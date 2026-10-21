// Nombres, símbolos y formato. Todo en español.
// Los símbolos de planetas y signos son vectores propios (glyphs.js): no dependen de la fuente del sistema.
// Los de los aspectos siguen siendo texto; ︎ fuerza presentación de texto (evita emojis de colores en macOS).
import { BODY_SVG, bodySVG, signSVG } from "./glyphs.js";
const VS = "︎";

/** Estilo de los gráficos: nuevo (vectores propios, círculos de color) o clásico (símbolos de texto, como antes). */
export const look = { classic: false };
export const setClassic = (on) => { look.classic = !!on; };

// Símbolos de texto del estilo clásico (los dibuja la fuente del sistema). Plutón siempre es vector.
const TEXT_BODY = {
  sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂", jupiter: "♃", saturn: "♄",
  uranus: "♅", neptune: "♆", node: "☊",
};
const TEXT_SIGN = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];
/** Símbolo de texto de un cuerpo (estilo clásico), o null si no lo tiene (Plutón, Asc, MC). */
export const bodyText = (id) => (TEXT_BODY[id] ? TEXT_BODY[id] + VS : null);
/** Símbolo de texto de un signo (estilo clásico). */
export const signText = (i) => TEXT_SIGN[i] + VS;

export const SIGNS = [
  "Aries", "Tauro", "Géminis", "Cáncer", "Leo", "Virgo",
  "Libra", "Escorpio", "Sagitario", "Capricornio", "Acuario", "Piscis",
];
export const ELEMENT = ["fire", "earth", "air", "water"]; // índice de signo % 4

export const BODY = {
  sun: { name: "Sol" },
  moon: { name: "Luna" },
  mercury: { name: "Mercurio" },
  venus: { name: "Venus" },
  mars: { name: "Marte" },
  jupiter: { name: "Júpiter" },
  saturn: { name: "Saturno" },
  uranus: { name: "Urano" },
  neptune: { name: "Neptuno" },
  pluto: { name: "Plutón" },
  node: { name: "Nodo norte" },
  asc: { name: "Ascendente", tag: "Asc" },
  mc: { name: "Medio Cielo", tag: "MC" },
};

export const ASPECT = {
  conjunction: { name: "Conjunción", glyph: "☌" + VS, cls: "neutral" },
  opposition: { name: "Oposición", glyph: "☍" + VS, cls: "hard" },
  trine: { name: "Trígono", glyph: "△" + VS, cls: "soft" },
  square: { name: "Cuadratura", glyph: "□" + VS, cls: "hard" },
  sextile: { name: "Sextil", glyph: "⚹" + VS, cls: "soft" },
  quincunx: { name: "Quincuncio", glyph: "⚻" + VS, cls: "minor" },
};

const pad = (n) => String(n).padStart(2, "0");

/**
 * Longitud eclíptica → signo, grados y minutos.
 * Los minutos se truncan: 13°31′38″ se escribe 13°31′. Es la convención estándar y
 * la que usa iPhemeris, así que ambas pantallas muestran lo mismo.
 */
export function split(lon) {
  const t = Math.floor((((lon % 360) + 360) % 360) * 60 + 1e-7) % 21600;
  const sign = Math.floor(t / 1800);
  const rem = t % 1800;
  return { sign, deg: Math.floor(rem / 60), min: rem % 60 };
}

export const fmtPos = (lon) => {
  const s = split(lon);
  return `${s.deg}°${pad(s.min)}′`;
};

export const fmtOrb = (orb) => {
  const t = Math.floor(orb * 60 + 1e-7);
  return `${Math.floor(t / 60)}°${pad(t % 60)}′`;
};

/** Símbolo de un cuerpo para HTML (tablas): <svg> en línea, o texto en el estilo clásico. Asc y MC: null. */
export const glyphHTML = (id) => (look.classic && bodyText(id)) || bodySVG(id);

/** Símbolo de un signo (0 = Aries … 11 = Piscis) para HTML: <svg> en línea, o texto en el estilo clásico. */
export const signHTML = (i) => (look.classic ? signText(i) : signSVG(i));

/** Marca de un cuerpo para tablas: símbolo, o etiqueta de texto para los ángulos. */
export function mark(id) {
  const g = glyphHTML(id);
  return g ? `<span class="g" aria-hidden="true">${g}</span>` : `<span class="tag">${BODY[id].tag}</span>`;
}

// ---- círculos de color --------------------------------------------------------------------------
// Un círculo por cuerpo (el Sol, con borde ondulado) y su símbolo adentro, en una caja de 100 × 100
// centrada en el origen. Es el mismo dibujo en la rueda, las tablas y los cuadros; los colores
// (--pb-bg, --pb-fg) están en style.css, uno por cuerpo.

/** Borde ondulado del Sol: 24 ondas suaves alrededor de un círculo. */
const SCALLOP = (() => {
  const n = 24, pts = [];
  for (let i = 0; i < n * 8; i++) {
    const t = (i / (n * 8)) * 2 * Math.PI;
    const r = 45.6 + 2.5 * Math.cos(n * t);
    pts.push(`${(r * Math.sin(t)).toFixed(1)} ${(-r * Math.cos(t)).toFixed(1)}`);
  }
  return `M${pts.join("L")}Z`;
})();

/** Dibujo interior del círculo de un cuerpo (sin <svg> alrededor). */
export function discInner(id) {
  const b = BODY[id];
  if (look.classic) {                      // círculo liso con el símbolo de texto, como antes
    const t = bodyText(id);
    const face = t ? `<text class="pd-sym" y="0" dy=".36em">${t}</text>`
      : BODY_SVG[id] ? `<g class="pd-gl" transform="translate(-30 -30) scale(2.5)">${BODY_SVG[id]}</g>`
      : `<text class="pd-tx" y="0" dy=".35em">${b.tag}</text>`;
    return `<circle class="pd-bg c" r="48"/>${face}`;
  }
  const bg = id === "sun" ? `<path class="pd-bg" d="${SCALLOP}"/>` : `<circle class="pd-bg" r="47.5"/>`;
  const ring = `<circle class="pd-ring" r="${id === "sun" ? 40 : 41.5}"/>`;
  const face = BODY_SVG[id]
    ? `<g class="pd-gl" transform="translate(-32.4 -32.4) scale(2.7)">${BODY_SVG[id]}</g>`
    : `<text class="pd-tx" y="0" dy=".35em">${b.tag}</text>`;
  return bg + ring + face;
}

/** Círculo de color con el símbolo del cuerpo (Asc y MC llevan su sigla), para HTML. */
export function badge(id, size = "") {
  return `<svg class="pb pb-${id}${size ? " " + size : ""}" viewBox="-50 -50 100 100" role="img" aria-label="${BODY[id].name}">${discInner(id)}</svg>`;
}

/** El mismo círculo dentro de la rueda, centrado en (x, y) con `d` unidades de diámetro. */
export function discWheel(id, x, y, d) {
  return `<g class="pdw pb-${id}" transform="translate(${x} ${y})"><g class="pdi"><g transform="scale(${(d / 95).toFixed(4)})">${discInner(id)}</g></g></g>`;
}

/** Escapa texto del usuario (nombres) antes de ponerlo dentro de HTML armado a mano. */
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
