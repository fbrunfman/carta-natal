// Viajes de planetas por las casas. Sin DOM (devuelve datos y HTML): se puede probar en node.
//
// Un planeta «viaja» a una casa que no es la suya, y ahí también actúa. Hay tres tipos, todos a partir de aspectos duros:
//
//  · Por aspecto: dos planetas en aspecto duro se intercambian de casa. Saturno en la III en oposición a Venus en la IX:
//    Saturno viaja a la IX y Venus viaja a la III.
//  · Por eje: un planeta pegado a una cúspide (en conjunción con ella, antes o después) viaja al otro extremo del eje, es decir
//    a la casa opuesta. Mercurio pegado a la cúspide de la V viaja a la XI.
//  · Por implicancia: un planeta en aspecto duro con otro viaja a las casas cuya cúspide está en un signo que rige ese otro.
//    Venus se opone a Saturno, que rige Capricornio, y la casa VIII tiene Capricornio en la cúspide: Venus viaja a la VIII.
//    Saturno se opone a Venus, que rige Libra (cúspide de la V) y Tauro (cúspide de la XII): Saturno viaja a la V y a la XII.
//
// Un planeta nunca viaja a la casa donde ya está.

import { BODY, SIGNS, ASPECT, fmtOrb, glyphHTML, signHTML } from "./astro-data.js";
import { RULER as MODERN } from "./elements.js";

export const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
export const roman = (h) => ROMAN[h - 1];

// Regente de cada signo (Aries … Piscis): siempre la regencia moderna, la de la cruz de elementos (Escorpio de Plutón, Acuario de Urano, Piscis de Neptuno).
export const RULERS = MODERN;

export const TRIP_PLANETS = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
/** Aspectos que se pueden elegir como «duros» para los viajes. */
export const TRIP_ASPECTS = ["conjunction", "opposition", "square", "semisquare", "sesquiquadrate"];
export const TRIP_TYPES = ["aspect", "axis", "implied"];
export const TRIP_TITLES = { aspect: "Por aspecto", axis: "Por eje", implied: "Por implicancia" };

// Valores de fábrica: conjunción, oposición y cuadratura; pegado a la cúspide hasta 1° [cúspide angular, otra].
export const TRIP_DEFAULTS = Object.freeze({ asp: Object.freeze(["conjunction", "opposition", "square"]), cusp: Object.freeze([1, 1]) });
const ORB_TOP = 15;
const ANGULAR = new Set([1, 4, 7, 10]);

const orb = (x, d) => {
  const v = Number(x);
  return Number.isFinite(v) && x !== null && x !== "" ? Math.min(ORB_TOP, Math.max(0, Math.round(v * 100) / 100)) : d;
};
/** Lo guardado o escrito a mano: lo que falte o esté mal vuelve al valor de fábrica. Devuelve siempre una copia. */
export function cleanTrips(raw) {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const cusp = Array.isArray(r.cusp) && r.cusp.length === 2 ? r.cusp : [];
  return {
    asp: Array.isArray(r.asp) ? TRIP_ASPECTS.filter((t) => r.asp.includes(t)) : [...TRIP_DEFAULTS.asp],
    cusp: [orb(cusp[0], TRIP_DEFAULTS.cusp[0]), orb(cusp[1], TRIP_DEFAULTS.cusp[1])],
  };
}
export const sameTrips = (a, b) => JSON.stringify(cleanTrips(a)) === JSON.stringify(cleanTrips(b));

const norm180 = (x) => ((((x % 360) + 540) % 360) - 180);

/**
 * Todos los viajes de una carta natal.
 * @param chart  la respuesta de /api/chart: bodies [{id, lon, house}], aspects [{a, b, type, orb}] (sin filtrar por lo que se muestra), houses.cusps
 * @param cfg    { asp: [tipos de aspecto duros], cusp: [orbe a la cúspide angular, a las otras] }
 * @returns [{ id, from, to, type: "aspect" | "axis" | "implied", via }] ordenados por tipo, planeta y casa
 *   via (por aspecto)    { other, aspect, orb }
 *   via (por eje)        { cusp, dist }                  dist = grados con signo del planeta a la cúspide (+ si ya la pasó)
 *   via (por implicancia){ other, aspect, orb, sign }    sign = el signo de la cúspide de la casa `to`
 */
export function computeTrips(chart, cfg = TRIP_DEFAULTS) {
  const c = cleanTrips(cfg);
  const cusps = chart.houses.cusps;
  const bodies = chart.bodies.filter((b) => TRIP_PLANETS.includes(b.id));
  const house = Object.fromEntries(bodies.map((b) => [b.id, b.house]));
  const rulers = RULERS;
  const signOfCusp = (h) => Math.floor((((cusps[h - 1] % 360) + 360) % 360) / 30);
  const trips = [];

  for (const a of chart.aspects) {
    if (!c.asp.includes(a.type) || !(a.a in house) || !(a.b in house)) continue;
    for (const [x, y] of [[a.a, a.b], [a.b, a.a]]) {
      const hx = house[x], hy = house[y];
      if (hx !== hy) trips.push({ id: x, from: hx, to: hy, type: "aspect", via: { other: y, aspect: a.type, orb: a.orb } });
      for (let h = 1; h <= 12; h++) {
        if (h === hx || rulers[signOfCusp(h)] !== y) continue;
        trips.push({ id: x, from: hx, to: h, type: "implied", via: { other: y, aspect: a.type, orb: a.orb, sign: signOfCusp(h) } });
      }
    }
  }

  for (const b of bodies) {
    for (let k = 1; k <= 12; k++) {
      const d = norm180(b.lon - cusps[k - 1]);
      if (Math.abs(d) > c.cusp[ANGULAR.has(k) ? 0 : 1]) continue;
      const to = ((k + 5) % 12) + 1;                      // el otro extremo del eje
      if (to !== b.house) trips.push({ id: b.id, from: b.house, to, type: "axis", via: { cusp: k, dist: Math.round(d * 1e5) / 1e5 } });
    }
  }

  const rank = (t) => TRIP_TYPES.indexOf(t.type) * 1000 + TRIP_PLANETS.indexOf(t.id) * 20 + t.to;
  return trips.sort((p, q) => rank(p) - rank(q));
}

/**
 * Los viajes de cada planeta a cada casa, juntos: un planeta puede llegar a la misma casa por más de un camino.
 * @returns [{ id, from, to, kind, routes: [viajes] }] kind = el tipo más fuerte (aspecto, eje, implicancia)
 */
export function groupTrips(trips) {
  const map = new Map();
  for (const t of trips) {
    const key = `${t.id}|${t.to}`;
    if (!map.has(key)) map.set(key, { id: t.id, from: t.from, to: t.to, kind: t.type, routes: [] });
    const g = map.get(key);
    g.routes.push(t);
    if (TRIP_TYPES.indexOf(t.type) < TRIP_TYPES.indexOf(g.kind)) g.kind = t.type;
  }
  return [...map.values()].sort((p, q) => TRIP_PLANETS.indexOf(p.id) - TRIP_PLANETS.indexOf(q.id) || p.to - q.to);
}

// ---- cómo se escribe ---------------------------------------------------------------------------------------------------------

const name = (id) => (id === "sun" ? "el Sol" : id === "moon" ? "la Luna" : BODY[id].name);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const WITH = {
  conjunction: "está en conjunción con", opposition: "se opone a", square: "está en cuadratura con",
  semisquare: "está en semicuadratura con", sesquiquadrate: "está en sesquicuadratura con",
};

/** Texto plano de un viaje con la notación del pizarrón: «Saturno → IX (Saturno oposición Venus IX)». */
export function tripPlain(t) {
  const A = BODY[t.id].name, v = t.via;
  const why = t.type === "axis"
    ? `${A} conjunción ${roman(v.cusp)}`
    : t.type === "aspect"
      ? `${A} ${ASPECT[v.aspect].name.toLowerCase()} ${BODY[v.other].name} ${roman(t.to)}`
      : `${A} ${ASPECT[v.aspect].name.toLowerCase()} ${BODY[v.other].name} reg. de ${SIGNS[v.sign]} ${roman(t.to)}`;
  return `${A} → ${roman(t.to)} (${why})`;
}

/** La explicación en palabras de un viaje. */
export function tripWords(t) {
  const A = name(t.id), v = t.via, R = roman;
  const cabeza = cap(A);
  if (t.type === "axis") {
    const d = Math.abs(v.dist);
    return `${cabeza} está en conjunción con la cúspide de la casa ${R(v.cusp)}, a ${fmtOrb(d)} ${v.dist >= 0 ? "después de ella" : "antes de ella"}. ` +
      `Por eso viaja al otro extremo del eje ${R(v.cusp)}–${R(t.to)}: la casa ${R(t.to)}.`;
  }
  const B = name(v.other);
  if (t.type === "aspect") {
    return `${cabeza} está en la casa ${R(t.from)} y ${WITH[v.aspect]} ${B}, que está en la casa ${R(t.to)} (orbe ${fmtOrb(v.orb)}). ` +
      `Por eso ${A} viaja a la casa ${R(t.to)}, y ${B}, a la ${R(t.from)}.`;
  }
  return `${cabeza} está en la casa ${R(t.from)} y ${WITH[v.aspect]} ${B} (orbe ${fmtOrb(v.orb)}). ` +
    `${cap(B)} es regente de ${SIGNS[v.sign]}, el signo de la cúspide de la casa ${R(t.to)}. Por eso ${A} viaja a la casa ${R(t.to)}.`;
}

/** Lo mismo para todos los caminos de un planeta a una casa (un párrafo por camino, separados por saltos de línea). */
export const groupWords = (g) => g.routes.map(tripWords).join("\n");

const gl = (id) => `<span class="g" title="${BODY[id].name}">${glyphHTML(id)}</span>`;
const as = (type) => `<span class="a-ic ${ASPECT[type].cls}" title="${ASPECT[type].name}" aria-hidden="true">${ASPECT[type].icon}</span>`;
const sg = (i) => `<span class="g" title="${SIGNS[i]}">${signHTML(i)}</span>`;
const rn = (h) => `<span class="rn">${roman(h)}</span>`;

/** La notación del pizarrón, con los símbolos de la app y números romanos: ♄ → IX (♄ ☍ ♀ IX). */
export function tripNotation(t) {
  const v = t.via;
  const why = t.type === "axis"
    ? `${gl(t.id)} ${as("conjunction")} ${rn(v.cusp)}`
    : t.type === "aspect"
      ? `${gl(t.id)} ${as(v.aspect)} ${gl(v.other)} ${rn(t.to)}`
      : `${gl(t.id)} ${as(v.aspect)} ${gl(v.other)} <span class="reg">reg. de</span> ${sg(v.sign)} ${rn(t.to)}`;
  return `<span class="tn-main">${gl(t.id)}<span class="tn-arr" aria-hidden="true">→</span>${rn(t.to)}</span><span class="tn-why">(${why})</span>`;
}
