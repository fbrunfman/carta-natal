// Símbolos de planetas y signos dibujados como vectores (caja de 24 × 24, trazo redondeado).
// No dependen de ninguna fuente del sistema, así que se ven igual en cualquier Mac y no aparecen emojis.
// Sin DOM: devuelven texto SVG (también se puede probar en node). El color es el del texto (currentColor).

const dot = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="currentColor" stroke="none"/>`;

/** Contenido SVG de cada cuerpo. Asc y MC no tienen símbolo: llevan su sigla. */
export const BODY_SVG = {
  sun: `<circle cx="12" cy="12" r="8.6"/>${dot(12, 12, 1.7)}`,
  moon: `<path fill="currentColor" d="M16.2 4.2A8.74 8.74 0 1 0 16.2 19.8A7.9 7.9 0 1 1 16.2 4.2Z"/>`,
  mercury: `<path d="M7.2 2.8C7.2 5.2 9.3 6.6 12 6.6S16.8 5.2 16.8 2.8"/><circle cx="12" cy="10.8" r="4.2"/><path d="M12 15V21.6M8.8 18.4H15.2"/>`,
  venus: `<circle cx="12" cy="8.6" r="5.2"/><path d="M12 13.8V22M8.2 18.2H15.8"/>`,
  mars: `<circle cx="9.8" cy="14.2" r="5.6"/><path d="M13.8 10.2L20.4 3.6M14.2 3.6H20.4V9.8"/>`,
  jupiter: `<path d="M4.3 7.6C4.3 4 8.2 3 10.2 5C12.2 7 10.8 10.8 4.3 15H20.4M16 6V21.4"/>`,
  saturn: `<path d="M6.8 6.6H13.2M10 3V12.6C10 9 14.2 8.2 16.4 10.3C18.3 12.2 17.2 15.2 15.4 17.2C14.2 18.6 14.3 20.4 15.8 21C17.2 21.5 18.6 20.7 19.2 19.4"/>`,
  uranus: `<path d="M5.4 3.6V12.6M18.6 3.6V12.6M5.4 8.2H18.6M12 3V14.6"/><circle cx="12" cy="18.2" r="3.2"/>`,
  neptune: `<path d="M5 4.2C5 10.8 8 13 12 13S19 10.8 19 4.2M12 3V21.4M8 17.6H16M2.8 7L5 4L7.4 6.6M16.6 6.6L19 4L21.2 7M9.6 5.6L12 3L14.4 5.6"/>`,
  pluto: `<circle cx="12" cy="6.2" r="2.8"/><path d="M5.4 9.6A6.6 6.6 0 0 0 18.6 9.6M12 16.2V22.5M8.6 19.6H15.4"/>`,
  node: `<path d="M6.9 16.2C4.3 13.6 4.4 5.6 12 5.6S19.7 13.6 17.1 16.2"/><circle cx="5.5" cy="18.1" r="2.3"/><circle cx="18.5" cy="18.1" r="2.3"/>`,
};

/** Contenido SVG de los 12 signos, de Aries a Piscis. */
export const SIGN_SVG = [
  // Aries
  `<path d="M12 21.4V11M12 11C12 6.6 9.6 3.6 6.9 3.6C4.7 3.6 3.2 5.2 3.2 7.2C3.2 8.8 4.2 9.9 5.4 10.2M12 11C12 6.6 14.4 3.6 17.1 3.6C19.3 3.6 20.8 5.2 20.8 7.2C20.8 8.8 19.8 9.9 18.6 10.2"/>`,
  // Tauro
  `<circle cx="12" cy="15.4" r="5.7"/><path d="M4.4 3.4C4.4 7.4 7.4 9.7 12 9.7S19.6 7.4 19.6 3.4"/>`,
  // Géminis
  `<path d="M4.6 3.8C8.6 6.2 15.4 6.2 19.4 3.8M4.6 20.2C8.6 17.8 15.4 17.8 19.4 20.2M9.2 5.6V18.4M14.8 5.6V18.4"/>`,
  // Cáncer
  `<circle cx="7" cy="9.6" r="2.7"/><circle cx="17" cy="14.4" r="2.7"/><path d="M7.4 6.9C9.2 4.6 11.6 4 13.8 4C17 4 19.6 5.6 20.6 8.6M16.6 17.1C14.8 19.4 12.4 20 10.2 20C7 20 4.4 18.4 3.4 15.4"/>`,
  // Leo
  `<circle cx="7.4" cy="14.8" r="3.2"/><path d="M9.8 12.4C10.6 9 11.4 5 14.6 4.2C17.6 3.5 20 5.6 20 8.6C20 12.2 16.6 13.6 16.6 17.4C16.6 19.8 18 21 20.2 20.6"/>`,
  // Virgo
  `<path d="M4.3 4.2C5.3 3.2 5.9 4.4 5.9 6.2V18.3M5.9 6.2C5.9 4 7.1 3 8.4 3C9.8 3 11 4 11 6.2V18.3M11 6.2C11 4 12.3 3 13.4 3C14.8 3 15.7 4 15.7 6.2V16C15.7 18.8 13.9 20.8 11.5 20.2M15.7 8C16.1 6.2 20.3 5.8 20.3 9.8V13.6C20.3 16.4 18.5 18.2 16.3 18.6"/>`,
  // Libra
  `<path d="M3.6 20H20.4M3.6 15.2H8.6C6.2 13.4 5.6 11.4 5.6 9.8C5.6 6.4 8.4 4.2 12 4.2S18.4 6.4 18.4 9.8C18.4 11.4 17.8 13.4 15.4 15.2H20.4"/>`,
  // Escorpio
  `<path d="M2.4 4.8C3.6 3.8 4.8 4.8 4.8 7V17.6M4.8 7C4.8 4.8 6 3.8 7.8 3.8C9.6 3.8 10.6 4.8 10.6 7V17.6M10.6 7C10.6 4.8 11.8 3.8 13.6 3.8C15.4 3.8 16.4 4.8 16.4 7V14.8C16.4 17.2 17.2 18.2 19 18.2L21.4 18.2M19.6 16L21.8 18.2L19.6 20.4"/>`,
  // Sagitario
  `<path d="M4.4 19.6L19.6 4.4M10.4 4.4H19.6V13.6M6.4 11.4L12.6 17.6"/>`,
  // Capricornio
  `<path d="M2.42 4.13C3.72 3.91 4.86 4.21 5.24 5.5C5.62 6.79 5.84 8.54 6.15 10.06C6.22 11.05 6.38 11.96 6.38 12.95C6.6 11.81 7.21 10.44 7.82 9.23C8.28 7.86 8.88 6.34 9.8 4.97C10.25 4.29 10.71 3.83 11.09 3.83C11.47 3.83 11.7 4.36 11.85 5.12C12.15 6.26 12.38 7.78 12.53 9.3C12.68 10.82 12.84 11.81 13.29 12.95C13.6 13.71 13.82 14.24 13.9 15.15C13.98 16.07 13.6 16.83 13.06 17.74C12.53 18.65 11.77 19.33 10.71 19.64C9.95 19.79 9.19 19.94 8.58 20.17M13.82 14.01C14.36 12.87 15.27 11.51 16.64 10.75C18.16 10.14 19.83 10.44 20.82 11.58C21.73 12.72 21.58 14.55 20.66 15.76C19.75 16.9 18.46 17.51 17.09 17.59C15.88 17.59 14.81 16.83 13.9 15.76"/>`,
  // Acuario
  `<path d="M3 9.4L7.4 5.4L12 9.4L16.6 5.4L21 9.4M3 17.4L7.4 13.4L12 17.4L16.6 13.4L21 17.4"/>`,
  // Piscis
  `<path d="M4.6 3.6C9.6 6.4 9.6 17.6 4.6 20.4M19.4 3.6C14.4 6.4 14.4 17.6 19.4 20.4M4 12H20"/>`,
];

const wrap = (inner, cls) => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;

/** Símbolo de un cuerpo como <svg> para HTML, o null si no tiene (Asc, MC). */
export const bodySVG = (id, cls = "gsvg") => (BODY_SVG[id] ? wrap(BODY_SVG[id], cls) : null);
/** Símbolo de un signo (0 = Aries … 11 = Piscis) como <svg> para HTML. */
export const signSVG = (i, cls = "gsvg sgsvg") => wrap(SIGN_SVG[i], cls);

/**
 * Símbolo dentro de otro SVG (la rueda), centrado en (x, y) con `size` unidades de lado.
 * El trazo (grosor, color) lo decide la CSS de quien lo contiene.
 */
export function glyphAt(inner, x, y, size, cls = "gl") {
  const k = size / 24;
  return `<g class="${cls}" transform="translate(${(x - 12 * k).toFixed(2)} ${(y - 12 * k).toFixed(2)}) scale(${k.toFixed(4)})">${inner}</g>`;
}
