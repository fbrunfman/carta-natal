// Resumen de tránsitos: profecciones, tránsitos destacados y próximos eventos.
// Sin DOM propio: cada función recibe los datos que ya calculó el servidor (o la carta) y devuelve HTML.
// Los nombres que escribe el usuario no aparecen acá, pero todo texto variable pasa por esc() igual.
import { SIGNS, ASPECT, BODY, badge, signHTML, esc, split, fmtOrb } from "./astro-data.js";
import { pairReading, elementName, HOUSE_THEME } from "./interp.js";

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------- fechas (los instantes llegan como «AAAA-MM-DD HH:MM», ya en la zona elegida) ----------
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const parts = (s) => {
  const [d, t = ""] = s.split(" ");
  const [y, m, day] = d.split("-").map(Number);
  return { y, m, day, time: t };
};
export const monthYear = (s) => { const p = parts(s); return `${MONTHS[p.m - 1]} ${p.y}`; };
export const dayMonthYear = (s) => { const p = parts(s); return `${p.day} ${MONTHS[p.m - 1]} ${p.y}`; };
const weekdayOf = (s) => { const p = parts(s); return WEEKDAYS[new Date(Date.UTC(p.y, p.m - 1, p.day)).getUTCDay()]; };

// ---------- profecciones ---------------------------------------------------------------------------
// Profección anual por signos enteros: a los 0 años el Ascendente, y cada cumpleaños pasa al signo siguiente.
// El mes avanza un signo por cada mes calendario desde el cumpleaños, y el día, un signo por día desde el
// aniversario del mes. El señor de cada uno es el regente tradicional del signo (Acuario es de Saturno).
export const TRADITIONAL_RULER = ["mars", "venus", "mercury", "moon", "sun", "mercury", "venus", "mars", "jupiter", "saturn", "saturn", "jupiter"];

const dayNumber = (y, m, d) => Date.UTC(y, m - 1, d) / 86400000;
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
/** Mismo día del mes, `m` puede pasarse de 12; si el mes es más corto, el último día (29 feb → 28 feb). */
function anniversary(y, m, d) {
  const yy = y + Math.floor((m - 1) / 12);
  const mm = (((m - 1) % 12) + 12) % 12 + 1;
  return dayNumber(yy, mm, Math.min(d, daysIn(yy, mm)));
}

/**
 * @param birthIso "AAAA-MM-DD" de nacimiento · @param atIso "AAAA-MM-DD" del momento · @param ascSign 0..11
 * @returns null si la fecha es anterior al nacimiento
 */
export function profection(birthIso, atIso, ascSign) {
  const [by, bm, bd] = birthIso.split("-").map(Number);
  const [ay, am, ad] = atIso.split("-").map(Number);
  const at = dayNumber(ay, am, ad);
  let age = ay - by;
  if (anniversary(by + age, bm, bd) > at) age -= 1;       // todavía no cumplió este año
  if (age < 0) return null;
  let month = 0;
  for (let k = 11; k >= 0; k--) if (anniversary(by + age, bm + k, bd) <= at) { month = k; break; }
  const day = at - anniversary(by + age, bm + month, bd);
  const sign = (ascSign + age) % 12;
  const monthSign = (sign + month) % 12;
  const daySign = (monthSign + day) % 12;
  return {
    age, house: (age % 12) + 1, sign, lord: TRADITIONAL_RULER[sign],
    month, monthSign, monthLord: TRADITIONAL_RULER[monthSign],
    day, daySign, dayLord: TRADITIONAL_RULER[daySign],
  };
}

/** Tarjeta de profecciones. `bodies` = planetas en tránsito en ese momento (para decir dónde está el señor del año).
 *  `interp` = false («solo datos»): sin el tema de la casa y sin que se pueda tocar un planeta para leerlo. */
export function profectionHTML(p, bodies, interp = true) {
  if (!p) return "";
  const lordNow = bodies.find((b) => b.id === p.lord);
  let where = "";
  if (lordNow) {
    const s = split(lordNow.lon);
    where = `${BODY[p.lord].name} ahora: ${SIGNS[s.sign]}, casa natal ${lordNow.house}${lordNow.retro ? " · retrógrado" : ""}`;
  }
  // con lecturas son botones (abren la ventana del planeta); sin ellas, solo datos
  const open = (id) => (interp ? ` data-id="o:${id}"` : "");
  const tag = interp ? "button" : "div";
  const mini = (id, label, sign) => `<${tag}${interp ? ' type="button"' : ""} class="prof-mini${interp ? "" : " static"}"${open(id)}>${badge(id, "s")}` +
    `<span><strong>${esc(BODY[id].name)}</strong><span class="prof-sub">${label} · ${esc(SIGNS[sign])}</span></span></${tag}>`;
  return `<section class="sum-card prof" aria-label="Profecciones">
    <h3 class="sum-h">Profecciones</h3>
    <div class="prof-year">
      <span class="prof-ic" aria-hidden="true">${signHTML(p.sign)}</span>
      <div><strong>Año de la casa ${p.house} · ${esc(SIGNS[p.sign])}</strong>
        ${interp ? `<span class="prof-sub">${esc(cap(HOUSE_THEME[p.house - 1]))}</span>` : ""}</div>
    </div>
    <${tag}${interp ? ` type="button"` : ""} class="prof-row${interp ? "" : " static"}"${open(p.lord)}${interp ? ` title="Ver la lectura de ${esc(BODY[p.lord].name)}"` : ""}>
      ${badge(p.lord, "s")}
      <span><strong>Señor del año: ${esc(BODY[p.lord].name)}</strong>${where ? `<span class="prof-sub">${esc(where)}</span>` : ""}</span>
    </${tag}>
    <div class="prof-pair">${mini(p.monthLord, "señor del mes", p.monthSign)}${mini(p.dayLord, "señor del día", p.daySign)}</div>
    <p class="fine tight">${p.age} años cumplidos. Signos enteros desde el Ascendente y regencias tradicionales; el mes cuenta desde el cumpleaños y el día, un signo por día desde el aniversario del mes.</p>
  </section>`;
}

// ---------- tránsitos destacados ---------------------------------------------------------------------

/** El texto de un par se escribe «Tema: descripción»: el tema hace de título. */
function splitTheme(theme) {
  const i = theme.indexOf(":");
  return i < 0 ? { title: "", body: theme } : { title: theme.slice(0, i), body: cap(theme.slice(i + 1).trim()) };
}

function featuredCard(it, interp) {
  const A = ASPECT[it.type];
  const read = interp ? pairReading(it.t, it.n, it.type) : null;
  const th = read ? splitTheme(read.theme) : { title: "", body: "" };
  const phase = it.peak ? "En su punto máximo" : it.applying ? "Se acerca" : "Se aleja";
  const exacts = it.exacts.map((e, i) => {
    const firstNext = !e.past && it.exacts.findIndex((x) => !x.past) === i;
    return `<span class="ex${e.past ? " past" : firstNext ? " next" : ""}">${dayMonthYear(e.local)}${e.retro ? '<span class="rx-t" title="Con el planeta retrógrado">R</span>' : ""}</span>`;
  }).join("");
  const until = it.until ? `hasta ${monthYear(it.until)}` : "por varios años";
  const range = it.since ? `Activo desde ${monthYear(it.since)}` : "";
  const link = interp ? ` tabindex="0" data-id="o:${it.t}" title="Tocá para leer ${esc(BODY[it.t].name)} en tránsito"` : "";
  return `<article class="fcard${interp ? "" : " static"}"${link}>
    <div class="fc-top">
      <span class="fc-glyphs" aria-hidden="true">${badge(it.t, "s")}<span class="a-ic ${A.cls}">${A.glyph}</span>${badge(it.n, "s")}</span>
      <span class="fc-until">${esc(until)}</span>
    </div>
    <p class="fc-line"><strong>${esc(BODY[it.t].name)}</strong> en tránsito · ${esc(A.name.toLowerCase())} · <strong>${esc(BODY[it.n].name)}</strong> natal</p>
    <p class="fc-phase${it.peak ? " peak" : ""}">${phase} · orbe ${fmtOrb(it.orb)}${it.retro ? " · retrógrado" : ""}</p>
    ${th.title ? `<h4 class="fc-title">${esc(th.title)}</h4>` : ""}
    ${th.body ? `<p class="fc-body">${esc(th.body)}</p>` : ""}
    ${read ? `<p class="fc-frame">${esc(read.frame)}</p>` : ""}
    ${exacts ? `<p class="fc-ex"><span class="fc-exl">Exacto</span>${exacts}</p>` : ""}
    ${range ? `<p class="fc-range">${esc(range)}</p>` : ""}
  </article>`;
}

export function featuredHTML(data, interp = true) {
  if (!data.items.length) {
    return `<p class="muted pad">Ningún planeta lento (de Júpiter a Plutón) forma un aspecto cerrado con tu Sol, tu Luna, tus ángulos o tus planetas hasta Saturno en este momento.</p>`;
  }
  const more = data.total > data.items.length ? ` Se muestran los ${data.items.length} más importantes de ${data.total}.` : "";
  return data.items.map((it) => featuredCard(it, interp)).join("") +
    `<p class="fine tight">Planetas lentos (de Júpiter a Plutón) con orbe de hasta 3° (2° en trígonos y sextiles) a tu Sol, Luna, Ascendente, Medio Cielo y planetas hasta Saturno. ` +
    `«Hasta» es cuando sale de ese orbe por última vez, contando las retrogradaciones; «punto máximo», a menos de 1° del exacto.${more}</p>`;
}

/**
 * Los destacados de una carta en versión corta, para el inicio (varias cartas una debajo de la otra): los tres puntos
 * (planeta en tránsito, aspecto y punto natal), cómo está hoy y hasta cuándo dura. Sin lecturas: son datos.
 * @param data respuesta de /api/featured
 */
export function featuredRowsHTML(data) {
  if (!data.items.length) return `<p class="htr-none">Hoy ningún planeta lento forma un aspecto cerrado con esta carta.</p>`;
  const row = (it) => {
    const A = ASPECT[it.type];
    const phase = it.peak ? "En su punto máximo" : it.applying ? "Se acerca" : "Se aleja";
    const until = it.until ? `hasta ${monthYear(it.until)}` : "por varios años";
    const next = it.exacts.find((e) => !e.past);
    return `<li class="htr-row">
      <span class="fc-glyphs" aria-hidden="true">${badge(it.t, "s")}<span class="a-ic ${A.cls}">${A.glyph}</span>${badge(it.n, "s")}</span>
      <span class="htr-txt">
        <span class="htr-line"><strong>${esc(BODY[it.t].name)}</strong>${it.retro ? `<span class="rx-t" title="Retrógrado">R</span>` : ""} · ${esc(A.name.toLowerCase())} · <strong>${esc(BODY[it.n].name)}</strong> natal</span>
        <span class="htr-sub"><span class="${it.peak ? "peak" : ""}">${phase}</span> · orbe ${fmtOrb(it.orb)} · ${esc(until)}${next ? ` · exacto ${esc(dayMonthYear(next.local))}` : ""}</span>
      </span>
    </li>`;
  };
  const SHOWN = 6;                                       // el resto queda plegado: con muchas cartas la página no se hace interminable
  const first = data.items.slice(0, SHOWN).map(row).join(""), rest = data.items.slice(SHOWN).map(row).join("");
  const more = data.total > data.items.length ? `<p class="fine tight">Se muestran los ${data.items.length} más importantes de ${data.total}.</p>` : "";
  return `<ul class="htr-list">${first}</ul>` +
    (rest ? `<details class="htr-more"><summary>Ver ${data.items.length - SHOWN} más</summary><ul class="htr-list">${rest}</ul></details>` : "") + more;
}

// ---------- próximamente ----------------------------------------------------------------------------

function eventRow(e, interp) {
  const name = BODY[e.body].name;
  const rx = e.retro && e.kind !== "station" ? '<span class="rx-t" title="Retrógrado">R</span>' : "";
  let title, sub;
  if (e.kind === "sign") {
    title = `${name} entra en ${SIGNS[e.sign]}${rx}`;
    sub = `<span class="g">${signHTML(e.sign)}</span>${esc(elementName(e.sign))}`;
  } else if (e.kind === "station") {
    title = `${name} estaciona ${e.to === "retro" ? "retrógrado" : "directo"}`;
    sub = `en ${esc(SIGNS[e.sign])} · casa ${e.house}`;
  } else {
    title = `${name} entra en tu casa ${e.house}${rx}`;
    sub = interp ? esc(cap(HOUSE_THEME[e.house - 1])) : "";
  }
  return `<li class="soon-ev" tabindex="0" data-go="${esc(e.local)}" title="Tocá para llevar la rueda a este momento">
    ${badge(e.body, "s")}
    <div class="soon-txt"><span class="soon-t">${title}</span><span class="soon-s">${sub}</span></div>
    <span class="soon-tm">${esc(parts(e.local).time)}</span>
  </li>`;
}

export const SOON_PERIODS = [[30, "30 días"], [90, "90 días"], [180, "6 meses"]];

export function upcomingHTML(data, days, interp = true) {
  const seg = `<div class="seg soonseg" role="group" aria-label="Período">${SOON_PERIODS.map(([d, label]) =>
    `<button type="button" data-days="${d}" aria-pressed="${d === days}">${label}</button>`).join("")}</div>`;
  if (!data.events.length) return seg + `<p class="muted pad">No hay ingresos, estaciones ni entradas a casas en este período.</p>`;
  let html = seg;
  let day = "", open = false;
  for (const e of data.events) {
    const d = e.local.slice(0, 10);
    if (d !== day) {
      if (open) html += "</ul>";
      day = d;
      const p = parts(e.local);
      html += `<h4 class="soon-day">${weekdayOf(e.local)} ${p.day} ${MONTHS[p.m - 1]}${p.y !== parts(data.events[0].local).y ? " " + p.y : ""}</h4><ul class="soon-list">`;
      open = true;
    }
    html += eventRow(e, interp);
  }
  const n = data.events.length;
  return html + `</ul><p class="fine tight">${n === 1 ? "1 evento" : `${n} eventos`}${data.truncated ? " (hay más: elegí un período más corto)" : ""}. ` +
    `Ingresos a signos, estaciones (cuando un planeta se detiene para cambiar de sentido) y entradas a las casas de tu carta, sin la Luna. Horas en la zona elegida.</p>`;
}
