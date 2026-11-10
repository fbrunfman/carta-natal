// Configuración de la vista: estilo de los gráficos, tipo y tamaño de letra, tamaño del mandala, tinte por
// elemento y modo «solo datos» (sin interpretación). Se guarda en el navegador (localStorage) y se aplica como atributos y variables CSS en <html>.
// El mismo código de aplicar() está resumido en el <script> del <head> de index.html para que no haya parpadeo.

import { ASPECT } from "./astro-data.js";
import { cleanTrips, sameTrips, TRIP_ASPECTS, TRIP_DEFAULTS } from "./trips.js";

export const KEY = "carta:cfg";
// Lecturas, explicaciones y análisis de la carta: apagados a pedido. Con false la app queda siempre en «solo datos» y la
// opción de Configuración está oculta. Para volver a ponerlos: true acá, y también en el <script> del <head> de index.html
// y sacar el `hidden` de la sección «Interpretación» de Configuración.
export const INTERP_ENABLED = false;
export const VERSION = 2;       // las configuraciones guardadas llevan `v`; sin `v` son de cuando los valores de fábrica eran otros

// Orbes (en grados). Son los mismos valores de fábrica que trae el servidor (ORB_TABLE y HOUSE_ORBS en astro.py); el servidor
// recibe los que se elijan acá en cada pedido. asp: una fila por grupo de planetas, y por columna: [conjunción · oposición ·
// cuadratura, trígono, sextil, semicuadratura · sesquicuadratura · quincuncio]. Planetas en las casas (siempre hacia adelante,
// según los grados que le faltan a un planeta para la cúspide de la casa que sigue): cusp = «en cúspide», cuenta solo en la
// casa que sigue [cúspide angular, otra]; span = «en las 2 casas», cuenta en las dos [cúspide angular, otra].
export const ORB_MAX = 15;
export const ORBS_VERSION = 2;      // el de astro.py: lo que trae la respuesta de la carta (`orbs_v`) si el servidor entiende los orbes de acá
export const ORB_DEFAULTS = Object.freeze({
  asp: Object.freeze({
    luminaries: Object.freeze([10, 8, 6, 2]),
    personal: Object.freeze([8, 7, 5, 2]),
    social: Object.freeze([7, 6, 5, 2]),
    outer: Object.freeze([5, 3, 3, 2]),
  }),
  cusp: Object.freeze([4, 2.5]),
  span: Object.freeze([7, 5]),
});
export const ORB_GROUPS = [
  ["luminaries", "Sol y Luna"],
  ["personal", "Mercurio, Venus y Marte"],
  ["social", "Júpiter y Saturno"],
  ["outer", "Urano, Neptuno y Plutón"],
];
const ORB_COLS = [["conjunction", "opposition", "square"], ["trine"], ["sextile"], ["semisquare", "sesquiquadrate", "quincunx"]];

const orbRow = (raw, def) => def.map((d, i) => {
  const x = Array.isArray(raw) && raw.length === def.length ? Number(raw[i]) : NaN;     // una fila de otro largo (formato viejo) vuelve a la de fábrica
  return Number.isFinite(x) ? Math.min(ORB_MAX, Math.max(0, Math.round(x * 100) / 100)) : d;
});
/** Orbes guardados o escritos a mano: lo que falte o esté mal vuelve al valor de fábrica. Devuelve siempre una copia. */
export function cleanOrbs(raw) {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const asp = r.asp && typeof r.asp === "object" ? r.asp : {};
  return {
    asp: Object.fromEntries(ORB_GROUPS.map(([g]) => [g, orbRow(asp[g], ORB_DEFAULTS.asp[g])])),
    cusp: orbRow(r.cusp, ORB_DEFAULTS.cusp),
    span: orbRow(r.span, ORB_DEFAULTS.span),
  };
}
export const sameOrbs = (a, b) => JSON.stringify(cleanOrbs(a)) === JSON.stringify(cleanOrbs(b));

export const DEFAULTS = Object.freeze({
  gfx: "new",        // "new" | "classic"
  tint: true,        // tinte por elemento en el anillo de signos
  font: "rounded",   // ver FONTS
  fs: 1,             // escala de la letra (0,85 – 1,3)
  wheel: 1,          // escala del mandala (0,6 – 1,4)
  aspOff: [],        // tipos de aspecto apagados (claves de ASPECT: "square", "sextile"…); [] = se muestran todos
  cuspRing: true,    // anillo exterior de la rueda con los grados y el signo de cada cúspide
  spill: false,      // carta natal: marcar los planetas que pasan a la casa que sigue o están en las dos
  orbs: ORB_DEFAULTS,   // orbes de los aspectos y de los planetas en las casas (ver más arriba)
  tripsOn: false,    // carta natal: dibujar en la rueda los viajes de los planetas por las casas
  trips: TRIP_DEFAULTS,   // qué cuenta para los viajes: aspectos duros, orbe a la cúspide y regentes (ver trips.js)
  interp: INTERP_ENABLED,   // false = «solo datos»: sin lecturas ni descripciones (ver .interp en style.css)
});

export const FONTS = {
  system: "Sistema (SF Pro)",
  helvetica: "Helvetica Neue",
  avenir: "Avenir Next",
  rounded: "Redondeada",
  serif: "Serif (New York)",
  mono: "Monoespaciada",
};

export const LIMITS = { fs: [0.85, 1.3], wheel: [0.6, 1.4] };
const clamp = (v, [lo, hi], d) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, Math.round(+v * 100) / 100)) : d);

/**
 * Lee la configuración guardada; lo que falte o esté mal vuelve al valor de fábrica.
 * Una configuración guardada antes de que cambiaran los valores de fábrica (sin `v`) que quedó en los de entonces (letra del
 * sistema, banda de signos lisa en el estilo nuevo) se toma como «sin elegir» y pasa a los de ahora.
 */
export function load() {
  let raw = {};
  try { raw = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { raw = {}; }
  if (typeof raw !== "object" || Array.isArray(raw)) raw = {};
  // Los valores de fábrica de los viajes eran otros (oposición y cuadratura, 4° y 2,5° a la cúspide): lo guardado que quedó igual a
  // ellos se toma como «sin elegir» y pasa a los de ahora.
  const t = raw.trips;
  if (t && typeof t === "object" && Array.isArray(t.asp) && Array.isArray(t.cusp) && t.asp.join() === "opposition,square" && t.cusp.join() === "4,2.5") delete raw.trips;
  if (raw.v !== VERSION) {
    if (raw.font === "system") delete raw.font;
    if (raw.tint === false && raw.gfx !== "classic") delete raw.tint;
  }
  return {
    gfx: raw.gfx === "classic" ? "classic" : "new",
    tint: typeof raw.tint === "boolean" ? raw.tint : DEFAULTS.tint,
    font: Object.hasOwn(FONTS, raw.font) ? raw.font : DEFAULTS.font,
    fs: clamp(raw.fs ?? DEFAULTS.fs, LIMITS.fs, DEFAULTS.fs),
    wheel: clamp(raw.wheel ?? DEFAULTS.wheel, LIMITS.wheel, DEFAULTS.wheel),
    cuspRing: typeof raw.cuspRing === "boolean" ? raw.cuspRing : DEFAULTS.cuspRing,
    spill: typeof raw.spill === "boolean" ? raw.spill : DEFAULTS.spill,
    orbs: cleanOrbs(raw.orbs),
    tripsOn: typeof raw.tripsOn === "boolean" ? raw.tripsOn : DEFAULTS.tripsOn,
    trips: cleanTrips(raw.trips),
    aspOff: Array.isArray(raw.aspOff) ? [...new Set(raw.aspOff.filter((t) => Object.hasOwn(ASPECT, t)))] : [],
    interp: INTERP_ENABLED && raw.interp !== false,
  };
}

export function save(cfg) {
  try { localStorage.setItem(KEY, JSON.stringify({ v: VERSION, ...cfg })); } catch { /* sin almacenamiento: queda solo en esta sesión */ }
}

/** Pone la configuración en <html>: atributos para la CSS y variables de escala. */
export function apply(cfg, root = document.documentElement) {
  root.dataset.gfx = cfg.gfx;
  if (cfg.tint) root.dataset.tint = "on"; else delete root.dataset.tint;
  if (cfg.font !== "system") root.dataset.font = cfg.font; else delete root.dataset.font;
  if (cfg.fs !== 1) root.style.setProperty("--fs", cfg.fs); else root.style.removeProperty("--fs");
  if (cfg.wheel !== 1) root.style.setProperty("--wheel", cfg.wheel); else root.style.removeProperty("--wheel");
  // más de 100 %: el mandala crece y las tablas pasan debajo
  if (cfg.wheel > 1) root.dataset.big = ""; else delete root.dataset.big;
  if (cfg.interp === false) root.dataset.nointerp = ""; else delete root.dataset.nointerp;
}

const pct = (v) => `${Math.round(v * 100)} %`;

/**
 * Conecta los controles de la pestaña «Configuración».
 * @param onChange (cfg, qué) se llama después de cada cambio; qué = "gfx" cuando hay que volver a dibujar
 */
export function initSettings(onChange) {
  let cfg = load();
  const $ = (s) => document.querySelector(s);
  const el = {
    gfx: [...document.querySelectorAll("#cfgGfx button")],
    tint: $("#cfgTint"), font: $("#cfgFont"),
    fs: $("#cfgFs"), fsV: $("#cfgFsV"), wheel: $("#cfgWheel"), wheelV: $("#cfgWheelV"),
    big: $("#cfgBig"), reset: $("#cfgReset"), cusp: $("#cfgCusp"),
    interp: [...document.querySelectorAll("#cfgInterp button")],
    asp: $("#cfgAsp"),
    spill: $("#spillBtn"),
    orbAsp: $("#cfgOrbAsp"), orbHouse: $("#cfgOrbHouse"), orbReset: $("#cfgOrbReset"),
    tripBtn: $("#tripBtn"), tripAsp: $("#cfgTripAsp"), tripOrb: $("#cfgTripOrb"),
    tripReset: $("#cfgTripReset"),
  };
  // un botón por tipo de aspecto: encendido se muestra, apagado se oculta en la rueda, las listas, el cuadro y el calendario
  el.asp.replaceChildren(...Object.entries(ASPECT).map(([type, A]) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "asp-toggle"; b.dataset.asp = type;
    b.innerHTML = `<span class="a-ic ${A.cls}" aria-hidden="true">${A.icon}</span>${A.name}`;
    return b;
  }));

  // tabla de orbes: una fila por grupo de planetas, una columna por tipo de aspecto (y la de las casas)
  const orbIn = (key, i, label) =>
    `<input type="number" class="orb-in" inputmode="decimal" min="0" max="${ORB_MAX}" step="0.5" data-orb="${key}" data-i="${i}" aria-label="${label}">`;
  const icons = (types) => types.map((t) => `<span class="a-ic ${ASPECT[t].cls}" title="${ASPECT[t].name}">${ASPECT[t].icon}</span>`).join("");
  const colName = (types) => types.map((t) => ASPECT[t].name).join(", ");
  el.orbAsp.innerHTML = `<thead><tr><th scope="col"><span class="sr">Planetas</span></th>` +
    ORB_COLS.map((c) => `<th scope="col" class="oc">${icons(c)}</th>`).join("") + `</tr></thead><tbody>` +
    ORB_GROUPS.map(([g, label]) => `<tr><th scope="row">${label}</th>` +
      ORB_COLS.map((c, i) => `<td>${orbIn(`asp.${g}`, i, `${label}: ${colName(c)}, en grados`)}</td>`).join("") + `</tr>`).join("") + `</tbody>`;
  el.orbHouse.innerHTML = `<thead><tr><th scope="col"><span class="sr">Planetas en las casas</span></th><th scope="col" class="oc">Cúspide angular</th><th scope="col" class="oc">Otras cúspides</th></tr></thead><tbody>` +
    `<tr><th scope="row">En cúspide</th><td>${orbIn("cusp", 0, "En cúspide, antes de una casa angular, en grados")}</td>` +
    `<td>${orbIn("cusp", 1, "En cúspide, antes de las otras casas, en grados")}</td></tr>` +
    `<tr><th scope="row">En las 2 casas</th><td>${orbIn("span", 0, "En las 2 casas, antes de una casa angular, en grados")}</td>` +
    `<td>${orbIn("span", 1, "En las 2 casas, antes de las otras casas, en grados")}</td></tr></tbody>`;
  const orbInputs = [...el.orbAsp.querySelectorAll("input"), ...el.orbHouse.querySelectorAll("input")];
  const orbGet = (o, key, i) => key.startsWith("asp.") ? o.asp[key.slice(4)][i] : o[key][i];
  const orbRead = () => {
    const o = { asp: {}, cusp: [], span: [] };
    for (const g of ORB_GROUPS) o.asp[g[0]] = [];
    for (const inp of orbInputs) {
      const key = inp.dataset.orb, i = +inp.dataset.i;
      (key.startsWith("asp.") ? o.asp[key.slice(4)] : o[key])[i] = inp.value === "" ? NaN : Number(inp.value);
    }
    return cleanOrbs(o);        // una casilla vacía o inválida vuelve a su valor de fábrica
  };

  // viajes: los aspectos que cuentan como duros (uno por botón), el orbe a la cúspide y los regentes
  el.tripAsp.replaceChildren(...TRIP_ASPECTS.map((type) => {
    const A = ASPECT[type], b = document.createElement("button");
    b.type = "button"; b.className = "asp-toggle"; b.dataset.tripAsp = type;
    b.innerHTML = `<span class="a-ic ${A.cls}" aria-hidden="true">${A.icon}</span>${A.name}`;
    return b;
  }));
  const tripIn = (i, label) =>
    `<input type="number" class="orb-in" inputmode="decimal" min="0" max="${ORB_MAX}" step="0.5" data-trip-cusp="${i}" aria-label="${label}">`;
  el.tripOrb.innerHTML = `<thead><tr><th scope="col"><span class="sr">Viaje por eje</span></th><th scope="col" class="oc">Cúspide angular</th><th scope="col" class="oc">Otras cúspides</th></tr></thead><tbody>` +
    `<tr><th scope="row">Pegado a la cúspide</th><td>${tripIn(0, "Pegado a una cúspide angular, en grados")}</td><td>${tripIn(1, "Pegado a las otras cúspides, en grados")}</td></tr></tbody>`;
  const tripInputs = [...el.tripOrb.querySelectorAll("input")];
  const tripRead = () => cleanTrips({
    asp: [...el.tripAsp.children].filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.dataset.tripAsp),
    cusp: tripInputs.map((inp) => (inp.value === "" ? NaN : Number(inp.value))),
  });

  el.font.replaceChildren(...Object.entries(FONTS).map(([v, label]) =>
    Object.assign(document.createElement("option"), { value: v, textContent: label })));
  el.fs.min = Math.round(LIMITS.fs[0] * 100); el.fs.max = Math.round(LIMITS.fs[1] * 100);
  el.wheel.min = Math.round(LIMITS.wheel[0] * 100); el.wheel.max = Math.round(LIMITS.wheel[1] * 100);

  function paint() {
    for (const b of el.gfx) b.setAttribute("aria-pressed", b.dataset.gfx === cfg.gfx);
    el.tint.checked = cfg.tint;
    el.cusp.checked = cfg.cuspRing;
    if (el.spill) el.spill.setAttribute("aria-pressed", cfg.spill);
    el.font.value = cfg.font;
    el.fs.value = Math.round(cfg.fs * 100); el.fsV.textContent = pct(cfg.fs);
    el.wheel.value = Math.round(cfg.wheel * 100); el.wheelV.textContent = pct(cfg.wheel);
    el.big.hidden = !(cfg.wheel > 1);
    for (const b of el.interp) b.setAttribute("aria-pressed", (b.dataset.interp === "on") === cfg.interp);
    for (const b of el.asp.children) b.setAttribute("aria-pressed", !cfg.aspOff.includes(b.dataset.asp));
    for (const inp of orbInputs) {
      if (document.activeElement !== inp) inp.value = orbGet(cfg.orbs, inp.dataset.orb, +inp.dataset.i);
      const d = orbGet(ORB_DEFAULTS, inp.dataset.orb, +inp.dataset.i);
      inp.classList.toggle("edited", orbGet(cfg.orbs, inp.dataset.orb, +inp.dataset.i) !== d);
    }
    el.orbReset.disabled = sameOrbs(cfg.orbs, ORB_DEFAULTS);
    if (el.tripBtn) el.tripBtn.setAttribute("aria-pressed", cfg.tripsOn);
    for (const b of el.tripAsp.children) b.setAttribute("aria-pressed", cfg.trips.asp.includes(b.dataset.tripAsp));
    for (const inp of tripInputs) {
      const i = +inp.dataset.tripCusp;
      if (document.activeElement !== inp) inp.value = cfg.trips.cusp[i];
      inp.classList.toggle("edited", cfg.trips.cusp[i] !== TRIP_DEFAULTS.cusp[i]);
    }
    el.tripReset.disabled = sameTrips(cfg.trips, TRIP_DEFAULTS);
  }
  function change(patch, what) {
    cfg = { ...cfg, ...patch };
    apply(cfg); save(cfg); paint();
    onChange(cfg, what);
  }

  for (const b of el.gfx) b.addEventListener("click", () => {
    if (b.dataset.gfx === cfg.gfx) return;
    // los dos estilos vienen con el tinte por elemento (se puede sacar después)
    change({ gfx: b.dataset.gfx, tint: true }, "gfx");
  });
  for (const b of el.interp) b.addEventListener("click", () => {
    const on = b.dataset.interp === "on";
    if (on !== cfg.interp) change({ interp: on }, "interp");
  });
  el.asp.addEventListener("click", (e) => {
    const t = e.target.closest("[data-asp]")?.dataset.asp;
    if (!t) return;
    change({ aspOff: cfg.aspOff.includes(t) ? cfg.aspOff.filter((x) => x !== t) : [...cfg.aspOff, t] }, "asp");
  });
  el.tint.addEventListener("change", () => change({ tint: el.tint.checked }, "tint"));
  el.cusp.addEventListener("change", () => change({ cuspRing: el.cusp.checked }, "cusp"));
  el.spill?.addEventListener("click", () => change({ spill: !cfg.spill }, "spill"));
  el.font.addEventListener("change", () => change({ font: el.font.value }, "font"));
  el.fs.addEventListener("input", () => change({ fs: clamp(el.fs.value / 100, LIMITS.fs, 1) }, "fs"));
  el.wheel.addEventListener("input", () => change({ wheel: clamp(el.wheel.value / 100, LIMITS.wheel, 1) }, "wheel"));
  for (const inp of orbInputs) inp.addEventListener("change", () => {
    const next = orbRead();
    inp.value = orbGet(next, inp.dataset.orb, +inp.dataset.i);     // lo que se acomodó (tope, vacío) se ve al instante
    if (!sameOrbs(next, cfg.orbs)) change({ orbs: next }, "orbs");
  });
  el.orbReset.addEventListener("click", () => change({ orbs: cleanOrbs(null) }, "orbs"));
  // «Restablecer» general no toca los orbes (tienen el suyo): cambiarlos obliga a recalcular las cartas
  el.tripBtn?.addEventListener("click", () => change({ tripsOn: !cfg.tripsOn }, "tripsOn"));
  el.tripAsp.addEventListener("click", (e) => {
    const b = e.target.closest("[data-trip-asp]");
    if (!b) return;
    const t = b.dataset.tripAsp;
    change({ trips: cleanTrips({ ...cfg.trips, asp: cfg.trips.asp.includes(t) ? cfg.trips.asp.filter((x) => x !== t) : [...cfg.trips.asp, t] }) }, "trips");
  });
  for (const inp of tripInputs) inp.addEventListener("change", () => {
    const next = tripRead();
    inp.value = next.cusp[+inp.dataset.tripCusp];          // lo que se acomodó (tope, vacío) se ve al instante
    if (!sameTrips(next, cfg.trips)) change({ trips: next }, "trips");
  });
  el.tripReset.addEventListener("click", () => change({ trips: cleanTrips(null) }, "trips"));
  el.reset.addEventListener("click", () => { const { orbs, ...rest } = DEFAULTS; change(rest, "gfx"); });

  apply(cfg);
  paint();
  return cfg;
}
