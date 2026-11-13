// Notas de una carta natal. Cada carta guarda una lista de notas; cada nota es un texto libre con sus vínculos: a qué de la
// carta se refiere (planetas en su casa y su signo, casas, el Ascendente, el Medio Cielo, aspectos). Una nota sin vínculos
// es sobre la carta en general. Con cada vínculo se guarda una foto de lo que había en la carta cuando se vinculó, para
// avisar si después cambió (se corrigió la hora, por ejemplo). Sin DOM: se prueba en node.
//
// Vínculos: "asc" · "mc" · "pl:<planeta>" · "house:<1..12>" · "asp:<a>|<b>" (un aspecto que tiene la carta, ids en orden
// alfabético: «Luna–Saturno» y «Saturno–Luna» son el mismo).
//
// detectRefs() lee el texto (en castellano) y propone vínculos: «Sol en I en Aries», «cuadratura con la Luna y con Marte
// en IV», «ascendente en Piscis». Solo propone lo que existe en la carta; si el texto dice otra cosa (Marte en III cuando
// está en la IV), lo propone igual con un aviso.

const ID = /^[a-z]{2,10}$/;
export const NOTE_MAX = 150;
export const NOTE_TEXT = 5000;
export const REF_MAX = 24;

export const keyPl = (id) => `pl:${id}`;
export const keyAsp = (a, b) => `asp:${[a, b].sort().join("|")}`;
export const keyHouse = (n) => `house:${n}`;

/** Qué es un vínculo: { kind: "angle" | "pl" | "house" | "asp", ids: [...], n? } o null si no es válido. */
export function parseKey(key) {
  if (key === "asc" || key === "mc") return { kind: "angle", ids: [key] };
  const s = String(key || "");
  let m = /^house:(\d{1,2})$/.exec(s);
  if (m) { const n = +m[1]; return n >= 1 && n <= 12 && String(n) === m[1] ? { kind: "house", ids: [], n } : null; }
  m = /^(pl|asp):(.+)$/.exec(s);
  if (!m) return null;
  const ids = m[2].split("|");
  if (ids.length !== (m[1] === "pl" ? 1 : 2) || !ids.every((x) => ID.test(x))) return null;
  if (m[1] === "asp" && (ids[0] >= ids[1])) return null;     // en orden y distintos
  return { kind: m[1], ids };
}

const signOf = (lon) => Math.floor((((lon % 360) + 360) % 360) / 30);

/** El aspecto entre dos cuerpos, de la lista de la carta (en cualquier orden), o null. */
export function aspectBetween(aspects, a, b) {
  return aspects.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a)) || null;
}

/** ¿Ese vínculo existe en la carta? (un aspecto que la carta no tiene, o un planeta que no está, no se puede vincular) */
export function refExists(key, chart, aspects) {
  const k = parseKey(key);
  if (!k) return false;
  if (k.kind === "angle" || k.kind === "house") return true;
  if (k.kind === "pl") return chart.bodies.some((b) => b.id === k.ids[0]);
  return !!aspectBetween(aspects, ...k.ids);
}

/** Lo que hay en la carta para ese vínculo (la foto que se guarda con él). */
export function snapOf(key, chart, aspects) {
  const k = parseKey(key);
  if (!k) return {};
  if (k.kind === "angle") return { sign: signOf(chart.angles[k.ids[0]]) };
  if (k.kind === "house") return { sign: signOf(chart.houses.cusps[k.n - 1]) };
  if (k.kind === "pl") {
    const b = chart.bodies.find((x) => x.id === k.ids[0]);
    return b ? { sign: signOf(b.lon), house: b.house } : {};
  }
  const x = aspectBetween(aspects, ...k.ids);
  return x ? { type: x.type } : {};
}

/**
 * Si la carta ya no es como cuando se vinculó (se corrigió la hora, por ejemplo): qué cambió.
 * @returns null si nada, o { was: foto, now: foto }
 */
export function changeOf(key, snap, chart, aspects) {
  const was = snap || {};
  if (!Object.keys(was).length) return null;
  const now = snapOf(key, chart, aspects);
  for (const f of ["sign", "house", "type"]) {
    if (f in was && was[f] !== now[f]) return { was, now };
  }
  return null;
}

/** Un id corto para una nota nueva. */
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const ISO = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z?$/;
const isoNow = () => new Date().toISOString().replace(/\.\d+Z$/, "Z");
function cleanSnap(s) {
  const out = {};
  if (!s || typeof s !== "object") return out;
  if (Number.isInteger(s.sign) && s.sign >= 0 && s.sign <= 11) out.sign = s.sign;
  if (Number.isInteger(s.house) && s.house >= 1 && s.house <= 12) out.house = s.house;
  if (typeof s.type === "string" && /^[a-z]{2,16}$/.test(s.type)) out.type = s.type;
  return out;
}

/**
 * Las notas de antes (un objeto { vínculo: { text, at, snap } }, una sola por cosa) pasan a la lista: cada una, una nota
 * con ese vínculo («general» queda sin vínculos; una figura de tres, con sus tres aspectos).
 */
function fromLegacy(obj) {
  const out = [];
  let i = 0;
  for (const [k, v] of Object.entries(obj)) {
    if (!v || typeof v !== "object") continue;
    const note = { id: `m${i++}`, text: v.text, at: v.at, refs: [], snap: {} };
    const s = v.snap && typeof v.snap === "object" ? v.snap : {};
    const fig = /^fig:([a-z]{2,10})\|([a-z]{2,10})\|([a-z]{2,10})$/.exec(k);
    if (fig) {
      const [a, b, c] = fig.slice(1);
      [[a, b], [a, c], [b, c]].forEach(([x, y], j) => {
        const key = keyAsp(x, y);
        note.refs.push(key);
        if (Array.isArray(s.types) && typeof s.types[j] === "string") note.snap[key] = { type: s.types[j] };
      });
    } else if (k !== "general") {
      const key = /^asp:/.test(k) ? keyAsp(...k.slice(4).split("|")) : k;
      note.refs.push(key);
      note.snap[key] = s;
    }
    out.push(note);
  }
  return out;
}

/** Valida las notas (las que vienen de un archivo, o antes de guardar): mismas reglas que el servidor. Siempre devuelve una lista. */
export function cleanNotes(data) {
  let list = data;
  if (data && typeof data === "object" && !Array.isArray(data)) list = fromLegacy(data);
  if (!Array.isArray(list)) return [];
  const out = [], seen = new Set();
  for (const v of list) {
    if (out.length >= NOTE_MAX) break;
    if (!v || typeof v !== "object" || typeof v.text !== "string") continue;
    // (Plutón con su símbolo astrológico: el «PL» de antes, ♇, pasa a ⯓)
    const text = v.text.trim() ? v.text.slice(0, NOTE_TEXT).replace(/♇/g, "⯓") : "";
    if (!text) continue;
    let id = typeof v.id === "string" && /^[a-z0-9]{2,16}$/.test(v.id) ? v.id : newId();
    while (seen.has(id)) id = newId();
    seen.add(id);
    const at = typeof v.at === "string" && ISO.test(v.at) ? v.at : isoNow();
    const refs = [], snap = {};
    for (const r of Array.isArray(v.refs) ? v.refs : []) {
      if (refs.length >= REF_MAX) break;
      if (typeof r !== "string" || !parseKey(r) || refs.includes(r)) continue;
      refs.push(r);
      const s = cleanSnap(v.snap?.[r]);
      if (Object.keys(s).length) snap[r] = s;
    }
    out.push({ id, text, at, refs, snap });
  }
  return out;
}

/**
 * Las casas de un planeta: la suya y, con la lógica de «Entre casas» (chart.house_reach, con los orbes de Reglas avanzadas),
 * también la que sigue si está cerca de su cúspide. [] si el planeta no está en la carta.
 */
export function housesOf(chart, id) {
  const b = chart?.bodies?.find((x) => x.id === id);
  if (!b) return [];
  const r = (chart.house_reach || []).find((x) => x.id === id);
  return r && r.also !== b.house ? [b.house, r.also] : [b.house];
}

/** Cuántas notas con texto tiene una carta guardada. */
export const noteCount = (notes) => (Array.isArray(notes) ? notes.filter((n) => n && n.text && n.text.trim()).length : 0);

/**
 * ¿La nota toca eso? Lo vincula, o (para un planeta) vincula un aspecto suyo, o (para una casa) vincula un planeta que está
 * en esa casa, también con la lógica de «Entre casas». Así el filtro «casa IV» encuentra también «Marte en IV» y, si Marte
 * está al final de la III cerca de la cúspide de la IV, también las notas de Marte.
 */
export function touches(note, key, chart) {
  const refs = note?.refs || [];
  if (refs.includes(key)) return true;
  const k = parseKey(key);
  if (!k) return false;
  if (k.kind === "pl") return refs.some((r) => r.startsWith("asp:") && r.slice(4).split("|").includes(k.ids[0]));
  if (k.kind === "house" && chart) {
    return refs.some((r) => r.startsWith("pl:") && housesOf(chart, r.slice(3)).includes(k.n));
  }
  return false;
}

// ---------------------------------------------------------------------------------------------------------------------
// Leer el texto y proponer vínculos

const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const PLANET_W = { sol: "sun", luna: "moon", mercurio: "mercury", venus: "venus", marte: "mars", jupiter: "jupiter", saturno: "saturn", urano: "uranus", neptuno: "neptune", pluton: "pluto" };
const SIGN_W = { aries: 0, tauro: 1, geminis: 2, cancer: 3, leo: 4, virgo: 5, libra: 6, escorpio: 7, escorpion: 7, sagitario: 8, capricornio: 9, acuario: 10, piscis: 11 };
const ORD_W = {
  primera: 1, primer: 1, primero: 1, segunda: 2, segundo: 2, tercera: 3, tercer: 3, tercero: 3, cuarta: 4, cuarto: 4,
  quinta: 5, quinto: 5, sexta: 6, sexto: 6, septima: 7, setima: 7, septimo: 7, octava: 8, octavo: 8, novena: 9, noveno: 9,
  decima: 10, decimo: 10, undecima: 11, onceava: 11, decimoprimera: 11, duodecima: 12, doceava: 12, decimosegunda: 12,
};
const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12 };
const ASP_W = [
  [/^semicuadratur/, "semisquare"], [/^sesquicuadratur/, "sesquiquadrate"], [/^conjunci|^conjunt/, "conjunction"],
  [/^oposici|^opuest|^opone|^oponi/, "opposition"], [/^cuadratur|^cuadrad/, "square"], [/^trigon/, "trine"],
  [/^sextil/, "sextile"], [/^quincunci|^inconjunci/, "quincunx"], [/^aspect/, "any"],
];
// palabras que pueden ir entre un planeta y su casa o su signo («Sol en la casa I», «Luna, ubicada en Cáncer»)
const FILL = new Set(["en", "la", "el", "de", "del", "su", "signo", "ubicado", "ubicada", "situado", "situada", "que", "esta", "se", "encuentra", "cae", "y", "e"]);
// entre dos planetas que comparten casa o signo («la Luna y Marte en IV», «con la Luna y con Marte en IV»)
const JOIN = new Set(["y", "e", "con", "la", "el", "a", ","]);
const PREP = new Set(["en", "la", "de", "del", "a", "casa", "casas"]);

function houseNum(tok) {
  if (!tok) return 0;
  if (ROMAN[tok.raw]) return ROMAN[tok.raw];
  const d = /^(\d{1,2})(?:ra|da|ta|va|na|ma|a|o|º|ª)?$/.exec(tok.w);
  if (d && +d[1] >= 1 && +d[1] <= 12) return +d[1];
  return ORD_W[tok.w] || 0;
}

// los símbolos (con o sin el selector de variante que los muestra como texto y no como emoji)
const VS = "︎";
// Plutón con el símbolo astrológico (⯓, el círculo sobre la medialuna y la cruz), no el «PL» (♇), que también se entiende
const PLANET_G = { sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂", jupiter: "♃", saturn: "♄", uranus: "♅", neptune: "♆", pluto: "⯓", node: "☊" };
const SIGN_G = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];
const ASP_G = { conjunction: "☌", opposition: "☍", square: "□", trine: "△", sextile: "⚹", quincunx: "⚻", semisquare: "∠", sesquiquadrate: "⚼" };
const G_PLANET = Object.fromEntries(Object.entries(PLANET_G).map(([k, g]) => [g, k]));
G_PLANET["☾"] = "moon";
G_PLANET["♇"] = "pluto";
const G_ASP = Object.fromEntries(Object.entries(ASP_G).map(([k, g]) => [g, k]));
const GLYPHS = [...Object.keys(G_PLANET), ...SIGN_G, ...Object.keys(G_ASP)].join("");
// los sustantivos de los aspectos (lo que se puede pasar a símbolo; «conjunta», «opuesto»… quedan como están)
const ASP_NOUN = { conjuncion: "conjunction", oposicion: "opposition", cuadratura: "square", trigono: "trine", sextil: "sextile", quincuncio: "quincunx", semicuadratura: "semisquare", sesquicuadratura: "sesquiquadrate" };
// después de un número suelto, palabras que dicen que no es una casa («en 3 días», «en 2 grados»)
const UNITS = new Set(["grados", "grado", "minutos", "segundos", "dias", "dia", "anos", "ano", "meses", "mes", "horas", "hora", "semanas", "veces", "de", "por"]);
const ROMAN_OF = (n) => Object.keys(ROMAN).find((k) => ROMAN[k] === n);

/**
 * Las palabras del texto, con lo que quiere decir cada una para la carta. Cada una con dónde está (at, end) y, si se
 * puede escribir con un símbolo o en romanos, cómo (sym).
 */
function entities(text) {
  const toks = [];
  const re = new RegExp(`[\\p{L}\\p{N}°ºª]+|[${GLYPHS}][\\uFE0E\\uFE0F]?|[.;:!?\\n]|,|[-–—/]`, "gu");
  for (const m of String(text).matchAll(re)) toks.push({ raw: m[0], w: fold(m[0].replace(/[︎️]/g, "")), at: m.index, end: m.index + m[0].length });
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i], prev = toks[i - 1]?.w, next = toks[i + 1];
    const push = (e, used = 0) => { out.push({ ...e, at: t.at, end: toks[i + used].end }); i += used; };
    const g = t.raw[0];
    if (G_PLANET[g]) { push({ t: "pl", id: G_PLANET[g], sym: g === "♇" ? PLANET_G.pluto + VS : null }); continue; }
    if (SIGN_G.includes(g)) { push({ t: "sign", n: SIGN_G.indexOf(g) }); continue; }
    if (G_ASP[g]) { push({ t: "asp", type: G_ASP[g] }); continue; }
    if (/^[.;:!?\n]$/.test(t.raw)) { push({ t: "end" }); continue; }
    if (t.raw === ",") { push({ t: "w", w: "," }); continue; }
    if (/^[-–—/]$/.test(t.raw)) { push({ t: "dash" }); continue; }
    if (PLANET_W[t.w]) { push({ t: "pl", id: PLANET_W[t.w], sym: PLANET_G[PLANET_W[t.w]] + VS }); continue; }
    if (t.w === "nodo" || t.w === "nn") { push({ t: "pl", id: "node", sym: next?.w === "norte" ? PLANET_G.node + VS : null }, next?.w === "norte" ? 1 : 0); continue; }
    if (t.w === "ascendente" || t.w === "asc") { push({ t: "angle", id: "asc", sym: t.w === "asc" ? null : "Asc" }); continue; }
    if (t.w === "mediocielo" || t.w === "mc" || (t.w === "medio" && next?.w === "cielo")) { push({ t: "angle", id: "mc", sym: t.w === "mc" ? null : "MC" }, t.w === "medio" ? 1 : 0); continue; }
    // «Leo» y «Libra» también son palabras comunes («leo mucho»): esos, solo después de «en», «de», «y» o de otro signo
    const after = prev === "en" || prev === "de" || ((prev === "y" || prev === "e" || prev === "o") && out.length > 1 && out[out.length - 2]?.t === "sign");
    if (t.w in SIGN_W && ((t.w === "leo" || t.w === "libra") ? after || prev === "en" || prev === "de" : /^\p{Lu}/u.test(t.raw) || after)) { push({ t: "sign", n: SIGN_W[t.w], sym: SIGN_G[SIGN_W[t.w]] + VS }); continue; }
    if (t.w === "casa" || t.w === "casas") {
      // «casa IV», «casa 4», «casa cuarta», «casas IV y X»
      let j = i + 1, any = false;
      while (j < toks.length) {
        const n = houseNum(toks[j]);
        if (n) { out.push({ t: "house", n, at: toks[j].at, end: toks[j].end, sym: ROMAN[toks[j].raw] ? null : ROMAN_OF(n) }); any = true; j++; }
        else if (any && (toks[j].w === "y" || toks[j].w === "e" || toks[j].raw === ",") && houseNum(toks[j + 1])) j++;
        else break;
      }
      if (any) { i = j - 1; continue; }
      out.push({ t: "w", w: t.w, at: t.at, end: t.end });
      continue;
    }
    // «cuarta casa», «5ta casa» → «casa IV», «casa V»
    if ((ORD_W[t.w] || (/^\d/.test(t.w) && houseNum(t))) && next?.w === "casa") { push({ t: "house", n: houseNum(t), sym: `${next.raw} ${ROMAN_OF(houseNum(t))}` }, 1); continue; }
    if (ROMAN[t.raw] && (PREP.has(prev) || t.raw.length >= 2) && !(t.raw.length === 1 && !PREP.has(prev))) { push({ t: "house", n: ROMAN[t.raw] }); continue; }
    // «Marte en 4», «en la 12»: un número suelto (que no sea «en 3 días»)
    if (/^\d{1,2}$/.test(t.w) && +t.w >= 1 && +t.w <= 12 && (prev === "en" || prev === "la") && !UNITS.has(next?.w)) {
      push({ t: "house", n: +t.w, sym: ROMAN_OF(+t.w) });
      continue;
    }
    const asp = ASP_W.find(([r]) => r.test(t.w));
    if (asp) { push({ t: "asp", type: asp[1], sym: ASP_NOUN[t.w] ? ASP_G[ASP_NOUN[t.w]] : null }); continue; }
    push({ t: "w", w: t.w });
  }
  return out;
}

/**
 * El texto con los símbolos en lugar de los nombres (Sol → ☉, Aries → ♈, cuadratura → □, Ascendente → Asc,
 * Medio Cielo → MC) y las casas en números romanos («casa 12» → «casa XII», «Marte en 4» → «Marte en IV»).
 */
export function toSymbols(text) {
  let out = String(text);
  const reps = entities(out).filter((e) => e.sym);
  for (const e of reps.sort((a, b) => b.at - a.at)) out = out.slice(0, e.at) + e.sym + out.slice(e.end);
  return out;
}

/**
 * Los vínculos que el texto nombra y existen en la carta, en el orden en que aparecen.
 * @returns [{ key, warn }] (warn: "" o qué dice distinto el texto, p. ej. «el texto dice casa III; en la carta está en la IV»)
 */
export function detectRefs(text, chart, aspects, names = {}) {
  const E = entities(text);
  const found = new Map();
  const add = (key, at, warn = "") => {
    if (!refExists(key, chart, aspects)) return;
    const f = found.get(key);
    if (!f) found.set(key, { key, at, warn });
    else if (!f.warn && warn) f.warn = warn;
  };
  const SIGNS = names.signs || [];
  const signName = (n) => SIGNS[n] || `signo ${n + 1}`;
  const roman = (n) => Object.keys(ROMAN).find((k) => ROMAN[k] === n);
  const typeName = (t) => names.aspects?.[t] || t;

  // lo que el texto dice de cada planeta o ángulo: su casa y su signo
  const claims = E.map(() => null);
  for (let i = 0; i < E.length; i++) {
    if (E[i].t !== "pl" && E[i].t !== "angle") continue;
    const c = {};
    for (let j = i + 1, words = 0; j < E.length && words < 6; j++) {
      const e = E[j];
      if (e.t === "house" && !("house" in c)) c.house = e.n;
      else if (e.t === "sign" && !("sign" in c)) c.sign = e.n;
      else if (e.t === "w" && FILL.has(e.w)) words++;
      else break;
    }
    claims[i] = c;
  }
  // «la Luna y Marte en IV»: el que va antes comparte lo que se dice del que sigue
  for (let i = E.length - 1; i >= 0; i--) {
    if (E[i].t !== "pl" || Object.keys(claims[i]).length) continue;
    let j = i + 1;
    while (j < E.length && E[j].t === "w" && JOIN.has(E[j].w)) j++;
    if (j > i + 1 && E[j]?.t === "pl" && Object.keys(claims[j]).length) claims[i] = claims[j];
  }

  for (let i = 0; i < E.length; i++) {
    const e = E[i], c = claims[i];
    if (e.t === "pl") {
      const b = chart.bodies.find((x) => x.id === e.id);
      if (!b) continue;
      const bits = [];
      // la casa que dice el texto vale si es la suya o, con la lógica de «Entre casas», la que sigue
      const hs = housesOf(chart, e.id);
      if ("house" in c && !hs.includes(c.house)) {
        bits.push(`el texto dice casa ${roman(c.house)}; en la carta está en la ${roman(b.house)}${hs.length > 1 ? ` (y entre casas, en la ${roman(hs[1])})` : ""}`);
      }
      if ("sign" in c && c.sign !== signOf(b.lon)) bits.push(`el texto dice ${signName(c.sign)}; en la carta está en ${signName(signOf(b.lon))}`);
      add(keyPl(e.id), e.at, bits.join(" · "));
    } else if (e.t === "angle") {
      const s = signOf(chart.angles[e.id]);
      add(e.id, e.at, "sign" in c && c.sign !== s ? `el texto dice ${signName(c.sign)}; en la carta es ${signName(s)}` : "");
    } else if (e.t === "house") {
      add(keyHouse(e.n), e.at);
    }
  }

  // aspectos: en cada oración, la palabra del aspecto con los planetas de antes y de después
  const sentences = [[]];
  E.forEach((e, i) => { if (e.t === "end") sentences.push([]); else sentences[sentences.length - 1].push(i); });
  const pairAt = (a, b, type, at) => {
    if (a === b) return false;
    const x = aspectBetween(aspects, a, b);
    if (!x) return false;
    add(keyAsp(a, b), at, type !== "any" && x.type !== type ? `el texto dice ${typeName(type)}; en la carta es ${typeName(x.type)}` : "");
    return true;
  };
  for (const S of sentences) {
    const asps = S.filter((i) => E[i].t === "asp");
    for (const k of asps) {
      const type = E[k].type, at = E[k].at;
      const nextAsp = asps.find((x) => x > k) ?? Infinity;
      const before = S.filter((i) => i < k && E[i].t === "pl").reverse().map((i) => E[i].id);   // el más cercano primero
      const after = S.filter((i) => i > k && i < nextAsp && E[i].t === "pl").map((i) => E[i].id);
      const nxt = S.find((i) => i > k);
      const entre = nxt !== undefined && E[nxt].t === "w" && E[nxt].w === "entre";
      if (!after.length) {                       // «Sol y Luna en cuadratura»
        if (before.length >= 2) pairAt(before[1], before[0], type, at);
        continue;
      }
      if (entre || !before.length) {             // «la cuadratura entre Sol y Luna», «la cuadratura Sol-Luna»
        for (const o of after.slice(1)) pairAt(after[0], o, type, at);
        continue;
      }
      for (const o of after) {                   // «Sol … cuadratura con la Luna y con Marte»
        const same = before.find((s) => aspectBetween(aspects, s, o)?.type === type);
        const any = before.find((s) => s !== o && aspectBetween(aspects, s, o));
        if (same) pairAt(same, o, type, at);
        else if (any) pairAt(any, o, type, at);
      }
    }
    // «Sol-Luna», «Sol/Luna»
    for (let n = 0; n + 2 < S.length; n++) {
      const [a, d, b] = [E[S[n]], E[S[n + 1]], E[S[n + 2]]];
      if (a.t === "pl" && d.t === "dash" && b.t === "pl") pairAt(a.id, b.id, "any", a.at);
    }
  }
  return [...found.values()].sort((x, y) => x.at - y.at).map(({ key, warn }) => ({ key, warn }));
}
