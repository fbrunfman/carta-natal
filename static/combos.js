// Pestaña «Combinar» (beta): lo que se busca por un planeta solo o por la combinación de dos o más.
// Lo que hay viene de dos lados:
//   · CONJUGARNOS (combos-conjugarnos.js): lo que carga el grupo en Conjugarnos, validado o todavía en debate. Está GENERADO:
//     se vuelve a hacer con `python3 importar_conjugarnos.py <export del grupo>`, no se edita a mano.
//   · TEXTOS_PROPIOS (acá abajo): lo que se quiera sumar a mano, fuera del grupo.
// Cada entrada lleva `planetas` (ids de BODY: sun, moon, mercury, venus, mars, jupiter, saturn, uranus, neptune, pluto), `titulo`,
// `autor` y `texto` (los párrafos se separan con una línea en blanco), y opcionalmente:
//   `clase`   texto (por defecto), biografia, pelicula o cancion; en película y canción el texto puede faltar
//   `tipo`    la etiqueta que se ve (Cuento, Poema…); si falta, sale la de la clase
//   `enlace`  un link (http o https) para ver o escuchar
//   `estado`  validado o debate (solo lo ponen los del grupo)
//   `porque`  por qué se propuso para esa combinación
// Una entrada sin titulo o autor, sin texto (salvo película y canción) o sin ningún planeta válido no se usa.
//
// Cómo se busca: con UN planeta, salen los que son de ese planeta solo; con dos o más, los que tienen TODOS los elegidos
// (elegir de más acota). Entre los que coinciden sale uno al azar.
import { CONJUGARNOS } from "./combos-conjugarnos.js";

export const PLANETS = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];

export const TEXTOS_PROPIOS = [];

export const TEXTOS = [...TEXTOS_PROPIOS, ...CONJUGARNOS];

/** Lo que cambia según la clase: la etiqueta que se ve, el verbo del botón del link y si el texto puede faltar. */
const CLASES = {
  texto: { tipo: "", verbo: "Abrir", cuerpoOpcional: false },
  biografia: { tipo: "Biografía", verbo: "Abrir", cuerpoOpcional: false },
  pelicula: { tipo: "Película", verbo: "Ver", cuerpoOpcional: true },
  cancion: { tipo: "Canción", verbo: "Escuchar", cuerpoOpcional: true },
};
const claseDe = (t) => CLASES[t && t.clase] || CLASES.texto;

export const ESTADOS = { validado: "Validado", debate: "En debate" };

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** Los planetas sin repetir, en el orden de siempre (Sol, Luna, Mercurio …); lo que no es un planeta se descarta. */
export const sortPlanets = (ids) => PLANETS.filter((p) => ids.includes(p));

const planetsOf = (t) => sortPlanets(Array.isArray(t.planetas) ? t.planetas : []);

const usable = (t) => !!t && planetsOf(t).length >= 1 && !!t.titulo && !!t.autor && !!(t.texto || claseDe(t).cuerpoOpcional);

/** ¿Entra en la búsqueda? Un planeta: solo los de ese planeta solo. Dos o más: los que los tienen a todos. */
function matches(t, sel) {
  const ps = planetsOf(t);
  return sel.length === 1 ? ps.length === 1 && ps[0] === sel[0] : sel.every((p) => ps.includes(p));
}

/** Lo que coincide con los planetas elegidos. Sin ningún planeta, nada. */
export function findTexts(ids, textos = TEXTOS) {
  const sel = sortPlanets([...ids]);
  if (!sel.length) return [];
  return textos.filter((t) => usable(t) && matches(t, sel));
}

/** Uno al azar entre los que coinciden; si hay más de uno, evita repetir el último que salió. */
export function pickText(ids, avoid = null, rnd = Math.random, textos = TEXTOS) {
  const all = findTexts(ids, textos);
  const pool = all.length > 1 && avoid ? all.filter((t) => t !== avoid) : all;
  if (!pool.length) return null;
  return pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))];
}

/** Cuántos se pueden mostrar. */
export const countTexts = (textos = TEXTOS) => textos.filter(usable).length;

/** Cuántos hay de cada estado (los que no son del grupo no cuentan en ninguno). */
export function countByEstado(textos = TEXTOS) {
  const n = { validado: 0, debate: 0 };
  for (const t of textos) if (usable(t) && n[t.estado] !== undefined) n[t.estado]++;
  return n;
}

/** Combinaciones que tienen al menos uno, cada una como lista ordenada de planetas, sin repetir. */
export function combosWithText(textos = TEXTOS) {
  const seen = new Map();
  for (const t of textos) if (usable(t)) { const c = planetsOf(t); seen.set(c.join("+"), c); }
  return [...seen.values()];
}

/** La etiqueta que se ve (Película, Canción, Cuento…), o vacío si no tiene. */
export const tipoDe = (t) => t.tipo || claseDe(t).tipo;

/** { href, dominio } si es una dirección web (http o https) que se puede abrir con tranquilidad; si no, null. */
export function enlaceSeguro(u) {
  try {
    const x = new URL(String(u || ""));
    if (x.protocol !== "http:" && x.protocol !== "https:") return null;
    return { href: x.href, dominio: x.hostname.replace(/^www\./, "") };
  } catch { return null; }
}

/** «Validado» o «En debate» (con una marca que no depende del color); vacío si no es del grupo. */
export function estadoHTML(t) {
  const e = ESTADOS[t.estado] ? t.estado : "";
  return e ? `<span class="cmb-estado cmb-est-${e}">${ESTADOS[e]}</span>` : "";
}

/** El texto en HTML: párrafos, y debajo autor, título y tipo. Si no hay texto (una canción, por ejemplo), solo lo de abajo. */
export function textHTML(t) {
  const paras = String(t.texto || "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const tipo = tipoDe(t);
  return `<figure class="cmb-fig">${paras.length ? `<div class="cmb-text" lang="es">${paras.map((p) => `<p>${esc(p)}</p>`).join("")}</div>` : ""}`
    + `<figcaption class="mp-by"><strong class="mp-au">${esc(t.autor)}</strong><cite class="mp-ob">${esc(t.titulo)}</cite>`
    + `${tipo ? `<span class="cmb-kind">${esc(tipo)}</span>` : ""}</figcaption></figure>`;
}

/** Lo que va debajo del texto: el botón del link (si hay) y por qué se propuso (si lo dijeron). */
export function extrasHTML(t) {
  const link = t.enlace ? enlaceSeguro(t.enlace) : null;
  const verbo = claseDe(t).verbo;
  return (link ? `<p class="cmb-ver"><a class="cmb-enlace" href="${esc(link.href)}" target="_blank" rel="noopener noreferrer">`
      + `${verbo}<span class="cmb-dom">${esc(link.dominio)}</span><span class="cmb-fl" aria-hidden="true">↗</span>`
      + `<span class="vh"> (se abre en otra pestaña)</span></a></p>` : "")
    + (t.porque ? `<div class="cmb-why"><p class="cmb-why-t">Por qué esta combinación</p><p>${esc(t.porque)}</p></div>` : "");
}
