// Balance de elementos: una cruz con Fuego, Aire, Tierra y Agua y, en cada cuadrante, los planetas
// personales (Sol a Saturno), el Ascendente y, si es personal, el regente del Ascendente.
// Sin porcentajes ni conteos. Sin DOM: devuelve HTML (también se puede probar en node).
import { BODY, SIGNS, signHTML, badge, split } from "./astro-data.js";

export const PERSONAL = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"];
export const TRANSPERSONAL = new Set(["uranus", "neptune", "pluto"]);

// Regente de cada signo (Aries … Piscis). La regencia moderna da Escorpio, Acuario y Piscis a planetas
// transpersonales; la tradicional, a Marte, Saturno y Júpiter.
export const RULER = {
  modern: ["mars", "venus", "mercury", "moon", "sun", "mercury", "venus", "pluto", "jupiter", "saturn", "uranus", "neptune"],
  traditional: ["mars", "venus", "mercury", "moon", "sun", "mercury", "venus", "mars", "jupiter", "saturn", "saturn", "jupiter"],
};

const ELEMENT_OF_SIGN = ["fire", "earth", "air", "water"];      // índice de signo % 4
// Orden de la cruz: arriba izquierda, arriba derecha, abajo izquierda, abajo derecha
const QUADS = [["fire", "Fuego"], ["air", "Aire"], ["earth", "Tierra"], ["water", "Agua"]];

// Símbolos clásicos de los elementos (triángulos), dibujados como SVG: no dependen de la fuente.
const TRI = {
  fire: '<path d="M12 4 21 19H3z"/>',
  air: '<path d="M12 4 21 19H3z"/><path d="M6.6 13h10.8"/>',
  water: '<path d="M12 20 3 5h18z"/>',
  earth: '<path d="M12 20 3 5h18z"/><path d="M6.6 11h10.8"/>',
};
const elementIcon = (el) => `<svg class="eicon" viewBox="0 0 24 24" aria-hidden="true">${TRI[el]}</svg>`;

/** Qué hay que mostrar para una carta: los elementos de cada cuerpo y el regente del Ascendente. */
export function balance(chart, system = "modern") {
  const at = (lon) => { const s = split(lon); return { sign: s.sign, element: ELEMENT_OF_SIGN[s.sign % 4] }; };
  const asc = { id: "asc", lon: chart.angles.asc, ...at(chart.angles.asc) };
  const rulerId = RULER[system][asc.sign];
  const alt = RULER[system === "modern" ? "traditional" : "modern"][asc.sign];
  const planets = PERSONAL.map((id) => {
    const b = chart.bodies.find((x) => x.id === id);
    return { id, lon: b.lon, ...at(b.lon), ruler: id === rulerId };
  });
  return {
    asc, planets,
    ruler: { id: rulerId, shown: !TRANSPERSONAL.has(rulerId), alt, system },
  };
}

export function elementsHTML(chart, system = "modern") {
  const bal = balance(chart, system);
  const chip = (it, extra = "") => {
    const isAsc = it.id === "asc";
    return `<li class="chip${it.ruler ? " ruler" : ""}${isAsc ? " asc" : ""}" data-id="${it.id}">` +
      `${badge(it.id, "s")}<span class="nm">${isAsc ? "Ascendente" : BODY[it.id].name}</span>` +
      `<span class="sg">${SIGNS[it.sign]}</span>${extra}</li>`;
  };

  const box = ([el, name]) => {
    const items = [bal.asc, ...bal.planets].filter((it) => it.element === el);
    const list = items.length
      ? items.map((it) => chip(it, it.ruler ? `<span class="rl">regente del Asc</span>` : "")).join("")
      : `<li class="none">—</li>`;
    return `<section class="quad ${el}" aria-label="${name}"><h3>${elementIcon(el)}${name}</h3><ul>${list}</ul></section>`;
  };

  const R = bal.ruler;
  const name = (id) => BODY[id].name;
  const sys = system === "modern" ? "moderno" : "tradicional";
  const altSys = system === "modern" ? "tradicional" : "moderno";
  let note = `Ascendente en ${SIGNS[bal.asc.sign]} ${signHTML(bal.asc.sign)}. `;
  if (R.shown) {
    note += `Regente ${sys}: ${name(R.id)}, marcado en su cuadrante.`;
    if (R.alt !== R.id) note += ` Con la regencia ${altSys} sería ${name(R.alt)}${TRANSPERSONAL.has(R.alt) ? " (transpersonal, no se incluiría)" : ""}.`;
  } else {
    note += `Regente ${sys}: ${name(R.id)}, transpersonal, por eso no se incluye.`;
    if (R.alt !== R.id) note += ` Con la regencia ${altSys} sería ${name(R.alt)}.`;
  }
  note += " Se muestran el Sol, la Luna y los planetas hasta Saturno.";

  return `<div class="seg" id="rulerSys" role="group" aria-label="Regencia del Ascendente">` +
      `<button type="button" data-r="modern" aria-pressed="${system === "modern"}">Regente moderno</button>` +
      `<button type="button" data-r="traditional" aria-pressed="${system === "traditional"}">Regente tradicional</button></div>` +
    `<div class="cross">${QUADS.map(box).join("")}</div>` +
    `<p class="fine tight">${note}</p>`;
}
