import { SIGNS, signHTML, BODY, ASPECT, split, fmtPos, fmtOrb, mark, glyphHTML, badge, esc, setClassic } from "./astro-data.js";
import { renderWheel } from "./wheel.js";
import { stairHTML } from "./stair.js";
import { elementsHTML } from "./elements.js";
import { createSaved } from "./saved.js";
import { compute, config, isPublic } from "./api.js";
import { localCharts } from "./local-charts.js";
import { initSettings, load as loadSettings } from "./settings.js";
import { initPlanetDialog } from "./planet-dialog.js";
import { profection, profectionHTML, featuredHTML, upcomingHTML, SOON_PERIODS } from "./summary.js";
import { moonCardHTML, phasesHTML, calendarHTML, monthTitle, todayIn } from "./moon.js";
import { pickPoem, poemHTML } from "./poems.js";

const $ = (s) => document.querySelector(s);
const form = $("#form");
const STORE = "carta:last";
const VIEW = "carta:view";
const SIDE_KEY = "carta:side";

// Datos iniciales: en tu computadora, tu carta (están en defaults-local.js, que la versión pública no sirve).
// Se recuerda lo último que calculaste.
let LOCAL_DEFAULTS = null;
// Punto de partida de «Nueva carta»: vacío, salvo el lugar más común.
const BLANK = {
  name: "", date: "", time: "", place: "Buenos Aires, Argentina", lat: "-34.6", lon: "-58.4167",
  tz: "America/Argentina/Buenos_Aires", manual: false, offset: "",
};

let PLACES = [];
let mode = "natal";        // natal | transit | syn
let birth = null;          // lo que había en el formulario al calcular (los tránsitos y la sinastría parten de acá)
let interpOn = loadSettings().interp;      // false = «solo datos»: ninguna lectura ni descripción (Configuración)
let chart = null;          // carta natal mostrada (en sinastría, la carta A)
let transit = null;        // respuesta de /api/transits
let syn = null;            // respuesta de /api/synastry
let partnerId = null;      // carta guardada con la que se compara
let wheel = null;
let orbMax = 3;

// ---------- formulario ----------------------------------------------------
function readForm() {
  const v = Object.fromEntries(new FormData(form).entries());
  v.manual = $("#manual").checked;
  return v;
}

function fillForm(v) {
  for (const [k, val] of Object.entries(v)) {
    if (k === "manual" || k === "active") continue;
    const el = form.elements[k];
    if (el) el.value = val ?? "";
  }
  $("#manual").checked = !!v.manual;
  $("#offsetField").hidden = !v.manual;
}

/** Solo los datos de nacimiento; sistema de casas y nodo son preferencias de vista. */
function birthFromForm() {
  const v = readForm();
  return {
    name: v.name.trim(), date: v.date, time: v.time, place: v.place.trim(),
    lat: v.lat, lon: v.lon, tz: v.tz.trim(), manual: v.manual, offset: v.manual ? v.offset : null,
  };
}

function remember() {
  try { localStorage.setItem(STORE, JSON.stringify({ ...readForm(), active: saved.activeId })); } catch {}
}
// Sin defaults-local.js (la versión alojada) el formulario arranca vacío: nadie ve «tu» carta.
const OPEN_DEFAULTS = { ...BLANK, hsys: "P", node: "true", active: null };
function recall() {
  const base = LOCAL_DEFAULTS || OPEN_DEFAULTS;
  try { return { ...base, ...JSON.parse(localStorage.getItem(STORE) || "{}") }; } catch { return { ...base }; }
}
function rememberView() {
  try { localStorage.setItem(VIEW, JSON.stringify({ mode, partner: partnerId })); } catch {}
}
function recallView() {
  try { return JSON.parse(localStorage.getItem(VIEW) || "{}") || {}; } catch { return {}; }
}

/** Cuerpo de la solicitud para una carta: datos de nacimiento + preferencias de vista. */
function natalBody(v) {
  const o = {
    name: v.name, place: v.place, date: v.date, time: v.time,
    lat: v.lat, lon: v.lon, tz: v.tz, hsys: v.hsys, node: v.node,
  };
  if (v.manual) o.offset = v.offset;
  return o;
}
function partnerBody(item, v) {
  const o = {
    name: item.name, place: item.place, date: item.date, time: item.time,
    lat: item.lat, lon: item.lon, tz: item.tz, hsys: v.hsys, node: v.node,
  };
  if (item.manual) o.offset = item.offset;
  return o;
}

const placeLabel = (p) => `${p.name}, ${p.country}`;

form.elements.place.addEventListener("input", (e) => {
  const hit = PLACES.find((p) => placeLabel(p) === e.target.value);
  if (hit) {
    form.elements.lat.value = hit.lat;
    form.elements.lon.value = hit.lon;
    form.elements.tz.value = hit.tz;
  }
});

$("#manual").addEventListener("change", (e) => {
  $("#offsetField").hidden = !e.target.checked;
  if (e.target.checked && !form.elements.offset.value && chart) {
    form.elements.offset.value = chart.time.offset;
  }
});

// Casas y nodo lunar viven en Configuración (fuera del formulario, pero asociados a él): valen para todas las
// cartas y se aplican al instante sobre la carta que se está viendo.
for (const name of ["hsys", "node"]) {
  form.elements[name].addEventListener("change", () => {
    remember();
    if (!birth) return;
    const v = readForm();
    birth = { ...birth, hsys: v.hsys, node: v.node };
    run(load);
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  showChart();
  await calculate();
  closeDrawer();                       // en el celular, el menú se cierra para ver la carta
});

// ---------- cartas guardadas ---------------------------------------------
const saved = createSaved({
  list: $("#savedList"), where: $("#savedWhere"),
  picker: { root: $("#picker"), btn: $("#pickBtn"), pop: $("#pickPop"), q: $("#pickQ"), none: $("#pickNone"), count: $("#savedCount") },
  onOpen: openSaved,
  onChange: () => { syncPartners(); syncActions(); if (page === "home") renderHomeCharts(); },
});

let noteTimer = 0;
function note(text, isError = false) {
  const el = $("#saveNote");
  el.textContent = text;
  el.classList.toggle("err", isError);
  clearTimeout(noteTimer);
  if (text) noteTimer = setTimeout(() => { el.textContent = ""; el.classList.remove("err"); }, 4000);
}

function syncSaveButtons() {
  const active = saved.activeId;
  $("#save").textContent = active ? "Guardar cambios" : "Guardar carta";
  $("#saveAs").hidden = !active;
  remember();
}

async function openSaved(item) {
  showChart();
  closeForm(false);
  saved.setActive(item.id);
  fillForm(item);
  note("");
  syncSaveButtons();
  closeDrawer();
  await calculate();
}

async function persist(asNew) {
  const birthData = birthFromForm();
  if (!birthData.name) {
    note("Poné un nombre para guardar la carta.", true);
    form.elements.name.focus();
    return;
  }
  try {
    const updating = saved.activeId && !asNew;
    const rec = updating ? await saved.update(saved.activeId, birthData) : await saved.create(birthData);
    saved.setActive(rec.id);
    syncSaveButtons();
    closeForm(false);
    note(updating ? "Cambios guardados." : "Carta guardada.");
    showChart();
    await calculate();                  // lo que se ve es lo que se guardó
    closeDrawer();
  } catch (err) {
    note(err.message, true);
  }
}

$("#save").addEventListener("click", () => persist(false));
$("#saveAs").addEventListener("click", () => persist(true));

// ---------- el formulario aparece con «Nueva carta» o «Editar» ----------------
// Oculto, el menú muestra solo la carta abierta y los botones. Al cerrarlo con la ✕ todo vuelve a como estaba;
// al calcular, lo que se ve pasa a ser el nuevo punto de partida de esa ✕.
const formPanel = $("#formPanel");
let editing = null;                     // { values, active } de antes de abrir; null con el formulario cerrado
const formOpen = () => !formPanel.hidden;
const hasChart = () => !!birth;

/** Qué se ve en «Cartas guardadas»: la lista y sus botones, o el primer paso si no hay ninguna. */
function syncActions() {
  const none = saved.items.length === 0;
  const open = formOpen();
  $("#savedSec").hidden = none && open;          // sin cartas y con el formulario abierto, el aviso sobra
  $("#savedEmpty").hidden = !none || open;
  $("#chartActions").hidden = none || open;
  $("#edit").hidden = !hasChart();
  if (none) root.dataset.nocharts = ""; else delete root.dataset.nocharts;
  paintSideBtn();
}

/** kind: "new" (en blanco) o "edit" (los datos de la carta que se está viendo). */
function openForm(kind) {
  if (!formOpen()) editing = { values: readForm(), active: saved.activeId };
  saved.closePicker();
  if (kind === "new") {
    saved.setActive(null);
    fillForm(BLANK);
  }
  note("");
  syncSaveButtons();
  $("#formTitle").textContent = kind === "new" ? "Nueva carta" : saved.activeId ? "Editar carta" : "Carta sin guardar";
  formPanel.hidden = false;
  syncActions();
  revealSide();
  form.elements.name.focus({ preventScroll: true });
  formPanel.scrollIntoView({ block: "nearest" });
}

/** cancel: vuelve a los datos de antes de abrir (la ✕). Guardar o elegir otra carta la cierran sin volver atrás. */
function closeForm(cancel) {
  if (!formOpen()) return;
  if (cancel && editing) {
    fillForm(editing.values);
    saved.setActive(editing.active);
    syncSaveButtons();
  }
  editing = null;
  formPanel.hidden = true;
  syncActions();
}

/** El primer paso: con una carta ya a la vista (sin guardar) se guarda esa; si no, una en blanco. */
const createFirst = () => openForm(hasChart() ? "edit" : "new");

$("#new").addEventListener("click", () => openForm("new"));
$("#edit").addEventListener("click", () => openForm("edit"));
$("#first").addEventListener("click", createFirst);
$("#introNew").addEventListener("click", createFirst);
$("#formClose").addEventListener("click", () => {
  closeForm(true);
  [$("#edit"), $("#new"), $("#first")].find((b) => b.offsetParent !== null)?.focus();
});

// ---------- sinastría: elegir la otra carta -------------------------------
const partnerSel = $("#partner");
let partnerSig = "";

const shortDate = (iso) => iso.split("-").reverse().join("/");
const partnerItem = () => (partnerId ? saved.find(partnerId) : null);

/** Mantiene la lista de «Comparar con» al día con las cartas guardadas (sin la que está abierta). */
function syncPartners() {
  const candidates = saved.items.filter((it) => it.id !== saved.activeId);
  const sig = JSON.stringify([saved.activeId, partnerId, candidates.map((c) => [c.id, c.name, c.date])]);
  if (sig === partnerSig) return;
  partnerSig = sig;

  const wasPartner = partnerId;
  if (partnerId && !candidates.some((c) => c.id === partnerId)) partnerId = null;

  partnerSel.replaceChildren(
    Object.assign(document.createElement("option"), { value: "", textContent: candidates.length ? "Elegí una carta guardada…" : "No hay otras cartas guardadas" }),
    ...candidates.map((c) => Object.assign(document.createElement("option"), { value: c.id, textContent: `${c.name} · ${shortDate(c.date)}` })),
  );
  partnerSel.value = partnerId || "";
  partnerSel.disabled = !candidates.length;
  $("#partnerHint").textContent = candidates.length ? "" : "Guardá otra carta desde el panel de la izquierda para poder compararlas.";

  if (wasPartner !== partnerId) {
    rememberView();
    if (mode === "syn" && birth) run(load);       // la carta comparada se borró o pasó a ser la abierta
  }
}

partnerSel.addEventListener("change", () => {
  partnerId = partnerSel.value || null;
  partnerSig = "";
  rememberView();
  run(load);
});

// ---------- tránsitos: fecha y hora ---------------------------------------
const tDate = $("#tDate"), tTime = $("#tTime"), tTz = $("#tTz");

function browserTz() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; }
}

/** Fecha y hora de pared "ahora" en una zona. */
function nowIn(tz) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  const p = Object.fromEntries(f.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

function setNow() {
  let tz = tTz.value.trim() || browserTz() || (birth && birth.tz) || "UTC";
  let n;
  try { n = nowIn(tz); } catch { tz = "UTC"; n = nowIn(tz); }
  tTz.value = tz;
  tDate.value = n.date;
  tTime.value = n.time;
  if (!$("#calFrom").value) $("#calFrom").value = n.date;
}

/** Instante elegido, o null si falta algún dato (no se calcula a medias). */
function atFromControls() {
  const date = tDate.value, time = tTime.value, tz = tTz.value.trim();
  return date && time && tz ? { date, time, tz } : null;
}

const pad2 = (n) => String(n).padStart(2, "0");

function stepTransit(dir) {
  if (!tDate.value || !tTime.value) return;
  const [y, m, d] = tDate.value.split("-").map(Number);
  const [hh, mm] = tTime.value.split(":").map(Number);
  let t = Date.UTC(y, m - 1, d, hh, mm);
  const unit = $("#tStep").value;
  if (unit === "h") t += dir * 3600e3;
  else if (unit === "d") t += dir * 86400e3;
  else if (unit === "w") t += dir * 7 * 86400e3;
  else {
    // meses y años sobre el calendario, sin desbordar fin de mes (31 ene + 1 mes = 28/29 feb)
    const total = y * 12 + (m - 1) + dir * (unit === "m" ? 1 : 12);
    const ny = Math.floor(total / 12), nm = total % 12;
    const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
    t = Date.UTC(ny, nm, Math.min(d, last), hh, mm);
  }
  const dt = new Date(t);
  tDate.value = `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
  tTime.value = `${pad2(dt.getUTCHours())}:${pad2(dt.getUTCMinutes())}`;
  loadSoon();
}

let soonTimer = 0;
function loadSoon() {
  clearTimeout(soonTimer);
  soonTimer = setTimeout(() => { if (mode === "transit" && birth && atFromControls()) run(load); }, 140);
}

$("#tPrev").addEventListener("click", () => stepTransit(-1));
$("#tNext").addEventListener("click", () => stepTransit(1));
$("#tNow").addEventListener("click", () => { setNow(); loadSoon(); });
for (const el of [tDate, tTime, tTz]) el.addEventListener("change", loadSoon);

// ---------- cálculo -------------------------------------------------------
let seq = 0;

// Por POST: los datos de nacimiento no tienen que viajar en la URL (quedarían en los registros del hosting).
const fetchNatal = (v) => compute.chart(natalBody(v));

/** Pide al servidor lo que necesita la vista actual y la dibuja. */
async function load() {
  const my = ++seq;
  const v = birth;
  let next;
  if (mode === "transit" && atFromControls()) {
    const r = await compute.transits(natalBody(v), atFromControls());
    next = { chart: r.natal, transit: r, syn: null };
  } else if (mode === "syn" && partnerItem()) {
    const r = await compute.synastry(natalBody(v), partnerBody(partnerItem(), v));
    next = { chart: r.a, transit: null, syn: r };
  } else {
    next = { chart: await fetchNatal(v), transit: null, syn: null };
  }
  if (my !== seq) return;                 // mientras tanto se pidió otra cosa
  ({ chart, transit, syn } = next);
  render();
}

async function run(fn) {
  try { await fn(); } catch (err) { showError(err); }
}

async function calculate() {
  primeChart();
  birth = readForm();
  remember();
  const btn = $("#go");
  btn.disabled = true;
  btn.textContent = "Calculando…";
  try { await run(load); } finally {
    btn.disabled = false;
    btn.textContent = "Calcular carta";
    if (formOpen()) editing = { values: readForm(), active: saved.activeId };   // la ✕ ya no vuelve más atrás de esto
    syncActions();
  }
}

function showError(err) {
  const offline = err instanceof TypeError;
  const pub = isPublic();
  $("#error").hidden = false;
  $("#intro").hidden = true;
  $("#error").innerHTML = `<strong>${offline ? (pub ? "No se pudo conectar con el servidor" : "No encuentro el servidor local") : "No se pudo calcular"}</strong>` +
    (offline
      ? (pub
        ? "Si hace un rato que nadie la usa, la página puede tardar hasta un minuto en despertar. Esperá un momento y recargá."
        : "La ventana de Terminal que inició la app tiene que seguir abierta. Volvé a abrir <em>iniciar.command</em> y recargá esta página.")
      : "");
  if (!offline) $("#error").append(document.createTextNode(err.message));
  $("#stage").hidden = true;
  $("#warnings").hidden = true;
  $("#timeNote").hidden = true;
}

// ---------- presentación --------------------------------------------------
const longDate = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric" });
const dateOf = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };

function header(c) {
  const name = c.input.name;
  const where = c.input.place || `${c.input.lat}°, ${c.input.lon}°`;
  if (mode === "transit" && transit) {
    const at = transit.at;
    $("#title").textContent = `Tránsitos sobre ${name || "la carta natal"}`;
    $("#sub").textContent =
      `${longDate.format(dateOf(at.date))}, ${at.time} (${at.tz || at.offset_label}). ` +
      `Adentro, la carta natal; afuera, los planetas en tránsito.`;
    document.title = `Tránsitos · ${name || "Carta natal"}`;
  } else if (mode === "syn" && syn) {
    const A = syn.a.input.name || "Carta A", B = syn.b.input.name || "Carta B";
    $("#title").textContent = `${A} y ${B}`;
    $("#sub").textContent =
      `Adentro, ${A} con sus casas; afuera, ${B}. Los aspectos cruzados usan los mismos orbes que la carta natal.`;
    document.title = `${A} y ${B} · Sinastría`;
  } else {
    const [y, m, d] = c.input.date.split("-").map(Number);
    $("#title").textContent = name || "Carta natal";
    $("#sub").textContent =
      `${longDate.format(new Date(y, m - 1, d))}, ${c.input.time} en ${where}. ` +
      `Casas ${c.houses.system_name}, nodo ${c.node_kind === "mean" ? "medio" : "verdadero"}.`;
    document.title = name ? `${name} · Carta natal` : "Carta natal";
  }
}

/** Datos del anillo exterior según la vista, o null en la rueda natal simple. */
function outerRing() {
  if (mode === "transit" && transit) {
    return {
      bodies: transit.bodies,
      aspects: transit.aspects.filter((a) => a.orb <= orbMax),
      short: "tránsito", houseWord: "casa natal", label: "los planetas en tránsito",
    };
  }
  if (mode === "syn" && syn) {
    const houseIn = Object.fromEntries(syn.overlay.b_in_a.map((o) => [o.id, o.house]));
    const A = syn.a.input.name || "Carta A", B = syn.b.input.name || "Carta B";
    return {
      bodies: syn.b.bodies.map((b) => ({ ...b, house: houseIn[b.id] })),
      angles: syn.b.angles,
      aspects: syn.aspects.filter((a) => a.orb <= orbMax),
      short: B, houseWord: `casa de ${A}`, label: B,
    };
  }
  return null;
}

function drawWheel() {
  const outer = outerRing();
  wheel = renderWheel($("#wheel"), chart, { outer, onFocus: highlightRows, onClear: () => highlightRows(null), onPick: interpOn ? openReading : null });
  $("#outKey").hidden = !outer;
  if (outer) $("#outKeyText").textContent = mode === "transit" ? "Tránsitos" : outer.short;
}

function render() {
  const c = chart;
  $("#error").hidden = true;
  $("#intro").hidden = true;
  $("#stage").hidden = false;
  header(c);

  const t = c.time;
  const timeNote = $("#timeNote");
  timeNote.textContent =
    `${c.input.time} locales equivalen a ${t.utc.slice(11, 16)} UTC (${t.offset_label}).` +
    (t.manual ? " Offset fijado a mano." : t.dst ? " Horario de verano vigente." : "");
  timeNote.hidden = false;

  const warnings = mode === "syn" && syn ? syn.warnings
    : mode === "transit" && transit ? [...c.warnings, ...transit.warnings.map((w) => `Fecha del tránsito: ${w}`)]
    : c.warnings;
  const w = $("#warnings");
  w.hidden = !warnings.length;
  w.replaceChildren(...warnings.map((text) => {
    const p = document.createElement("p");
    p.style.margin = "0";
    p.textContent = text;
    return p;
  }));

  drawWheel();
  renderPositions(c);
  renderHouses(c);
  renderTransitList();
  renderAspects();
  renderStair();
  renderGrid();
  renderElements();
  renderOverlay();
  applyTabs();
}

function renderPositions(c) {
  const row = (id, lon, house, retro) => {
    const s = split(lon);
    return `<tr data-id="${id}">
      <td>${mark(id)}${BODY[id].name}</td>
      <td><span class="g">${signHTML(s.sign)}</span>${SIGNS[s.sign]}</td>
      <td class="num">${fmtPos(lon)}${retro ? '<span class="rx-t" title="Retrógrado">R</span>' : ""}</td>
      <td class="num">${house}</td></tr>`;
  };
  let html = `<table><thead><tr><th>Cuerpo</th><th>Signo</th><th class="num">Posición</th><th class="num">Casa</th></tr></thead><tbody>`;
  html += row("asc", c.angles.asc, "—") + row("mc", c.angles.mc, "—");
  c.bodies.forEach((b, i) => {
    html += row(b.id, b.lon, b.house, b.retro).replace("<tr ", i === 0 ? '<tr class="sep" ' : "<tr ");
  });
  $("#panel-pos").innerHTML = html + "</tbody></table>";
}

function renderHouses(c) {
  let html = `<table><thead><tr><th>Casa</th><th>Cúspide</th><th class="num">Posición</th><th>Contiene</th></tr></thead><tbody>`;
  c.houses.cusps.forEach((lon, i) => {
    const s = split(lon);
    const inside = c.bodies.filter((b) => b.house === i + 1)
      .map((b) => `<span class="g" title="${BODY[b.id].name}">${glyphHTML(b.id)}</span>`).join("");
    html += `<tr><td class="num" style="text-align:left">${i + 1}</td>
      <td><span class="g">${signHTML(s.sign)}</span>${SIGNS[s.sign]}</td>
      <td class="num">${fmtPos(lon)}</td><td class="contains">${inside}</td></tr>`;
  });
  $("#panel-casas").innerHTML = html + "</tbody></table>";
}

const needPartner = `<p class="muted pad">Elegí arriba una carta guardada para compararla con la que tenés abierta.</p>`;
const retroTag = (on) => (on ? '<span class="rx-t" title="Retrógrado">R</span>' : "");

// -- tránsitos: dónde está cada planeta y en qué casa natal cae
function renderTransitList() {
  const el = $("#panel-tpos");
  if (!transit) { el.innerHTML = ""; return; }
  let html = `<table><thead><tr><th>Cuerpo</th><th>Signo</th><th class="num">Posición</th><th class="num">Casa</th></tr></thead><tbody>`;
  for (const b of transit.bodies) {
    const s = split(b.lon);
    html += `<tr data-id="o:${b.id}">
      <td>${mark(b.id)}${BODY[b.id].name}</td>
      <td><span class="g">${signHTML(s.sign)}</span>${SIGNS[s.sign]}</td>
      <td class="num">${fmtPos(b.lon)}${retroTag(b.retro)}</td>
      <td class="num">${b.house}</td></tr>`;
  }
  el.innerHTML = html + `</tbody></table><p class="fine tight">Casa: la de la carta natal que cada planeta recorre en este momento.</p>`;
}

// -- aspectos: natal, tránsito→natal o carta A↔B
function renderAspects() {
  if (!chart) return;
  const cross = mode === "transit" ? transit : mode === "syn" ? syn : null;
  if (mode === "syn" && !syn) {
    $("#aspCount").textContent = "";
    $("#aspTable").innerHTML = needPartner;
    return;
  }
  const all = cross ? cross.aspects : chart.aspects;
  const list = all.filter((a) => a.orb <= orbMax);
  $("#aspCount").textContent = list.length === 1 ? "1 aspecto" : `${list.length} aspectos`;
  if (!list.length) {
    $("#aspTable").innerHTML = `<p class="muted">No hay aspectos con ese orbe. Probá con un orbe mayor.</p>`;
    return;
  }

  const trBody = (id) => transit.bodies.find((b) => b.id === id);
  const isTransit = mode === "transit";
  const heads = isTransit ? "Tránsito · Natal" : mode === "syn" ? `${esc(syn.a.input.name || "A")} · ${esc(syn.b.input.name || "B")}` : "Aspecto";
  const phaseCol = mode !== "syn";
  let html = `<table><thead><tr><th>${heads}</th><th></th><th class="num">Orbe</th>${phaseCol ? "<th>Fase</th>" : ""}</tr></thead><tbody>`;
  for (const a of list) {
    const A = ASPECT[a.type];
    const phase = a.applying === null ? "" : a.applying ? "aplicativo" : "separativo";
    const b = cross ? "o:" + a.b : a.b;
    const pair = isTransit
      ? `${mark(a.b)}${retroTag(trBody(a.b).retro)}<span class="a-ic ${A.cls}">${A.glyph}</span>${mark(a.a)}`
      : `${mark(a.a)}<span class="a-ic ${A.cls}">${A.glyph}</span>${mark(a.b)}`;
    html += `<tr data-a="${a.a}" data-b="${b}">
      <td class="pair">${pair}</td>
      <td class="small">${A.name}</td>
      <td class="num">${fmtOrb(a.orb)}</td>
      ${phaseCol ? `<td class="small muted">${phase}</td>` : ""}</tr>`;
  }
  $("#aspTable").innerHTML = html + "</tbody></table>";
}

// -- natal: cuadro de aspectos en escalera
function renderStair() {
  $("#stairTable").innerHTML = chart ? stairHTML(chart, orbMax) : "";
}

// -- natal: balance de elementos
function renderElements() {
  $("#panel-elem").innerHTML = chart ? elementsHTML(chart) : "";
}

// -- sinastría y tránsitos: cuadrícula de aspectos. Filas: la carta de adentro (A o la natal).
//    Columnas: la de afuera (B o los planetas en tránsito).
function renderGrid() {
  const el = $("#gridTable");
  const cross = mode === "syn" ? syn : mode === "transit" ? transit : null;
  if (!cross) { el.innerHTML = mode === "syn" ? needPartner : ""; return; }
  const inner = [...chart.bodies.map((b) => b.id), "asc", "mc"];
  const outer = mode === "syn" ? [...syn.b.bodies.map((b) => b.id), "asc", "mc"] : transit.bodies.map((b) => b.id);
  const found = new Map(cross.aspects.filter((a) => a.orb <= orbMax).map((a) => [`${a.a}|${a.b}`, a]));
  const A = mode === "syn" ? syn.a.input.name || "A" : chart.input.name || "la carta natal";
  const B = mode === "syn" ? syn.b.input.name || "B" : "los tránsitos";
  const owner = mode === "syn" ? (who) => ` de ${esc(who)}` : () => "";

  let html = `<p class="count">Filas: <strong>${esc(A)}</strong>. Columnas: <strong>${esc(B)}</strong>.</p>` +
    `<table class="grid"><thead><tr><th></th>${outer.map((id) => `<th scope="col">${badge(id, "s")}</th>`).join("")}</tr></thead><tbody>`;
  for (const r of inner) {
    html += `<tr><th scope="row">${badge(r, "s")}</th>`;
    for (const c of outer) {
      const a = found.get(`${r}|${c}`);
      if (!a) { html += "<td></td>"; continue; }
      const T = ASPECT[a.type];
      const phase = a.applying === null || a.applying === undefined ? "" : a.applying ? " · aplicativo" : " · separativo";
      html += `<td class="hit" data-a="${r}" data-b="o:${c}" title="${BODY[r].name}${owner(A)} ${T.name.toLowerCase()} ${BODY[c].name}${owner(B)} · orbe ${fmtOrb(a.orb)}${phase}">` +
        `<span class="a-ic ${T.cls}">${T.glyph}</span></td>`;
    }
    html += "</tr>";
  }
  el.innerHTML = html + "</tbody></table>";
}

// -- sinastría: en qué casa de uno cae cada planeta del otro
function renderOverlay() {
  const el = $("#panel-over");
  if (!(mode === "syn" && syn)) { el.innerHTML = needPartner; return; }
  const A = syn.a.input.name || "Carta A", B = syn.b.input.name || "Carta B";
  const table = (title, rows, prefix) => {
    let html = `<h3 class="sub">${title}</h3><table><thead><tr><th>Cuerpo</th><th>Signo</th><th class="num">Posición</th><th class="num">Casa</th></tr></thead><tbody>`;
    rows.forEach((o) => {
      const s = split(o.lon);
      html += `<tr data-id="${prefix}${o.id}">
        <td>${mark(o.id)}${BODY[o.id].name}</td>
        <td><span class="g">${signHTML(s.sign)}</span>${SIGNS[s.sign]}</td>
        <td class="num">${fmtPos(o.lon)}</td><td class="num">${o.house}</td></tr>`;
    });
    return html + "</tbody></table>";
  };
  el.innerHTML =
    table(`${esc(B)} en las casas de ${esc(A)}`, syn.overlay.b_in_a, "o:") +
    table(`${esc(A)} en las casas de ${esc(B)}`, syn.overlay.a_in_b, "");
}

// ---------- calendario de aspectos exactos --------------------------------
const cal = { months: 12, scope: "slow", key: "", data: null, shown: null, tz: "", seq: 0, current: null };
const monthName = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" });
const monthShort = new Intl.DateTimeFormat("es-AR", { month: "short", timeZone: "UTC" });
const ordinal = (n) => `${n}ª`;

async function ensureCalendar() {
  if (mode !== "transit" || !birth) return;
  const from = $("#calFrom").value, tz = tTz.value.trim();
  if (!from || !tz) {
    $("#calCount").textContent = "";
    $("#calTable").innerHTML = `<p class="muted pad">Elegí la fecha de inicio.</p>`;
    return;
  }
  const req = { natal: natalBody(birth), start: { date: from, time: "00:00", tz }, months: cal.months, scope: cal.scope };
  const key = JSON.stringify(req);
  if (cal.key === key && cal.data) { if (cal.shown !== cal.data) renderCalendar(); return; }
  cal.key = key;
  const my = ++cal.seq;
  $("#calCount").textContent = "";
  $("#calTable").innerHTML = `<p class="muted pad">Calculando…</p>`;
  try {
    const data = await compute.calendar(req.natal, req.start, req.months, req.scope);
    if (my !== cal.seq) return;
    cal.data = data;
    cal.tz = tz;
    cal.current = null;
    renderCalendar();
  } catch (err) {
    if (my !== cal.seq) return;
    cal.data = null;
    cal.key = "";
    const p = Object.assign(document.createElement("p"), { className: "muted pad", textContent: err.message });
    $("#calTable").replaceChildren(p);
  }
}

function renderCalendar() {
  const d = cal.data;
  if (!d) return;
  cal.shown = d;
  const n = d.events.length;
  $("#calCount").textContent = (n === 1 ? "1 aspecto exacto" : `${n} aspectos exactos`) +
    (d.truncated ? ". Hay más: acortá el período o elegí menos planetas." : "");
  if (!n) { $("#calTable").innerHTML = `<p class="muted pad">No hay aspectos exactos en este período.</p>`; return; }

  let html = `<table class="cal"><tbody>`;
  let month = "";
  d.events.forEach((e, i) => {
    const [dayIso, hm] = e.local.split(" ");
    const [y, m, day] = dayIso.split("-").map(Number);
    const stamp = new Date(Date.UTC(y, m - 1, 1));
    const raw = monthName.format(stamp);
    const label = raw.charAt(0).toUpperCase() + raw.slice(1);
    if (label !== month) {
      month = label;
      html += `<tr class="mon"><th colspan="3">${label}</th></tr>`;
    }
    const A = ASPECT[e.type];
    const sub = [e.passes ? `${ordinal(e.pass)} de ${e.passes}` : "", e.retro ? "retrógrado" : ""].filter(Boolean).join(" · ");
    html += `<tr class="ev${cal.current === i ? " cur" : ""}" tabindex="0" data-i="${i}" data-a="${e.n}" data-b="o:${e.t}" data-type="${e.type}"
        title="${BODY[e.t].name} ${A.name.toLowerCase()} ${BODY[e.n].name} natal · tocá para ver la rueda en ese momento">
      <td class="when"><span class="dd">${day}</span> ${monthShort.format(stamp).replace(".", "")}<span class="tm">${hm}</span></td>
      <td class="pair">${mark(e.t)}${retroTag(e.retro)}<span class="a-ic ${A.cls}">${A.glyph}</span>${mark(e.n)}</td>
      <td class="small">${A.name}${sub ? `<span class="sub2">${sub}</span>` : ""}</td></tr>`;
  });
  $("#calTable").innerHTML = html + "</tbody></table>" +
    `<p class="fine tight">Horas en ${esc(cal.tz)}. Tocá una fila para llevar la rueda a ese momento.</p>`;
}

function jumpTo(i) {
  const e = cal.data?.events[i];
  if (!e) return;
  const [date, time] = e.local.split(" ");
  tTz.value = cal.tz;
  tDate.value = date;
  tTime.value = time;
  cal.current = i;
  document.querySelectorAll("#calTable tr.cur").forEach((r) => r.classList.remove("cur"));
  document.querySelector(`#calTable tr[data-i="${i}"]`)?.classList.add("cur");
  loadSoon();
}

$("#calTable").addEventListener("click", (e) => {
  const tr = e.target.closest("tr.ev");
  if (tr) jumpTo(Number(tr.dataset.i));
});
$("#calTable").addEventListener("keydown", (e) => {
  const tr = e.target.closest("tr.ev");
  if (tr && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); jumpTo(Number(tr.dataset.i)); }
});
$("#calFrom").addEventListener("change", ensureCalendar);
for (const [sel, key, attr] of [["#calMonths", "months", "m"], ["#calScope", "scope", "s"]]) {
  document.querySelectorAll(`${sel} button`).forEach((b) => b.addEventListener("click", () => {
    cal[key] = key === "months" ? Number(b.dataset[attr]) : b.dataset[attr];
    document.querySelectorAll(`${sel} button`).forEach((x) => x.setAttribute("aria-pressed", x === b));
    ensureCalendar();
  }));
}

// ---------- resumen: profecciones, destacados y próximamente ---------------------
// Las profecciones salen de la carta y la fecha; los destacados y los próximos eventos los calcula el servidor
// para el momento elegido en la barra de tránsitos y se piden recién al abrir cada vista.
const sum = { view: "feat", days: 30, feat: null, featKey: "", featSeq: 0, soon: null, soonKey: "", soonSeq: 0, err: null };

function sumProfection() {
  if (!chart || !transit) return "";
  const p = profection(chart.input.date, transit.at.date, Math.floor(chart.angles.asc / 30) % 12);
  return profectionHTML(p, transit.bodies, interpOn);
}

function sumError(err) {
  // un servidor local de antes de esta versión no conoce los pedidos nuevos
  if (err && err.status === 404 && !isPublic()) {
    return "Este servidor local es de una versión anterior y no tiene esta función. Cerrá la app (Cmd+Q) y volvé a abrirla.";
  }
  return err?.message || "No se pudo calcular.";
}

function renderSummary() {
  const body = $("#sumBody");
  document.querySelectorAll("#sumView button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === sum.view));
  if (!(mode === "transit" && transit)) { body.replaceChildren(); return; }
  let html;
  if (sum.view === "feat") {
    const list = sum.err ? `<p class="muted pad">${esc(sumError(sum.err))}</p>`
      : sum.feat ? featuredHTML(sum.feat, interpOn)
      : `<p class="muted pad">Calculando…</p>`;
    html = sumProfection() + `<h3 class="sum-h sum-h2">Tránsitos destacados</h3>` + list;
  } else {
    html = sum.err ? `<p class="muted pad">${esc(sumError(sum.err))}</p>`
      : sum.soon ? upcomingHTML(sum.soon, sum.days, interpOn)
      : `<p class="muted pad">Calculando…</p>`;
    if (sum.err || !sum.soon) {          // el selector de período se ve igual mientras carga
      html = `<div class="seg soonseg" role="group" aria-label="Período">${SOON_PERIODS.map(([d, label]) =>
        `<button type="button" data-days="${d}" aria-pressed="${d === sum.days}">${label}</button>`).join("")}</div>` + html;
    }
  }
  body.innerHTML = html;
}

async function ensureSummary() {
  if (mode !== "transit" || !birth || !transit) return;
  const at = atFromControls();
  if (!at) { renderSummary(); return; }
  const natal = natalBody(birth);
  const feat = sum.view === "feat";
  const key = JSON.stringify(feat ? [natal, at] : [natal, at, sum.days]);
  if (key === (feat ? sum.featKey : sum.soonKey) && (feat ? sum.feat : sum.soon)) { renderSummary(); return; }
  if (feat) { sum.featKey = key; sum.feat = null; } else { sum.soonKey = key; sum.soon = null; }
  const my = feat ? ++sum.featSeq : ++sum.soonSeq;
  sum.err = null;
  renderSummary();
  try {
    const data = feat ? await compute.featured(natal, at) : await compute.upcoming(natal, at, sum.days);
    if (my !== (feat ? sum.featSeq : sum.soonSeq)) return;
    if (feat) sum.feat = data; else sum.soon = data;
  } catch (err) {
    if (my !== (feat ? sum.featSeq : sum.soonSeq)) return;
    if (feat) sum.featKey = ""; else sum.soonKey = "";
    sum.err = err;
  }
  if (feat === (sum.view === "feat")) renderSummary();
}

document.querySelectorAll("#sumView button").forEach((b) => b.addEventListener("click", () => {
  if (sum.view === b.dataset.v) return;
  sum.view = b.dataset.v;
  sum.err = null;
  ensureSummary();
}));
$("#sumBody").addEventListener("click", (e) => {
  const days = e.target.closest("[data-days]");
  if (days) { sum.days = Number(days.dataset.days); sum.err = null; ensureSummary(); return; }
  const go = e.target.closest("[data-go]");
  if (go) { jumpToLocal(go.dataset.go); return; }
  const el = e.target.closest("[data-id]");
  if (el) openReading(el.dataset.id);
});
$("#sumBody").addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const el = e.target.closest(".soon-ev[data-go], .fcard[data-id]");
  if (!el) return;
  e.preventDefault();
  if (el.dataset.go) jumpToLocal(el.dataset.go); else openReading(el.dataset.id);
});

/** Lleva la barra de tránsitos a un instante «AAAA-MM-DD HH:MM» (en la zona elegida) y vuelve a calcular. */
function jumpToLocal(local) {
  const [date, time] = local.split(" ");
  tDate.value = date;
  tTime.value = time;
  loadSoon();
}

// ---------- interacción rueda ↔ tablas -----------------------------------
function highlightRows(id) {
  document.querySelectorAll("tr.hl").forEach((r) => r.classList.remove("hl"));
  if (!id) return;
  document.querySelectorAll(`#panel-pos tr[data-id="${id}"], #panel-tpos tr[data-id="${id}"], #panel-over tr[data-id="${id}"]`)
    .forEach((r) => r.classList.add("hl"));
}

const hoverFocus = (panel, skipAngles) => {
  $(panel).addEventListener("mouseover", (e) => {
    const tr = e.target.closest("[data-id]");
    if (!tr || !wheel) return;
    if (skipAngles && (tr.dataset.id === "asc" || tr.dataset.id === "mc")) return;
    wheel.focus(tr.dataset.id);
  });
  $(panel).addEventListener("mouseleave", () => wheel?.clear());
};
hoverFocus("#panel-pos", true);
hoverFocus("#panel-elem", true);
hoverFocus("#panel-tpos", false);
hoverFocus("#panel-over", false);

// Tocar un planeta (en la rueda, en una tabla o en la cruz de elementos) abre su lectura.
const reading = initPlanetDialog(() => ({ mode, chart, transit, syn, orbMax }), () => { wheel?.clear(); highlightRows(null); });
function openReading(id) { if (chart && interpOn) reading.open(id); }
for (const sel of ["#panel-pos", "#panel-tpos", "#panel-over", "#panel-elem"]) {
  $(sel).addEventListener("click", (e) => {
    const el = e.target.closest("tr[data-id], li.chip[data-id]");
    if (el) openReading(el.dataset.id);
  });
}

const STAIR_HINT = "Pasá el cursor por un aspecto para ver el orbe.";
for (const sel of ["#aspTable", "#gridTable", "#stairTable"]) {
  $(sel).addEventListener("mouseover", (e) => {
    const el = e.target.closest("[data-a][data-b]");
    if (!el) return;
    if (wheel) wheel.pair(el.dataset.a, el.dataset.b);
    const info = $("#stairInfo");
    if (sel === "#stairTable" && info) info.textContent = el.dataset.info || STAIR_HINT;
  });
  $(sel).addEventListener("mouseleave", () => {
    wheel?.clear();
    const info = $("#stairInfo");
    if (info) info.textContent = STAIR_HINT;
  });
}

// ---------- pestañas, modos y filtro -------------------------------------
const tabs = [...document.querySelectorAll("[role=tab]")];
const lastTab = { natal: "tab-pos", transit: "tab-sum", syn: "tab-asp" };
const visibleTabs = () => tabs.filter((t) => t.dataset.modes.split(" ").includes(mode));

function selectTab(tab) {
  lastTab[mode] = tab.id;
  for (const t of tabs) {
    const on = t === tab;
    t.setAttribute("aria-selected", on);
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
  }
  wheel?.clear();
  if (tab.id === "tab-cal") ensureCalendar();
  if (tab.id === "tab-sum") ensureSummary();
}

function applyTabs() {
  const vis = visibleTabs();
  for (const t of tabs) t.hidden = !vis.includes(t);
  selectTab(vis.find((t) => t.id === lastTab[mode]) || vis[0]);
}

tabs.forEach((t) => {
  t.addEventListener("click", () => selectTab(t));
  t.addEventListener("keydown", (e) => {
    const next = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!next) return;
    const vis = visibleTabs();
    const n = vis[(vis.indexOf(t) + next + vis.length) % vis.length];
    n.focus();
    selectTab(n);
  });
});

function paintMode() {
  document.querySelectorAll("#modes button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.mode === mode));
  $("#toolsTransit").hidden = mode !== "transit";
  $("#toolsSyn").hidden = mode !== "syn";
}

async function setMode(next) {
  if (next === mode) return;
  mode = next;
  rememberView();
  paintMode();
  if (mode === "transit" && !tDate.value) setNow();
  if (birth) { await run(load); } else { applyTabs(); }
}
document.querySelectorAll("#modes button").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));

document.querySelectorAll(".seg.orb button").forEach((b) => b.addEventListener("click", () => {
  orbMax = Number(b.dataset.orb);
  document.querySelectorAll(".seg.orb button").forEach((x) => x.setAttribute("aria-pressed", x.dataset.orb === b.dataset.orb));
  if (!chart) return;
  renderAspects();
  renderStair();
  renderGrid();
  if (mode !== "natal") drawWheel();      // en la rueda doble las líneas siguen el orbe elegido
}));

// ---------- menú lateral: fijo, u oculto y solapado --------------------------
// Oculto: no ocupa lugar. Con mouse, al pasar por el borde izquierdo o por el botón de la esquina aparece flotando
// encima del contenido («peek»); con un clic en el botón queda fijo. En el celular o la tableta no hay «pasar el
// mouse»: el botón abre el menú encima, como un cajón con una cortina detrás, y se cierra al tocar afuera.
// Sin cartas guardadas, el botón de la esquina es un «+» que abre el menú con el formulario para la primera.
const root = document.documentElement;
const sideShowBtn = $("#sideShow");
const sideHidden = () => root.dataset.side === "hidden";
const hoverMode = () => matchMedia("(hover: hover) and (pointer: fine) and (min-width: 821px)").matches;
const canPeek = () => sideHidden() && hoverMode();      // abrir pasando el mouse
const peeking = () => "peek" in root.dataset;
let peekTimer = 0;
let sideChangedAt = 0;      // al ocultar con el mouse quieto sobre la esquina, el menú no tiene que reaparecer solo

function paintSideBtn() {
  const none = "nocharts" in root.dataset;
  const label = peeking() ? "Fijar el menú" : none ? "Crear la primera carta" : "Mostrar el menú";
  sideShowBtn.setAttribute("aria-label", label);
  if (!peeking()) sideShowBtn.title = none
    ? "Crear la primera carta"
    : "Pasá el mouse para ver el menú encima; hacé clic para fijarlo (Ctrl o Cmd + \\)";
}

function peek(on) {
  clearTimeout(peekTimer);
  if (on && !sideHidden()) on = false;
  if (on) root.dataset.peek = ""; else { delete root.dataset.peek; saved.closePicker(); }
  paintSideBtn();
}
const peekSoon = (on, ms) => { clearTimeout(peekTimer); peekTimer = setTimeout(() => peek(on), ms); };
/** Para que se vea lo que se acaba de abrir (el formulario): muestra el menú si está oculto. */
function revealSide() {
  if (!sideHidden() || peeking()) return;
  peek(true);
  if (!hoverMode()) $(".side").focus({ preventScroll: true });
}
/** En el celular o la tableta el menú abierto tapa la carta: se cierra al elegir o al calcular. */
function closeDrawer() {
  if (peeking() && !hoverMode()) peek(false);
  showResult();
}
/** Con el menú fijo arriba de todo (pantalla angosta), la carta queda más abajo: si no se ve, lleva la vista hasta ella. */
function showResult() {
  if (page !== "chart" || !matchMedia("(max-width: 820px)").matches || sideHidden()) return;
  const t = $("#title").getBoundingClientRect();
  if (t.top < 0 || t.top > innerHeight - 80) $("main").scrollIntoView({ block: "start" });
}
// no se cierra solo mientras se escribe en un campo, ni con la lista de cartas o el formulario abiertos
const sideBusy = () => saved.pickerOpen || formOpen() || ($(".side").contains(document.activeElement) && /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName));

function paintSideCfg() {
  document.querySelectorAll("#cfgSide button").forEach((b) => b.setAttribute("aria-pressed", (b.dataset.side === "hidden") === sideHidden()));
}
/** hidden = true: oculto y solapable; false: fijo. `focus` mueve el foco al botón que queda a la vista. */
function setSide(hidden, focus = true) {
  peek(false);
  sideChangedAt = performance.now();
  if (hidden) root.dataset.side = "hidden"; else delete root.dataset.side;
  try { localStorage.setItem(SIDE_KEY, hidden ? "hidden" : "shown"); } catch {}
  paintSideCfg();
  // el foco no puede quedar en un botón que acaba de desaparecer
  if (focus) (hidden ? sideShowBtn : $("#sideHide")).focus();
}
$("#sideHide").addEventListener("click", () => setSide(true));
sideShowBtn.addEventListener("click", () => {
  if (peeking() && hoverMode()) { setSide(false); return; }       // flotando con el mouse: el botón es «fijar»
  if ("nocharts" in root.dataset) { createFirst(); return; }
  if (!hoverMode()) { revealSide(); return; }
  setSide(false);
});
document.querySelectorAll("#cfgSide button").forEach((b) => b.addEventListener("click", () => {
  // al ocultar desde adentro del menú, el botón apretado se va con él: el foco pasa al botón de la esquina
  if ((b.dataset.side === "hidden") !== sideHidden()) setSide(b.dataset.side === "hidden", b.dataset.side === "hidden");
}));
paintSideCfg();

for (const el of [sideShowBtn, $("#sideEdge")]) {
  el.addEventListener("mouseenter", () => { if (canPeek() && !peeking() && performance.now() - sideChangedAt > 350) peekSoon(true, 90); });
  el.addEventListener("mouseleave", () => { if (hoverMode() && peeking() && !sideBusy()) peekSoon(false, 320); else clearTimeout(peekTimer); });
}
// el cajón del celular no se cierra «al salir el mouse» (los toques lo simulan): solo con la cortina, Esc o la ✕
$(".side").addEventListener("mouseenter", () => { if (peeking()) clearTimeout(peekTimer); });
$(".side").addEventListener("mouseleave", () => { if (hoverMode() && peeking() && !sideBusy()) peekSoon(false, 320); });
// tocar fuera del menú flotante lo cierra; Esc también
document.addEventListener("pointerdown", (e) => {
  if (peeking() && !e.target.closest(".side, #sideShow")) peek(false);
});
addEventListener("keydown", (e) => {
  if (e.key === "Escape" && peeking() && !document.querySelector("dialog[open]")) {
    peek(false);
    if ($(".side").contains(document.activeElement)) sideShowBtn.focus();
  }
});
addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key === "\\") {
    e.preventDefault();
    setSide(!sideHidden());
  }
});

// la configuración dentro del menú: abierta en pantallas grandes, cerrada en el celular, y se recuerda lo que se elija
const cfgBox = $("#cfgBox");
try {
  const v = localStorage.getItem("carta:cfgopen");
  cfgBox.open = v === null ? !matchMedia("(max-width: 820px)").matches : v === "1";
} catch { cfgBox.open = true; }
cfgBox.querySelector("summary").addEventListener("click", () => setTimeout(() => {
  try { localStorage.setItem("carta:cfgopen", cfgBox.open ? "1" : "0"); } catch {}
}));

// ---------- tema ----------------------------------------------------------
const themeBtn = $("#theme");
const isDark = () => (document.documentElement.dataset.theme
  ? document.documentElement.dataset.theme === "dark"
  : matchMedia("(prefers-color-scheme: dark)").matches);
const paintThemeBtn = () => { themeBtn.textContent = isDark() ? "Modo claro" : "Modo oscuro"; };
themeBtn.addEventListener("click", () => {
  const next = isDark() ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("carta:theme", next); } catch {}
  paintThemeBtn();
});
paintThemeBtn();

// ---------- configuración: estilo, letra, mandala --------------------------
// Solo cambiar el estilo de los gráficos obliga a volver a dibujar; lo demás lo resuelve la CSS.
setClassic(initSettings((cfg, what) => {
  const interpChanged = cfg.interp !== interpOn;
  interpOn = cfg.interp;
  if (interpChanged) {                  // «solo datos»: se cierra la ventana de lectura y se redibuja lo que la ofrecía
    reading.close();
    if (chart) { drawWheel(); renderSummary(); }
  }
  if (what === "gfx") {
    setClassic(cfg.gfx === "classic");
    if (chart) render();
  }
}).gfx === "classic");
// «Restablecer» deja el menú como viene de fábrica: fijo en pantallas grandes, oculto en el celular
$("#cfgReset").addEventListener("click", () => {
  const hidden = matchMedia("(max-width: 820px)").matches;
  if (sideHidden() !== hidden) setSide(hidden, false);
});

// ---------- arranque ------------------------------------------------------
// ---------- versión alojada en internet ------------------------------------
// Las cartas guardadas viven en el navegador de cada persona; acá se pueden exportar e importar como copia.
function setupPublic() {
  $("#privacyNote").textContent = "Zodíaco tropical, calculado con Swiss Ephemeris (Moshier). Los datos de nacimiento se envían al servidor solo para calcular la carta y no se guardan ahí.";
  $("#backup").hidden = false;

  let timer = 0;
  const say = (text, isError = false) => {
    const el = $("#backupNote");
    el.textContent = text;
    el.classList.toggle("err", isError);
    clearTimeout(timer);
    if (text) timer = setTimeout(() => { el.textContent = ""; el.classList.remove("err"); }, 6000);
  };
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  $("#exportCharts").addEventListener("click", () => {
    const data = localCharts.exportData();
    if (!data.charts.length) { say("Todavía no hay cartas guardadas para exportar.", true); return; }
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `cartas-natales-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    say(`Se exportó ${plural(data.charts.length, "carta", "cartas")}.`);
  });

  $("#importCharts").addEventListener("click", () => $("#importFile").click());
  $("#importFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 1_000_000) { say("Ese archivo es demasiado grande.", true); return; }
    try {
      const r = await localCharts.importData(JSON.parse(await file.text()));
      await saved.refresh();
      syncSaveButtons();
      const parts = [`Se importó ${plural(r.added, "carta", "cartas")}`];
      if (r.skipped) parts.push(`${plural(r.skipped, "ya estaba", "ya estaban")}`);
      if (r.failed) parts.push(`${plural(r.failed, "no se pudo leer", "no se pudieron leer")}`);
      say(parts.join(" · ") + ".", !r.added && !r.skipped);
    } catch (err) {
      say(err instanceof SyntaxError ? "Ese archivo no es un JSON válido." : err.message, true);
    }
  });
}

const formReady = (v) => !!(v.date && v.time && String(v.lat) !== "" && String(v.lon) !== "" &&
  (v.manual ? String(v.offset ?? "") !== "" : v.tz));

// ---------- páginas: inicio (la Luna), calendario lunar y carta ----------------------------------------------
// Se navega con el # de la dirección (#inicio, #luna, #luna/2026-10, #carta): el botón «atrás» del celular vuelve del
// calendario al inicio y al recargar queda la misma página. Sin # se abre el inicio.
const moon = { now: null, nowAt: 0, nowSeq: 0, err: null, months: new Map(), cal: null, calSeq: 0, timer: 0, south: true,
  poem: null, poemSign: -1, poemShown: null, poemOpen: false };       // poema de la tarjeta: se elige al entrar al inicio
try { moon.south = localStorage.getItem("carta:hemi") !== "n"; } catch {}
let page = "";                       // "home" | "lunar" | "chart"
let chartStarted = false;            // ya se pidió la carta (al entrar a «Carta» o al elegir una)
const moonTz = () => browserTz() || "UTC";
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/** Prepara la primera carta de la visita (en tránsitos, la fecha de «ahora»). */
function primeChart() {
  if (chartStarted) return;
  chartStarted = true;
  if (mode === "transit") setNow();
}
/** Va a la página de la carta antes de calcular, para que se dibuje con el contenedor a la vista. */
function showChart() {
  primeChart();
  go("#carta");
}
function startChart() {
  primeChart();
  if (!formReady(readForm())) {                       // formulario vacío: nada que calcular todavía
    $("#intro").hidden = false;
    $(".intro-note").hidden = !isPublic();
    return;
  }
  calculate();
}

function parseRoute() {
  const h = location.hash.replace(/^#\/?/, "");
  if (h === "carta") return { page: "chart" };
  const m = /^luna(?:\/(.*))?$/.exec(h);
  if (m) {                                            // #luna/AAAA-M; con cualquier otra cosa, el mes actual
    const ym = /^(\d{4})-(\d{1,2})$/.exec(m[1] || "");
    return { page: "lunar", y: ym ? +ym[1] : null, m: ym ? +ym[2] : null };
  }
  return { page: "home" };
}

function setPage(r) {
  const prev = page;
  page = r.page;
  $("#home").hidden = page !== "home";
  $("#lunar").hidden = page !== "lunar";
  $("#chartPage").hidden = page !== "chart";
  for (const [id, p] of [["navHome", "home"], ["navMoon", "lunar"], ["navChart", "chart"]]) {
    if (page === p) $("#" + id).setAttribute("aria-current", "page"); else $("#" + id).removeAttribute("aria-current");
  }
  if (prev !== page) {
    if (prev === "home") stopHome();
    if (peeking() && !hoverMode()) peek(false);       // el menú del celular se cierra al cambiar de sección
    if (prev) scrollTo(0, 0);
  }
  if (page === "home") startHome();
  else if (page === "lunar") showLunar(r.y, r.m);
  else if (!chartStarted) startChart();
}

function route() {
  const r = parseRoute();
  if (page === r.page && !(r.page === "lunar" && r.y && (moon.cal?.y !== r.y || moon.cal?.m !== r.m))) return;
  setPage(r);
}
function go(hash) {
  if (location.hash !== hash) location.hash = hash;
  route();
}
addEventListener("hashchange", route);
document.querySelectorAll("#sidenav a").forEach((a) => a.addEventListener("click", (e) => {
  if (peeking() && !hoverMode()) peek(false);
  if (a.id === "navMoon" && page === "lunar") { e.preventDefault(); lunarTo(0, 0, true); }     // ya estás en el calendario: vuelve a este mes
}));

// -- inicio: la Luna ahora
function renderHome() {
  const tz = moonTz();
  try {
    $("#homeSub").textContent = cap(new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(new Date()));
  } catch { $("#homeSub").textContent = ""; }
  const card = $("#moonCard"), err = $("#homeErr");
  if (moon.now) {
    card.hidden = false;
    card.classList.remove("is-loading");
    card.innerHTML = moonCardHTML(moon.now, moon.south, todayIn(tz));
    err.hidden = true;
    renderPoem();
  } else if (moon.err) {
    card.hidden = true;
    $("#moonPoem").hidden = true;
    const offline = moon.err instanceof TypeError;
    err.hidden = false;
    err.replaceChildren(
      Object.assign(document.createElement("strong"), { textContent: offline ? "No se pudo conectar con el servidor" : "No se pudo calcular la Luna" }),
      document.createTextNode(offline ? (isPublic() ? "Si hace un rato que nadie la usa, la página puede tardar hasta un minuto en despertar." : "Volvé a abrir la app.") : moon.err.message),
    );
    const retry = Object.assign(document.createElement("button"), { type: "button", className: "secondary compact", textContent: "Reintentar" });
    retry.style.marginTop = "10px";
    retry.addEventListener("click", () => { moon.err = null; renderHome(); loadMoon(); });
    err.append(document.createElement("br"), retry);
  } else {
    card.hidden = false;
    card.classList.add("is-loading");
    card.innerHTML = `<span class="mc-wait">Calculando la Luna…</span>`;
    err.hidden = true;
    $("#moonPoem").hidden = true;
  }
  renderHomeCharts();
}

/**
 * Un poema para la Luna en su signo, al azar entre los de ese signo. Se elige al entrar al inicio (o si la Luna cambia de
 * signo mientras se mira) y no cambia con cada actualización de la tarjeta; el botón «Leer completo» recuerda su estado.
 */
function renderPoem() {
  const box = $("#moonPoem"), sign = moon.now.sign;
  if (moon.poemSign !== sign) {
    moon.poem = pickPoem(sign, moon.poem);
    moon.poemSign = sign;
    moon.poemShown = null; moon.poemOpen = false;
  }
  if (!moon.poem) { box.hidden = true; return; }
  if (moon.poemShown !== moon.poem) {
    box.innerHTML = poemHTML(moon.poem);
    box.dataset.el = ["fire", "earth", "air", "water"][sign % 4];
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", `Poema para la Luna en ${SIGNS[sign]}`);
    moon.poemShown = moon.poem;
  }
  box.classList.toggle("is-long", !!box.querySelector(".mp-more"));
  paintPoem();
  box.hidden = false;
}
function paintPoem() {
  const box = $("#moonPoem"), more = box.querySelector(".mp-more");
  box.classList.toggle("is-open", moon.poemOpen);
  if (more) { more.setAttribute("aria-expanded", String(moon.poemOpen)); more.textContent = moon.poemOpen ? "Leer menos" : "Leer completo"; }
}
$("#moonPoem").addEventListener("click", (e) => {
  if (!e.target.closest(".mp-more")) return;
  moon.poemOpen = !moon.poemOpen;
  paintPoem();
});

async function loadMoon() {
  const my = ++moon.nowSeq;
  try {
    const d = await compute.moon(moonTz());
    if (my !== moon.nowSeq) return;
    moon.now = d; moon.nowAt = Date.now(); moon.err = null;
  } catch (e) {
    if (my !== moon.nowSeq) return;
    if (!moon.now) moon.err = e;                       // si ya había una lectura, se sigue mostrando esa
  }
  if (page === "home") renderHome();
}

function startHome() {
  moon.poemSign = -1;                                  // cada vez que se entra al inicio sale otro poema (si hay más de uno)
  renderHome();
  if (!moon.now || Date.now() - moon.nowAt > 120000) loadMoon();
  clearInterval(moon.timer);
  moon.timer = setInterval(() => { if (!document.hidden) loadMoon(); }, 300000);
}
function stopHome() { clearInterval(moon.timer); }
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && page === "home" && Date.now() - moon.nowAt > 120000) loadMoon();
});
$("#moonCard").addEventListener("click", () => { if (moon.now) go("#luna"); });

/** «Continuar con …» y las demás cartas guardadas. Los nombres los escribe quien usa la app: todo con DOM. */
function renderHomeCharts() {
  const body = $("#homeChartBody");
  const items = saved.items;
  const act = saved.activeId ? saved.find(saved.activeId) : null;
  const v = readForm();
  const make = (tag, props, fn) => {
    const el = Object.assign(document.createElement(tag), props);
    if (fn) el.addEventListener("click", fn);
    return el;
  };
  const nodes = [];
  if (act) nodes.push(make("button", { type: "button", className: "home-continue", textContent: `Continuar con ${act.name}` }, () => go("#carta")));
  else if (formReady(v)) nodes.push(make("button", { type: "button", className: "home-continue", textContent: `Continuar con ${v.name || "la carta sin guardar"}` }, () => go("#carta")));
  else if (!items.length) {
    nodes.push(make("p", { className: "home-empty", textContent: "Todavía no guardaste ninguna carta." }));
    nodes.push(make("button", { type: "button", className: "home-continue", textContent: "Crear mi primera carta" }, () => createFirst()));
  }
  const others = items.filter((it) => !act || it.id !== act.id);
  if (others.length) {
    nodes.push(make("div", { className: "home-chips" }));
    nodes[nodes.length - 1].append(...others.map((it) => make("button", { type: "button", className: "home-chip", textContent: it.name, title: `Abrir la carta de ${it.name}` }, () => openSaved(it))));
  }
  body.replaceChildren(...nodes);
}

// -- calendario lunar
function paintHemi() {
  document.querySelectorAll("#hemi button").forEach((b) => b.setAttribute("aria-pressed", (b.dataset.h === "s") === moon.south));
}
function paintMonth(data) {
  $("#mPhases").innerHTML = phasesHTML(data, moon.south);
  $("#mGrid").innerHTML = calendarHTML(data, moon.south, todayIn(moonTz()));
}

async function showLunar(y, m) {
  const tz = moonTz();
  if (!y || !m || m < 1 || m > 12 || y < 1800 || y > 2400) [y, m] = todayIn(tz).slice(0, 7).split("-").map(Number);
  moon.cal = { y, m };
  paintHemi();
  $("#mTitle").textContent = cap(monthTitle(y, m));
  $("#lunarSub").textContent = `Fase y signo de la Luna día por día · horas de ${tz}`;
  $("#mPrev").disabled = y === 1800 && m === 1;
  $("#mNext").disabled = y === 2400 && m === 12;
  $("#mErr").hidden = true;
  const key = `${tz}|${y}-${m}`;
  const grid = $("#mGrid");
  const my = ++moon.calSeq;
  let data = moon.months.get(key);
  if (!data) {
    grid.setAttribute("aria-busy", "true");
    $("#mPhases").replaceChildren();
    grid.innerHTML = `<p class="muted pad">Calculando…</p>`;
    try {
      data = await compute.moonMonth(y, m, tz);
    } catch (e) {
      if (my !== moon.calSeq) return;
      grid.setAttribute("aria-busy", "false");
      grid.replaceChildren();
      const err = $("#mErr");
      err.hidden = false;
      err.replaceChildren(
        Object.assign(document.createElement("strong"), { textContent: e instanceof TypeError ? "No se pudo conectar con el servidor" : "No se pudo calcular el mes" }),
        document.createTextNode(e instanceof TypeError ? "Probá de nuevo en unos segundos." : e.message),
      );
      return;
    }
    if (my !== moon.calSeq) return;
    if (moon.months.size > 36) moon.months.clear();
    moon.months.set(key, data);
  }
  grid.setAttribute("aria-busy", "false");
  paintMonth(data);
}

/** Cambiar de mes no suma pasos al historial: «atrás» sigue volviendo al inicio. */
function lunarTo(y, m, isToday = false) {
  history.replaceState(null, "", isToday ? "#luna" : `#luna/${y}-${m}`);
  showLunar(y, m);
}
function stepMonth(d) {
  const { y, m } = moon.cal;
  const t = y * 12 + (m - 1) + d;
  lunarTo(Math.floor(t / 12), (t % 12) + 1);
}
$("#mPrev").addEventListener("click", () => stepMonth(-1));
$("#mNext").addEventListener("click", () => stepMonth(1));
$("#mToday").addEventListener("click", () => lunarTo(0, 0, true));
document.querySelectorAll("#hemi button").forEach((b) => b.addEventListener("click", () => {
  const south = b.dataset.h === "s";
  if (south === moon.south) return;
  moon.south = south;
  try { localStorage.setItem("carta:hemi", south ? "s" : "n"); } catch {}
  paintHemi();
  if (page === "lunar") { const d = moon.months.get(`${moonTz()}|${moon.cal.y}-${moon.cal.m}`); if (d) paintMonth(d); }
  if (page === "home" && moon.now) renderHome();
}));

async function init() {
  await config();
  if (isPublic()) setupPublic();
  else { try { LOCAL_DEFAULTS = (await import("./defaults-local.js")).DEFAULTS; } catch { /* sin archivo: formulario vacío */ } }
  const last = recall();
  fillForm(last);
  const view = recallView();
  if (["natal", "transit", "syn"].includes(view.mode)) mode = view.mode;
  partnerId = view.partner || null;
  try {
    const [places, tzs] = await Promise.all([
      fetch("places.json").then((r) => r.json()),
      fetch("/api/timezones").then((r) => r.json()),
      saved.refresh(),
    ]);
    PLACES = places;
    $("#places").replaceChildren(...places.map((p) => Object.assign(document.createElement("option"), { value: placeLabel(p) })));
    $("#tzs").replaceChildren(...tzs.map((z) => Object.assign(document.createElement("option"), { value: z })));
  } catch (err) {
    chartStarted = true;
    setPage({ page: "chart" });
    showError(err instanceof TypeError ? err : new TypeError("offline"));
    return;
  }
  if (last.active && saved.find(last.active)) saved.setActive(last.active);
  syncSaveButtons();
  syncPartners();
  paintMode();
  route();                                        // sin # abre el inicio; #carta, la carta de antes
}
init();
