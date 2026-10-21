// Cliente de la API: cartas guardadas (en el servidor local, o en el navegador si es la versión pública) y cálculos.
import { localCharts } from "./local-charts.js";

const JSON_HEADERS = { "Content-Type": "application/json" };

async function call(url, options) {
  const res = await fetch(url, options);
  let data = {};
  try { data = await res.json(); } catch { /* respuesta sin cuerpo */ }
  if (!res.ok) throw new Error(data.error || "No se pudo completar la operación.");
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

export const compute = {
  chart: (natal) => post("/api/chart", natal),
  transits: (natal, at) => post("/api/transits", { natal, at }),
  synastry: (a, b) => post("/api/synastry", { a, b }),
  calendar: (natal, start, months, scope) => post("/api/transit-calendar", { natal, start, months, scope }),
};
