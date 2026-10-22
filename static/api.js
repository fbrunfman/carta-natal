// Cliente de la API: cartas guardadas (en el servidor local, o en el navegador si es la versión pública) y cálculos.
import { localCharts } from "./local-charts.js";

const JSON_HEADERS = { "Content-Type": "application/json" };

async function call(url, options) {
  const res = await fetch(url, options);
  let data = {};
  try { data = await res.json(); } catch { /* respuesta sin cuerpo */ }
  if (!res.ok) throw Object.assign(new Error(data.error || "No se pudo completar la operación."), { status: res.status });
  return data;
}

// ¿Es la versión alojada en internet? Lo dice el servidor. Allá las cartas guardadas viven en el navegador.
let cfg = null;
export async function config() {
  if (cfg) return cfg;
  try {
    const j = await (await fetch("/api/ping")).json();
    cfg = { public: !!j.public };
  } catch {
    return { public: false };       // sin servidor: no se recuerda, se vuelve a preguntar
  }
  return cfg;
}
export const isPublic = () => !!cfg?.public;

const remote = {
  list: () => call("/api/charts"),
  create: (body) => call("/api/charts", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) }),
  update: (id, body) => call(`/api/charts/${id}`, { method: "PUT", headers: JSON_HEADERS, body: JSON.stringify(body) }),
  remove: (id) => call(`/api/charts/${id}`, { method: "DELETE" }),
};

const store = async () => ((await config()).public ? localCharts : remote);
export const charts = {
  list: async () => (await store()).list(),
  create: async (body) => (await store()).create(body),
  update: async (id, body) => (await store()).update(id, body),
  remove: async (id) => (await store()).remove(id),
};

// Cálculos que viajan como JSON (los datos de nacimiento no van en la URL).
const post = (url, body) => call(url, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) });

// Un servidor local de una versión anterior (que seguía abierto al actualizar los archivos) no conoce la Luna:
// en vez de «No encontrado», se dice qué hacer. En la versión pública el servidor y la página se actualizan juntos.
const staleServer = (err) => {
  if (err.status !== 404 || isPublic()) throw err;
  throw Object.assign(new Error("El servidor de la app es de una versión anterior. Cerrá la ventana de Carta natal, esperá unos segundos y volvé a abrirla."), { status: 404 });
};

export const compute = {
  chart: async (natal) => {
    try {
      return await post("/api/chart", natal);
    } catch (err) {
      // Un servidor local de una versión anterior (que seguía abierto al actualizar los archivos) no conoce el
      // pedido POST: se pide como antes, por la URL. En la versión pública esa ruta no existe y no se usa.
      if (err.status !== 404 || isPublic()) throw err;
      const qs = new URLSearchParams({ name: natal.name, place: natal.place, date: natal.date, time: natal.time,
        lat: natal.lat, lon: natal.lon, tz: natal.tz, hsys: natal.hsys, node: natal.node });
      if (natal.offset !== undefined) qs.set("offset", natal.offset);
      return call(`/api/chart?${qs}`);
    }
  },
  transits: (natal, at) => post("/api/transits", { natal, at }),
  featured: (natal, at) => post("/api/featured", { natal, at }),
  upcoming: (natal, at, days) => post("/api/upcoming", { natal, at, days }),
  synastry: (a, b) => post("/api/synastry", { a, b }),
  moon: (tz) => post("/api/moon", { tz }).catch(staleServer),
  moonMonth: (year, month, tz) => post("/api/moon-calendar", { year, month, tz }).catch(staleServer),
  calendar: (natal, start, months, scope) => post("/api/transit-calendar", { natal, start, months, scope }),
};
