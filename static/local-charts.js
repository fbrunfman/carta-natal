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

const same = (a, b) => ["name", "date", "time", "lat", "lon", "tz"].every((k) => String(a[k]) === String(b[k])) &&
  (a.manual ? a.offset : null) === (b.manual ? b.offset : null);

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

  /** Suma las cartas de un archivo exportado. Las que ya están (mismos datos) se saltean. */
  async importData(obj) {
    const incoming = Array.isArray(obj) ? obj : obj?.charts;
    if (!Array.isArray(incoming)) throw new Error("Ese archivo no parece una exportación de cartas.");
    const list = read();
    let added = 0, skipped = 0, failed = 0;
    for (let i = 0; i < incoming.length; i += 50) {
      const chunk = incoming.slice(i, i + 50);
      const res = await validate({ items: chunk });
      for (const r of res.items) {
        if (!r.chart) { failed++; continue; }
        if (list.some((c) => same(c, r.chart))) { skipped++; continue; }
        if (list.length >= MAX_CHARTS) { failed++; continue; }
        list.push({ ...r.chart, id: newId(), created: now(), updated: now() });
        added++;
      }
    }
    if (added) write(list);
    return { added, skipped, failed };
  },
};
