import { cleanNotes, NOTE_MAX, newId as newNoteId } from "./notes.js";

// Cartas guardadas en el navegador (versión pública): cada persona guarda las suyas acá y no pasan por el
// servidor. Misma forma que las del servidor local, para que el resto de la app no note la diferencia.
const KEY = "carta:charts";
const MAX_CHARTS = 300;
const ID = /^[0-9a-f]{12}$/;

const NOTE_OK = "Tus cartas se guardan solo en este navegador: no se envían al servidor. Si borrás los datos del sitio se pierden; exportalas para tener una copia.";
const NOTE_MEM = "Este navegador no deja guardar datos del sitio (¿navegación privada?): las cartas se pierden al cerrar la pestaña. Exportalas para no perderlas.";

let memory = null;       // si localStorage no anda, las cartas viven acá hasta que se cierre la página

const isRecord = (c) => c && typeof c === "object" && ID.test(c.id || "") && typeof c.name === "string" &&
  typeof c.date === "string" && typeof c.time === "string" && Number.isFinite(+c.lat) && Number.isFinite(+c.lon);

function read() {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw)?.charts;
    return Array.isArray(list) ? list.filter(isRecord) : [];
  } catch {
    return [];       // dato dañado o almacenamiento bloqueado: se arranca vacío en vez de romper la página
  }
}

function write(list) {
  if (!memory) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: 1, charts: list }));
      return;
    } catch {
      memory = list;                     // sin espacio o bloqueado: se sigue en memoria
      return;
    }
  }
  memory = list;
}

const newId = () => {
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
};
const now = () => new Date().toISOString().replace(/\.\d+Z$/, "Z");

async function validate(body) {
  const res = await fetch("/api/validate-chart", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let data = {};
  try { data = await res.json(); } catch { /* sin cuerpo */ }
  if (!res.ok) throw new Error(data.error || "No se pudo completar la operación.");
  return data;
}

// Al importar, ¿es la misma carta? Misma fecha, misma hora y misma ciudad (el lugar con el mismo nombre, o casi las
// mismas coordenadas). El nombre no cuenta: la misma persona puede venir con otro nombre.
const fold = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ").trim();
export const sameBirth = (a, b) => {
  if (String(a.date) !== String(b.date) || String(a.time) !== String(b.time)) return false;
  const pa = fold(a.place), pb = fold(b.place);
  if (pa && pb && pa === pb) return true;
  return Math.abs(+a.lat - +b.lat) < 0.02 && Math.abs(+a.lon - +b.lon) < 0.02;
};
/** Suma a las notas de una carta las de otra copia de ella (las que no tiene ya, con el mismo texto). */
export function mergeNotes(old, incoming) {
  const have = cleanNotes(old), add = cleanNotes(incoming);
  const texts = new Set(have.map((n) => n.text.trim())), ids = new Set(have.map((n) => n.id));
  let added = 0;
  for (const n of add) {
    if (have.length >= NOTE_MAX) break;
    if (texts.has(n.text.trim())) continue;
    const note = ids.has(n.id) ? { ...n, id: newNoteId() } : n;
    have.push(note); texts.add(note.text.trim()); ids.add(note.id);
    added++;
  }
  return { notes: have, added };
}

export const localCharts = {
  async list() {
    return { charts: read(), note: memory ? NOTE_MEM : NOTE_OK };
  },

  async create(body) {
    const list = read();
    if (list.length >= MAX_CHARTS) throw new Error(`Podés guardar hasta ${MAX_CHARTS} cartas en este navegador.`);
    const rec = { ...(await validate(body)), id: newId(), created: now(), updated: now() };
    write([...list, rec]);
    return rec;
  },

  async update(id, body) {
    const list = read();
    const old = list.find((c) => c.id === id);
    if (!old) throw new Error("Esa carta ya no existe.");
    const rec = { ...(await validate(body)), id, created: old.created || now(), updated: now() };
    if (old.notes && Object.keys(old.notes).length) rec.notes = old.notes;      // cambiar los datos no borra las notas
    write(list.map((c) => (c.id === id ? rec : c)));
    return rec;
  },

  /** Reemplaza las notas de una carta (no pasan por el servidor). */
  async setNotes(id, notes) {
    const list = read();
    const old = list.find((c) => c.id === id);
    if (!old) throw new Error("Esa carta ya no existe.");
    const clean = cleanNotes(notes);
    const rec = { ...old };
    if (Object.keys(clean).length) rec.notes = clean; else delete rec.notes;
    write(list.map((c) => (c.id === id ? rec : c)));
    return rec;
  },

  async remove(id) {
    const list = read();
    if (!list.some((c) => c.id === id)) throw new Error("Esa carta ya no existe.");
    write(list.filter((c) => c.id !== id));
    return { ok: true };
  },

  /** Copia de seguridad: un archivo JSON con todas las cartas. */
  exportData() {
    return { app: "carta-natal", version: 1, exported: now(), charts: read() };
  },

  /**
   * Suma las cartas de un archivo exportado. Si una ya está (misma fecha, hora y ciudad, aunque tenga otro nombre), no
   * se duplica: se le suman las notas que trae y no tiene.
   */
  async importData(obj) {
    const incoming = Array.isArray(obj) ? obj : obj?.charts;
    if (!Array.isArray(incoming)) throw new Error("Ese archivo no parece una exportación de cartas.");
    const list = read();
    let added = 0, updated = 0, skipped = 0, failed = 0, notesAdded = 0;
    for (let i = 0; i < incoming.length; i += 50) {
      const chunk = incoming.slice(i, i + 50);
      // las notas no viajan al servidor: se validan los datos de nacimiento y las notas se suman acá
      const res = await validate({ items: chunk.map((c) => (c && typeof c === "object" ? { ...c, notes: undefined } : c)) });
      res.items.forEach((r, j) => {
        if (!r.chart) { failed++; return; }
        const twin = list.find((c) => sameBirth(c, r.chart));
        if (twin) {
          const m = mergeNotes(twin.notes, chunk[j]?.notes);
          if (m.added) { twin.notes = m.notes; twin.updated = now(); updated++; notesAdded += m.added; } else skipped++;
          return;
        }
        if (list.length >= MAX_CHARTS) { failed++; return; }
        const notes = cleanNotes(chunk[j]?.notes);
        list.push({ ...r.chart, ...(Object.keys(notes).length ? { notes } : {}), id: newId(), created: now(), updated: now() });
        added++;
      });
    }
    if (added || updated) write(list);
    return { added, updated, skipped, failed, notes: notesAdded };
  },
};
