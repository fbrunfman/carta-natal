// Pestaña «Combinar» (beta): textos que se buscan por la combinación de dos o más planetas.
// Cada texto lleva `planetas`: los que lo definen (ids de BODY: sun, moon, mercury, venus, mars, jupiter, saturn, uranus, neptune, pluto).
// Una búsqueda devuelve los textos que tienen TODOS los planetas elegidos (elegir de más acota); entre ellos sale uno al azar.
// Agregar un texto: sumar un objeto a TEXTOS. Campos: planetas (2 o más), titulo, autor, tipo (opcional: Cuento, Poema…),
// y texto (los párrafos se separan con una línea en blanco). Un texto sin titulo, autor, texto o con menos de 2 planetas no se usa.

export const PLANETS = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];

export const TEXTOS = [
  {
    // Saturno: la Ley, el guardián, el umbral, la prohibición, la espera de toda una vida.
    // Plutón: guardianes cada vez más poderosos, el poder, el soborno, la obsesión con un solo obstáculo, la muerte y el cierre final.
    // (Federico: Saturno + Plutón. Mi primera lectura había sido Saturno + Neptuno.)
    planetas: ["saturn", "pluto"],
    titulo: "Ante la ley", autor: "Franz Kafka", tipo: "Cuento",
    // El texto es el que pegó Federico; no se sabe quién tradujo esta versión, por eso no hay `trad`.
    texto: `Ante la ley hay un guardián. Un campesino se presenta frente a este guardián, y solicita que le permita entrar en la Ley. Pero el guardián contesta que por ahora no puede dejarlo entrar. El hombre reflexiona y pregunta si más tarde lo dejarán entrar.

-Tal vez -dice el centinela- pero no por ahora.

La puerta que da a la Ley está abierta, como de costumbre; cuando el guardián se hace a un lado, el hombre se inclina para espiar. El guardián lo ve, se sonríe y le dice:

-Si tu deseo es tan grande haz la prueba de entrar a pesar de mi prohibición. Pero recuerda que soy poderoso. Y sólo soy el último de los guardianes. Entre salón y salón también hay guardianes, cada uno más poderoso que el otro. Ya el tercer guardián es tan terrible que no puedo mirarlo siquiera.

El campesino no había previsto estas dificultades; la Ley debería ser siempre accesible para todos, piensa, pero al fijarse en el guardián, con su abrigo de pieles, su nariz grande y aguileña, su barba negra de tártaro, rala y negra, decide que le conviene más esperar. El guardián le da un escabel y le permite sentarse a un costado de la puerta.

Allí espera días y años. Intenta infinitas veces entrar y fatiga al guardián con sus súplicas. Con frecuencia el guardián conversa brevemente con él, le hace preguntas sobre su país y sobre muchas otras cosas; pero son preguntas indiferentes, como las de los grandes señores, y, finalmente siempre le repite que no puede dejarlo entrar. El hombre, que se ha provisto de muchas cosas para el viaje, sacrifica todo, por valioso que sea, para sobornar al guardián. Este acepta todo, en efecto, pero le dice:

-Lo acepto para que no creas que has omitido ningún esfuerzo.

Durante esos largos años, el hombre observa casi continuamente al guardián: se olvida de los otros y le parece que éste es el único obstáculo que lo separa de la Ley. Maldice su mala suerte, durante los primeros años audazmente y en voz alta; más tarde, a medida que envejece, sólo murmura para sí. Retorna a la infancia, y como en su cuidadosa y larga contemplación del guardián ha llegado a conocer hasta las pulgas de su cuello de piel, también suplica a las pulgas que lo ayuden y convenzan al guardián. Finalmente, su vista se debilita, y ya no sabe si realmente hay menos luz, o si sólo lo engañan sus ojos. Pero en medio de la oscuridad distingue un resplandor, que surge inextinguible de la puerta de la Ley. Ya le queda poco tiempo de vida. Antes de morir, todas las experiencias de esos largos años se confunden en su mente en una sola pregunta, que hasta ahora no ha formulado. Hace señas al guardián para que se acerque, ya que el rigor de la muerte comienza a endurecer su cuerpo. El guardián se ve obligado a agacharse mucho para hablar con él, porque la disparidad de estaturas entre ambos ha aumentado bastante con el tiempo, para desmedro del campesino.

-¿Qué quieres saber ahora? -pregunta el guardián-. Eres insaciable.

-Todos se esfuerzan por llegar a la Ley -dice el hombre-; ¿cómo es posible entonces que durante tantos años nadie más que yo pretendiera entrar?

El guardián comprende que el hombre está por morir, y para que sus desfallecientes sentidos perciban sus palabras, le dice junto al oído con voz atronadora:

-Nadie podía pretenderlo porque esta entrada era solamente para ti. Ahora voy a cerrarla.`,
  },
];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const usable = (t) => t && Array.isArray(t.planetas) && new Set(t.planetas.filter((p) => PLANETS.includes(p))).size >= 2 && t.titulo && t.autor && t.texto;

/** Los planetas sin repetir, en el orden de siempre (Sol, Luna, Mercurio …); lo que no es un planeta se descarta. */
export const sortPlanets = (ids) => PLANETS.filter((p) => ids.includes(p));

/** Textos que tienen todos los planetas elegidos. Con menos de dos planetas, ninguno. */
export function findTexts(ids, textos = TEXTOS) {
  const sel = sortPlanets([...ids]);
  if (sel.length < 2) return [];
  return textos.filter((t) => usable(t) && sel.every((p) => t.planetas.includes(p)));
}

/** Uno al azar entre los que coinciden; si hay más de uno, evita repetir el último que salió. */
export function pickText(ids, avoid = null, rnd = Math.random, textos = TEXTOS) {
  const all = findTexts(ids, textos);
  const pool = all.length > 1 && avoid ? all.filter((t) => t !== avoid) : all;
  if (!pool.length) return null;
  return pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))];
}

/** Cuántos textos se pueden mostrar. */
export const countTexts = (textos = TEXTOS) => textos.filter(usable).length;

/** Combinaciones que tienen al menos un texto, cada una como lista ordenada de planetas, sin repetir. */
export function combosWithText(textos = TEXTOS) {
  const seen = new Map();
  for (const t of textos) if (usable(t)) { const c = sortPlanets(t.planetas); seen.set(c.join("+"), c); }
  return [...seen.values()];
}

/** El texto en HTML: párrafos, y debajo autor, título y tipo. */
export function textHTML(t) {
  const paras = String(t.texto).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return `<figure class="cmb-fig"><div class="cmb-text" lang="es">${paras.map((p) => `<p>${esc(p)}</p>`).join("")}</div>`
    + `<figcaption class="mp-by"><strong class="mp-au">${esc(t.autor)}</strong><cite class="mp-ob">${esc(t.titulo)}</cite>`
    + `${t.tipo ? `<span class="cmb-kind">${esc(t.tipo)}</span>` : ""}</figcaption></figure>`;
}
