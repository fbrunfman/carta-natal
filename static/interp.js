// Interpretación: junta los textos (interp-*.js) según signo, casa y aspecto. Sin DOM: se puede probar en node.
//
// Es una lectura simbólica y general. Describe tendencias de la manera estándar en que se leen los
// símbolos; no explica causas ni predice hechos, y cada carta se lee en conjunto.
import { SIGN_TEXT } from "./interp-signs.js";
import { HOUSE_TEXT, HOUSE_THEME } from "./interp-houses.js";
import { PAIR, SAME, FRAME, RETRO, ORDER } from "./interp-aspects.js";

export { HOUSE_THEME, ORDER };

/** Planetas que cambian de signo cada 7, 14 o 20 años o más: su signo describe a una generación. */
export const GENERATIONAL = new Set(["uranus", "neptune", "pluto"]);

const ELEMENT_NAME = ["Fuego", "Tierra", "Aire", "Agua"];       // índice de signo % 4
const MODE_NAME = ["Cardinal", "Fijo", "Mutable"];              // índice de signo % 3
export const elementName = (sign) => ELEMENT_NAME[sign % 4];
export const modeName = (sign) => MODE_NAME[sign % 3];

// Dignidades esenciales clásicas (Sol a Saturno): domicilio, exaltación, exilio y caída, por índice de signo.
// Urano, Neptuno y Plutón solo tienen domicilio en la regencia moderna.
const DIGNITY = {
  sun:     { domicile: [4],     exaltation: [0],  detriment: [10],    fall: [6] },
  moon:    { domicile: [3],     exaltation: [1],  detriment: [9],     fall: [7] },
  mercury: { domicile: [2, 5],  exaltation: [5],  detriment: [8, 11], fall: [11] },
  venus:   { domicile: [1, 6],  exaltation: [11], detriment: [7, 0],  fall: [5] },
  mars:    { domicile: [0, 7],  exaltation: [9],  detriment: [6, 1],  fall: [3] },
  jupiter: { domicile: [8, 11], exaltation: [3],  detriment: [2, 5],  fall: [9] },
  saturn:  { domicile: [9, 10], exaltation: [6],  detriment: [3, 4],  fall: [0] },
};
const MODERN_HOME = { uranus: 10, neptune: 11, pluto: 7 };
const DIGNITY_LABEL = { domicile: "Domicilio", exaltation: "Exaltación", detriment: "Exilio", fall: "Caída" };

/** Dignidades del cuerpo en ese signo: [] si no tiene ninguna. */
export function dignityOf(id, sign) {
  const out = [];
  const d = DIGNITY[id];
  if (d) for (const k of ["domicile", "exaltation", "detriment", "fall"]) if (d[k].includes(sign)) out.push(DIGNITY_LABEL[k]);
  if (MODERN_HOME[id] === sign) out.push("Domicilio (regencia moderna)");
  return out;
}

/** Lectura del cuerpo en su signo; null si no hay texto (cuerpo desconocido). */
export function signReading(id, sign) {
  const text = SIGN_TEXT[id]?.[sign];
  if (!text) return null;
  return {
    text, element: elementName(sign), mode: modeName(sign), dignity: dignityOf(id, sign),
    generational: GENERATIONAL.has(id),
  };
}

/** Lectura del cuerpo en su casa (1–12); null para Asc y MC, que no tienen casa. */
export function houseReading(id, house) {
  const text = HOUSE_TEXT[id]?.[house - 1];
  if (!text) return null;
  return { theme: HOUSE_THEME[house - 1], text };
}

export const retroReading = (id) => RETRO[id] || null;

/** Texto de un aspecto entre dos cuerpos (el orden no importa). `frame` es del tipo, `theme` del par. */
export function pairReading(a, b, type) {
  const frame = FRAME[type];
  if (!frame) return null;
  let theme;
  if (a === b) theme = SAME[a];
  else {
    const [x, y] = ORDER.indexOf(a) <= ORDER.indexOf(b) ? [a, b] : [b, a];
    theme = PAIR[x]?.[y];
  }
  return theme ? { theme, frame } : null;
}

/** Cuánto pesa el aspecto según el orbe (en grados). */
export function orbNote(orb) {
  if (orb < 1) return "Orbe muy cerrado: el aspecto pesa mucho.";
  if (orb > 5) return "Orbe amplio: el aspecto es más difuso.";
  return "";
}

export const phaseLabel = (applying) => (applying === null || applying === undefined ? "" : applying ? "aplicativo" : "separativo");
