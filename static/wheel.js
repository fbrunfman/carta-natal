// Rueda natal en SVG. Ascendente a la izquierda, casas en sentido antihorario.
import { SIGNS, ELEMENT, BODY, ASPECT, split, fmtPos, fmtOrb, discWheel, look, bodyText, signText } from "./astro-data.js";
import { BODY_SVG, SIGN_SVG, ASPECT_SVG, glyphAt } from "./glyphs.js";
import { placePlanets, spreadRing } from "./layout.js";
import { roman } from "./trips.js";

// Radios en unidades del viewBox (690 × 690). Cada planeta es una pila radial:
// círculo con el símbolo, grados, signo y minutos (y "R" debajo si es retrógrado).
const R = {
  out: 310, signIn: 270, houseOut: 172, houseNum: 161, asp: 150, label: 320,
  glyph: 247, deg: 226, sign: 210.5, min: 196, retro: 184,
};
const SIZE = { disc: 24, sign: 14.5, band: 30 };       // diámetro del círculo, signo de la pila, signo del anillo

// Rueda doble: un anillo más allá del zodíaco para tránsitos o la otra carta.
// La pila va igual que la interior (símbolo hacia afuera, minutos hacia adentro) pero más compacta.
const OUT = { min: 324, sign: 339, deg: 354, glyph: 377, edge: 393, label: 398, view: 440, tick: 7 };
const SIZE_OUT = { disc: 25, sign: 15.5, band: 33 };

// Anillo exterior de las cúspides (se puede apagar en Configuración): una banda por afuera del zodíaco (en la rueda doble,
// por afuera del anillo de tránsitos) con los grados, el signo y los minutos de cada cúspide. Los bordes de las casas llegan hasta él.
const CUSP_RING = { natal: { in: R.out, out: 358, view: 394 }, bi: { in: OUT.edge, out: 441, view: 472 }, name: 15 };

/** Escala de la letra dentro de la rueda (la misma de --fw en la CSS): los rótulos del anillo se acomodan según ella. */
function wheelFont() {
  try {
    const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--fs"));
    return Math.min(1.25, Math.max(0.9, Number.isFinite(v) ? v : 1));
  } catch { return 1; }
}

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

// Cartelito de los planetas que pasan a otra casa: lo que sale al pasar el mouse (el <title>) se ve también al tocar o con Enter.
// Hay uno solo en toda la página; se cierra al tocar afuera, con Esc, al desplazar o achicar la ventana, o al redibujar la rueda.
let tipEl = null, tipFor = null, tipOff = null;
function hideTip() {
  tipEl?.remove();
  tipOff?.();
  tipEl = tipFor = tipOff = null;
}
function showTip(anchor, text, onRead) {
  hideTip();
  const el = document.createElement("div");
  el.className = "reach-tip";
  el.setAttribute("role", "tooltip");
  for (const line of String(text).split("\n")) {         // un párrafo por línea (un viaje puede llegar a una casa por más de un camino)
    const p = document.createElement("p");
    p.textContent = line;
    el.append(p);
  }
  if (onRead) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "reach-tip-read";
    b.textContent = "Ver lectura";
    b.addEventListener("click", () => { hideTip(); onRead(); });
    el.append(b);
  }
  document.body.append(el);
  const ref = (anchor.querySelector(".reach-ring") || anchor).getBoundingClientRect();
  const w = el.offsetWidth, h = el.offsetHeight, vw = document.documentElement.clientWidth, vh = window.innerHeight;
  let top = ref.top - h - 8;
  if (top < 8) top = Math.min(ref.bottom + 8, vh - h - 8);
  const left = Math.min(Math.max(8, ref.left + ref.width / 2 - w / 2), Math.max(8, vw - w - 8));
  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(Math.max(8, top))}px`;
  const away = (e) => { if (!el.contains(e.target) && !anchor.contains(e.target)) hideTip(); };
  const key = (e) => { if (e.key === "Escape") hideTip(); };
  document.addEventListener("pointerdown", away, true);
  document.addEventListener("keydown", key, true);
  window.addEventListener("scroll", hideTip, true);
  window.addEventListener("resize", hideTip);
  tipEl = el; tipFor = anchor;
  tipOff = () => {
    document.removeEventListener("pointerdown", away, true);
    document.removeEventListener("keydown", key, true);
    window.removeEventListener("scroll", hideTip, true);
    window.removeEventListener("resize", hideTip);
  };
}

export function renderWheel(svg, chart, hooks = {}) {
  hideTip();
  const outer = hooks.outer || null;     // { bodies, angles?, aspects (a: interior, b: exterior), short, houseWord }
  // con lecturas, tocar un planeta abre su ventana; en «solo datos» (sin onPick) son solo imágenes con foco
  const act = hooks.onPick ? ' role="button" aria-haspopup="dialog"' : ' role="img"';
  const ring = look.cuspRing;
  const band = outer ? CUSP_RING.bi : CUSP_RING.natal;
  const V = ring ? band.view : outer ? OUT.view : 360;   // más allá del zodíaco quedan los rótulos de los ejes y los grados de las cúspides
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

  if (ring) s += `<path class="oband" fill-rule="evenodd" d="${disc(band.out)}${disc(band.in)}"/><circle class="ring thin" r="${band.out}"/>`;

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
  const cuspSeg = [];
  for (let i = 0; i < 12; i++) {
    const a = phi(cusps[i]);
    const axis = i % 3 === 0;
    const [ix, iy] = pt(R.asp, a), [mx, my] = pt(R.houseOut, a), [ox, oy] = pt(R.signIn, a);
    s += `<line class="cusp" x1="${mx}" y1="${my}" x2="${ox}" y2="${oy}"/>`;
    s += `<line class="cusp-in${axis ? " axis" : ""}" x1="${ix}" y1="${iy}" x2="${axis ? ox : mx}" y2="${axis ? oy : my}"/>`;
    if (ring) {
      // el borde de la casa salta el anillo de signos (no lo pisa) y sigue por afuera: en la rueda doble, por el anillo de
      // tránsitos (más tenue), y por la banda de las cúspides, donde cuspRingSvg() lo dibuja con un hueco para el signo
      const seg = (r1, r2, cls) => `<path class="${cls}${axis ? " axis" : ""}" d="M${pt(r1, a).join(" ")}L${pt(r2, a).join(" ")}"/>`;
      if (outer) s += seg(R.out, OUT.edge, "cusp-o");
      cuspSeg[i] = (r1, r2) => seg(r1, r2, "cusp-b");
    }
    const next = phi(cusps[(i + 1) % 12]);
    const mid = a + (norm360(next - a) || 360) / 2;
    const [hx, hy] = pt(R.houseNum, mid);
    s += `<text class="hnum" x="${hx}" y="${hy}" dy=".35em">${i + 1}</text>`;
  }

  // Anillo de las cúspides: cada una lleva grados · signo (del color de su elemento) · minutos, apilados a lo largo del arco, con el
  // signo sobre el borde de su casa. Los rótulos de los ejes (Asc, MC, Dsc, IC) quedan afuera del anillo.
  function cuspRingSvg() {
    const fw = wheelFont();
    const mid = (band.in + band.out) / 2;
    const mcPhi = phi(chart.angles.mc);
    const axes = [["Asc", 0], ["MC", mcPhi], ["Dsc", 180], ["IC", norm360(mcPhi + 180)]];
    const gap = (x, y) => ((x - y + 540) % 360) - 180;                // diferencia con signo, de -180 a 180
    const items = cusps.map((lon, i) => ({ i, lon, a: phi(lon), pos: phi(lon), k: -1 }));
    for (const it of items) {                                          // la cúspide que cae justo en un eje lleva su nombre
      const k = axes.findIndex(([, ang]) => Math.abs(gap(it.a, ang)) < 0.5);
      if (k >= 0 && !items.some((o) => o.k === k)) it.k = k;
    }
    // Si dos cúspides quedan tan cerca que sus rótulos se pisarían (casas de tamaños muy distintos), se separan un poco.
    const sep = ((48 * fw) / mid) * (180 / Math.PI);                   // ≈ 8° con la letra normal
    const order = [...items].sort((p, q) => p.a - q.a);
    for (let n = 0; n < 80; n++) {
      let moved = false;
      for (let j = 0; j < order.length; j++) {
        const p = order[j], q = order[(j + 1) % order.length];
        const d = norm360(q.pos - p.pos);
        if (d < sep - 0.01) { const m = (sep - d) / 2; p.pos -= m; q.pos += m; moved = true; }
      }
      if (!moved) break;
    }

    const text = (t, x, y) => `<text class="cuspt" x="${n2(x)}" y="${n2(y)}" dy=".35em">${t}</text>`;
    const sign = (i, x, y) => (look.classic
      ? `<text class="cs-t el-${ELEMENT[i % 4]}" x="${n2(x)}" y="${n2(y)}" dy=".35em">${signText(i)}</text>`
      : glyphAt(SIGN_SVG[i], x, y, 13 * fw, `sgd cs el-${ELEMENT[i % 4]}`));
    let out = "";
    for (const it of items) {
      const shifted = Math.abs(gap(it.pos, it.a)) > 0.3;
      // el borde de la casa por la banda: con hueco para el signo si el rótulo está sobre él
      const h = 9 * fw;
      out += shifted ? cuspSeg[it.i](band.in, band.out) : cuspSeg[it.i](band.in, mid - h) + cuspSeg[it.i](mid + h, band.out);
      // la pila: grados · signo · minutos a lo largo del arco, leída de arriba abajo o de izquierda a derecha
      const sp = split(it.lon), [x, y] = pt(mid, it.pos);
      let tx = Math.sin(rad(it.pos)), ty = Math.cos(rad(it.pos));
      if (ty < -0.2 || (Math.abs(ty) <= 0.2 && tx < 0)) { tx = -tx; ty = -ty; }
      const st = 1 / Math.hypot(tx / (16 * fw), ty / (13 * fw));
      const P = (m) => [x + m * st * tx, y + m * st * ty];
      out += `<g class="cuspl" data-cusp="${it.i + 1}"${it.k >= 0 ? ` data-cusp-axis="${axes[it.k][0].toLowerCase()}"` : ""}>` +
        `<title>Cúspide de la casa ${it.i + 1}: ${sp.deg}°${pad(sp.min)}′ de ${SIGNS[sp.sign]}</title>` +
        text(`${sp.deg}°`, ...P(-1)) + sign(sp.sign, ...P(0)) + text(`${pad(sp.min)}′`, ...P(1)) + `</g>`;
    }
    for (const [name, ang] of axes) {
      const [nx, ny] = pt(band.out + CUSP_RING.name, ang);
      // Asc y MC se pueden tocar para ver su lectura; Dsc e IC son solo rótulos
      const pick = (name === "Asc" || name === "MC") && !!hooks.onPick;
      out += `<text class="axis-label${pick ? " pick" : ""}" text-anchor="middle" x="${nx}" y="${ny}" dy=".35em"` +
        `${pick ? ` data-pick="${name.toLowerCase()}" tabindex="0" role="button" aria-haspopup="dialog" aria-label="${name === "Asc" ? "Ascendente" : "Medio Cielo"}"` : ""}>${name}</text>`;
    }
    return out;
  }

  if (!ring) {
    // Fuera del anillo: los rótulos de los ejes (Asc, MC, Dsc, IC) y los grados y minutos de la cúspide de cada casa.
    // Si una cúspide cae justo en un eje (lo normal: la cúspide 1 es el Ascendente), su grado va debajo del rótulo;
    // si cae cerca de uno, se corre un poco para no pisarlo.
    const mcPhi = phi(chart.angles.mc);
    const axes = [["Asc", 0], ["MC", mcPhi], ["Dsc", 180], ["IC", norm360(mcPhi + 180)]];
    const rl = outer ? OUT.label : R.label;
    const gap = (x, y) => ((x - y + 540) % 360) - 180;                 // diferencia con signo, de -180 a 180
    const axisDeg = {};                                                // índice de eje → texto del grado
    const loose = [];                                                  // cúspides que no coinciden con ningún eje
    cusps.forEach((c, i) => {
      const a = phi(c);
      const k = axes.findIndex(([, ang]) => Math.abs(gap(a, ang)) < 0.5);
      if (k >= 0 && !(k in axisDeg)) axisDeg[k] = fmtPos(c);
      else loose.push({ i, a, text: fmtPos(c) });
    });
    for (const l of loose) {
      for (const [, ang] of axes) {
        const d = gap(l.a, ang);
        if (Math.abs(d) < 6.5) l.a = ang + (d < 0 ? -6.5 : 6.5);      // lejos del rótulo del eje
      }
      const [lx, ly] = pt(rl, l.a);
      const anchor = lx < -12 ? "end" : lx > 12 ? "start" : "middle";
      s += `<text class="cusplbl" data-cusp="${l.i + 1}" x="${lx}" y="${ly}" dy=".35em" text-anchor="${anchor}">${l.text}</text>`;
    }
    axes.forEach(([text, a], k) => {
      const [lx, ly] = pt(rl, a);
      const anchor = lx < -12 ? "end" : lx > 12 ? "start" : "middle";
      // Asc y MC se pueden tocar para ver su lectura; Dsc e IC son solo rótulos
      const pick = (text === "Asc" || text === "MC") && !!hooks.onPick;
      const attrs = `class="axis-label${pick ? " pick" : ""}" text-anchor="${anchor}"` +
        `${pick ? ` data-pick="${text.toLowerCase()}" tabindex="0" role="button" aria-haspopup="dialog" aria-label="${text === "Asc" ? "Ascendente" : "Medio Cielo"}"` : ""}`;
      if (!(k in axisDeg)) {
        s += `<text ${attrs} x="${lx}" y="${ly}" dy=".35em">${text}</text>`;
        return;
      }
      // el rótulo y, junto a él, el grado de la cúspide: a los costados uno sobre otro; arriba o abajo, el grado del lado
      // del anillo y el rótulo más afuera
      const line = (t, x, y, cls = "") => `<tspan${cls ? ` class="${cls}"` : ""} x="${x}" y="${y}" dy=".35em">${t}</tspan>`;
      const deg = (x, y) => line(axisDeg[k], x, y, "cusplbl").replace("<tspan ", `<tspan data-cusp-axis="${text.toLowerCase()}" `);
      if (Math.abs(lx) < 12) {
        const off = ly < 0 ? -12 : 12;
        s += `<text ${attrs} x="${lx}" y="${ly}">${deg(lx, ly)}${line(text, lx, ly + off)}</text>`;
      } else {
        s += `<text ${attrs} x="${lx}" y="${ly}">${line(text, lx, ly - 6)}${deg(lx, ly + 7)}</text>`;
      }
    });
  } else {
    s += cuspRingSvg();
  }

  // Aspectos. Las conjunciones no llevan raya: un circulito rojo en el punto medio entre los dos cuerpos.
  let lineSvg = "", markSvg = "";
  for (const a of aspects) {
    const p1 = phi(lonOf(a.a)), p2 = phi(lonOf(a.b));
    if (a.type === "conjunction") {
      const [cx, cy] = pt(R.asp, p1 + (((p2 - p1 + 540) % 360) - 180) / 2);
      lineSvg += `<circle class="asp asp-conjunction conj" data-a="${a.a}" data-b="${a.b}" data-orb="${a.orb}" data-t="conjunction" cx="${cx}" cy="${cy}" r="4.6"><title>${nameOf(a.a)} conjunción ${nameOf(a.b)}</title></circle>`;
      continue;
    }
    const [x1, y1] = pt(R.asp, p1), [x2, y2] = pt(R.asp, p2);
    const tier = a.orb < 1 ? "t1" : a.orb < 3 ? "t2" : "t3";
    lineSvg += `<line class="asp asp-${a.type} ${tier}" data-a="${a.a}" data-b="${a.b}" data-orb="${a.orb}" data-t="${a.type}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><title>${nameOf(a.a)} ${ASPECT[a.type].name.toLowerCase()} ${nameOf(a.b)}</title></line>`;
    // el símbolo del aspecto, en el punto medio de la raya (con un fondo del color del mandala que la interrumpe)
    const mx = n2((x1 + x2) / 2), my = n2((y1 + y2) / 2);
    markSvg += `<g class="amark amark-${a.type} ${tier}" data-a="${a.a}" data-b="${a.b}" data-t="${a.type}" data-x="${mx}" data-y="${my}">` +
      `<title>${nameOf(a.a)} ${ASPECT[a.type].name.toLowerCase()} ${nameOf(a.b)} · orbe ${fmtOrb(a.orb)}</title>` +
      `<circle class="amk-bg" cx="${mx}" cy="${my}" r="7.4"/>${glyphAt(ASPECT_SVG[a.type], mx, my, a.type === "sesquiquadrate" ? 13.5 : 11.5, "amk-ic")}</g>`;
  }
  let dotSvg = "";
  for (const id of chart.bodies.map((b) => b.id)) {
    const [x, y] = pt(R.asp, phi(lonIn(id)));
    dotSvg += `<circle class="adot" cx="${x}" cy="${y}" r="2"/>`;
  }
  if (outer) {
    for (const b of outer.bodies) {
      const [x, y] = pt(R.asp, phi(b.lon));
      dotSvg += `<circle class="adot out" cx="${x}" cy="${y}" r="2.3"/>`;
    }
  }
  s += `<g class="aspects">${lineSvg}</g><g class="amarks">${markSvg}</g>${dotSvg}`;

  // Planetas entre casas (solo en la rueda natal, y si se pidió): se cuenta hacia adelante, así que cada planeta marcado está
  // antes de una cúspide. Si cuenta solo en la casa que sigue («pass»), su pila se dibuja allá, con un borde macizo; si cuenta en las
  // dos («both»), queda su pila en la casa propia y otra, con borde punteado, en la que sigue. Una raya sale de su posición real.
  const reachBy = {};
  if (!outer) for (const r of hooks.reach || []) if (chart.bodies.some((b) => b.id === r.id)) reachBy[r.id] = r;
  const GHOST = "g:";
  const TRIP = "t:";
  // Viajes de los planetas (solo en la rueda natal, y si se pidió): cada planeta viajero se dibuja en la casa a la que viaja
  // (una pila chica, con borde según el tipo de viaje) y, al enfocarlo, una flecha va desde su lugar hasta ahí.
  const trips = !outer ? (hooks.trips || []).filter((g) => chart.bodies.some((b) => b.id === g.id)) : [];
  const tripKey = (g) => `${TRIP}${g.id}:${g.to}`;
  const reachText = (r) => {
    const name = BODY[r.id].name;
    return `${name} está en la casa ${r.house}, a ${fmtOrb(r.dist)} de la cúspide de la ${r.also}: ` +
      (r.kind === "pass" ? `cuenta en la ${r.also} y no en la ${r.house}` : `cuenta en las dos, la ${r.house} y la ${r.also}`);
  };

  // Planetas: cada uno queda dentro de su casa (ver layout.js). Los que pasan a la casa que sigue se reparten en ella:
  // como recién pasaron la cúspide, quedan antes que los de esa casa (y, entre ellos, en el orden de la rueda).
  const items = [];
  for (const b of chart.bodies) {
    const r = reachBy[b.id];
    const lead = r ? { id: b.id, lon: cusps[r.also - 1] + (15 - r.dist) * 0.01, house: r.also } : null;
    if (r?.kind === "pass") items.push(lead);
    else items.push({ id: b.id, lon: b.lon, house: b.house });
    if (r?.kind === "both") items.push({ ...lead, id: GHOST + b.id });
  }
  // los viajeros van al final de la casa a la que viajan (el reparto los separa de los que ya estén ahí)
  trips.forEach((g, i) => items.push({ id: tripKey(g), lon: cusps[g.to % 12] - 0.5 + i * 0.001, house: g.to }));
  const placed = placePlanets(items, cusps, asc);
  let planets = "";
  const stack = (b, key, r, ghost) => {
    const disp = placed[key];
    const at = (rad) => pt(rad, disp);
    const sp = split(b.lon);
    const [gx, gy] = at(R.glyph), [dx, dy] = at(R.deg), [sx, sy] = at(R.sign), [mx, my] = at(R.min);
    const [rx, ry] = at(R.retro);
    const [tx, ty] = pt(R.signIn - 10, phi(b.lon));      // posición real sobre la graduación
    const [lx, ly] = pt(R.glyph + SIZE.disc / 2 + 1, disp);
    const [h1x, h1y] = at(R.glyph + 14), [h2x, h2y] = at(b.retro ? R.retro - 7 : R.min - 7);
    const moved = Math.abs(((disp - phi(b.lon) + 540) % 360) - 180) > 0.6;
    const tip = r ? reachText(r) : "";
    const cls = r ? ` reach reach-${r.kind}${ghost ? " ghost" : ""}` : "";
    return `<g class="pl${cls}" data-id="${b.id}" data-house="${b.house}" data-disp="${n2(disp)}"` +
      (r ? ` data-also="${r.also}" data-tip="${esc(tip)}"` : "") + ` tabindex="0"${act} ` +
      `aria-label="${BODY[b.id].name}, ${sp.deg} grados ${sp.min} minutos de ${SIGNS[sp.sign]}, casa ${b.house}${b.retro ? ", retrógrado" : ""}${r ? `. ${esc(tip)}` : ""}">` +
      (r ? `<title>${esc(tip)}</title>` : "") +
      (moved ? `<line class="link" x1="${tx}" y1="${ty}" x2="${lx}" y2="${ly}"/>` : "") +
      `<line class="hit" x1="${h1x}" y1="${h1y}" x2="${h2x}" y2="${h2y}"/>` +
      (r ? `<circle class="reach-ring" cx="${gx}" cy="${gy}" r="${look.classic ? 15.5 : SIZE.disc / 2 + 1.7}"/>` : "") +
      planetMark(b.id, gx, gy, SIZE.disc) +
      `<text class="degtxt" x="${dx}" y="${dy}" dy=".35em">${sp.deg}°</text>` +
      stackSign(sp.sign, sx, sy, SIZE.sign) +
      `<text class="mnt" x="${mx}" y="${my}" dy=".35em">${pad(sp.min)}′</text>` +
      (b.retro ? `<text class="rx" x="${rx}" y="${ry}" dy=".35em"><title>Retrógrado</title>R</text>` : "") +
      `</g>`;
  };
  for (const b of chart.bodies) {
    const r = reachBy[b.id];
    planets += stack(b, b.id, r, false);
    if (r?.kind === "both") planets += stack(b, GHOST + b.id, r, true);
  }

  // el viajero: solo el círculo del planeta, con borde macizo (por aspecto), doble (por eje) o punteado (por implicancia)
  const tripStack = (g) => {
    const disp = placed[tripKey(g)];
    const ringR = look.classic ? 15.5 : SIZE.disc / 2 + 1.7;
    const [gx, gy] = pt(R.glyph, disp), [h1x, h1y] = pt(R.glyph + 15, disp), [h2x, h2y] = pt(R.glyph - 15, disp);
    const words = esc(g.words);
    return `<g class="pl trip trip-${g.kind}" data-id="${g.id}" data-house="${g.to}" data-from="${g.from}" data-disp="${n2(disp)}" data-tip="${words}" tabindex="0"${act} ` +
      `aria-label="${BODY[g.id].name} viaja a la casa ${roman(g.to)}. ${words.replace(/\n/g, " ")}">` +
      `<title>${words}</title><line class="hit" x1="${h1x}" y1="${h1y}" x2="${h2x}" y2="${h2y}"/>` +
      `<circle class="trip-ring" cx="${gx}" cy="${gy}" r="${ringR}"/>` +
      (g.kind === "axis" ? `<circle class="trip-ring trip-ring2" cx="${gx}" cy="${gy}" r="${ringR + 3.3}"/>` : "") +
      `${planetMark(g.id, gx, gy, SIZE.disc)}</g>`;
  };
  let arrows = "";
  for (const g of trips) {
    const a1 = placed[g.id], a2 = placed[tripKey(g)];
    const gap = Math.abs(((a2 - a1 + 540) % 360) - 180);                   // 0°..180° entre un lugar y el otro
    const mid = a1 + (((a2 - a1 + 540) % 360) - 180) / 2;
    const [x1, y1] = pt(R.glyph - 15, a1), [x2, y2] = pt(R.glyph - 17, a2), [cx, cy] = pt(R.asp * (1 - gap / 180) * 0.95, mid);
    arrows += `<path class="trip-arrow" data-id="${g.id}" data-house="${g.to}" d="M${x1} ${y1}Q${cx} ${cy} ${x2} ${y2}" marker-end="url(#trip-head)"/>`;
  }
  if (arrows) {
    s += `<defs><marker id="trip-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path class="trip-head" d="M0 0L10 5L0 10z"/></marker></defs>`;
  }
  s += `<g class="trip-arrows" aria-hidden="true">${arrows}</g>` + planets + trips.map(tripStack).join("");

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
  const marks = [...svg.querySelectorAll(".amark")];             // los símbolos que van sobre las rayas
  const tripArrows = [...svg.querySelectorAll(".trip-arrow")];    // las flechas de los viajes (solo se ven con el planeta enfocado)

  // Orbe sobre cada línea resaltada: una etiqueta chica en el medio de la raya (o corrida a lo largo de ella si ahí
  // taparía a otra etiqueta). En las conjunciones, que no tienen raya, va al lado del circulito rojo.
  const orbLayer = svg.querySelector(".orbs");
  const SVGNS = "http://www.w3.org/2000/svg";
  const clearOrbs = () => { orbLayer.textContent = ""; };
  function showOrbs() {
    clearOrbs();
    // los símbolos de las rayas resaltadas ya ocupan su lugar: la etiqueta del orbe se corre para no taparlos
    const taken = marks.filter((m) => m.classList.contains("on")).map((m) => ({ x: +m.dataset.x - 8, y: +m.dataset.y - 8, w: 16, h: 16 }));
    const hit = (r) => taken.some((o) => r.x < o.x + o.w + 2 && r.x + r.w + 2 > o.x && r.y < o.y + o.h + 2 && r.y + r.h + 2 > o.y);
    const conj = (l) => l.dataset.t === "conjunction";
    const len = (l) => (conj(l) ? 0 : Math.hypot(l.getAttribute("x2") - l.getAttribute("x1"), l.getAttribute("y2") - l.getAttribute("y1")));
    // las rayas cortas tienen menos lugar donde poner la etiqueta: van primero, las largas se acomodan después
    for (const l of lines.filter((x) => x.classList.contains("on")).sort((p, q) => len(p) - len(q))) {
      const orb = Number(l.dataset.orb);
      if (!Number.isFinite(orb)) continue;
      const isConj = conj(l);
      const x1 = +l.getAttribute(isConj ? "cx" : "x1"), y1 = +l.getAttribute(isConj ? "cy" : "y1");
      const x2 = isConj ? x1 : +l.getAttribute("x2"), y2 = isConj ? y1 : +l.getAttribute("y2");
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
      const sx = w / 2 + 9;
      const tries = isConj ? [[0, -15], [0, 15], [sx, 0], [-sx, 0], [0, -29], [0, 29], [sx, -15], [-sx, 15], [sx, 15], [-sx, -15], [0, -43], [0, 43], [sx, -29], [-sx, 29]]
        : [0.5, 0.42, 0.58, 0.34, 0.66, 0.27, 0.73, 0.2, 0.8, 0.14, 0.86];
      for (const t of tries) {
        const cx = isConj ? x1 + t[0] : x1 + (x2 - x1) * t, cy = isConj ? y1 + t[1] : y1 + (y2 - y1) * t;
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
    for (const l of [...lines, ...marks]) if (l.dataset.a === id || l.dataset.b === id) l.classList.add("on");
    for (const g of pls) {
      if (g.dataset.id === id) g.classList.add("sel");
      else if (rel.has(g.dataset.id)) g.classList.add("rel");
    }
    for (const a of tripArrows) if (a.dataset.id === id) a.classList.add("on");
    showOrbs();
  }
  function pair(a, b) {
    reset();
    svg.classList.add("has-focus");
    for (const l of [...lines, ...marks]) {
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
  // los planetas que pasan a otra casa muestran su explicación al tocarlos; la lectura queda en un botón del cartelito
  const tipable = (g, id) => {
    const toggle = () => {
      if (tipFor === g) hideTip();
      else showTip(g, g.dataset.tip, hooks.onPick ? () => hooks.onPick(id) : null);
    };
    g.addEventListener("click", toggle);
    g.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
    });
  };
  for (const g of pls) {
    const id = g.dataset.id;
    if (g.dataset.tip) tipable(g, id); else pickable(g, id);
    g.addEventListener("mouseenter", () => { focus(id); hooks.onFocus?.(id); });
    g.addEventListener("focus", () => { focus(id); hooks.onFocus?.(id); });
    g.addEventListener("mouseleave", () => { reset(); hooks.onClear?.(); });
    g.addEventListener("blur", () => { reset(); hooks.onClear?.(); });
  }
  return { focus, pair, clear: reset };
}
