// Cuadro de aspectos en escalera: cada planeta es un círculo en la diagonal y, a su izquierda, un símbolo
// por cada aspecto que forma con los anteriores. Sin DOM: devuelve HTML (también se puede probar en node).
import { ASPECT, BODY, badge, esc, fmtOrb } from "./astro-data.js";

const phaseText = (a) => (a.applying === null || a.applying === undefined ? "" : a.applying ? " · aplicativo" : " · separativo");

/** Texto de un aspecto para el tooltip y la línea de información. */
export function aspectText(a) {
  return `${BODY[a.a].name} ${ASPECT[a.type].name.toLowerCase()} ${BODY[a.b].name} · orbe ${fmtOrb(a.orb)}${phaseText(a)}`;
}

/**
 * @param chart carta natal ({bodies, aspects})
 * @param orbMax orbe máximo en grados
 */
export function stairHTML(chart, orbMax) {
  const ids = [...chart.bodies.map((b) => b.id), "asc", "mc"];
  const found = new Map();
  for (const a of chart.aspects) {
    if (a.orb > orbMax) continue;
    found.set(`${a.a}|${a.b}`, a);
    found.set(`${a.b}|${a.a}`, a);
  }

  let html = `<div class="stair" style="--n:${ids.length}" role="table" aria-label="Cuadro de aspectos">`;
  ids.forEach((row, i) => {
    html += `<div class="srow" role="row">`;
    for (let j = 0; j < i; j++) {
      const a = found.get(`${ids[j]}|${row}`);
      if (!a) { html += `<div class="sc" role="cell"></div>`; continue; }
      const T = ASPECT[a.type];
      const text = esc(aspectText(a));
      html += `<div class="sc hit" role="cell" data-a="${ids[j]}" data-b="${row}" data-info="${text}" title="${text}">` +
        `<span class="a-ic ${T.cls}">${T.glyph}</span></div>`;
    }
    html += `<div class="sc diag" role="columnheader">${badge(row)}</div></div>`;
  });
  return html + `</div><p class="fine tight" id="stairInfo" aria-live="polite">Pasá el cursor por un aspecto para ver el orbe.</p>`;
}
