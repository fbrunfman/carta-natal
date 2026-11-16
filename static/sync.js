// Sincronizar entre dispositivos. Cada dispositivo trabaja con lo suyo (las cartas en el navegador o en la compu) y,
// de fondo, sube sus cambios y baja los de los otros: nada espera a la red.
//
// Un **código** (20 letras y números, se crea una vez y se escribe en los otros dispositivos) es la llave: de él salen,
// en el dispositivo, una clave para cifrar (AES-GCM) y otra para firmar (HMAC). El código nunca viaja: el servidor ve
// el identificador del espacio (`sid`, una firma), una clave opaca por cosa, cuándo cambió y el texto cifrado.
//
// Qué viaja: cada carta (con sus notas y grupos) como `chart:<id>`, la configuración (`cfg`, sin el tamaño de la letra
// ni del mandala, que dependen de la pantalla) y las cartas fijadas (`pins`). Se detectan los cambios comparando una
// huella de cada cosa con la de la última sincronización; lo que se borra viaja como «borrado». Gana el cambio más
// nuevo; si una carta cambió en los dos lados, se juntan sus notas y sus grupos. Al conectar un dispositivo que ya
// tenía cartas, las que son la misma persona (misma fecha, hora y lugar) se unen en una sola.
import { charts, config } from "./api.js";
import { cleanNotes, NOTE_MAX, newId as newNoteId } from "./notes.js";

const KEY = "carta:sync";
const ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";       // sin I, O, 0 ni 1: no se confunden al escribirlo
const SALT = "carta-natal/sync/v1";
const ITER = 200000;
const PUSH_BYTES = 1_200_000;                          // por envío
const EVERY = 120_000;                                 // con la app a la vista, cada 2 minutos
const SOON = 2500;                                     // después de un cambio

const enc = new TextEncoder(), dec = new TextDecoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const b64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
/** JSON con las claves ordenadas: la misma cosa da la misma huella en cualquier dispositivo. */
const stable = (v) => (Array.isArray(v) ? `[${v.map(stable).join(",")}]`
  : v && typeof v === "object" ? `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`
  : JSON.stringify(v ?? null));
const sha = async (v) => hex(await crypto.subtle.digest("SHA-256", enc.encode(stable(v)))).slice(0, 32);

// ---- el código ----------------------------------------------------------------------------------------------------
export function newCode() {
  const r = crypto.getRandomValues(new Uint8Array(20));
  const s = [...r].map((b) => ALPH[b % 32]).join("");
  return s.match(/.{4}/g).join("-");
}
// Lo que se escribe o se pega: mayúsculas o minúsculas, con guiones, espacios o rayas (el celular cambia «-» por «—»), o
// pegado dentro de un texto («mi código es abcd-efgh-…»): se busca el código ahí adentro.
export function normCode(s) {
  let t = String(s || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const link = t.match(/#\/?SYNC=([^&\s]+)/);                        // el link para conectar: lo que va después de #sync=
  if (link) { try { t = decodeURIComponent(link[1]); } catch { t = link[1]; } }
  const m = t.match(/(?:^|[^A-Z0-9])([A-Z0-9]{4}(?:[\s\-\u2010-\u2015_.·]*[A-Z0-9]{4}){4})(?![A-Z0-9])/);
  return (m ? m[1] : t).replace(/[^A-Z0-9]/g, "");
}
export const codeOk = (s) => { const n = normCode(s); return n.length === 20 && [...n].every((c) => ALPH.includes(c)); };
/** Qué tiene de malo un código, para decirlo claro (null si está bien). */
export function codeProblem(s) {
  const n = normCode(s);
  if (!n) return "Escribí el código (20 letras y números, por ejemplo ABCD-EFGH-JKLM-NPQR-STUV).";
  const bad = [...new Set([...n].filter((c) => !ALPH.includes(c)))];
  if (bad.length) return `Los códigos no usan 0, O, 1 ni I, y acá hay ${bad.map((c) => `«${c}»`).join(", ")}: revisá esa letra.`;
  if (n.length < 20) return `Le ${20 - n.length === 1 ? "falta 1 letra o número" : `faltan ${20 - n.length} letras o números`}: tiene ${n.length} de 20.`;
  if (n.length > 20) return `Le ${n.length - 20 === 1 ? "sobra 1 letra o número" : `sobran ${n.length - 20} letras o números`}: tiene ${n.length} de 20.`;
  return null;
}
export const fmtCode = (s) => normCode(s).match(/.{1,4}/g)?.join("-") || "";

let keys = null;            // { code, aes, mac, sid }
async function getKeys(code) {
  const n = normCode(code);
  if (keys?.code === n) return keys;
  const base = await crypto.subtle.importKey("raw", enc.encode(n), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(SALT), iterations: ITER }, base, 512));
  const aes = await crypto.subtle.importKey("raw", bits.slice(0, 32), "AES-GCM", false, ["encrypt", "decrypt"]);
  const mac = await crypto.subtle.importKey("raw", bits.slice(32), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sid = hex(await crypto.subtle.sign("HMAC", mac, enc.encode("space")));
  keys = { code: n, aes, mac, sid };
  return keys;
}
const kCache = new Map();
async function itemKey(k, name) {
  const c = kCache.get(name);
  if (c && c[0] === k.sid) return c[1];
  const v = hex(await crypto.subtle.sign("HMAC", k.mac, enc.encode(`item:${name}`))).slice(0, 32);
  kCache.set(name, [k.sid, v]);
  return v;
}
async function seal(k, doc) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k.aes, enc.encode(JSON.stringify(doc))));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv); out.set(ct, 12);
  return b64(out);
}
async function open(k, v) {
  const raw = unb64(v);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(0, 12) }, k.aes, raw.slice(12));
  return JSON.parse(dec.decode(pt));
}

// ---- estado (en este dispositivo) ---------------------------------------------------------------------------------
// { code, since, items: { nombre: { h: huella, m: cuándo } }, last, err }
function loadState() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && typeof s.code === "string") return { since: 0, items: {}, ...s }; } catch {}
  return null;
}
function saveState(s) {
  try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch {}
}

async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) throw Object.assign(new Error(data.error || `No se pudo sincronizar (${res.status}).`), { status: res.status });
  return data;
}

// ---- unir dos copias de una carta -------------------------------------------------------------------------------
const fold = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ").trim();
const sameBirth = (a, b) => {
  if (String(a.date) !== String(b.date) || String(a.time) !== String(b.time)) return false;
  const pa = fold(a.place), pb = fold(b.place);
  if (pa && pb && pa === pb) return true;
  return Math.abs(+a.lat - +b.lat) < 0.02 && Math.abs(+a.lon - +b.lon) < 0.02;
};
/** `base` con las notas y los grupos de `other` que no tenga. */
function mergeChart(base, other) {
  const notes = cleanNotes(base.notes), texts = new Set(notes.map((n) => n.text.trim())), ids = new Set(notes.map((n) => n.id));
  for (const n of cleanNotes(other.notes)) {
    if (notes.length >= NOTE_MAX || texts.has(n.text.trim())) continue;
    const note = ids.has(n.id) ? { ...n, id: newNoteId() } : n;
    notes.push(note); texts.add(note.text.trim()); ids.add(note.id);
  }
  const groups = [], seen = new Set();
  for (const g of [...(base.groups || []), ...(other.groups || [])]) {
    const k = fold(g);
    if (typeof g === "string" && k && !seen.has(k) && groups.length < 12) { seen.add(k); groups.push(g); }
  }
  const out = { ...base };
  if (notes.length) out.notes = notes; else delete out.notes;
  if (groups.length) out.groups = groups; else delete out.groups;
  return out;
}

// ---- sincronizar ----------------------------------------------------------------------------------------------------
let host = null;            // lo que pone la app: ver initSync
let running = null, again = false, timer = 0, soonTimer = 0, avail = null;

/** Lo que hay en este dispositivo: nombre → dato. */
async function localItems() {
  const out = new Map();
  for (const c of (await charts.list()).charts) out.set(`chart:${c.id}`, c);
  out.set("cfg", host.getCfg());
  out.set("pins", host.getPins());
  return out;
}

async function run() {
  const st = loadState();
  if (!st) return;
  const k = await getKeys(st.code);
  st.items ||= {};
  // 1. bajar todo lo que llegó después de lo último que se vio
  const remote = [];
  let since = st.since || 0;
  for (;;) {
    const r = await post("/api/sync/pull", { sid: k.sid, since });
    remote.push(...r.items);
    since = r.seq;
    if (!r.more) break;
  }
  let local = await localItems();
  const changed = { charts: false, cfg: false, pins: false, merged: [] };
  const puts = [], dels = [];
  const firstJoin = !st.joined;
  const claimed = new Set();          // cartas locales ya unidas con una de afuera
  for (const it of remote) {
    let doc;
    try { doc = await open(k, it.v); } catch { continue; }            // no es de este código (o está dañado)
    const name = doc?.n;
    if (typeof name !== "string") continue;
    const e = st.items[name];
    if (e && it.m <= e.m) continue;                                     // ya lo tenía (o es más viejo)
    const cur = local.get(name);
    // ¿cambió acá y todavía no se subió? Al conectar, la configuración y las fijadas de este dispositivo no cuentan como
    // cambios: llegan las de los otros (si no, un dispositivo nuevo pisaría todo con lo de fábrica).
    const pending = cur !== undefined && (e ? (await sha(cur)) !== e.h : !(firstJoin && (name === "cfg" || name === "pins")));
    if (name.startsWith("chart:")) {
      const id = name.slice(6);
      if (doc.d === null) {                                             // la borraron en otro lado
        if (cur !== undefined && !pending) dels.push(id);
        st.items[name] = { h: "x", m: it.m };
        continue;
      }
      let rec = doc.d;
      if (pending) rec = mergeChart(cur, rec);                          // cambió en los dos lados: se juntan notas y grupos
      else if (cur === undefined && firstJoin) {
        // al conectar: la misma persona que ya estaba acá con otro id se une con la de afuera
        const twin = [...local.values()].find((c) => c?.id && !st.items[`chart:${c.id}`] && !claimed.has(c.id) && c.id !== id && sameBirth(c, rec));
        if (twin) { claimed.add(twin.id); rec = mergeChart(rec, twin); changed.merged.push([twin.id, id]); }
      }
      puts.push(rec);
      const mine = pending || changed.merged.some(([, to]) => to === id);   // hay algo de acá: después se sube
      st.items[name] = { h: mine ? "" : null, m: it.m };                 // la huella se toma después de guardar
    } else if (name === "cfg") {
      if (!pending) { host.setCfg(doc.d); changed.cfg = true; }
      st.items[name] = { h: pending ? "" : null, m: it.m };
    } else if (name === "pins") {
      if (!pending) { host.setPins(doc.d); changed.pins = true; }
      st.items[name] = { h: pending ? "" : null, m: it.m };
    }
  }
  // guardar lo que llegó
  for (let i = 0; i < puts.length; i += 40) await charts.put(puts.slice(i, i + 40));
  for (const [oldId] of changed.merged) { try { await charts.remove(oldId, true); } catch {} }
  for (const id of dels) { try { await charts.remove(id, true); } catch {} }
  if (changed.merged.length) host.remap(changed.merged);
  if (puts.length || dels.length || changed.merged.length) changed.charts = true;
  // huellas de lo que quedó guardado (lo que se unió o cambió en los dos lados queda «pendiente» y se sube)
  local = await localItems();
  for (const [name, e] of Object.entries(st.items)) {
    if (e.h === null) { const v = local.get(name); e.h = v === undefined ? "x" : await sha(v); }
  }
  // 2. subir lo que cambió acá (y lo borrado)
  const now = Date.now(), out = [];
  for (const [name, v] of local) {
    const h = await sha(v), e = st.items[name];
    if (!e || e.h !== h) out.push({ name, h, d: v });
  }
  for (const [name, e] of Object.entries(st.items)) {
    if (name.startsWith("chart:") && e.h !== "x" && !local.has(name)) out.push({ name, h: "x", d: null });
  }
  let batch = [], size = 0;
  const flush = async () => {
    if (!batch.length) return;
    const r = await post("/api/sync/push", { sid: k.sid, items: batch.map((b) => b.item) });
    const stale = new Set(r.stale || []);
    for (const b of batch) if (!stale.has(b.item.k)) st.items[b.name] = { h: b.h, m: b.item.m };
    batch = []; size = 0;
  };
  for (const o of out) {
    const item = { k: await itemKey(k, o.name), m: now, v: await seal(k, { n: o.name, d: o.d }) };
    if (batch.length && (size + item.v.length > PUSH_BYTES || batch.length >= 150)) await flush();
    batch.push({ name: o.name, h: o.h, item }); size += item.v.length;
  }
  await flush();
  st.since = since;
  st.joined = true;
  st.last = new Date().toISOString();
  delete st.err;
  saveState(st);
  if (changed.charts || changed.cfg || changed.pins) host.onRemote(changed);
  return { sent: out.length, got: remote.length };
}

/** Sincroniza ya (si ya está sincronizando, vuelve a hacerlo al terminar). */
export function syncNow() {
  if (!loadState() || !host) return Promise.resolve(null);
  if (running) { again = true; return running; }
  host.onState?.(state());
  running = (async () => {
    let res = null;
    try {
      do { again = false; res = await run(); } while (again);
    } catch (err) {
      const st = loadState();
      if (st) { st.err = err.message || String(err); saveState(st); }
    } finally {
      running = null;
      host.onState?.(state());
    }
    return res;
  })();
  return running;
}
export function syncSoon(ms = SOON) {
  if (!loadState()) return;
  clearTimeout(soonTimer);
  soonTimer = setTimeout(syncNow, ms);
}

/** Para la pantalla: si está prendida, cuándo fue la última vez, si hubo un error. */
export function state() {
  const st = loadState();
  return { available: avail, on: !!st, busy: !!running, code: st ? fmtCode(st.code) : "", last: st?.last || null, err: st?.err || null };
}

/** Prender con un código (nuevo o de otro dispositivo). Devuelve la primera sincronización. */
export async function connect(code) {
  const bad = codeProblem(code);
  if (bad) throw new Error(bad);
  saveState({ code: normCode(code), since: 0, items: {}, joined: false });
  kCache.clear();
  return syncNow();
}
/** Conectar con el código de otro dispositivo: primero se fija que haya algo con ese código (un error al escribirlo
 *  daría un espacio vacío nuevo y los dispositivos no se encontrarían). */
export async function join(code) {
  const bad = codeProblem(code);
  if (bad) throw new Error(bad);
  const k = await getKeys(code);
  const r = await post("/api/sync/pull", { sid: k.sid, since: 0 });
  if (!r.items.length) throw new Error("No encontré nada con ese código. Revisá que esté bien escrito (es el que muestra «Ver el código» en tu otro dispositivo).");
  return connect(code);
}
/** Apagar en este dispositivo: las cartas quedan acá; los otros dispositivos siguen como estaban. */
export function disconnect() {
  saveState(null);
  keys = null;
  kCache.clear();
  host?.onState?.(state());
}

/**
 * @param h.getCfg / setCfg   la configuración que viaja
 * @param h.getPins / setPins las cartas fijadas
 * @param h.remap([[viejo, nuevo]])  cartas unidas al conectar (para las fijadas, las recientes y la abierta)
 * @param h.onRemote(qué)     llegaron cambios: redibujar
 * @param h.onState(estado)   para la pantalla
 */
export async function initSync(h) {
  host = h;
  avail = !!(await config()).sync;
  host.onState?.(state());
  if (!avail) return;
  addEventListener("carta:changed", () => syncSoon());
  document.addEventListener("visibilitychange", () => { if (!document.hidden) syncSoon(300); });
  addEventListener("online", () => syncSoon(300));
  clearInterval(timer);
  timer = setInterval(() => { if (!document.hidden) syncNow(); }, EVERY);
  syncSoon(800);
}
