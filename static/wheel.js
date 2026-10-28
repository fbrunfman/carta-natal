// Rueda natal en SVG. Ascendente a la izquierda, casas en sentido antihorario.
import { SIGNS, ELEMENT, BODY, ASPECT, split, fmtOrb, discWheel, look, bodyText, signText } from "./astro-data.js";
import { BODY_SVG, SIGN_SVG, glyphAt } from "./glyphs.js";
import { placePlanets, spreadRing } from "./layout.js";

// Radios en unidades del viewBox (690 × 690). Cada planeta es una pila radial:
// círculo con el símbolo, grados, signo y minutos (y "R" debajo si es retrógrado).
const R = {
  out: 310, signIn: 270, houseOut: 172, houseNum: 161, asp: 150, label: 320,
  glyph: 247, deg: 226, sign: 210.5, min: 196, retro: 184,
};
const SIZE = { disc: 24, sign: 14.5, band: 30 };       // diámetro del círculo, signo de la pila, signo del anillo

// Rueda doble: un anillo más allá del zodíaco para tránsitos o la otra carta.
// La pila va igual que la interior (símbolo hacia afuera, minutos hacia adentro) pero más compacta.
const OUT = { min: 324, sign: 339, deg: 354, glyph: 377, edge: 393, label: 398, view: 421, tick: 7 };
const SIZE_OUT = { disc: 25, sign: 15.5, band: 33 };

const pad = (n) => String(n).padStart(2, "0");
const rad = (d) => (d * Math.PI) / 180;
const n2 = (n) => Math.round(n * 100) / 100;
const norm360 = (x) => ((x % 360) + 360) % 360;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** φ = ángulo desde el Ascendente (grados, antihorario). φ=0 es la izquierda. */
const pt = (r, phi) => [n2(-r * Math.cos(rad(phi))), n2(r * Math.sin(rad(phi)))];

/** Disco centrado en el origen (para el relleno del anillo exterior). */
const disc = (r) => `M${-r} 0a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

function wedge(r1, r2, a1, a2) {
  const [x1, y1] = pt(r1, a1), [x2, y2] = pt(r1, a2);
  const [x3, y3] = pt(r2, a2), [x4, y4] = pt(r2, a1);
  return `M${x1} ${y1}A${r1} ${r1} 0 0 0 ${x2} ${y2}L${x3} ${y3}A${r2} ${r2} 0 0 1 ${x4} ${y4}Z`;
}

const OUTER = "o:";   // los ids del anillo exterior van con este prefijo

// Símbolos según el estilo: vectores propios (nuevo) o texto de la fuente del sistema (clásico).
// En el estilo nuevo el planeta va dentro de un círculo de color; en el clásico va solo.
const planetMark = (id, x, y, d) => {
  if (!look.classic) return discWheel(id, x, y, d);
  const t = bodyText(id);
  return t ? `<text class="pg" x="${x}" y="${y}" dy=".35em">${t}</text>` : glyphAt(BODY_SVG[id], x, y, 20, "pluto");
};
const ringSign = (i, x, y, size) => (look.classic
  ? `<text class="sgt" x="${x}" y="${y}" dy=".35em">${signText(i)}</text>`
  : glyphAt(SIGN_SVG[i], x, y, size, "sgn"));
const stackSign = (i, x, y, size) => (look.classic
  ? `<text class="sgdt" x="${x}" y="${y}" dy=".35em">${signText(i)}</text>`
  : glyphAt(SIGN_SVG[i], x, y, size, "sgd"));

export function renderWheel(svg, chart, hooks = {}) {
  const outer = hooks.outer || null;     // { bodies, angles?, aspects (a: interior, b: exterior), short, houseWord }
  // con lecturas, tocar un planeta abre su ventana; en «solo datos» (sin onPick) son solo imágenes con foco
  const act = hooks.onPick ? ' role="button" aria-haspopup="dialog"' : ' role="img"';
  const V = outer ? OUT.view : 345;
  svg.setAttribute("viewBox", `${-V} ${-V} ${2 * V} ${2 * V}`);
  svg.classList.toggle("bi", !!outer);
  svg.classList.toggle("classic", look.classic);

  const asc = chart.angles.asc;
  const phi = (lon) => norm360(lon - asc);
  const lonIn = (id) => (id === "asc" ? chart.angles.asc : id === "mc" ? chart.angles.mc : chart.bodies.find((b) => b.id === id).lon);
  const lonOut = (id) => (id === "asc" ? outer.angles.asc : id === "mc" ? outer.angles.mc : outer.bodies.find((b) => b.id === id).lon);
  const lonOf = (id) => (id.startsWith(OUTER) ? lonOut(id.slice(OUTER.length)) : lonIn(id));
  const short = outer ? esc(outer.short) : "";     // puede ser el nombre de una persona: va escapado
  const nameOf = (id) => (id.startsWith(OUTER)
    ? `${BODY[id.slice(OUTER.length)].name} (${short})`
    : BODY[id].name);
  const cusps = chart.houses.cusps;
  // Con anillo exterior solo se dibujan los aspectos cruzados; el exterior lleva prefijo.
  const aspects = outer ? outer.aspects.map((a) => ({ ...a, b: OUTER + a.b })) : chart.aspects;
  let s = "";

  if (outer) {
    s += `<path class="oband" fill-rule="evenodd" d="${disc(OUT.edge)}${disc(R.out)}"/><circle class="ring thin" r="${OUT.edge}"/>`;
  }

  // Anillo de signos: banda oscura con los símbolos en blanco (o, en el estilo clásico, transparente).
  // Cada signo es una cuña con la clase de su elemento: el tinte por elemento se activa desde la CSS.
  for (let i = 0; i < 12; i++) {
    const a1 = phi(i * 30);
    s += `<path class="sg sg-${ELEMENT[i % 4]}" d="${wedge(R.out, R.signIn, a1, a1 + 30)}"/>`;
  }
  s += `<circle class="ring" r="${R.out}"/><circle class="ring" r="${R.signIn}"/>`;
  s += `<circle class="ring thin" r="${R.houseOut}"/><circle class="ring thin" r="${R.asp}"/>`;
  for (let i = 0; i < 12; i++) {
    const a = phi(i * 30);
    const [x1, y1] = pt(R.out, a), [x2, y2] = pt(R.signIn, a);
    s += `<line class="sgline" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    const [gx, gy] = pt((R.out + R.signIn) / 2, a + 15);
    s += `<g class="sgw"><title>${SIGNS[i]}</title>${ringSign(i, gx, gy, outer ? SIZE_OUT.band : SIZE.band)}</g>`;
  }

  // Graduación cada 1°, 5° y 10°
  let ticks = "";
  for (let d = 0; d < 360; d++) {
    const len = d % 10 === 0 ? 9 : d % 5 === 0 ? 6 : 3.5;
    const a = phi(d);
    const [x1, y1] = pt(R.signIn, a), [x2, y2] = pt(R.signIn - len, a);
    ticks += `M${x1} ${y1}L${x2} ${y2}`;
  }
  s += `<path class="tick" d="${ticks}"/>`;

  // Cúspides y números de casa
  for (let i = 0; i < 12; i++) {
    const a = phi(cusps[i]);
    const axis = i % 3 === 0;
    const [ix, iy] = pt(R.asp, a), [mx, my] = pt(R.houseOut, a), [ox, oy] = pt(R.signIn, a);
    s += `<line class="cusp" x1="${mx}" y1="${my}" x2="${ox}" y2="${oy}"/>`;
    s += `<line class="cusp-in${axis ? " axis" : ""}" x1="${ix}" y1="${iy}" x2="${axis ? ox : mx}" y2="${axis ? oy : my}"/>`;
    const next = phi(cusps[(i + 1) % 12]);
    const mid = a + (norm360(next - a) || 360) / 2;
    const [hx, hy] = pt(R.houseNum, mid);
    s += `<text class="hnum" x="${hx}" y="${hy}" dy=".35em">${i + 1}</text>`;
  }

  // Etiquetas de ángulos fuera del anillo
  const mcPhi = phi(chart.angles.mc);
  for (const [text, a] of [["Asc", 0], ["MC", mcPhi], ["Dsc", 180], ["IC", norm360(mcPhi + 180)]]) {
    const [lx, ly] = pt(outer ? OUT.label : R.label, a);
    const anchor = lx < -12 ? "end" : lx > 12 ? "start" : "middle";
    // Asc y MC se pueden tocar para ver su lectura; Dsc e IC son solo rótulos
    const pick = (text === "Asc" || text === "MC") && !!hooks.onPick;
    s += `<text class="axis-label${pick ? " pick" : ""}" x="${lx}" y="${ly}" dy=".35em" text-anchor="${anchor}"` +
      `${pick ? ` data-pick="${text.toLowerCase()}" tabindex="0" role="button" aria-haspopup="dialog" aria-label="${text === "Asc" ? "Ascendente" : "Medio Cielo"}"` : ""}>${text}</text>`;
  }

  // Aspectos (sin línea para conjunciones)
  let lineSvg = "";
  for (const a of aspects) {
    if (a.type === "conjunction") continue;
    const [x1, y1] = pt(R.asp, phi(lonOf(a.a))), [x2, y2] = pt(R.asp, phi(lonOf(a.b)));
    const tier = a.orb < 1 ? "t1" : a.orb < 3 ? "t2" : "t3";
    lineSvg += `<line class="asp asp-${a.type} ${tier}" data-a="${a.a}" data-b="${a.b}" data-orb="${a.orb}" data-t="${a.type}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><title>${nameOf(a.a)} ${ASPECT[a.type].name.toLowerCase()} ${nameOf(a.b)}</title></line>`;
  }
  let dotSvg = "";
  for (const id of [...chart.bodies.map((b) => b.id), "asc", "mc"]) {
    const [x, y] = pt(R.asp, phi(lonIn(id)));
    dotSvg += `<circle class="adot" cx="${x}" cy="${y}" r="2"/>`;
  }
  if (outer) {
    for (const b of outer.bodies) {
      const [x, y] = pt(R.asp, phi(b.lon));
      dotSvg += `<circle class="adot out" cx="${x}" cy="${y}" r="2.3"/>`;
    }
  }
  s += `<g class="aspects">${lineSvg}</g>${dotSvg}`;

  // Planetas: cada uno queda dentro de su casa (ver layout.js)
  const placed = placePlanets(chart.bodies, cusps, asc);
  let planets = "";
  for (const b of chart.bodies) {
    const disp = placed[b.id];
    const at = (r) => pt(r, disp);
    const sp = split(b.lon);
    const [gx, gy] = at(R.glyph), [dx, dy] = at(R.deg), [sx, sy] = at(R.sign), [mx, my] = at(R.min);
    const [rx, ry] = at(R.retro);
    const [tx, ty] = pt(R.signIn - 10, phi(b.lon));      // posición real sobre la graduación
    const [lx, ly] = pt(R.glyph + SIZE.disc / 2 + 1, disp);
    const [h1x, h1y] = at(R.glyph + 14), [h2x, h2y] = at(b.retro ? R.retro - 7 : R.min - 7);
    const moved = Math.abs(((disp - phi(b.lon) + 540) % 360) - 180) > 0.6;
    planets +=
      `<g class="pl" data-id="${b.id}" data-house="${b.house}" data-disp="${n2(disp)}" tabindex="0"${act} ` +
      `aria-label="${BODY[b.id].name}, ${sp.deg} grados ${sp.min} minutos de ${SIGNS[sp.sign]}, casa ${b.house}${b.retro ? ", retrógrado" : ""}">` +
      (moved ? `<line class="link" x1="${tx}" y1="${ty}" x2="${lx}" y2="${ly}"/>` : "") +
      `<line class="hit" x1="${h1x}" y1="${h1y}" x2="${h2x}" y2="${h2y}"/>` +
      planetMark(b.id, gx, gy, SIZE.disc) +
      `<text class="degtxt" x="${dx}" y="${dy}" dy=".35em">${sp.deg}°</text>` +
      stackSign(sp.sign, sx, sy, SIZE.sign) +
      `<text class="mnt" x="${mx}" y="${my}" dy=".35em">${pad(sp.min)}′</text>` +
      (b.retro ? `<text class="rx" x="${rx}" y="${ry}" dy=".35em"><title>Retrógrado</title>R</text>` : "") +
      `</g>`;
  }
  s += planets;

  // Anillo exterior: pila compacta; solo se separan para no pisarse
  if (outer) {
    const spread = spreadRing(outer.bodies.map((b) => ({ id: b.id, lon: b.lon })));
    let ring = "";
    for (const b of outer.bodies) {
      const disp = phi(spread[b.id]);
      const real = phi(b.lon);
      const at = (r) => pt(r, disp);
      const sp = split(b.lon);
      const [gx, gy] = at(OUT.glyph), [dx, dy] = at(OUT.deg), [sx, sy] = at(OUT.sign), [mx, my] = at(OUT.min);
      const [rx, ry] = pt(OUT.glyph, disp + (look.classic ? 2.4 : 3));
      const [t1x, t1y] = pt(R.out, real), [t2x, t2y] = pt(R.out + OUT.tick, real);
      const [l1x, l1y] = pt(OUT.min - 8, disp);
      const moved = Math.abs(((disp - real + 540) % 360) - 180) > 0.6;
      const [h1x, h1y] = at(OUT.glyph + 8), [h2x, h2y] = at(OUT.min - 6);
      ring +=
        `<g class="pl out" data-id="${OUTER}${b.id}" data-disp="${n2(disp)}" ${b.house ? `data-house="${b.house}" ` : ""}tabindex="0"${act} ` +
        `aria-label="${BODY[b.id].name} (${short}), ${sp.deg} grados ${sp.min} minutos de ${SIGNS[sp.sign]}${b.house ? `, ${esc(outer.houseWord)} ${b.house}` : ""}${b.retro ? ", retrógrado" : ""}">` +
        `<line class="tickreal" x1="${t1x}" y1="${t1y}" x2="${t2x}" y2="${t2y}"/>` +
        (moved ? `<line class="link" x1="${t2x}" y1="${t2y}" x2="${l1x}" y2="${l1y}"/>` : "") +
        `<line class="hit" x1="${h1x}" y1="${h1y}" x2="${h2x}" y2="${h2y}"/>` +
        planetMark(b.id, gx, gy, SIZE_OUT.disc) +
        `<text class="degtxt" x="${dx}" y="${dy}" dy=".35em">${sp.deg}°</text>` +
        stackSign(sp.sign, sx, sy, SIZE_OUT.sign) +
        `<text class="mnt" x="${mx}" y="${my}" dy=".35em">${pad(sp.min)}′</text>` +
        (b.retro ? `<text class="rx" x="${rx}" y="${ry}" dy=".35em"><title>Retrógrado</title>R</text>` : "") +
        `</g>`;
    }
    s += ring;
  }

  s += `<g class="orbs" aria-hidden="true"></g>`;      // el orbe de cada línea resaltada (arriba de todo)
  svg.innerHTML = s;
  svg.setAttribute("aria-label", outer
    ? `Rueda doble de ${esc(chart.input.name || "la carta")} con ${esc(outer.label)}`
    : `Rueda natal de ${esc(chart.input.name || "la carta")}`);

  // ---- foco: resaltar un cuerpo y sus aspectos --------------------------
  const pls = [...svg.querySelectorAll(".pl")];
  const lines = [...svg.querySelectorAll(".asp")];

  // Orbe sobre cada línea resaltada: una etiqueta chica en el medio de la raya (o corrida a lo largo de ella si ahí
  // taparía a otra etiqueta). Las conjunciones no tienen raya, así que no llevan etiqueta.
  const orbLayer = svg.querySelector(".orbs");
  const SVGNS = "http://www.w3.org/2000/svg";
  const clearOrbs = () => { orbLayer.textContent = ""; };
  function showOrbs() {
    clearOrbs();
    const taken = [];
    const hit = (r) => taken.some((o) => r.x < o.x + o.w + 2 && r.x + r.w + 2 > o.x && r.y < o.y + o.h + 2 && r.y + r.h + 2 > o.y);
    const len = (l) => Math.hypot(l.getAttribute("x2") - l.getAttribute("x1"), l.getAttribute("y2") - l.getAttribute("y1"));
    // las rayas cortas tienen menos lugar donde poner la etiqueta: van primero, las largas se acomodan después
    for (const l of lines.filter((x) => x.classList.contains("on")).sort((p, q) => len(p) - len(q))) {
      const orb = Number(l.dataset.orb);
      if (!Number.isFinite(orb)) continue;
      const x1 = +l.getAttribute("x1"), y1 = +l.getAttribute("y1"), x2 = +l.getAttribute("x2"), y2 = +l.getAttribute("y2");
      const g = document.createElementNS(SVGNS, "g");
      g.setAttribute("class", `orb orb-${ASPECT[l.dataset.t]?.cls || "neutral"}`);
      g.dataset.a = l.dataset.a; g.dataset.b = l.dataset.b;
      const rect = document.createElementNS(SVGNS, "rect");
      const txt = document.createElementNS(SVGNS, "text");
      txt.setAttribute("dy", ".35em");
      txt.textContent = fmtOrb(orb);
      g.append(rect, txt);
      orbLayer.append(g);
      const bb = txt.getBBox();
      const w = bb.width + 9, h = bb.height + 3;
      // se prueba el medio y después se corre a lo largo de la raya; si en ningún lugar entra sin tapar a otra, queda donde menos tapa
      let spot = null, least = Infinity;
      for (const t of [0.5, 0.42, 0.58, 0.34, 0.66, 0.27, 0.73, 0.2, 0.8, 0.14, 0.86]) {
        const cx = x1 + (x2 - x1) * t, cy = y1 + (y2 - y1) * t;
        const r = { x: cx - w / 2, y: cy - h / 2, w, h };
        const cover = taken.reduce((sum, o) => sum + Math.max(0, Math.min(r.x + r.w, o.x + o.w) - Math.max(r.x, o.x)) * Math.max(0, Math.min(r.y + r.h, o.y + o.h) - Math.max(r.y, o.y)), 0);
        if (cover < least) { least = cover; spot = { cx, cy, r }; }
        if (!cover && !hit(r)) { spot = { cx, cy, r }; break; }
      }
      taken.push(spot.r);
      txt.setAttribute("x", n2(spot.cx)); txt.setAttribute("y", n2(spot.cy));
      for (const [k, v] of [["x", spot.r.x], ["y", spot.r.y], ["width", w], ["height", h], ["rx", 4]]) rect.setAttribute(k, n2(v));
    }
  }

  function reset() {
    svg.classList.remove("has-focus");
    for (const e of svg.querySelectorAll(".on, .rel, .sel")) e.classList.remove("on", "rel", "sel");
    clearOrbs();
  }
  function focus(id) {
    reset();
    svg.classList.add("has-focus");
    const rel = new Set();
    for (const a of aspects) {
      if (a.a === id) rel.add(a.b);
      else if (a.b === id) rel.add(a.a);
    }
    for (const l of lines) if (l.dataset.a === id || l.dataset.b === id) l.classList.add("on");
    for (const g of pls) {
      if (g.dataset.id === id) g.classList.add("sel");
      else if (rel.has(g.dataset.id)) g.classList.add("rel");
    }
    showOrbs();
  }
  function pair(a, b) {
    reset();
    svg.classList.add("has-focus");
    for (const l of lines) {
      if ((l.dataset.a === a && l.dataset.b === b) || (l.dataset.a === b && l.dataset.b === a)) l.classList.add("on");
    }
    for (const g of pls) if (g.dataset.id === a || g.dataset.id === b) g.classList.add("sel");
    showOrbs();
  }

  const pickable = (el, id) => {
    el.addEventListener("click", () => hooks.onPick?.(id));
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); hooks.onPick?.(id); }
    });
  };
  for (const t of svg.querySelectorAll(".axis-label.pick")) pickable(t, t.dataset.pick);
  for (const g of pls) {
    const id = g.dataset.id;
    pickable(g, id);
    g.addEventListener("mouseenter", () => { focus(id); hooks.onFocus?.(id); });
    g.addEventListener("focus", () => { focus(id); hooks.onFocus?.(id); });
    g.addEventListener("mouseleave", () => { reset(); hooks.onClear?.(); });
    g.addEventListener("blur", () => { reset(); hooks.onClear?.(); });
  }
  return { focus, pair, clear: reset };
}
