// Qué se muestra al tocar un planeta: posición, casa y aspectos, según la vista (natal, tránsitos o sinastría).
// Sin DOM: recibe los datos que ya calculó el servidor y devuelve texto plano (quien lo dibuje lo escapa).
import { BODY, ASPECT, split } from "./astro-data.js";
import { signReading, houseReading, retroReading, pairReading, orbNote, phaseLabel } from "./interp.js";

export const OUTER = "o:";   // los ids del anillo exterior van con este prefijo

/**
 * Dónde está un punto en la vista actual.
 * @param rawId "sun", "asc"… (interior) o "o:sun" (anillo exterior)
 * @returns null si ese cuerpo no está en los datos
 */
function locate(ctx, rawId) {
  const { mode, chart, transit, syn } = ctx;
  const outer = rawId.startsWith(OUTER);
  const id = outer ? rawId.slice(OUTER.length) : rawId;
  if (!BODY[id] || !chart) return null;
  const inTransit = mode === "transit" && !!transit;
  const inSyn = mode === "syn" && !!syn;
  if (outer && !inTransit && !inSyn) return null;

  let lon, house = null, retro = false;
  if (!outer) {
    if (id === "asc" || id === "mc") lon = chart.angles[id];
    else {
      const b = chart.bodies.find((x) => x.id === id);
      if (!b) return null;
      ({ lon, house, retro } = b);
    }
  } else if (inTransit) {
    const b = transit.bodies.find((x) => x.id === id);
    if (!b) return null;
    ({ lon, house, retro } = b);
  } else {
    if (id === "asc" || id === "mc") lon = syn.b.angles[id];
    else {
      const b = syn.b.bodies.find((x) => x.id === id);
      if (!b) return null;
      lon = b.lon;
      retro = b.retro;
      house = syn.overlay.b_in_a.find((o) => o.id === id)?.house ?? null;
    }
  }
  return { id, outer, lon, house, retro, sp: split(lon), inTransit, inSyn };
}

/**
 * @param ctx { mode, chart, transit, syn, orbMax }
 * @param rawId "sun", "asc"… (interior) o "o:sun" (anillo exterior)
 * @returns null si ese cuerpo no está en los datos
 */
export function subjectFor(ctx, rawId) {
  const { mode, chart, transit, syn, orbMax } = ctx;
  const loc = locate(ctx, rawId);
  if (!loc) return null;
  const { id, outer, lon, house, retro, sp, inTransit, inSyn } = loc;

  const A = syn ? syn.a.input.name || "Carta A" : chart.input.name || "la carta natal";
  const B = syn ? syn.b.input.name || "Carta B" : "";

  // a quién pertenece cada lado, para rotular los aspectos
  const ownerOf = (isOuter) => (!inTransit && !inSyn ? "" : isOuter ? (inTransit ? "tránsito" : B) : (inTransit ? "natal" : A));

  const finish = (all) => {
    const shown = all.filter((a) => a.orb <= orbMax);
    return { shown, hidden: all.length - shown.length };
  };

  let main, cross = null;
  if (!outer) {
    // aspectos dentro de la carta (en sinastría, la carta A)
    const all = chart.aspects.filter((a) => a.a === id || a.b === id);
    main = finish(all);
    main.items = main.shown.map((a) => ({
      other: a.a === id ? a.b : a.a, target: a.a === id ? a.b : a.a, name: BODY[a.a === id ? a.b : a.a].name,
      type: a.type, orb: a.orb, applying: a.applying, owner: ownerOf(false),
    }));
    const src = inTransit ? transit : inSyn ? syn : null;
    if (src) {
      const c = finish(src.aspects.filter((a) => a.a === id));
      cross = {
        title: inTransit ? "Tránsitos a este punto de la carta" : `Aspectos con ${B}`,
        hidden: c.hidden,
        items: c.shown.map((a) => ({
          other: a.b, target: OUTER + a.b, name: BODY[a.b].name, type: a.type, orb: a.orb, applying: a.applying, owner: ownerOf(true),
        })),
      };
    }
  } else {
    const src = inTransit ? transit : syn;
    const c = finish(src.aspects.filter((a) => a.b === id));
    main = {
      hidden: c.hidden,
      items: c.shown.map((a) => ({
        other: a.a, target: a.a, name: BODY[a.a].name, type: a.type, orb: a.orb, applying: a.applying, owner: ownerOf(false),
      })),
    };
  }

  // textos
  const sign = signReading(id, sp.sign);
  const houseR = house ? houseReading(id, house) : null;
  const items = main.items.map((it) => ({ ...it, text: pairReading(id, it.other, it.type), note: orbNote(it.orb), phase: phaseLabel(it.applying) }));
  if (cross) cross.items = cross.items.map((it) => ({ ...it, text: pairReading(id, it.other, it.type), note: orbNote(it.orb), phase: phaseLabel(it.applying) }));

  return {
    key: rawId, id, name: BODY[id].name, outer,
    context: outer ? (inTransit ? "Planeta en tránsito" : `De ${B}`) : inSyn ? `De ${A}` : "",
    // el planeta del anillo exterior se lee como «lo que activa»: el texto es el mismo, el rótulo cambia
    houseWord: outer ? (inTransit ? "Casa natal que recorre" : `Casa de ${A} que ocupa`) : "Casa",
    houseShort: !house ? "" : outer ? (inTransit ? `casa natal ${house}` : `casa ${house} de ${A}`) : `casa ${house}`,
    lon, sign: sp.sign, deg: sp.deg, min: sp.min, house, retro,
    signReading: sign, houseReading: houseR, retroText: retro ? retroReading(id) : null,
    aspects: { items, hidden: main.hidden, title: outer ? (inTransit ? "Aspectos a la carta natal" : `Aspectos con ${A}`) : "Aspectos" },
    cross,
    orbMax,
  };
}

const ANGLE = { conjunction: 0, opposition: 180, trine: 120, square: 90, sextile: 60, quincunx: 150 };    // grados exactos de cada aspecto

/**
 * Qué se muestra al tocar un aspecto (en el cuadro, la lista o la cuadrícula): los dos puntos, el orbe y lo que significa.
 * @param ctx { mode, chart, transit, syn, orbMax }
 * @param aKey, bKey los dos extremos, como van en las tablas: «sun» / «o:moon» (el del anillo exterior lleva «o:»)
 * @returns null si ese aspecto no está en los datos de la vista
 */
export function aspectFor(ctx, aKey, bKey) {
  const { chart, transit, syn } = ctx;
  const pa = locate(ctx, aKey), pb = locate(ctx, bKey);
  if (!pa || !pb || pa.outer) return null;
  const src = pb.outer ? (pb.inTransit ? transit : syn) : null;
  const rec = pb.outer
    ? src.aspects.find((x) => x.a === pa.id && x.b === pb.id)
    : chart.aspects.find((x) => (x.a === pa.id && x.b === pb.id) || (x.a === pb.id && x.b === pa.id));
  if (!rec || !ASPECT[rec.type]) return null;

  const A = syn ? syn.a.input.name || "Carta A" : "";
  const B = syn ? syn.b.input.name || "Carta B" : "";
  const inTransit = pb.inTransit && pb.outer, inSyn = pb.inSyn && pb.outer;
  const point = (p, key) => ({
    key, id: p.id, name: BODY[p.id].name, outer: p.outer, lon: p.lon, sign: p.sp.sign, deg: p.sp.deg, min: p.sp.min,
    house: p.house, retro: p.retro,
    owner: inTransit ? (p.outer ? "tránsito" : "natal") : inSyn ? (p.outer ? B : A) : "",
    houseShort: !p.house ? "" : p.outer ? (inTransit ? `casa natal ${p.house}` : `casa ${p.house} de ${A}`) : `casa ${p.house}`,
    retroText: p.retro ? retroReading(p.id) : null,
  });
  const inner = point(pa, aKey), outer = pb.outer ? point(pb, bKey) : null;
  const other = outer || point(pb, bKey);
  // en tránsitos se lee primero lo que pasa en el cielo y después lo que toca; en las demás vistas, en el orden de la tabla
  const points = inTransit ? [outer, inner] : [inner, other];
  return {
    type: rec.type, angle: ANGLE[rec.type], orb: rec.orb, applying: rec.applying, phase: phaseLabel(rec.applying), note: orbNote(rec.orb),
    context: inTransit ? "Tránsito sobre la carta natal" : inSyn ? "Sinastría" : "", live: inTransit,
    points, text: pairReading(pa.id, pb.id, rec.type),
  };
}
