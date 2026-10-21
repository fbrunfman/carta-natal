// Configuración de la vista: estilo de los gráficos, tipo y tamaño de letra, tamaño del mandala y tinte por
// elemento. Se guarda en el navegador (localStorage) y se aplica como atributos y variables CSS en <html>.
// El mismo código de aplicar() está resumido en el <script> del <head> de index.html para que no haya parpadeo.

export const KEY = "carta:cfg";

export const DEFAULTS = Object.freeze({
  gfx: "new",        // "new" | "classic"
  tint: false,       // tinte por elemento en el anillo de signos
  font: "system",    // ver FONTS
  fs: 1,             // escala de la letra (0,85 – 1,3)
  wheel: 1,          // escala del mandala (0,6 – 1,4)
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

/** Lee la configuración guardada; lo que falte o esté mal vuelve al valor de fábrica. */
export function load() {
  let raw = {};
  try { raw = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { raw = {}; }
  return {
    gfx: raw.gfx === "classic" ? "classic" : "new",
    tint: raw.tint === true,
    font: Object.hasOwn(FONTS, raw.font) ? raw.font : DEFAULTS.font,
    fs: clamp(raw.fs ?? DEFAULTS.fs, LIMITS.fs, DEFAULTS.fs),
    wheel: clamp(raw.wheel ?? DEFAULTS.wheel, LIMITS.wheel, DEFAULTS.wheel),
  };
}

export function save(cfg) {
  try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch { /* sin almacenamiento: queda solo en esta sesión */ }
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
    big: $("#cfgBig"), reset: $("#cfgReset"),
  };

  el.font.replaceChildren(...Object.entries(FONTS).map(([v, label]) =>
    Object.assign(document.createElement("option"), { value: v, textContent: label })));
  el.fs.min = Math.round(LIMITS.fs[0] * 100); el.fs.max = Math.round(LIMITS.fs[1] * 100);
  el.wheel.min = Math.round(LIMITS.wheel[0] * 100); el.wheel.max = Math.round(LIMITS.wheel[1] * 100);

  function paint() {
    for (const b of el.gfx) b.setAttribute("aria-pressed", b.dataset.gfx === cfg.gfx);
    el.tint.checked = cfg.tint;
    el.font.value = cfg.font;
    el.fs.value = Math.round(cfg.fs * 100); el.fsV.textContent = pct(cfg.fs);
    el.wheel.value = Math.round(cfg.wheel * 100); el.wheelV.textContent = pct(cfg.wheel);
    el.big.hidden = !(cfg.wheel > 1);
  }
  function change(patch, what) {
    cfg = { ...cfg, ...patch };
    apply(cfg); save(cfg); paint();
    onChange(cfg, what);
  }

  for (const b of el.gfx) b.addEventListener("click", () => {
    if (b.dataset.gfx === cfg.gfx) return;
    // cada estilo trae su tinte: el nuevo, banda lisa; el clásico, anillo teñido como antes
    change({ gfx: b.dataset.gfx, tint: b.dataset.gfx === "classic" }, "gfx");
  });
  el.tint.addEventListener("change", () => change({ tint: el.tint.checked }, "tint"));
  el.font.addEventListener("change", () => change({ font: el.font.value }, "font"));
  el.fs.addEventListener("input", () => change({ fs: clamp(el.fs.value / 100, LIMITS.fs, 1) }, "fs"));
  el.wheel.addEventListener("input", () => change({ wheel: clamp(el.wheel.value / 100, LIMITS.wheel, 1) }, "wheel"));
  el.reset.addEventListener("click", () => change({ ...DEFAULTS }, "gfx"));

  apply(cfg);
  paint();
  return cfg;
}
