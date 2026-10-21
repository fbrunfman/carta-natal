// Qué se muestra al tocar un planeta: posición, casa y aspectos, según la vista (natal, tránsitos o sinastría).
// Sin DOM: recibe los datos que ya calculó el servidor y devuelve texto plano (quien lo dibuje lo escapa).
import { BODY, split } from "./astro-data.js";
import { signReading, houseReading, retroReading, pairReading, orbNote, phaseLabel } from "./interp.js";

export const OUTER = "o:";   // los ids del anillo exterior van con este prefijo

/**
 * @param ctx { mode, chart, transit, syn, orbMax }
 * @param rawId "sun", "asc"… (interior) o "o:sun" (anillo exterior)
 * @returns null si ese cuerpo no está en los datos
 */
export function subjectFor(ctx, rawId) {
  const { mode, chart, transit, syn, orbMax } = ctx;
  const outer = rawId.startsWith(OUTER);
  const id = outer ? rawId.slice(OUTER.length) : rawId;
  if (!BODY[id] || !chart) return null;

  const A = syn ? syn.a.input.name || "Carta A" : chart.input.name || "la carta natal";
  const B = syn ? syn.b.input.name || "Carta B" : "";
  const inTransit = mode === "transit" && !!transit;
  const inSyn = mode === "syn" && !!syn;
  if (outer && !inTransit && !inSyn) return null;

  // posición
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
  const sp = split(lon);

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
