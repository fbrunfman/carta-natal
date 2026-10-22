// La Luna: tarjeta de inicio, calendario del mes e íconos de fase. Sin DOM propio: cada función recibe lo que ya
// calculó el servidor (/api/moon y /api/moon-calendar) y devuelve HTML (también se puede probar en node).
// Los instantes llegan como «AAAA-MM-DD HH:MM» ya en la zona elegida.
import { SIGNS, signHTML } from "./astro-data.js";

const MONTHS_LONG = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
export const WEEK_HEAD = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];     // el calendario empieza en lunes

const pad = (n) => String(n).padStart(2, "0");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const parts = (s) => {
  const [d, t = ""] = s.split(" ");
  const [y, m, day] = d.split("-").map(Number);
  return { y, m, day, time: t, date: d };
};
const dayNo = (d) => { const p = parts(d); return Date.UTC(p.y, p.m - 1, p.day) / 86400000; };
const weekday = (s) => { const p = parts(s); return WEEKDAYS[new Date(Date.UTC(p.y, p.m - 1, p.day)).getUTCDay()]; };

export const monthTitle = (y, m) => `${MONTHS_LONG[m - 1]} de ${y}`;

/** «AAAA-MM-DD» de hoy en una zona (para marcar el día de hoy sin pedirle nada al servidor). */
export function todayIn(tz, now = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** «hoy 20:00», «mañana 16:54», «ayer 09:35» o «lun 26 oct 01:12» respecto de `today` («AAAA-MM-DD»). */
export function whenLabel(local, today) {
  const p = parts(local);
  const diff = dayNo(p.date) - dayNo(today);
  if (diff === 0) return `hoy ${p.time}`;
  if (diff === 1) return `mañana ${p.time}`;
  if (diff === -1) return `ayer ${p.time}`;
  return `${weekday(local)} ${p.day} ${MONTHS[p.m - 1]} ${p.time}`;
}

/** Cuánto falta (o pasó) entre dos instantes UTC «AAAA-MM-DD HH:MM»: «2 d 5 h», «3 h 20 min», «40 min». */
export function span(fromUtc, toUtc) {
  const ms = (s) => { const p = parts(s); const [h, mi] = p.time.split(":").map(Number); return Date.UTC(p.y, p.m - 1, p.day, h, mi); };
  const min = Math.round(Math.abs(ms(toUtc) - ms(fromUtc)) / 60000);
  const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60;
  if (d) return h ? `${d} d ${h} h` : `${d} d`;
  if (h) return m ? `${h} h ${m} min` : `${h} h`;
  return `${m} min`;
}

// ---------- ícono de fase ---------------------------------------------------------------------------------

const R = 44;

/**
 * La Luna como SVG según la elongación al Sol (0 = nueva, 90 = cuarto creciente, 180 = llena, 270 = cuarto menguante).
 * `south`: en el hemisferio sur la parte iluminada de la Luna creciente queda a la izquierda (al norte, a la derecha).
 * Los colores salen de la CSS (--moon-lit, --moon-dark), así sigue el tema claro u oscuro.
 */
export function moonIcon(elong, south = true) {
  const e = ((elong % 360) + 360) % 360;
  const k = Math.cos((e * Math.PI) / 180);               // 1 en la nueva, −1 en la llena
  const rx = Math.round(Math.abs(k) * R * 100) / 100;
  const waxing = e < 180;
  const litRight = waxing !== south;
  // media circunferencia del lado iluminado + el terminador (media elipse): creciente (k > 0) curva hacia la luz,
  // gibosa (k < 0) hacia la sombra
  const lit = `M0 ${-R}A${R} ${R} 0 0 1 0 ${R}A${rx} ${R} 0 0 ${k > 0 ? 0 : 1} 0 ${-R}Z`;
  const full = k < -0.9995, none = k > 0.9995;
  return `<svg class="moon" viewBox="-47 -47 94 94" aria-hidden="true" focusable="false">` +
    `<circle class="mo-dark" r="${R}"/>` +
    (none ? "" : full ? `<circle class="mo-lit" r="${R}"/>` : `<path class="mo-lit" d="${lit}"${litRight ? "" : ' transform="scale(-1 1)"'}/>`) +
    `<circle class="mo-ring" r="${R}"/></svg>`;
}

const pct = (illum) => `${Math.round(illum * 100)} %`;
const sg = (sign) => `<span class="g">${signHTML(sign)}</span>`;
const degMin = (p) => `${p.deg}°${pad(p.min)}′`;

// ---------- tarjeta de inicio -----------------------------------------------------------------------------

/**
 * La Luna ahora: signo y grado, fase, desde cuándo está en el signo, cuándo pasa al siguiente y la próxima fase.
 * @param now respuesta de /api/moon · @param today «AAAA-MM-DD» en la zona elegida
 */
export function moonCardHTML(now, south = true, today = now.local.slice(0, 10)) {
  const next = now.next_sign;
  const since = now.since;
  const ph = now.next_phases[0];
  const lines = [];
  if (since) lines.push(`En ${SIGNS[now.sign]} desde ${esc(whenLabel(since.local, today))}.`);
  if (next) lines.push(`Pasa a ${SIGNS[next.sign]} ${esc(whenLabel(next.local, today))} (en ${esc(span(now.utc, next.utc))}).`);
  if (ph) lines.push(`Próxima fase: ${esc(ph.name)}, ${esc(whenLabel(ph.local, today))}.`);
  return `<span class="mc-ic">${moonIcon(now.elong, south)}</span>
    <span class="mc-body">
      <span class="mc-kicker">La Luna está en</span>
      <span class="mc-sign">${sg(now.sign)}<span class="mc-name">${SIGNS[now.sign]}</span><span class="mc-deg">${degMin(now)}</span></span>
      <span class="mc-phase">${esc(now.name)} · ${pct(now.illum)} iluminada</span>
      ${lines.map((l) => `<span class="mc-line">${l}</span>`).join("")}
    </span>
    <span class="mc-go">Calendario lunar <span aria-hidden="true">›</span></span>`;
}

// ---------- calendario del mes -----------------------------------------------------------------------------

const KIND_ANGLE = { new: 0, first: 90, full: 180, last: 270 };

/** Las fases principales del mes, con su día, hora y signo. */
export function phasesHTML(month, south = true) {
  if (!month.phases.length) return "";
  return `<ul class="mphases" aria-label="Fases principales del mes">${month.phases.map((p) => {
    const t = parts(p.local);
    return `<li>${moonIcon(KIND_ANGLE[p.kind], south)}<span class="mp-t"><strong>${esc(p.name)}</strong>` +
      `<span>${weekday(p.local)} ${t.day} ${MONTHS[t.m - 1]} · ${t.time}</span>` +
      `<span>${sg(p.sign)}${SIGNS[p.sign]} ${degMin(p)}</span></span></li>`;
  }).join("")}</ul>`;
}

/**
 * La grilla del mes (lunes a domingo). Cada día: la fase al mediodía, el signo en que termina el día y, si la Luna
 * cambia de signo ese día, la hora a la que lo hace.
 * @param today «AAAA-MM-DD» (se marca ese día si es de este mes)
 */
export function calendarHTML(month, south = true, today = "") {
  const { year, month: mo } = month;
  const byDay = new Map(month.phases.map((p) => [p.day, p]));
  const cells = [];
  for (let i = 0; i < month.first_weekday; i++) cells.push(`<td class="mday empty"></td>`);
  for (const d of month.days) {
    const iso = `${year}-${pad(mo)}-${pad(d.day)}`;
    const ph = byDay.get(d.day);
    const ing = d.ingress;
    const label = `${d.day} de ${MONTHS_LONG[mo - 1]}: ${d.name}, ${pct(d.illum)} iluminada. ` +
      (ing ? `La Luna entra en ${SIGNS[ing.sign]} a las ${ing.time}. ` : `Luna en ${SIGNS[d.sign]}. `) +
      (ph ? `${ph.name} a las ${parts(ph.local).time}.` : "");
    cells.push(`<td class="mday${iso === today ? " today" : ""}${ph ? " has-phase" : ""}" aria-label="${esc(label.trim())}"${iso === today ? ' aria-current="date"' : ""}>` +
      `<span class="md-n">${d.day}</span>` +
      (ph ? `<span class="md-ph">${esc(ph.name.replace("Cuarto ", "C. "))}<br>${parts(ph.local).time}</span>` : "") +
      `<span class="md-ic" title="${esc(d.name)} · ${pct(d.illum)}">${moonIcon(d.elong, south)}</span>` +
      `<span class="md-sg">${ing ? `<span class="md-tm">${ing.time}</span>` : ""}<span class="md-sgl">${sg(d.sign)}<span class="md-sgn">${SIGNS[d.sign]}</span></span></span></td>`);
  }
  while (cells.length % 7) cells.push(`<td class="mday empty"></td>`);
  let rows = "";
  for (let i = 0; i < cells.length; i += 7) rows += `<tr>${cells.slice(i, i + 7).join("")}</tr>`;
  return `<table class="mcal" aria-label="Calendario lunar de ${esc(monthTitle(year, mo))}">` +
    `<thead><tr>${WEEK_HEAD.map((w) => `<th scope="col">${w}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>` +
    `<p class="fine tight">Horas en ${esc(month.tz)}. En cada día se muestra la fase al mediodía y el signo en que termina; la hora indica cuándo la Luna entra en ese signo.</p>`;
}
