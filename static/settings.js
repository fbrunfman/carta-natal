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

// Colores propios: botones (y todo lo elegido), fondo y líneas, por separado para el modo claro y el oscuro. null = el de fábrica.
// Se aplican con una hoja de estilo chica (id="userColors") que también queda guardada armada en `carta:colorcss`, para que el
// <script> del <head> la ponga antes de pintar.
export const COLOR_KEYS = [["accent", "Botones"], ["bg", "Fondo"], ["line", "Líneas"]];
// Los de fábrica son los de la paleta «Océano» (los de :root en style.css).
export const COLOR_BASE = Object.freeze({
  light: Object.freeze({ accent: "#1F6FB2", bg: "#F1F6FA", line: "#D5E2EC" }),
  dark: Object.freeze({ accent: "#6CB4F0", bg: "#0B1622", line: "#22364A" }),
});
export const PALETTES = [
  ["oceano", "Océano", { light: {}, dark: {} }],
  ["violeta", "Violeta", { light: { accent: "#7A4FD3", bg: "#F6F3FA", line: "#E2DBEE" }, dark: { accent: "#B794F6", bg: "#0E0E24", line: "#2A2A4C" } }],
  ["bosque", "Bosque", { light: { accent: "#2F7D5B", bg: "#F3F7F2", line: "#D7E4D5" }, dark: { accent: "#7CCB9E", bg: "#0E1712", line: "#24382C" } }],
  ["ambar", "Ámbar", { light: { accent: "#B4561F", bg: "#FAF5EF", line: "#EADCCB" }, dark: { accent: "#F0A25A", bg: "#17110C", line: "#3A2C20" } }],
  ["mineral", "Mineral", { light: { accent: "#12202B", bg: "#E9EDF0", line: "#CBD3DA" }, dark: { accent: "#E8EEF2", bg: "#0D161C", line: "#243541" } }],
];
const HEX = /^#[0-9a-f]{6}$/i;
export function cleanColors(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const one = (m, base) => Object.fromEntries(COLOR_KEYS.map(([k]) => {
    const v = typeof m?.[k] === "string" && HEX.test(m[k]) ? m[k].toUpperCase() : null;
    return [k, v === base[k] ? null : v];                 // igual al de fábrica = sin elegir
  }));
  return { light: one(r.light, COLOR_BASE.light), dark: one(r.dark, COLOR_BASE.dark) };
}
const noColors = (c) => COLOR_KEYS.every(([k]) => !c.light[k] && !c.dark[k]);
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => { const v = parseInt(hex.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** La hoja de estilo de los colores propios ("" si no hay). El fondo trae la superficie y, si es claro en el modo oscuro (o al
 *  revés), también la tinta, para que el texto se lea; el color de los botones trae su versión para lo elegido y el texto encima. */
export function colorCSS(colors) {
  const c = cleanColors(colors);
  if (noColors(c)) return "";
  const vars = (m, dark) => {
    let v = "";
    if (m.accent) {
      v += `--accent-2:${m.accent};--accent:${dark ? m.accent : `color-mix(in srgb, ${m.accent} 72%, #000)`};` +
        `--accent-ink:${lum(m.accent) > 0.45 ? "#1A1036" : "#FFFFFF"};--accent-soft:color-mix(in srgb, ${m.accent} 18%, transparent);` +
        `--focus:${m.accent};--hover:color-mix(in srgb, ${m.accent} 8%, transparent);`;
    }
    if (m.bg) {
      const light = lum(m.bg) > 0.4;
      v += `--bg:${m.bg};--surface:color-mix(in srgb, ${m.bg} ${light ? 45 : 93}%, #fff);` +
        `--field:${light ? "#FFFFFF" : `color-mix(in srgb, ${m.bg} 82%, #000)`};`;
      if (light === dark) v += light ? "--ink:#1D1830;--ink-2:#5E5775;color-scheme:light;" : "--ink:#F0EDFA;--ink-2:#A9A4C6;color-scheme:dark;";
    }
    if (m.line) v += `--line:${m.line};--line-strong:color-mix(in srgb, ${m.line} 72%, ${lum(m.line) > 0.3 ? "#000" : "#fff"});`;
    return v;
  };
  const L = vars(c.light, false), D = vars(c.dark, true);
  let css = "";
  if (L) css += `html:root[data-theme="light"]{${L}}@media (prefers-color-scheme: light){html:root:not([data-theme]){${L}}}`;
  if (D) css += `html:root[data-theme="dark"]{${D}}@media (prefers-color-scheme: dark){html:root:not([data-theme]){${D}}}`;
  return `@media screen{${css}}`;          // la hoja impresa sale siempre con los colores de fábrica, en claro
}
const sameColors = (a, b) => JSON.stringify(cleanColors(a)) === JSON.stringify(cleanColors(b));

export const DEFAULTS = Object.freeze({
  gfx: "new",        // "new" | "classic"
  tint: true,        // tinte por elemento en el anillo de signos
  font: "rounded",   // ver FONTS
  noteFont: "kalam", // la letra de las notas: ver NOTE_FONTS
  fs: 1,             // escala de la letra (0,85 – 1,3)
  wheel: 1,          // escala del mandala (0,6 – 1,4)
  aspOff: [],        // tipos de aspecto apagados (claves de ASPECT: "square", "sextile"…); [] = se muestran todos
  cuspRing: true,    // anillo exterior de la rueda con los grados y el signo de cada cúspide
  spill: false,      // carta natal: marcar los planetas que pasan a la casa que sigue o están en las dos
  orbs: ORB_DEFAULTS,   // orbes de los aspectos y de los planetas en las casas (ver más arriba)
  tripsOn: false,    // carta natal: dibujar en la rueda los viajes de los planetas por las casas
  trips: TRIP_DEFAULTS,   // qué cuenta para los viajes: aspectos duros, orbe a la cúspide y regentes (ver trips.js)
  interp: INTERP_ENABLED,   // false = «solo datos»: sin lecturas ni descripciones (ver .interp en style.css)
  colors: cleanColors(null),  // colores propios (ver más arriba)
});

// Tipos de letra de la app. Los «del dispositivo» dependen de lo que tenga la compu o el celular (Avenir o New York solo
// existen en Apple); los «incluidos» vienen con la app (static/fonts, licencia OFL) y se ven igual en todos lados.
// La familia de cada una (para la vista previa del selector) es la misma que pone la CSS en :root[data-font=…].
export const FONTS = {
  system: "Sistema", helvetica: "Helvetica Neue", avenir: "Avenir Next", rounded: "Redondeada", serif: "New York", mono: "Monoespaciada",
  inter: "Inter", sourcesans: "Source Sans", nunito: "Nunito", atkinson: "Atkinson Hyperlegible", plex: "IBM Plex Sans",
  lora: "Lora", sourceserif: "Source Serif", garamond: "EB Garamond",
};
export const FONT_GROUPS = [
  ["Del dispositivo", ["system", "rounded", "helvetica", "avenir", "serif", "mono"]],
  ["Incluidas · sin serif", ["inter", "sourcesans", "nunito", "atkinson", "plex"]],
  ["Incluidas · con serif", ["lora", "sourceserif", "garamond"]],
];
export const FONT_NOTE = { nunito: "redondeada", atkinson: "muy legible", garamond: "clásica", mono: "de máquina" };
export const FONT_FAMILY = {
  system: 'system-ui, -apple-system, "SF Pro Text", "Segoe UI", sans-serif',
  helvetica: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  avenir: '"Avenir Next", Avenir, "Helvetica Neue", sans-serif',
  rounded: 'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", system-ui, sans-serif',
  serif: 'ui-serif, "New York", "Iowan Old Style", Georgia, serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  inter: '"Inter", system-ui, sans-serif',
  sourcesans: '"Source Sans 3", system-ui, sans-serif',
  nunito: '"Nunito", system-ui, sans-serif',
  atkinson: '"Atkinson Hyperlegible Next", system-ui, sans-serif',
  plex: '"IBM Plex Sans", system-ui, sans-serif',
  lora: '"Lora", Georgia, serif',
  sourceserif: '"Source Serif 4", Georgia, serif',
  garamond: '"EB Garamond", Georgia, serif',
};
// La letra de las notas (manuscritas, incluidas en la app), o la misma de la app.
export const NOTE_FONTS = { kalam: "Kalam", patrick: "Patrick Hand", mali: "Mali", shantell: "Shantell Sans", app: "La misma de la app" };
export const NOTE_FONT_FAMILY = {
  kalam: '"Kalam", system-ui, sans-serif', patrick: '"Patrick Hand", system-ui, sans-serif', mali: '"Mali", system-ui, sans-serif',
  shantell: '"Shantell Sans", system-ui, sans-serif', app: "var(--sans)",
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
    noteFont: Object.hasOwn(NOTE_FONTS, raw.noteFont) ? raw.noteFont : DEFAULTS.noteFont,
    fs: clamp(raw.fs ?? DEFAULTS.fs, LIMITS.fs, DEFAULTS.fs),
    wheel: clamp(raw.wheel ?? DEFAULTS.wheel, LIMITS.wheel, DEFAULTS.wheel),
    cuspRing: typeof raw.cuspRing === "boolean" ? raw.cuspRing : DEFAULTS.cuspRing,
    spill: typeof raw.spill === "boolean" ? raw.spill : DEFAULTS.spill,
    orbs: cleanOrbs(raw.orbs),
    tripsOn: typeof raw.tripsOn === "boolean" ? raw.tripsOn : DEFAULTS.tripsOn,
    trips: cleanTrips(raw.trips),
    aspOff: Array.isArray(raw.aspOff) ? [...new Set(raw.aspOff.filter((t) => Object.hasOwn(ASPECT, t)))] : [],
    interp: INTERP_ENABLED && raw.interp !== false,
    colors: cleanColors(raw.colors),
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
  root.dataset.nfont = cfg.noteFont;
  if (cfg.fs !== 1) root.style.setProperty("--fs", cfg.fs); else root.style.removeProperty("--fs");
  if (cfg.wheel !== 1) root.style.setProperty("--wheel", cfg.wheel); else root.style.removeProperty("--wheel");
  // más de 100 %: el mandala crece y las tablas pasan debajo
  if (cfg.wheel > 1) root.dataset.big = ""; else delete root.dataset.big;
  if (cfg.interp === false) root.dataset.nointerp = ""; else delete root.dataset.nointerp;
  const css = colorCSS(cfg.colors);
  let st = document.getElementById("userColors");
  if (css && !st) { st = document.createElement("style"); st.id = "userColors"; document.head.append(st); }
  if (st && st.textContent !== css) st.textContent = css;
  try { if (css) localStorage.setItem("carta:colorcss", css); else localStorage.removeItem("carta:colorcss"); } catch {}
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
    tint: $("#cfgTint"), font: $("#cfgFont"), noteFont: $("#cfgNoteFont"),
    fs: $("#cfgFs"), fsV: $("#cfgFsV"), wheel: $("#cfgWheel"), wheelV: $("#cfgWheelV"),
    big: $("#cfgBig"), cusp: $("#cfgCusp"),
    resetLook: $("#cfgResetLook"), resetWheel: $("#cfgResetWheel"), resetAsp: $("#cfgResetAsp"), resetAdv: $("#cfgResetAdv"),
    interp: [...document.querySelectorAll("#cfgInterp button")],
    asp: $("#cfgAsp"),
    spill: $("#spillBtn"),
    orbAsp: $("#cfgOrbAsp"), orbHouse: $("#cfgOrbHouse"),
    tripBtn: $("#tripBtn"), tripAsp: $("#cfgTripAsp"), tripOrb: $("#cfgTripOrb"),
    pal: $("#cfgPal"), colors: $("#cfgColors"), resetColors: $("#cfgResetColors"),
  };
  // colores: las paletas (un botón con sus muestras) y una tabla con un selector de color por cosa y por modo
  el.pal.replaceChildren(...PALETTES.map(([id, label, p]) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "cpal-b"; b.dataset.pal = id;
    const sw = (m, k) => `<i style="background:${p[m][k] || COLOR_BASE[m][k]}"></i>`;
    b.innerHTML = `<span class="cpal-sw" aria-hidden="true">${sw("light", "bg")}${sw("light", "accent")}${sw("dark", "bg")}${sw("dark", "accent")}</span>${label}`;
    return b;
  }));
  el.colors.innerHTML = `<thead><tr><th scope="col"><span class="sr">Qué</span></th><th scope="col">Modo claro</th><th scope="col">Modo oscuro</th></tr></thead><tbody>` +
    COLOR_KEYS.map(([k, label]) => `<tr><th scope="row">${label}</th>` + ["light", "dark"].map((m) =>
      `<td><label class="ccol-in"><input type="color" data-mode="${m}" data-key="${k}" aria-label="${label}, modo ${m === "light" ? "claro" : "oscuro"}"><span></span></label></td>`).join("") + `</tr>`).join("") + `</tbody>`;
  const colorInputs = [...el.colors.querySelectorAll("input")];
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

  // las letras, en grupos (el selector con vista previa lo arma fontpick.js sobre este <select>)
  el.font.replaceChildren(...FONT_GROUPS.map(([label, keys]) => {
    const g = Object.assign(document.createElement("optgroup"), { label });
    g.append(...keys.map((v) => Object.assign(document.createElement("option"), { value: v, textContent: FONTS[v] })));
    return g;
  }));
  el.noteFont.replaceChildren(...Object.entries(NOTE_FONTS).map(([v, label]) =>
    Object.assign(document.createElement("option"), { value: v, textContent: label })));
  el.fs.min = Math.round(LIMITS.fs[0] * 100); el.fs.max = Math.round(LIMITS.fs[1] * 100);
  el.wheel.min = Math.round(LIMITS.wheel[0] * 100); el.wheel.max = Math.round(LIMITS.wheel[1] * 100);

  function paint() {
    for (const b of el.gfx) b.setAttribute("aria-pressed", b.dataset.gfx === cfg.gfx);
    el.tint.checked = cfg.tint;
    el.cusp.checked = cfg.cuspRing;
    if (el.spill) el.spill.setAttribute("aria-pressed", cfg.spill);
    el.font.value = cfg.font;
    el.noteFont.value = cfg.noteFont;
    el.font.dispatchEvent(new Event("fpick:sync"));
    el.noteFont.dispatchEvent(new Event("fpick:sync"));
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

    if (el.tripBtn) el.tripBtn.setAttribute("aria-pressed", cfg.tripsOn);
    for (const b of el.tripAsp.children) b.setAttribute("aria-pressed", cfg.trips.asp.includes(b.dataset.tripAsp));
    for (const inp of tripInputs) {
      const i = +inp.dataset.tripCusp;
      if (document.activeElement !== inp) inp.value = cfg.trips.cusp[i];
      inp.classList.toggle("edited", cfg.trips.cusp[i] !== TRIP_DEFAULTS.cusp[i]);
    }
    for (const inp of colorInputs) {
      const v = cfg.colors[inp.dataset.mode][inp.dataset.key];
      if (document.activeElement !== inp) inp.value = (v || COLOR_BASE[inp.dataset.mode][inp.dataset.key]).toLowerCase();
      inp.closest("td").classList.toggle("edited", !!v);
      inp.nextElementSibling.textContent = (v || COLOR_BASE[inp.dataset.mode][inp.dataset.key]).toUpperCase();
    }
    for (const b of el.pal.children) {
      const p = PALETTES.find((x) => x[0] === b.dataset.pal)[2];
      b.setAttribute("aria-pressed", String(sameColors(p, cfg.colors)));
    }
    el.resetColors.disabled = noColors(cfg.colors);
    // cada grupo de Configuración tiene su «Restablecer»: apagado si ya está como viene de fábrica
    const D = DEFAULTS, O = ORB_DEFAULTS;
    el.resetLook.disabled = cfg.gfx === D.gfx && cfg.font === D.font && cfg.noteFont === D.noteFont && cfg.fs === D.fs;
    el.resetWheel.disabled = cfg.wheel === D.wheel && cfg.cuspRing === D.cuspRing && cfg.tint === D.tint;
    el.resetAsp.disabled = !cfg.aspOff.length && JSON.stringify(cfg.orbs.asp) === JSON.stringify(cleanOrbs(null).asp);
    el.resetAdv.disabled = sameTrips(cfg.trips, TRIP_DEFAULTS) && cfg.orbs.cusp.join() === O.cusp.join() && cfg.orbs.span.join() === O.span.join();
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
  el.noteFont.addEventListener("change", () => change({ noteFont: el.noteFont.value }, "noteFont"));
  el.fs.addEventListener("input", () => change({ fs: clamp(el.fs.value / 100, LIMITS.fs, 1) }, "fs"));
  el.wheel.addEventListener("input", () => change({ wheel: clamp(el.wheel.value / 100, LIMITS.wheel, 1) }, "wheel"));
  for (const inp of orbInputs) inp.addEventListener("change", () => {
    const next = orbRead();
    inp.value = orbGet(next, inp.dataset.orb, +inp.dataset.i);     // lo que se acomodó (tope, vacío) se ve al instante
    if (!sameOrbs(next, cfg.orbs)) change({ orbs: next }, "orbs");
  });
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
  for (const inp of colorInputs) inp.addEventListener("input", () => {
    const m = inp.dataset.mode, k = inp.dataset.key, v = inp.value.toUpperCase();
    const colors = cleanColors({ ...cfg.colors, [m]: { ...cfg.colors[m], [k]: v === COLOR_BASE[m][k] ? null : v } });
    if (!sameColors(colors, cfg.colors)) change({ colors }, "colors");
  });
  el.pal.addEventListener("click", (e) => {
    const b = e.target.closest("[data-pal]");
    if (b) change({ colors: cleanColors(PALETTES.find((x) => x[0] === b.dataset.pal)[2]) }, "colors");
  });
  el.resetColors.addEventListener("click", () => change({ colors: cleanColors(null) }, "colors"));
  // «Restablecer» de cada grupo: lo de ese grupo vuelve a como viene de fábrica (los orbes obligan a recalcular las cartas)
  el.resetLook.addEventListener("click", () => change({ gfx: DEFAULTS.gfx, font: DEFAULTS.font, noteFont: DEFAULTS.noteFont, fs: DEFAULTS.fs }, "gfx"));
  el.resetWheel.addEventListener("click", () => change({ wheel: DEFAULTS.wheel, cuspRing: DEFAULTS.cuspRing, tint: DEFAULTS.tint }, "cusp"));
  el.resetAsp.addEventListener("click", () => {
    const orbs = { ...cfg.orbs, asp: cleanOrbs(null).asp };
    const orbsChanged = !sameOrbs(orbs, cfg.orbs);
    change({ aspOff: [] }, "asp");
    if (orbsChanged) change({ orbs }, "orbs");
  });
  el.resetAdv.addEventListener("click", () => {
    const orbs = { ...cfg.orbs, cusp: [...ORB_DEFAULTS.cusp], span: [...ORB_DEFAULTS.span] };
    const orbsChanged = !sameOrbs(orbs, cfg.orbs);
    change({ trips: cleanTrips(null) }, "trips");
    if (orbsChanged) change({ orbs }, "orbs");
  });

  apply(cfg);
  paint();
  return cfg;
}
export const getCfg = () => load();
