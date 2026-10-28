// El cielo de ahora visto desde la Tierra: el mapa del inicio. La Tierra está en el centro, los 12 signos alrededor
// (Aries a la derecha y los signos van en contra de las agujas del reloj, como la eclíptica vista desde el norte) y el
// Sol y los planetas en su longitud real. Sin DOM: las funciones reciben lo que calculó el servidor (/api/moon →
// planets) y el ancho del mapa en píxeles, y devuelven posiciones o HTML; así también se pueden probar en node.
import { BODY, SIGNS, ELEMENT, badge, signHTML } from "./astro-data.js";

const clamp = (lo, x, hi) => Math.min(hi, Math.max(lo, x));
const RAD = Math.PI / 180;

/** Del más cerca al más lejos de la Tierra (el orden de siempre): cada uno arranca en su anillo. */
export const ORDER = ["moon", "mercury", "venus", "sun", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
const RMIN = 0.11;                                      // radio de los planetas, como parte del ancho del mapa
const rmax = (W) => (W < 480 ? 0.385 : 0.35);           // en un celular los signos son solo el símbolo: queda más lugar
export const NAMES_FROM = 480;                          // desde este ancho se escriben los nombres de los signos

/** Tamaños en píxeles según el ancho del mapa (la CSS usa las mismas proporciones con cqw). */
export function sizes(W) {
  return {
    badge: clamp(20, 0.044 * W, 34), sun: clamp(25, 0.058 * W, 44), font: clamp(10, 0.019 * W, 13.5),
    glyph: clamp(16, 0.044 * W, 30), signName: clamp(9, 0.0185 * W, 13), names: W >= NAMES_FROM,
  };
}

/** Punto del borde del cuadrado (0–100) en la dirección `deg`, medido desde el centro. */
function edge(deg, inset = 0) {
  const c = Math.cos(deg * RAD), s = Math.sin(deg * RAD);
  const t = (50 - inset) / Math.max(Math.abs(c), Math.abs(s));
  return [50 + t * c, 50 - t * s];
}
/** Donde va el rótulo del signo k: en el borde, en la mitad de su sector. */
export const signPos = (k) => edge(30 * k + 15, 7);

const f = (n) => Math.round(n * 100) / 100;

/** Lo que no cambia: sectores de color, las 12 líneas que pasan por la Tierra, los signos y la Tierra. */
export function skyShellHTML(W) {
  const wedges = [], rays = [];
  for (let k = 0; k < 12; k++) {
    const pts = [[50, 50], edge(30 * k)];
    for (const corner of [45, 135, 225, 315]) if (corner > 30 * k && corner < 30 * k + 30) pts.push(edge(corner));
    pts.push(edge(30 * k + 30));
    wedges.push(`<polygon class="sky-w ${ELEMENT[k % 4]}" points="${pts.map(([x, y]) => `${f(x)},${f(y)}`).join(" ")}"/>`);
    const [x, y] = edge(30 * k);
    rays.push(`<line x1="50" y1="50" x2="${f(x)}" y2="${f(y)}"/>`);
  }
  const rings = [15, 26, 37].map((r) => `<circle cx="50" cy="50" r="${r}"/>`).join("");
  const signs = SIGNS.map((n, k) => {
    const [x, y] = signPos(k);
    return `<span class="sky-sign ${ELEMENT[k % 4]}" style="left:${f(x)}%;top:${f(y)}%"><span class="g">${signHTML(k)}</span>` +
      `<span class="sky-sn">${n}</span></span>`;
  }).join("");
  return `<svg class="sky-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">` +
    `${wedges.join("")}<g class="sky-rings">${rings}</g><g class="sky-rays">${rays.join("")}</g></svg>` +
    `${signs}<span class="sky-earth" aria-hidden="true"><span class="sky-earth-nm">Tierra</span></span>`;
}

/**
 * Dónde dibujar cada planeta. Cada uno está en el ángulo de su longitud (eso no se toca); lo único que cambia es qué
 * tan lejos del centro: arranca en el anillo de su lugar en el orden y, si dos quedarían encimados (una conjunción),
 * se separan hacia adentro y hacia afuera. Después se decide de qué lado va el nombre, si hay lugar.
 * @param planets [{id, lon, retro}] · @param W ancho del mapa en px
 * @param obstacles rectángulos {x0,y0,x1,y1} en px (relativos al mapa) que no se pueden tapar, como el rincón de la Luna
 * @returns [{id, x, y (en %), d (diámetro px), side: "right"|"left"|"below"|"above"|null}]
 */
export function layoutSky(planets, W, obstacles = []) {
  const z = sizes(W), half = W / 2;
  const lo = RMIN * W, hi = rmax(W) * W;
  const place = (shrink) => {
    const P = planets.map((p, i) => {
      const slot = ORDER.indexOf(p.id);
      const k = slot < 0 ? i : slot;
      return { p, a: p.lon * RAD, r: lo + ((hi - lo) * k) / (ORDER.length - 1), d: (p.id === "sun" ? z.sun : z.badge) * shrink };
    });
    const at = (q) => [half + q.r * Math.cos(q.a), half - q.r * Math.sin(q.a)];

    for (let it = 0; it < 160; it++) {
      let moved = false;
      for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
        const A = P[i], B = P[j];
        const [ax, ay] = at(A), [bx, by] = at(B);
        const need = ((A.d + B.d) / 2) * 1.22, dist = Math.hypot(ax - bx, ay - by);
        if (dist >= need) continue;
        const [inner, outer] = A.r <= B.r ? [A, B] : [B, A];
        const push = (need - dist) / 2 + 0.6;
        const room = inner.r - lo;                         // lo que el de adentro todavía puede bajar
        const down = Math.min(push, Math.max(0, room));
        inner.r -= down;
        outer.r = Math.min(hi, outer.r + push + (push - down));
        moved = true;
      }
      for (const q of P) for (const o of obstacles) {      // sin tapar los rectángulos de afuera: se corre hacia el centro
        for (let guard = 0; guard < 80 && q.r > lo; guard++) {
          const [x, y] = at(q);
          const cx = clamp(o.x0, x, o.x1), cy = clamp(o.y0, y, o.y1);
          if (Math.hypot(x - cx, y - cy) >= q.d / 2 + 3) break;
          q.r -= 2; moved = true;
        }
      }
      if (!moved) break;
    }
    let tight = Infinity;                                  // qué tan cerca quedó el par más apretado (1 = justo tocándose)
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      const [ax, ay] = at(P[i]), [bx, by] = at(P[j]);
      tight = Math.min(tight, Math.hypot(ax - bx, ay - by) / ((P[i].d + P[j].d) / 2));
    }
    return { P, at, tight };
  };
  // si en un grupo muy apretado (varios planetas casi en la misma dirección) no hay lugar, los círculos se achican un poco
  let L = place(1);
  for (const k of [0.88, 0.78]) if (L.tight < 1) L = place(k);
  const { P, at } = L;

  // nombres: del lado donde haya lugar (derecha, izquierda, abajo, arriba); si no entra, queda sin nombre
  const box = (cx, cy, w, h) => ({ x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 });
  const placed = [...obstacles];
  for (let k = 0; k < 12; k++) {                         // los signos del borde
    const [sx, sy] = signPos(k);
    const w = z.names ? Math.max(z.glyph * 1.2, SIGNS[k].length * z.signName * 0.6) : z.glyph * 1.2;
    placed.push(box((sx * W) / 100, (sy * W) / 100, w, z.names ? z.glyph + z.signName * 1.5 : z.glyph * 1.2));
  }
  placed.push(box(half, half + 4, 44, 36));              // la Tierra y su nombre
  const pts = P.map((q) => at(q));
  const badges = P.map((q, i) => box(pts[i][0], pts[i][1], q.d, q.d));
  const hit = (a, b) => a.x0 < b.x1 + 1 && a.x1 > b.x0 - 1 && a.y0 < b.y1 + 1 && a.y1 > b.y0 - 1;
  const order = P.map((_, i) => i).sort((i, j) => P[i].r - P[j].r);
  const side = new Array(P.length).fill(null);
  for (const i of order) {
    const q = P[i], [x, y] = pts[i];
    const tw = (BODY[q.p.id].name.length + (q.p.retro ? 2 : 0)) * z.font * 0.6 + 2, th = z.font * 1.35, g = 3;
    const cand = {
      right: { x0: x + q.d / 2 + g, y0: y - th / 2, x1: x + q.d / 2 + g + tw, y1: y + th / 2 },
      left: { x0: x - q.d / 2 - g - tw, y0: y - th / 2, x1: x - q.d / 2 - g, y1: y + th / 2 },
      below: { x0: x - tw / 2, y0: y + q.d / 2 + 1, x1: x + tw / 2, y1: y + q.d / 2 + 1 + th },
      above: { x0: x - tw / 2, y0: y - q.d / 2 - 1 - th, x1: x + tw / 2, y1: y - q.d / 2 - 1 },
    };
    const pref = x > 0.6 * W ? ["left", "below", "above", "right"] : x < 0.4 * W ? ["right", "below", "above", "left"] : ["right", "left", "below", "above"];
    for (const s of pref) {
      const r = cand[s];
      if (r.x0 < 2 || r.x1 > W - 2 || r.y0 < 2 || r.y1 > W - 2) continue;
      if (placed.some((o) => hit(r, o)) || badges.some((o, k) => k !== i && hit(r, o))) continue;
      side[i] = s; placed.push(r);
      break;
    }
  }
  return P.map((q, i) => {
    const [x, y] = pts[i];
    return { id: q.p.id, retro: !!q.p.retro, lon: q.p.lon, sign: q.p.sign, deg: q.p.deg, min: q.p.min,
      x: f((x / W) * 100), y: f((y / W) * 100), d: f(q.d), side: side[i] };
  });
}

const pad = (n) => String(n).padStart(2, "0");
/** «Saturno, 9°32′ de Aries, retrógrado» */
export const planetLabel = (p) => `${BODY[p.id].name}, ${p.deg}°${pad(p.min)}′ de ${SIGNS[p.sign]}${p.retro ? ", retrógrado" : ""}`;

/**
 * Un planeta como botón: el círculo de color y, si hay lugar, su nombre al lado. La Luna se dibuja con su fase
 * (`moonArt`, el SVG de moon.js) y, en vez de marcarse, abre el poema.
 */
export function planetHTML(p, selected = false, moonArt = "") {
  const name = BODY[p.id].name;
  const isMoon = p.id === "moon" && moonArt;
  return `<button type="button" class="sky-pl${isMoon ? " sky-pl-moon" : ""}${p.side ? " lab-" + p.side : ""}" data-id="${p.id}" style="left:${p.x}%;top:${p.y}%;--sd:${p.d}px"` +
    (isMoon ? ` aria-haspopup="dialog"` : ` aria-pressed="${selected}"`) + ` aria-label="${planetLabel(p)}">` +
    (isMoon ? `<span class="pb pb-ph">${moonArt}</span>` : badge(p.id)) +
    (p.side ? `<span class="sky-nm">${name}${p.retro ? `<i class="rx" title="Retrógrado">R</i>` : ""}</span>` : "") + `</button>`;
}

/** La línea de debajo del mapa: qué es lo que se ve, o el planeta que se tocó. */
export function skyInfoHTML(selected, planets, hour) {
  const p = selected && planets.find((q) => q.id === selected);
  if (p) {
    return `<span class="sky-info-pl">${badge(p.id, "s")}<strong>${BODY[p.id].name}</strong>` +
      `<span>${p.deg}°${pad(p.min)}′ de <span class="g">${signHTML(p.sign)}</span>${SIGNS[p.sign]}${p.retro ? ` · <span class="rx">retrógrado</span>` : ""}</span></span>`;
  }
  return `Así está el cielo${hour ? ` a las ${hour}` : " ahora"}, visto desde la Tierra. Tocá un planeta para ver dónde está` +
    `<span class="sky-info-desk interp"> (o la Luna, para leer un poema)</span>.`;
}
