import { SIGNS, signHTML, BODY, ASPECT, split, fmtPos, fmtOrb, orbCode, mark, glyphHTML, badge, esc, setClassic, setCuspRing } from "./astro-data.js";
import { renderWheel } from "./wheel.js";
import { stairHTML, ORB_LEGEND, STAIR_HINT } from "./stair.js";
import { elementsHTML } from "./elements.js";
import { createSaved } from "./saved.js";
import { charts, compute, config, isPublic } from "./api.js";
import { setupPrint } from "./print.js";
import { initSettings, load as loadSettings, ORB_DEFAULTS, ORBS_VERSION, sameOrbs } from "./settings.js";
import { initPlanetDialog } from "./planet-dialog.js";
import { initAspectDialog } from "./aspect-dialog.js";
import { profection, profectionHTML, featuredHTML, featuredRowsHTML, upcomingHTML, SOON_PERIODS } from "./summary.js";
import { moonCornerHTML, moonLinesHTML, moonIcon, phasesHTML, calendarHTML, monthTitle, todayIn } from "./moon.js";
import { layoutSky, planetHTML, skyInfoHTML, skyShellHTML } from "./sky.js";
import { pickPoem, poemHTML } from "./poems.js";
import { showCombine, refreshCombine } from "./combinar.js";
import { computeTrips, groupTrips, groupWords, tripNotation, tripWords, tripPlain, TRIP_TYPES, TRIP_TITLES, TRIP_PLANETS, roman } from "./trips.js";

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
let aspOff = new Set(loadSettings().aspOff);     // tipos de aspecto apagados en Configuración
// Los planetas entre casas los calcula el servidor. Un servidor de una versión anterior (que seguía abierto al actualizar los
// archivos) no entiende los orbes elegidos y trae otro cálculo de las casas: no se usa su respuesta y se avisa.
const reachData = () => (chart?.orbs_v === ORBS_VERSION ? chart.house_reach || [] : []);
const staleOrbs = () => !!chart && chart.orbs_v !== ORBS_VERSION && (spillOn || !sameOrbs(orbs, ORB_DEFAULTS));
const vis = (list) => (aspOff.size ? list.filter((a) => !aspOff.has(a.type)) : list);
let orbs = loadSettings().orbs;           // orbes elegidos en Configuración: viajan con cada pedido de cálculo
let spillOn = loadSettings().spill;       // carta natal: marcar los planetas que pasan a la casa que sigue o están en las dos
let tripCfg = loadSettings().trips;        // qué cuenta para los viajes de los planetas por las casas (Configuración)
let tripsOn = loadSettings().tripsOn;      // carta natal: dibujar esos viajes en la rueda
const HOUSES = Array.from({ length: 12 }, (_, i) => i + 1);
// Los viajes se eligen por planeta o por casa (la de llegada), nunca las dos a la vez: de fábrica, por planeta, con todos marcados.
// Al prender «Viajes», o al cambiar de «Planeta» a «Casa» (o al revés), vuelve a estar todo marcado.
let tripBy = "planet";
let tripSel = new Set(TRIP_PLANETS);       // por planeta: cuáles se dibujan
let tripHSel = new Set(HOUSES);            // por casa: a cuáles llegan
const tripReset = (by = "planet") => { tripBy = by; tripSel = new Set(TRIP_PLANETS); tripHSel = new Set(HOUSES); };
let interpOn = loadSettings().interp;      // false = «solo datos»: ninguna lectura ni descripción (Configuración)
let chart = null;          // carta natal mostrada (en sinastría, la carta A)
let transit = null;        // respuesta de /api/transits
let syn = null;            // respuesta de /api/synastry
let partnerId = null;      // carta guardada con la que se compara
let wheel = null;
let orbMax = 99;
let mview = "carta";       // celular, carta natal: la rueda sola («carta») o las tablas («tablas»)

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
  o.orbs = orbs;
  return o;
}
function partnerBody(item, v) {
  const o = {
    name: item.name, place: item.place, date: item.date, time: item.time,
    lat: item.lat, lon: item.lon, tz: item.tz, hsys: v.hsys, node: v.node,
  };
  if (item.manual) o.offset = item.offset;
  o.orbs = orbs;
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

// Un solo botón: calcula la carta y la guarda (con Enter en cualquier campo también). Ver persist() más abajo.
form.addEventListener("submit", (e) => {
  e.preventDefault();
  persist(false);
});

// ---------- cartas guardadas ---------------------------------------------
const saved = createSaved({
  list: $("#savedList"), where: $("#savedWhere"),
  picker: { root: $("#picker"), btn: $("#pickBtn"), pop: $("#pickPop"), q: $("#pickQ"), none: $("#pickNone"), count: $("#savedCount") },
  onOpen: openSaved,
  onChange: () => { syncPartners(); syncActions(); paintTitlePick(); if (page === "home") renderHomeCharts(); },
});

let noteTimer = 0;
let noteIsError = false;
/** El aviso de debajo del formulario. Lo bueno se va solo a los 4 s; un error queda hasta que se corrige algo o se vuelve a intentar. */
function note(text, isError = false) {
  const el = $("#saveNote");
  el.textContent = text;
  el.classList.toggle("err", isError);
  noteIsError = !!text && isError;
  clearTimeout(noteTimer);
  if (text && !isError) noteTimer = setTimeout(() => { el.textContent = ""; }, 4000);
}
form.addEventListener("input", () => { if (noteIsError) note(""); });

let saving = false;                     // mientras guarda, el botón no se puede apretar de nuevo (sería una carta repetida)

/** El texto del botón único según el momento: una carta nueva, una guardada que se edita, o guardando. */
function syncSaveButtons() {
  const active = saved.activeId;
  $("#go").textContent = saving ? "Guardando…" : active ? "Calcular y guardar cambios" : "Calcular y guardar";
  $("#go").disabled = saving;
  $("#saveAs").hidden = !active;
  $("#saveAs").disabled = saving;
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

// -- cambiar de carta desde la carta: la lupa al lado del nombre abre la lista de las guardadas, con buscador
const cpick = $("#cpick"), cpickBtn = $("#titlePick"), cpickQ = $("#cpickQ"), cpickList = $("#cpickList");
const dmy = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || "") ? d.split("-").reverse().join("/") : "");
function paintTitlePick() {                                  // (se llama también desde onChange de las guardadas: sin las constantes de acá)
  const b = $("#titlePick");
  b.hidden = !saved.items.length;
  if (b.hidden) { $("#cpick").hidden = true; b.setAttribute("aria-expanded", "false"); }
}
function fillCpick() {
  const q = cpickQ.value.trim().toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const items = saved.items.filter((it) => !q || it.name.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q));
  cpickList.replaceChildren(...items.map((it) => {
    const li = document.createElement("li"), b = document.createElement("button");
    b.type = "button"; b.className = "cpick-it"; b.dataset.id = it.id;
    if (it.id === saved.activeId) b.setAttribute("aria-current", "true");
    b.append(Object.assign(document.createElement("span"), { className: "cpick-nm", textContent: it.name }),
      Object.assign(document.createElement("span"), { className: "cpick-d", textContent: dmy(it.date) }));
    li.append(b);
    return li;
  }));
  if (!items.length) cpickList.append(Object.assign(document.createElement("li"), { className: "cpick-none", textContent: "Ninguna carta con ese nombre." }));
}
function openCpick() {
  cpickQ.value = "";
  fillCpick();
  cpick.hidden = false;
  const room = cpick.offsetParent ? cpick.offsetParent.clientWidth - cpick.offsetWidth : 0;      // que no se salga por la derecha
  cpick.style.left = `${Math.max(0, Math.min(cpickBtn.offsetLeft - 6, room))}px`;
  cpick.style.top = `${cpickBtn.offsetTop + cpickBtn.offsetHeight + 6}px`;
  cpickBtn.setAttribute("aria-expanded", "true");
  (matchMedia("(pointer: coarse)").matches ? cpickList.querySelector("[aria-current]") || cpickList.querySelector("button") : cpickQ)?.focus({ preventScroll: true });
}
function closeCpick(focusBtn = true) {
  if (cpick.hidden) return;
  cpick.hidden = true;
  cpickBtn.setAttribute("aria-expanded", "false");
  if (focusBtn) cpickBtn.focus({ preventScroll: true });
}
cpickBtn.addEventListener("click", () => (cpick.hidden ? openCpick() : closeCpick()));
cpickQ.addEventListener("input", fillCpick);
cpickList.addEventListener("click", (e) => {
  const b = e.target.closest(".cpick-it");
  if (!b) return;
  const it = saved.find(b.dataset.id);
  closeCpick(false);
  if (it && it.id !== saved.activeId) openSaved(it);
});
$("#cpickNew").addEventListener("click", () => { closeCpick(false); openForm("new"); });
cpick.addEventListener("keydown", (e) => {
  const opts = [...cpickList.querySelectorAll(".cpick-it")];
  const i = opts.indexOf(document.activeElement);
  if (e.key === "Escape") { e.preventDefault(); closeCpick(); }
  else if (e.key === "ArrowDown") { e.preventDefault(); (opts[i + 1] || opts[0])?.focus(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); (i > 0 ? opts[i - 1] : cpickQ).focus(); }
  else if (e.key === "Enter" && e.target === cpickQ && opts[0]) { e.preventDefault(); opts[0].click(); }
});
document.addEventListener("pointerdown", (e) => { if (!cpick.hidden && !cpick.contains(e.target) && !cpickBtn.contains(e.target)) closeCpick(false); }, true);

// -- celular: el nombre en su renglón. Si no entra, primero se achica un poco y después se corta con «…»; la lupa y el
// ícono de info van al lado o, si el nombre ocupa todo el ancho, arriba (style.css). Los datos de nacimiento, detrás de la info.
const phoneBar = () => document.documentElement.hasAttribute("data-mbar") && matchMedia("(max-width: 640px)").matches;
function fitTitle() {
  const t = $("#title");
  t.style.fontSize = "";
  if (!phoneBar()) return;
  const avail = t.parentElement.clientWidth;
  for (const px of [26, 23, 20]) { if (t.scrollWidth <= avail) break; t.style.fontSize = `${px}px`; }
}
addEventListener("resize", () => { fitTitle(); if (!$("#cinfo").hidden) closeCinfo(false); });
function openCinfo() {
  const box = $("#cinfo"), btn = $("#titleInfo");
  const parts = [["cinfo-sub", $("#sub").textContent], ["cinfo-utc", $("#timeNote").hidden ? "" : $("#timeNote").textContent]];
  box.replaceChildren(...parts.filter(([, t]) => t).map(([cls, t]) => Object.assign(document.createElement("p"), { className: cls, textContent: t })));
  box.hidden = false;
  box.style.top = `${btn.closest("h2").offsetTop + btn.closest("h2").offsetHeight + 8}px`;
  btn.setAttribute("aria-expanded", "true");
}
function closeCinfo(focusBtn = true) {
  const box = $("#cinfo");
  if (box.hidden) return;
  box.hidden = true;
  $("#titleInfo").setAttribute("aria-expanded", "false");
  if (focusBtn) $("#titleInfo").focus({ preventScroll: true });
}
$("#titleInfo").addEventListener("click", () => ($("#cinfo").hidden ? openCinfo() : closeCinfo()));
document.addEventListener("pointerdown", (e) => { if (!$("#cinfo").hidden && !$("#cinfo").contains(e.target) && !$("#titleInfo").contains(e.target)) closeCinfo(false); }, true);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#cinfo").hidden) { e.preventDefault(); closeCinfo(); } });

/** Lo que hace el botón: guarda la carta (la valida el servidor: fecha, hora, lugar…), la calcula y la muestra.
 *  asNew: con una carta guardada abierta, la guarda como otra en vez de pisarla. */
async function persist(asNew) {
  if (saving) return;
  const birthData = birthFromForm();
  note("");
  if (!birthData.name) {
    note("Poné un nombre para guardar la carta.", true);
    form.elements.name.focus();
    return;
  }
  saving = true;
  syncSaveButtons();
  try {
    const updating = saved.activeId && !asNew;
    const rec = updating ? await saved.update(saved.activeId, birthData) : await saved.create(birthData);
    saved.setActive(rec.id);
    saving = false;
    syncSaveButtons();
    closeForm(false);
    note(updating ? "Cambios guardados." : "Carta guardada.");
    showChart();
    await calculate();                  // lo que se ve es lo que se guardó
    closeDrawer();                      // en el celular, el menú se cierra para ver la carta
  } catch (err) {
    note(err.message, true);
  } finally {
    saving = false;
    syncSaveButtons();
  }
}

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
  if (unit === "q") t += dir * 15 * 60e3;
  else if (unit === "h") t += dir * 3600e3;
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
  try { await run(load); } finally {
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
  $("#printBtn").hidden = true;
  $("#spillBtn").hidden = true;
  $("#warnings").hidden = true;
  $("#timeNote").hidden = true;
  paintBar();
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
      `Casas ${c.houses.system_name}${c.bodies.some((b) => b.id === "node") ? `, nodo ${c.node_kind === "mean" ? "medio" : "verdadero"}` : ""}.`;
    document.title = name ? `${name} · Carta natal` : "Carta natal";
  }
}

/** Datos del anillo exterior según la vista, o null en la rueda natal simple. */
function outerRing() {
  if (mode === "transit" && transit) {
    return {
      bodies: transit.bodies,
      aspects: vis(transit.aspects).filter((a) => a.orb <= orbMax),
      short: "tránsito", houseWord: "casa natal", label: "los planetas en tránsito",
    };
  }
  if (mode === "syn" && syn) {
    const houseIn = Object.fromEntries(syn.overlay.b_in_a.map((o) => [o.id, o.house]));
    const A = syn.a.input.name || "Carta A", B = syn.b.input.name || "Carta B";
    return {
      bodies: syn.b.bodies.map((b) => ({ ...b, house: houseIn[b.id] })),
      angles: syn.b.angles,
      aspects: vis(syn.aspects).filter((a) => a.orb <= orbMax),
      short: B, houseWord: `casa de ${A}`, label: B,
    };
  }
  return null;
}

// El selector de «Viajes»: una ficha por planeta (con cuántas casas visita) y una por casa (con cuántos viajeros llegan), marcadas o no.
$("#tripHouses").innerHTML = HOUSES.map((h) =>
  `<button type="button" class="trip-chip hs" data-h="${h}" aria-pressed="true"><span class="hn">${roman(h)}</span><span class="tp-n"></span></button>`).join("");
$("#tripChips").innerHTML = TRIP_PLANETS.map((id) =>
  `<button type="button" class="trip-chip" data-id="${id}" aria-pressed="true"><span class="g" aria-hidden="true">${glyphHTML(id)}</span><span class="tp-n"></span></button>`).join("");
let tripPop = false;          // el filtro abierto (se abre con la flechita de «Viajes»)
function syncTripPick(all) {
  $("#tripMore").hidden = !all;
  if (!all) tripPop = false;
  $("#tripPick").hidden = !all || !tripPop;
  $("#tripMore").setAttribute("aria-expanded", String(!!all && tripPop));
  // en el botón, cuántos se dibujan si no son todos («Viajes 7/10»)
  const on = tripBy === "planet" ? TRIP_PLANETS.filter((id) => tripSel.has(id)).length : tripHSel.size;
  const tot = tripBy === "planet" ? TRIP_PLANETS.length : HOUSES.length;
  $("#tripCount").hidden = !all || on === tot;
  $("#tripCount").textContent = `${on}/${tot}`;
  $("#tripMore").setAttribute("aria-label", all && on !== tot ? `Filtrar los viajes (se dibujan ${on} de ${tot} ${tripBy === "planet" ? "planetas" : "casas"})` : "Filtrar los viajes");
  if (!all) return;
  for (const b of $("#tripBy").children) b.setAttribute("aria-pressed", b.dataset.by === tripBy);
  $("#tripPlanetRow").hidden = tripBy !== "planet";
  $("#tripHouseRow").hidden = tripBy !== "house";
  for (const b of $("#tripChips").children) {
    const id = b.dataset.id, n = all.filter((g) => g.id === id).length;
    b.setAttribute("aria-pressed", tripSel.has(id));
    b.classList.toggle("none", n === 0);
    b.querySelector(".tp-n").textContent = n || "";
    const txt = `${BODY[id].name}: ${n === 0 ? "sin viajes" : n === 1 ? "viaja a 1 casa" : `viaja a ${n} casas`}`;
    b.title = txt; b.setAttribute("aria-label", txt);
  }
  for (const b of $("#tripHouses").children) {
    const h = +b.dataset.h, n = all.filter((g) => g.to === h).length;
    b.setAttribute("aria-pressed", tripHSel.has(h));
    b.classList.toggle("none", n === 0);
    b.querySelector(".tp-n").textContent = n || "";
    const txt = `Casa ${roman(h)}: ${n === 0 ? "no llega ningún planeta" : n === 1 ? "llega 1 planeta" : `llegan ${n} planetas`}`;
    b.title = txt; b.setAttribute("aria-label", txt);
  }
  $("#tripAll").disabled = TRIP_PLANETS.every((id) => tripSel.has(id));
  $("#tripNone").disabled = tripSel.size === 0;
  $("#tripHAll").disabled = HOUSES.every((h) => tripHSel.has(h));
  $("#tripHNone").disabled = tripHSel.size === 0;
}
/** Abre o cierra el filtro: en escritorio, flotando debajo de la flechita; en el celular, una hoja desde abajo (style.css). */
function setTripPop(on, focusBtn = false) {
  tripPop = on && !$("#tripMore").hidden;
  const pop = $("#tripPick"), btn = $("#tripMore");
  pop.hidden = !tripPop;
  btn.setAttribute("aria-expanded", String(tripPop));
  if (tripPop) {
    hideFicha();
    placeTripPop();
    (pop.querySelector("#tripBy [aria-pressed=true]") || pop.querySelector("button"))?.focus({ preventScroll: true });
  } else if (focusBtn) btn.focus({ preventScroll: true });
}
function placeTripPop() {
  const pop = $("#tripPick"), btn = $("#tripMore");
  pop.style.left = pop.style.top = "";
  if (matchMedia("(max-width: 640px)").matches) return;           // en el celular, la hoja de abajo la ubica la CSS
  const max = pop.offsetParent ? pop.offsetParent.clientWidth - pop.offsetWidth : 0;
  pop.style.left = `${Math.max(0, Math.min(btn.offsetLeft + btn.offsetWidth - pop.offsetWidth, max))}px`;
  pop.style.top = `${btn.offsetTop + btn.offsetHeight + 6}px`;
}
$("#tripMore").addEventListener("click", () => setTripPop(!tripPop));
$("#tripPopX").addEventListener("click", () => setTripPop(false, true));
document.addEventListener("pointerdown", (e) => {
  if (tripPop && !$("#tripPick").contains(e.target) && !$("#tripMore").contains(e.target)) setTripPop(false);
}, true);
document.addEventListener("keydown", (e) => { if (tripPop && e.key === "Escape") { e.preventDefault(); setTripPop(false, true); } });
addEventListener("resize", () => { if (tripPop) placeTripPop(); });

const flip = (set, x) => { const s = new Set(set); s.has(x) ? s.delete(x) : s.add(x); return s; };
$("#tripPick").addEventListener("click", (e) => {
  const t = e.target.closest("button");
  if (!t || !chart) return;
  if (t.dataset.by) { if (t.dataset.by === tripBy) return; tripReset(t.dataset.by); }
  else if (t.id === "tripAll") tripSel = new Set(TRIP_PLANETS);
  else if (t.id === "tripNone") tripSel = new Set();
  else if (t.dataset.id) tripSel = flip(tripSel, t.dataset.id);
  else if (t.id === "tripHAll") tripHSel = new Set(HOUSES);
  else if (t.id === "tripHNone") tripHSel = new Set();
  else if (t.dataset.h) tripHSel = flip(tripHSel, +t.dataset.h);
  else return;
  drawWheel();
});

function drawWheel() {
  const outer = outerRing();
  const allTrips = tripsOn && !outer && mode === "natal" ? groupTrips(computeTrips(chart, tripCfg)) : null;
  const trips = allTrips ? allTrips.filter((g) => (tripBy === "planet" ? tripSel.has(g.id) : tripHSel.has(g.to))).map((g) => ({ ...g, words: groupWords(g) })) : null;
  syncTripPick(allTrips);
  hideFicha();
  wheel = renderWheel($("#wheel"), { ...chart, aspects: vis(chart.aspects) }, { outer, reach: spillOn && mode === "natal" ? reachData() : null, trips, onFocus: highlightRows, onClear: () => highlightRows(null), onPick: interpOn ? openReading : null });
  const clear0 = wheel.clear;
  wheel.clear = () => { clear0(); hideFicha(); };       // soltar lo resaltado (cerrar una lectura, cambiar de pestaña) también cierra la ficha
  $("#outKey").hidden = !outer;
  $("#reachKey").hidden = !(spillOn && !outer && reachData().length);
  $("#tripKey").hidden = !(trips && trips.length);
  if (outer) $("#outKeyText").textContent = mode === "transit" ? "Tránsitos" : outer.short;
  fitWheel();
}

// La rueda y su leyenda entran en la pantalla: el lugar que queda debajo de lo que hay arriba de la rueda (encabezado,
// modos, fecha de los tránsitos, el selector de viajes), sin bajar de 440 px. Se recalcula si algo de eso cambia de alto.
// En escritorio ancho, para que la rueda sea más grande: el encabezado va en una fila (los modos y botones a la derecha
// del nombre) y, si al costado de la rueda sobra lugar, la leyenda pasa a una columna en su rincón de abajo a la izquierda.
const deskWide = matchMedia("screen and (min-width: 821px)");
function fitWheel() {
  const svg = $("#wheel"), root = document.documentElement;
  if ($("#stage").hidden || !svg.isConnected) return;
  const fig = svg.parentElement, legend = fig.querySelector(".legend");
  root.toggleAttribute("data-headrow", deskWide.matches && $("#chartPage").clientWidth >= 1080);
  const top = svg.getBoundingClientRect().top + scrollY;
  const free = innerHeight - top - 16, colW = fig.clientWidth;
  // ¿la leyenda entra en el rincón de abajo a la izquierda sin tocar la rueda? La rueda es redonda: su esquina queda vacía.
  // Se mide con la leyenda ya en columna y la rueda del tamaño que tendría (sin la leyenda abajo), centrada en su lugar.
  let side = false;
  if (legend && deskWide.matches && !root.hasAttribute("data-big")) {
    root.setAttribute("data-legend-side", "");
    const scale = Math.min(1, parseFloat(getComputedStyle(root).getPropertyValue("--wheel")) || 1);
    const D = Math.min(colW * scale, 1100, Math.max(440, free)), r = D / 2 + 6;
    const sTop = svg.getBoundingClientRect().top - fig.getBoundingClientRect().top;
    const cx = colW / 2, cy = sTop + D / 2;
    const x1 = legend.offsetWidth, y1 = sTop + D, y0 = y1 - legend.offsetHeight;
    const nx = Math.min(Math.max(cx, 0), x1), ny = Math.min(Math.max(cy, y0), y1);
    side = Math.hypot(nx - cx, ny - cy) >= r && y0 > sTop;
  }
  root.toggleAttribute("data-legend-side", side);
  const room = Math.max(440, Math.floor(side || !legend ? free : free - legend.offsetHeight - 8));
  if (room !== fitWheel.room) { fitWheel.room = room; root.style.setProperty("--wheel-room", `${room}px`); }
}
{
  let raf = 0;
  const soon = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(fitWheel); };
  addEventListener("resize", soon);
  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(soon);
    for (const sel of ["#chartPage > .head", "#timeNote", "#warnings", ".modebar", "#toolsTransit", "#toolsSyn", "#error", "#tripPick", ".wheel-fig .legend", ".wheel-fig"]) {
      const el = document.querySelector(sel);
      if (el) ro.observe(el);
    }
  }
}

function render() {
  const c = chart;
  $("#error").hidden = true;
  $("#intro").hidden = true;
  $("#stage").hidden = false;
  $("#printBtn").hidden = false;
  $("#spillBtn").hidden = mode !== "natal";
  $("#tripBtn").hidden = mode !== "natal";
  header(c);
  paintBar();
  paintTitlePick();
  closeCinfo(false);

  const t = c.time;
  const timeNote = $("#timeNote");
  timeNote.textContent =
    `${c.input.time} locales equivalen a ${t.utc.slice(11, 16)} UTC (${t.offset_label}).` +
    (t.manual ? " Offset fijado a mano." : t.dst ? " Horario de verano vigente." : "");
  timeNote.hidden = false;

  const warnings = [...(mode === "syn" && syn ? syn.warnings
    : mode === "transit" && transit ? [...c.warnings, ...transit.warnings.map((w) => `Fecha del tránsito: ${w}`)]
    : c.warnings)];
  if (staleOrbs()) warnings.push("El servidor de la app es de una versión anterior: no aplica los orbes de Configuración ni calcula los planetas entre casas. Cerrá la ventana de Carta natal, esperá unos segundos y volvé a abrirla.");
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
  renderTrips(c);
  renderTransitList();
  renderAspects();
  renderStair();
  renderGrid();
  renderElements();
  renderOverlay();
  applyTabs();
}

function renderPositions(c) {
  const reach = spillOn && mode === "natal" ? new Map(reachData().map((r) => [r.id, r])) : new Map();
  const row = (id, lon, house, retro) => {
    const s = split(lon);
    return `<tr data-id="${id}">
      <td>${mark(id)}${BODY[id].name}</td>
      <td><span class="g">${signHTML(s.sign)}</span>${SIGNS[s.sign]}</td>
      <td class="num">${fmtPos(lon)}${retro ? '<span class="rx-t" title="Retrógrado">R</span>' : ""}</td>
      <td class="num">${house}${reachChip(reach.get(id))}</td></tr>`;
  };
  let html = `<table><thead><tr><th>Cuerpo</th><th>Signo</th><th class="num">Posición</th><th class="num">Casa</th></tr></thead><tbody>`;
  html += row("asc", c.angles.asc, "—") + row("mc", c.angles.mc, "—");
  c.bodies.forEach((b, i) => {
    html += row(b.id, b.lon, b.house, b.retro).replace("<tr ", i === 0 ? '<tr class="sep" ' : "<tr ");
  });
  $("#panel-pos").innerHTML = html + "</tbody></table>" + (reach.size ? reachNote() : "");
}

/** Qué dice «Entre casas» de un planeta: «→ 11» si cuenta en la casa que sigue y no en la suya, «+ 11» si cuenta en las dos. */
const reachTip = (r) => `${BODY[r.id].name}: a ${fmtOrb(r.dist)} de la cúspide de la casa ${r.also}; ` +
  (r.kind === "pass" ? `cuenta en la ${r.also} y no en la ${r.house}` : `cuenta en las dos, la ${r.house} y la ${r.also}`);
function reachChip(r) {
  if (!r) return "";
  return `<span class="reach-chip ${r.kind}" title="${reachTip(r)}">${r.kind === "pass" ? "→" : "+"} ${r.also}</span>`;
}
/** Explicación de las marcas, con los orbes que se están usando. */
function reachNote() {
  const [ca, co] = orbs.cusp, [sa, so] = orbs.span;
  return `<p class="fine tight reach-note"><span class="reach-chip pass">→ N</span> le faltan hasta ${fmtGrad(ca)} (cúspide angular) o ${fmtGrad(co)} (otras) para la cúspide de la casa N: cuenta en la N y no en la suya. ` +
    `<span class="reach-chip both">+ N</span> le faltan hasta ${fmtGrad(sa)} (angular) o ${fmtGrad(so)} (otras): cuenta en las dos. Los orbes se cambian en Configuración.</p>`;
}
const fmtGrad = (n) => `${String(n).replace(".", ",")}°`;

function renderHouses(c) {
  const reach = spillOn && mode === "natal" ? reachData() : [];
  const passed = new Set(reach.filter((r) => r.kind === "pass").map((r) => r.id));       // cuentan en la casa que sigue, no en la suya
  let html = `<table><thead><tr><th>Casa</th><th>Cúspide</th><th class="num">Posición</th><th>Contiene</th></tr></thead><tbody>`;
  c.houses.cusps.forEach((lon, i) => {
    const s = split(lon);
    const inside = c.bodies.filter((b) => b.house === i + 1 && !passed.has(b.id))
      .map((b) => `<span class="g" title="${BODY[b.id].name}">${glyphHTML(b.id)}</span>`).join("") +
      // los que vienen de la casa anterior («Entre casas»): con borde macizo si cuentan solo acá, punteado si cuentan en las dos
      reach.filter((r) => r.also === i + 1)
        .map((r) => `<span class="g also ${r.kind}" title="${reachTip(r)}">${glyphHTML(r.id)}</span>`).join("");
    html += `<tr><td class="num" style="text-align:left">${i + 1}</td>
      <td><span class="g">${signHTML(s.sign)}</span>${SIGNS[s.sign]}</td>
      <td class="num">${fmtPos(lon)}</td><td class="contains">${inside}</td></tr>`;
  });
  $("#panel-casas").innerHTML = html + "</tbody></table>" +
    (reach.length ? `<p class="fine tight reach-note">Con borde: planetas de la casa anterior que cuentan acá, macizo si cuentan solo en esta y punteado si cuentan en las dos (ver los orbes en Configuración).</p>` : "");
}

// -- viajes de los planetas por las casas: la notación del pizarrón, y al tocar una fila, la explicación en palabras
function renderTrips(c) {
  const el = $("#panel-viajes");
  if (mode !== "natal") { el.innerHTML = ""; return; }
  const trips = computeTrips(c, tripCfg);
  let html = "";
  for (const type of TRIP_TYPES) {
    const rows = trips.map((t, i) => [t, i]).filter(([t]) => t.type === type);
    html += `<h4 class="trip-h">${TRIP_TITLES[type]}<span class="trip-n">${rows.length}</span></h4>`;
    html += rows.length
      ? `<ul class="trips">${rows.map(([t, i]) => `<li data-id="${t.id}"><button type="button" class="trip-row" data-trip="${i}" aria-expanded="false" aria-label="${esc(tripPlain(t))}">${tripNotation(t)}</button>` +
        `<p class="trip-words" hidden>${esc(tripWords(t))}</p></li>`).join("")}</ul>`
      : `<p class="fine tight trip-none">Ninguno.</p>`;
  }
  const hard = tripCfg.asp.map((t) => ASPECT[t].name.toLowerCase());
  const list = hard.length > 1 ? `${hard.slice(0, -1).join(", ")} y ${hard.at(-1)}` : hard[0];
  html += `<p class="fine tight trip-note">${hard.length ? `Aspectos duros: ${list}.` : "No hay aspectos duros elegidos: solo cuentan los viajes por eje."} ` +
    `Pegado a la cúspide: hasta ${fmtGrad(tripCfg.cusp[0])} (angular) o ${fmtGrad(tripCfg.cusp[1])} (otras). Regentes modernos. ` +
    `Tocá un viaje para leerlo; todo se cambia en Configuración, «Viajes de planetas».</p>`;
  el.innerHTML = html;
}
$("#panel-viajes").addEventListener("click", (e) => {
  const row = e.target.closest(".trip-row");
  if (!row) return;
  const words = row.parentElement.querySelector(".trip-words");
  words.hidden = !words.hidden;
  row.setAttribute("aria-expanded", !words.hidden);
});

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
  const all = vis(cross ? cross.aspects : chart.aspects);
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
      ? `${mark(a.b)}${retroTag(trBody(a.b).retro)}<span class="a-ic ${A.cls}">${A.icon}</span>${mark(a.a)}`
      : `${mark(a.a)}<span class="a-ic ${A.cls}">${A.icon}</span>${mark(a.b)}`;
    html += `<tr data-a="${a.a}" data-b="${b}">
      <td class="pair">${pair}</td>
      <td class="small">${A.name}</td>
      <td class="num">${fmtOrb(a.orb)}</td>
      ${phaseCol ? `<td class="small muted">${phase}</td>` : ""}</tr>`;
  }
  $("#aspTable").innerHTML = html + "</tbody></table>";
  armAspects();
}

// -- natal: cuadro de aspectos en escalera
function renderStair() {
  $("#stairTable").innerHTML = chart ? stairHTML({ ...chart, aspects: vis(chart.aspects) }, orbMax) : "";
  armAspects();
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
  const inner = chart.bodies.map((b) => b.id);
  const outer = (mode === "syn" ? syn.b.bodies : transit.bodies).map((b) => b.id);
  const found = new Map(vis(cross.aspects).filter((a) => a.orb <= orbMax).map((a) => [`${a.a}|${a.b}`, a]));
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
      html += `<td class="hit" data-a="${r}" data-b="o:${c}" data-t="${a.type}" title="${BODY[r].name}${owner(A)} ${T.name.toLowerCase()} ${BODY[c].name}${owner(B)} · orbe ${fmtOrb(a.orb)}${phase}">` +
        `<span class="a-ic ${T.cls}">${T.icon}</span><span class="a-or">${orbCode(a.orb, a.applying)}</span></td>`;
    }
    html += "</tr>";
  }
  el.innerHTML = html + "</tbody></table>" + ORB_LEGEND;
  armAspects();
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
  const shown = d.events.map((e, i) => [e, i]).filter(([e]) => !aspOff.has(e.type));     // sin los aspectos apagados (i sigue siendo el de d.events)
  const n = shown.length;
  $("#calCount").textContent = (n === 1 ? "1 aspecto exacto" : `${n} aspectos exactos`) +
    (d.truncated ? ". Hay más: acortá el período o elegí menos planetas." : "");
  if (!n) { $("#calTable").innerHTML = `<p class="muted pad">No hay aspectos exactos en este período.</p>`; return; }

  let html = `<table class="cal"><tbody>`;
  let month = "";
  shown.forEach(([e, i]) => {
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
      <td class="pair">${mark(e.t)}${retroTag(e.retro)}<span class="a-ic ${A.cls}">${A.icon}</span>${mark(e.n)}</td>
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
  $(panel).addEventListener("mouseleave", () => wheel?.leave());
};
hoverFocus("#panel-pos", true);
hoverFocus("#panel-elem", true);
hoverFocus("#panel-viajes", false);
hoverFocus("#panel-tpos", false);
hoverFocus("#panel-over", false);

// -- la ficha del planeta tocado en la rueda (con el dedo y sin lecturas): signo, grados, casa y sus aspectos, en una
// tarjeta abajo de la pantalla. Se va al soltar el planeta (tocar afuera, de nuevo el mismo o la ×).
function hideFicha() {
  const el = $("#pfi");
  if (!el.hidden) { el.hidden = true; el.replaceChildren(); }
}
function showFicha(id, note = "", trip = false) {
  const ring = outerRing(), out = id.startsWith("o:"), bid = out ? id.slice(2) : id;
  const body = (out ? ring?.bodies : chart?.bodies)?.find((b) => b.id === bid);
  if (!body || !wheel) { hideFicha(); return; }
  const nm = (oid) => {
    const o = oid.startsWith("o:"), b = o ? oid.slice(2) : oid;
    return { b, html: esc(BODY[b]?.name || b) + (ring ? ` <span class="pfi-tag">${esc(o ? ring.short : "natal")}</span>` : "") };
  };
  const s = split(body.lon), me = nm(id);
  const house = body.house ? `${out ? cap(ring.houseWord) : "Casa"} ${body.house}` : "";
  const asps = wheel.aspectsOf(id).map((a) => ({ ...a, other: a.a === id ? a.b : a.a })).sort((x, y) => x.orb - y.orb);
  const rows = asps.map((a) => {
    const A = ASPECT[a.type], o = nm(a.other);
    const ph = a.applying === true ? "aplicativo" : a.applying === false ? "separativo" : "";
    return `<li><span class="a-ic ${A.cls}" title="${A.name}">${A.icon}</span><span class="pfi-g" aria-hidden="true">${glyphHTML(o.b) || ""}</span>` +
      `<span class="pfi-an"><span class="pfi-at">${A.name}</span> ${o.html}</span><span class="pfi-orb" title="${ph}">${fmtOrb(a.orb)}${ph ? ` ${ph[0].toUpperCase()}` : ""}</span></li>`;
  }).join("");
  const el = $("#pfi");
  el.innerHTML = `<div class="pfi-head"><span class="pfi-b" aria-hidden="true">${badge(bid)}</span><div class="pfi-t">` +
    `<h3 id="pfiTitle">${me.html}</h3><p class="pfi-pos"><span class="g" aria-hidden="true">${signHTML(s.sign)}</span> ${SIGNS[s.sign]} ` +
    `${s.deg}°${String(s.min).padStart(2, "0")}′${body.retro ? ' <span class="rx">R</span>' : ""}${house ? ` · ${house}` : ""}</p></div>` +
    `<button type="button" class="iconbtn pfi-x" aria-label="Cerrar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>` +
    (note ? `<div class="pfi-note${trip ? " trip" : ""}">${String(note).split("\n").map((l) => `<p>${esc(l)}</p>`).join("")}</div>` : "") +
    (rows ? `<ul class="pfi-list" aria-label="Aspectos">${rows}</ul>` : `<p class="pfi-none">Sin aspectos en la rueda.</p>`);
  el.hidden = false;
}

// -- celular: la barra de abajo. «Carta» es la rueda natal sola, «Tablas» las tablas de la carta natal; «Tránsitos» y
// «Sinastría» son sus vistas (rueda y tablas). Reemplaza al selector Natal / Tránsitos / Sinastría de arriba.
function paintBar() {
  const root = document.documentElement;
  root.toggleAttribute("data-mbar", page === "chart" && !$("#stage").hidden);
  fitTitle();
  root.dataset.mview = mview;
  const cur = mode === "natal" ? mview : mode;
  $("#mbar").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === cur)));
}
$("#mbar").addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-v]");
  if (!b) return;
  const v = b.dataset.v, cur = mode === "natal" ? mview : mode;
  if (v === cur) { scrollTo({ top: 0, behavior: "smooth" }); return; }
  wheel?.clear(); highlightRows(null);
  if (v === "carta" || v === "tablas") mview = v;
  paintBar();
  scrollTo(0, 0);
  await setMode(v === "carta" || v === "tablas" ? "natal" : v);
  paintBar();
});

// Con el dedo no hay «sacar el mouse»: lo que se toca queda resaltado en la rueda y no hay cómo soltarlo. Tocar afuera, o de nuevo
// lo mismo, vuelve a mostrar todos los aspectos (con el mouse y el teclado todo sigue como antes).
{
  const PANELS = ["#panel-pos", "#panel-elem", "#panel-viajes", "#panel-tpos", "#panel-over"];
  const noAngles = new Set(["#panel-pos", "#panel-elem"]);
  const ASPECTS = ["#aspTable", "#stairTable", "#gridTable"].map((s) => `${s} [data-a][data-b]`).join(",");
  // qué resalta tocar esto: { key, on } o null si no resalta nada
  const target = (el) => {
    if (!el.closest) return null;
    const asp = el.closest(ASPECTS);
    if (asp) return { key: `${asp.dataset.a}|${asp.dataset.b}`, on: () => wheel.pair(asp.dataset.a, asp.dataset.b) };
    const pl = el.closest("[data-id]");
    if (!pl) return null;
    const id = pl.dataset.id;
    // (los viajeros y los que pasan a otra casa llevan su explicación: con el dedo va dentro de la ficha)
    if (pl.closest("#wheel")) return pl.classList.contains("pl") ? { key: id, inWheel: true, tip: pl.dataset.tip || "", trip: pl.classList.contains("trip"), on: () => { wheel.focus(id); highlightRows(id); } } : null;
    for (const p of PANELS) if (pl.closest(p)) return noAngles.has(p) && (id === "asc" || id === "mc") ? null : { key: id, on: () => wheel.focus(id) };
    return null;
  };
  const release = () => { wheel?.clear(); highlightRows(null); hideFicha(); };
  $("#pfi").addEventListener("click", (e) => { if (e.target.closest(".pfi-x")) release(); });
  let tap = null;       // el apoyo en curso: con qué dedo y qué estaba resaltado
  document.addEventListener("pointerdown", (e) => { tap = { type: e.pointerType, held: wheel?.current() ?? null }; }, true);
  // se resuelve en el click (no al apoyar) para que arrastrar para desplazarse no suelte el resaltado
  document.addEventListener("click", (e) => {
    const t = tap; tap = null;
    if (!wheel || !t || !t.type || t.type === "mouse" || e.target.closest?.("#pfi")) return;      // (dentro de la ficha se lee, no se suelta)
    const hit = target(e.target);
    // sin lecturas, la explicación de «Entre casas» o del viaje va en la ficha, junto con los aspectos: no se abre además el cartelito
    if (hit?.inWheel && hit.tip && !interpOn) e.stopPropagation();
    if (hit && t.held === hit.key) release();             // el mismo otra vez
    else if (hit) {                                       // otro, o el primero: queda resaltado hasta soltarlo (no hay un «mouseover» nuevo si el dedo ya estaba ahí)
      hit.on(); wheel.hold();
      if (hit.inWheel && !interpOn) showFicha(hit.key, hit.tip, hit.trip); else hideFicha();      // con lecturas se abre la ventana del planeta
    }
    else if (wheel.current()) release();                  // afuera
  }, true);
}

// Tocar un planeta (en la rueda, en una tabla o en la cruz de elementos) abre su lectura.
// lo que ven las ventanas de lectura: los datos de la vista sin los aspectos apagados en Configuración
const readCtx = () => ({
  mode, orbMax,
  chart: chart && { ...chart, aspects: vis(chart.aspects) },
  transit: transit && { ...transit, aspects: vis(transit.aspects) },
  syn: syn && { ...syn, aspects: vis(syn.aspects) },
});
const reading = initPlanetDialog(readCtx, () => { wheel?.clear(); highlightRows(null); });
function openReading(id) { if (chart && interpOn) reading.open(id); }
// Tocar un aspecto (en la lista, el cuadro o la cuadrícula) abre la ventana que lo explica; desde ahí se salta a cada planeta.
const aspectDlg = initAspectDialog(readCtx, (key) => openReading(key), () => { wheel?.clear(); });
const aspectCell = (e) => e.target.closest("[data-a][data-b]");
function openAspect(el) { if (chart && interpOn && el) aspectDlg.open(el.dataset.a, el.dataset.b); }
// Con lecturas, cada aspecto se puede tocar y alcanzar con el teclado; en «solo datos», no.
function armAspects() {
  for (const sel of ["#aspTable", "#stairTable", "#gridTable"]) {
    for (const el of document.querySelectorAll(`${sel} [data-a][data-b]`)) {
      el.classList.toggle("asp-open", interpOn);
      if (interpOn) { el.tabIndex = 0; el.setAttribute("aria-haspopup", "dialog"); }
      else { el.removeAttribute("tabindex"); el.removeAttribute("aria-haspopup"); }
    }
  }
}
for (const sel of ["#aspTable", "#stairTable", "#gridTable"]) {
  $(sel).addEventListener("click", (e) => openAspect(aspectCell(e)));
  $(sel).addEventListener("keydown", (e) => {
    if ((e.key !== "Enter" && e.key !== " ") || e.target !== aspectCell(e)) return;
    e.preventDefault();
    openAspect(e.target);
  });
  // con el teclado, el aspecto enfocado también resalta su línea en la rueda
  $(sel).addEventListener("focusin", (e) => { const el = aspectCell(e); if (el && wheel) wheel.pair(el.dataset.a, el.dataset.b); });
  $(sel).addEventListener("focusout", () => wheel?.leave());
}
for (const sel of ["#panel-pos", "#panel-tpos", "#panel-over", "#panel-elem"]) {
  $(sel).addEventListener("click", (e) => {
    const el = e.target.closest("tr[data-id], li.chip[data-id]");
    if (el) openReading(el.dataset.id);
  });
}

for (const sel of ["#aspTable", "#gridTable", "#stairTable"]) {
  $(sel).addEventListener("mouseover", (e) => {
    const el = e.target.closest("[data-a][data-b]");
    if (!el) return;
    if (wheel) wheel.pair(el.dataset.a, el.dataset.b);
    const info = $("#stairInfo");
    // con el dedo no hay «pasar por encima»: cambiar el texto de acá mueve la página justo cuando se toca y el toque cae en otro lado
    if (sel === "#stairTable" && info && !matchMedia("(hover: none)").matches) { if (el.dataset.info) info.textContent = el.dataset.info; else info.innerHTML = STAIR_HINT; }
  });
  $(sel).addEventListener("mouseleave", () => {
    wheel?.leave();
    const info = $("#stairInfo");
    if (info) info.innerHTML = STAIR_HINT;
  });
}

// ---------- pestañas, modos y filtro -------------------------------------
const tabs = [...document.querySelectorAll("[role=tab]")];
const lastTab = { natal: "tab-stair", transit: "tab-sum", syn: "tab-asp" };    // en la carta natal se abre en el Cuadro
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
  showTab(tab);
}

// las pestañas van en una fila; si no entran se deslizan: la elegida queda a la vista y el borde que corta se esfuma
const tabRow = $(".tabs");
function tabEdges() {
  const max = tabRow.scrollWidth - tabRow.clientWidth;
  tabRow.classList.toggle("fade-l", max > 1 && tabRow.scrollLeft > 1);
  tabRow.classList.toggle("fade-r", max > 1 && tabRow.scrollLeft < max - 1);
}
function showTab(tab) {
  if (!tabRow.clientWidth) return;
  const r = tabRow.getBoundingClientRect(), b = tab.getBoundingClientRect(), pad = 28;
  if (b.left < r.left + pad) tabRow.scrollLeft -= r.left + pad - b.left;
  else if (b.right > r.right - pad) tabRow.scrollLeft += b.right - (r.right - pad);
  tabEdges();
}
tabRow.addEventListener("scroll", tabEdges, { passive: true });
// en el celular la fila queda pegada arriba al bajar (style.css); pegada, deja lugar al botón del menú
if (typeof IntersectionObserver !== "undefined") {
  new IntersectionObserver(([e]) => tabRow.classList.toggle("stuck", e.intersectionRatio < 1 && e.boundingClientRect.top < 1 && getComputedStyle(tabRow).position === "sticky"),
    { threshold: [1] }).observe(tabRow);
}
if (typeof ResizeObserver !== "undefined") new ResizeObserver(tabEdges).observe(tabRow);

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
  document.documentElement.dataset.mode = mode;       // la hoja de impresión lo usa: en natal salen todas las tablas
  document.querySelectorAll("#modes button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.mode === mode));
  $("#toolsTransit").hidden = mode !== "transit";
  $("#toolsSyn").hidden = mode !== "syn";
  if (!$("#stage").hidden) { $("#spillBtn").hidden = mode !== "natal"; $("#tripBtn").hidden = mode !== "natal"; }
  paintBar();
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

// la configuración dentro del menú: siempre arranca cerrada (se abre con un toque, pero no se recuerda abierta)
try { localStorage.removeItem("carta:cfgopen"); } catch {}      // ya no se guarda; se limpia lo que dejó una versión anterior
$("#cfgBox").open = false;

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

// ---------- imprimir ------------------------------------------------------
// «Imprimir» abre un cuadro para elegir qué va en la hoja; lo demás está en print.js y en el @media print de style.css.
setupPrint({ root, getMode: () => mode });

// ---------- configuración: estilo, letra, mandala --------------------------
// Solo cambiar el estilo de los gráficos obliga a volver a dibujar; lo demás lo resuelve la CSS.
const cfg0 = initSettings((cfg, what) => {
  setCuspRing(cfg.cuspRing);
  const interpChanged = cfg.interp !== interpOn;
  interpOn = cfg.interp;
  if (interpChanged) {                  // «solo datos»: se cierra la ventana de lectura y se redibuja lo que la ofrecía
    reading.close();
    aspectDlg.close();
    armAspects();
    if (chart) { drawWheel(); renderSummary(); }
  }
  aspOff = new Set(cfg.aspOff);
  orbs = cfg.orbs;
  spillOn = cfg.spill;
  tripCfg = cfg.trips;
  if (cfg.tripsOn && !tripsOn) tripReset();
  tripsOn = cfg.tripsOn;
  if (what === "orbs") { if (birth) run(load); }       // los aspectos y los planetas entre casas los calcula el servidor
  if (what === "spill" && chart) render();
  if ((what === "trips" || what === "tripsOn") && chart) render();
  if (what === "asp" && chart) {         // un tipo de aspecto prendido o apagado: se rehace todo lo que muestra aspectos
    renderAspects();
    renderStair();
    renderGrid();
    drawWheel();
    if (cal.data) renderCalendar();
  }
  if ((what === "cusp" || (what === "fs" && cfg.cuspRing)) && chart) drawWheel();     // el tamaño de la letra cambia el lugar de los rótulos del anillo
  if (what === "gfx") {
    setClassic(cfg.gfx === "classic");
    refreshCombine();
    if (page === "home" && moon.now) paintSky();
    if (chart) render();
  }
});
setClassic(cfg0.gfx === "classic");
setCuspRing(cfg0.cuspRing);
// «Restablecer» deja el menú como viene de fábrica: fijo en pantallas grandes, oculto en el celular
$("#cfgReset").addEventListener("click", () => {
  const hidden = matchMedia("(max-width: 820px)").matches;
  if (sideHidden() !== hidden) setSide(hidden, false);
});

// ---------- copia de seguridad: exportar e importar las cartas guardadas --------------------------------
// Sirve igual en la versión de escritorio (las cartas están en un archivo de tu compu) y en la alojada (están en el
// navegador). El archivo es el mismo en las dos, así que se puede pasar cartas de una a la otra.
function setupBackup() {
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

  $("#exportCharts").addEventListener("click", async () => {
    try {
      const data = await charts.exportData();
      if (!data.charts.length) { say("Todavía no hay cartas guardadas para exportar.", true); return; }
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: `cartas-natales-${new Date().toISOString().slice(0, 10)}.json` });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      say(`Se exportó ${plural(data.charts.length, "carta", "cartas")}.`);
    } catch (err) {
      say(err.message, true);
    }
  });

  $("#importCharts").addEventListener("click", () => $("#importFile").click());
  $("#importFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 1_000_000) { say("Ese archivo es demasiado grande.", true); return; }
    try {
      const r = await charts.importData(JSON.parse(await file.text()));
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

// ---------- versión alojada en internet ------------------------------------
// Las cartas guardadas viven en el navegador de cada persona; el aviso de privacidad lo dice.
function setupPublic() {
  $("#privacyNote").textContent = "Zodíaco tropical, calculado con Swiss Ephemeris (Moshier). Los datos de nacimiento se envían al servidor solo para calcular la carta y no se guardan ahí.";
}

const formReady = (v) => !!(v.date && v.time && String(v.lat) !== "" && String(v.lon) !== "" &&
  (v.manual ? String(v.offset ?? "") !== "" : v.tz));

// ---------- páginas: inicio (la Luna), calendario lunar y carta ----------------------------------------------
// Se navega con el # de la dirección (#inicio, #luna, #luna/2026-10, #carta): el botón «atrás» del celular vuelve del
// calendario al inicio y al recargar queda la misma página. Sin # se abre el inicio.
const moon = { now: null, nowAt: 0, nowSeq: 0, err: null, months: new Map(), cal: null, calSeq: 0, timer: 0, south: true,
  poem: null, poemSign: -1 };                  // el poema de la Luna: se elige al entrar al inicio y se lee al tocarla
try { moon.south = localStorage.getItem("carta:hemi") !== "n"; } catch {}
let page = "";                       // "home" | "lunar" | "combine" | "chart"
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
  if (h === "combinar") return { page: "combine" };
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
  $("#combine").hidden = page !== "combine";
  $("#chartPage").hidden = page !== "chart";
  paintBar();
  if (page !== "chart") hideFicha();
  for (const [id, p] of [["navHome", "home"], ["navMoon", "lunar"], ["navChart", "chart"], ["navCombine", "combine"]]) {
    if (page === p) $("#" + id).setAttribute("aria-current", "page"); else $("#" + id).removeAttribute("aria-current");
  }
  if (prev !== page) {
    if (prev === "home") stopHome();
    if (peeking() && !hoverMode()) peek(false);       // el menú del celular se cierra al cambiar de sección
    if (prev) scrollTo(0, 0);
  }
  if (page === "home") startHome();
  else if (page === "lunar") showLunar(r.y, r.m);
  else if (page === "combine") showCombine();
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

// -- inicio: el cielo de ahora, con la Luna abajo a la izquierda
const skyState = { sel: null, w: 0, layout: [] };      // sel: el planeta que se tocó

function renderHome() {
  const tz = moonTz();
  try {
    $("#homeSub").textContent = cap(new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(new Date()));
  } catch { $("#homeSub").textContent = ""; }
  const wrap = $("#skyWrap"), err = $("#homeErr");
  if (moon.now || !moon.err) {
    wrap.hidden = false;
    err.hidden = true;
    paintSky();
  } else {
    wrap.hidden = true;
    const offline = moon.err instanceof TypeError;
    err.hidden = false;
    err.replaceChildren(
      Object.assign(document.createElement("strong"), { textContent: offline ? "No se pudo conectar con el servidor" : "No se pudo calcular el cielo" }),
      document.createTextNode(offline ? (isPublic() ? "Si hace un rato que nadie la usa, la página puede tardar hasta un minuto en despertar." : "Volvé a abrir la app.") : moon.err.message),
    );
    const retry = Object.assign(document.createElement("button"), { type: "button", className: "secondary compact", textContent: "Reintentar" });
    retry.style.marginTop = "10px";
    retry.addEventListener("click", () => { moon.err = null; renderHome(); loadMoon(); });
    err.append(document.createElement("br"), retry);
  }
  renderHomeCharts();
}

/** Dibuja el mapa: los signos, la Tierra, los planetas en su lugar y la Luna en el rincón. */
function paintSky() {
  const sky = $("#sky"), box = $("#skyMoon"), now = moon.now;
  placeMoon();
  const W = Math.round(sky.clientWidth) || 640;
  skyState.w = W;
  sky.innerHTML = skyShellHTML(W);
  if (now) {
    box.innerHTML = `<button type="button" class="sky-moon-btn" id="moonBtn" aria-haspopup="dialog">${moonCornerHTML(now, moon.south)}</button>` +
      `<a class="sky-moon-cal sky-cal" href="#luna">Calendario lunar <span aria-hidden="true">›</span></a>`;
  } else {
    box.innerHTML = `<span class="mc-wait">Calculando el cielo…</span>`;
  }
  // en pantallas medianas la Luna está encima del mapa (en el celular, debajo; en el tablero, en la columna): los planetas no la tapan
  const obstacles = [], mr = box.getBoundingClientRect(), sr = sky.getBoundingClientRect();
  if (now && mr.width && box.parentElement.id === "skyWrap" && mr.top < sr.bottom - 1 && mr.left < sr.right - 1) {
    obstacles.push({ x0: mr.left - sr.left - 4, y0: mr.top - sr.top - 4, x1: mr.right - sr.left + 4, y1: mr.bottom - sr.top + 4 });
  }
  // la Luna es un cuerpo más del cielo: se dibuja con su fase en su longitud (el servidor la manda aparte de los planetas)
  const bodies = now?.planets ? [{ id: "moon", lon: now.lon, sign: now.sign, deg: now.deg, min: now.min, retro: false }, ...now.planets] : [];
  const moonArt = now ? moonIcon(now.elong, moon.south) : "";
  skyState.layout = layoutSky(bodies, W, obstacles);
  sky.insertAdjacentHTML("beforeend", skyState.layout.map((p) => planetHTML(p, p.id === skyState.sel, moonArt)).join(""));
  paintSkyInfo();
}

/** En el tablero de escritorio la Luna va en la columna de la derecha; si no, en el rincón del mapa (o debajo, en el celular). */
function placeMoon() {
  const box = $("#skyMoon"), slot = $("#homeMoonSlot"), wrap = $("#skyWrap");
  const dash = getComputedStyle($("#home .home-grid")).display === "grid";
  if (dash && box.parentElement !== slot) slot.append(box);
  else if (!dash && box.parentElement !== wrap) wrap.insertBefore(box, wrap.querySelector(".sky-foot"));
}

function paintSkyInfo() {
  const el = $("#skyInfo"), now = moon.now;
  if (now && !now.planets) el.textContent = "Para ver los planetas, cerrá la ventana de Carta natal y volvé a abrirla.";
  else el.innerHTML = skyInfoHTML(skyState.sel, skyState.layout, now ? now.local.slice(11) : "");
}

$("#sky").addEventListener("click", (e) => {
  const b = e.target.closest(".sky-pl");
  if (!b) return;
  if (b.dataset.id === "moon") { openPoem(); return; }          // la Luna del mapa es la misma de la esquina: abre el poema
  skyState.sel = skyState.sel === b.dataset.id ? null : b.dataset.id;
  document.querySelectorAll("#sky .sky-pl").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.id === skyState.sel)));
  paintSkyInfo();
});

// el mapa se vuelve a acomodar si cambia de ancho (girar el celular, achicar la ventana)
let skyWatch = null, skyFrame = 0;
function watchSky() {
  if (skyWatch || typeof ResizeObserver === "undefined") return;
  skyWatch = new ResizeObserver(() => {
    const w = Math.round($("#sky").clientWidth);
    const dash = getComputedStyle($("#home .home-grid")).display === "grid";        // pasar a tablero (o volver) mueve la Luna
    if (page !== "home" || !moon.now || !w || (Math.abs(w - skyState.w) < 6 && dash === ($("#skyMoon").parentElement.id === "homeMoonSlot"))) return;
    cancelAnimationFrame(skyFrame);
    skyFrame = requestAnimationFrame(paintSky);
  });
  skyWatch.observe($("#skyWrap"));
  skyWatch.observe($("#home"));
  document.fonts?.ready.then(() => { if (page === "home" && moon.now) paintSky(); });     // con la letra ya cargada cambia el tamaño del rincón de la Luna
}

/**
 * Un poema para la Luna en su signo, al azar entre los de ese signo. Se elige al entrar al inicio (o si la Luna cambia de
 * signo mientras se mira) y no cambia hasta entonces: se lee al tocar la Luna.
 */
function ensurePoem(sign) {
  if (moon.poemSign === sign) return;
  moon.poem = pickPoem(sign, moon.poem);
  moon.poemSign = sign;
}
function openPoem() {
  const now = moon.now;
  if (!now) return;
  ensurePoem(now.sign);
  const box = $("#poemBody");
  $("#poemIc").innerHTML = moonIcon(now.elong, moon.south);
  $("#poemTitle").textContent = `La Luna en ${SIGNS[now.sign]}`;
  $("#poemSub").replaceChildren(`${now.name} · `, Object.assign(document.createElement("span"), { className: "nowrap", textContent: `${Math.round(now.illum * 100)} % iluminada` }));
  if (moon.poem) {
    box.innerHTML = poemHTML(moon.poem);
    box.querySelector(".mp-more")?.remove();                       // acá se lee entero
    box.dataset.el = ["fire", "earth", "air", "water"][now.sign % 4];
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", `Poema para la Luna en ${SIGNS[now.sign]}`);
    box.hidden = false;
  } else {
    box.hidden = true;
  }
  $("#poemNow").innerHTML = (moon.poem ? "" : `<p class="pdl-empty interp">Todavía no hay poemas para este signo.</p>`) + moonLinesHTML(now, todayIn(moonTz()));
  $("#poemDlg").showModal();
  $("#poemDlg .pdl-body").scrollTop = 0;
}
$("#skyMoon").addEventListener("click", (e) => { if (e.target.closest(".sky-moon-btn")) openPoem(); });
$("#poemClose").addEventListener("click", () => $("#poemDlg").close());
$("#poemCal").addEventListener("click", () => $("#poemDlg").close());          // el enlace sigue su camino al calendario
$("#poemDlg").addEventListener("click", (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });   // un toque en la cortina

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
  watchSky();
  if (!moon.now || Date.now() - moon.nowAt > 120000) loadMoon();
  clearInterval(moon.timer);
  moon.timer = setInterval(() => { if (!document.hidden) loadMoon(); }, 300000);
}
function stopHome() { clearInterval(moon.timer); }
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && page === "home" && Date.now() - moon.nowAt > 120000) loadMoon();
});

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
  if (items.length) {                                  // las otras cartas y, al final, «Nueva carta»
    const row = make("div", { className: "home-chips" });
    row.append(...others.map((it) => make("button", { type: "button", className: "home-chip", textContent: it.name, title: `Abrir la carta de ${it.name}` }, () => openSaved(it))));
    const add = make("button", { type: "button", className: "home-chip home-new", id: "homeNew", title: "Cargar una carta nueva" }, () => openForm("new"));
    add.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Nueva carta`;
    row.append(add);
    nodes.push(row);
  }
  body.replaceChildren(...nodes);
  renderHomeTr();
  renderHomeFind();
}

// -- inicio: tránsitos destacados de hoy con las cartas guardadas. Se piden al apretar el botón (cada carta es un
// cálculo de años de recorrido), de a dos a la vez; si el servidor pide esperar (versión pública) se espera y se sigue.
const homeTr = { on: new Set(), res: new Map(), running: false, seq: 0, done: 0, total: 0, at: null };
/** Lo que identifica los datos de una carta: si se edita, lo que se calculó antes deja de valer. */
const trSig = (it) => [it.date, it.time, it.lat, it.lon, it.tz, it.manual, it.offset].join("|");

function renderHomeTr() {
  const sec = $("#homeTr"), items = saved.items;
  sec.hidden = !items.length;                      // sin cartas guardadas no hay con qué calcular
  if (!items.length) return;
  const on = items.filter((it) => homeTr.on.has(it.id));      // al abrir la app no hay ninguna elegida: se eligen a mano
  $("#homeTrNote").textContent = "Elegí las cartas. Los planetas lentos (de Júpiter a Plutón) que hoy forman un aspecto cerrado con el Sol, la Luna o los planetas hasta Saturno de cada una." +
    (isPublic() ? " Al calcular, los datos de nacimiento de las cartas elegidas se envían al servidor solo para eso; no se guardan." : "");
  const pick = $("#homeTrPick");
  pick.replaceChildren(...items.map((it) => {
    const b = Object.assign(document.createElement("button"), { type: "button", className: "home-chip", textContent: it.name, title: "Incluir o sacar esta carta del cálculo" });
    b.setAttribute("aria-pressed", String(homeTr.on.has(it.id)));
    b.addEventListener("click", () => { if (homeTr.on.has(it.id)) homeTr.on.delete(it.id); else homeTr.on.add(it.id); renderHomeTr(); });
    return b;
  }));
  if (items.length > 1) {                          // con muchas cartas, elegirlas una por una es un rato largo
    const all = on.length === items.length;
    const b = Object.assign(document.createElement("button"), { type: "button", className: "home-tr-all", textContent: all ? "Quitar todas" : "Elegir todas" });
    b.addEventListener("click", () => { homeTr.on = new Set(all ? [] : items.map((it) => it.id)); renderHomeTr(); });
    pick.append(b);
  }
  const go = $("#homeTrGo");
  go.disabled = homeTr.running || !on.length;
  go.textContent = homeTr.running ? "Calculando…" : !on.length ? "Calcular" : homeTr.res.size ? "Volver a calcular" : on.length === 1 ? "Calcular con 1 carta" : `Calcular con ${on.length} cartas`;
  $("#homeTrProg").textContent = homeTr.running ? `${homeTr.done} de ${homeTr.total}`
    : !on.length ? "Elegí al menos una carta."
    : homeTr.res.size && homeTr.at ? `Calculado para el ${homeTr.at.date.split("-").reverse().join("/")} a las ${homeTr.at.time}` : "";
  const cards = [];
  for (const it of on) {
    const r = homeTr.res.get(it.id);
    if (!r || r.sig !== trSig(it)) continue;
    const card = Object.assign(document.createElement("article"), { className: "htr-card" });
    const head = Object.assign(document.createElement("div"), { className: "htr-head" });
    head.append(Object.assign(document.createElement("h4"), { textContent: it.name }));
    const open = Object.assign(document.createElement("button"), { type: "button", className: "htr-open", textContent: "Abrir en Tránsitos ›", title: `Abrir la carta de ${it.name} con los tránsitos de hoy` });
    open.addEventListener("click", () => openSavedInTransit(it));
    head.append(open);
    const body = document.createElement("div");
    if (r.err) {
      body.className = "htr-err";
      body.textContent = r.err instanceof TypeError ? "No se pudo conectar con el servidor." : sumError(r.err);
    } else {
      body.innerHTML = featuredRowsHTML(r.data);
    }
    card.append(head, body);
    cards.push(card);
  }
  $("#homeTrBody").replaceChildren(...cards);
}

async function featuredRetry(body, at, my) {
  for (let i = 0; ; i++) {
    try {
      return await compute.featured(body, at);
    } catch (err) {
      const busy = err.status === 429 || err.status === 503;
      if (!busy || i >= 4 || my !== homeTr.seq) throw err;
      await new Promise((ok) => setTimeout(ok, Math.min(15, Math.max(1, err.retryAfter || 2)) * 1000));
    }
  }
}

async function runHomeTr() {
  if (homeTr.running) return;
  const items = saved.items.filter((it) => homeTr.on.has(it.id));
  if (!items.length) return;
  const tz = moonTz();
  const at = { ...nowIn(tz), tz };
  const view = readForm(), queue = items.slice(), my = ++homeTr.seq;
  Object.assign(homeTr, { running: true, res: new Map(), done: 0, total: items.length, at });
  renderHomeTr();
  const worker = async () => {
    while (queue.length && my === homeTr.seq) {
      const it = queue.shift();
      let r;
      const sig = trSig(it);
      try { r = { sig, data: await featuredRetry(partnerBody(it, view), at, my) }; } catch (err) { r = { sig, err }; }
      if (my !== homeTr.seq) return;
      homeTr.res.set(it.id, r);
      homeTr.done++;
      if (page === "home") renderHomeTr();
    }
  };
  await Promise.all([worker(), worker()]);
  if (my !== homeTr.seq) return;
  homeTr.running = false;
  if (page === "home") renderHomeTr();
}
$("#homeTrGo").addEventListener("click", runHomeTr);

// -- inicio: buscar entre las cartas guardadas las que tienen un planeta (o el Ascendente) en un signo.
// Hace falta la posición de cada carta: se calcula una vez (en la versión pública, al apretar el botón, porque los datos de
// nacimiento viajan al servidor) y queda en este navegador junto con lo que identifica los datos de la carta; si una carta
// se edita, se vuelve a calcular solo esa.
const FIND_KEY = "carta:pos";
const FIND_BODIES = [...TRIP_PLANETS, "asc", "mc"];
const find = { pos: new Map(), running: false, seq: 0, done: 0, total: 0, errs: new Map(), body: "moon", sign: "all" };
const FIND_ART = { sun: "el Sol", moon: "la Luna", asc: "el Ascendente", mc: "el Medio Cielo" };
const degTxt = (lon) => { const s = split(lon); return `${s.deg}°${String(s.min).padStart(2, "0")}′`; };
try {
  const raw = JSON.parse(localStorage.getItem(FIND_KEY));
  if (raw?.v === 1 && raw.items && typeof raw.items === "object") {
    for (const [id, r] of Object.entries(raw.items)) {
      if (r && typeof r.sig === "string" && r.lon && FIND_BODIES.every((b) => Number.isFinite(r.lon[b]))) find.pos.set(id, { sig: r.sig, lon: Object.fromEntries(FIND_BODIES.map((b) => [b, r.lon[b]])) });
    }
  }
} catch {}
function findSave() {
  try {
    const items = {};
    for (const it of saved.items) { const r = find.pos.get(it.id); if (r && r.sig === trSig(it)) items[it.id] = r; }
    localStorage.setItem(FIND_KEY, JSON.stringify({ v: 1, items }));
  } catch {}
}
const findReady = (it) => find.pos.get(it.id)?.sig === trSig(it);

(() => {
  const opt = (v, t) => Object.assign(document.createElement("option"), { value: v, textContent: t });
  $("#findBody").replaceChildren(opt("any", "Cualquier planeta"), ...FIND_BODIES.map((b) => opt(b, BODY[b].name)));
  $("#findBody").value = find.body;
  $("#findSign").replaceChildren(opt("all", "Todos los signos"), ...SIGNS.map((s, i) => opt(String(i), s)));
  $("#findSign").value = find.sign;
  $("#findBody").addEventListener("change", (e) => { find.body = e.target.value; renderHomeFind(); });
  $("#findSign").addEventListener("change", (e) => { find.sign = e.target.value; renderHomeFind(); });
})();

async function retryBusy(call, alive) {
  for (let i = 0; ; i++) {
    try {
      return await call();
    } catch (err) {
      const busy = err.status === 429 || err.status === 503;
      if (!busy || i >= 4 || !alive()) throw err;
      await new Promise((ok) => setTimeout(ok, Math.min(15, Math.max(1, err.retryAfter || 2)) * 1000));
    }
  }
}

async function runFind() {
  if (find.running) return;
  const todo = saved.items.filter((it) => !findReady(it));
  if (!todo.length) return;
  const view = readForm(), queue = todo.slice(), my = ++find.seq;
  Object.assign(find, { running: true, done: 0, total: todo.length, errs: new Map() });
  renderHomeFind();
  const worker = async () => {
    while (queue.length && my === find.seq) {
      const it = queue.shift(), sig = trSig(it);
      try {
        const c = await retryBusy(() => compute.chart(partnerBody(it, view)), () => my === find.seq);
        const lon = Object.fromEntries([...c.bodies.filter((b) => TRIP_PLANETS.includes(b.id)).map((b) => [b.id, b.lon]), ["asc", c.angles.asc], ["mc", c.angles.mc]]);
        if (!FIND_BODIES.every((b) => Number.isFinite(lon[b]))) throw new Error("Respuesta incompleta.");
        find.pos.set(it.id, { sig, lon });
      } catch (err) {
        find.errs.set(it.id, err);
      }
      if (my !== find.seq) return;
      find.done++;
      if (page === "home") renderHomeFind();
    }
  };
  await Promise.all([worker(), worker()]);
  if (my !== find.seq) return;
  find.running = false;
  findSave();
  if (page === "home") renderHomeFind();
}
$("#findGo").addEventListener("click", runFind);

function renderHomeFind() {
  const sec = $("#homeFind"), items = saved.items;
  sec.hidden = !items.length;
  if (!items.length) return;
  const missing = items.filter((it) => !findReady(it));
  const failed = missing.filter((it) => find.errs.has(it.id));
  // en el servidor propio de la app se calcula solo; en la versión pública, al apretar el botón
  if (missing.length && !find.running && !failed.length && !isPublic()) { runFind(); return; }
  $("#homeFindNote").textContent = "Elegí un planeta (o el Ascendente o el Medio Cielo) y un signo, y salen las cartas guardadas que lo tienen." +
    (isPublic() ? " Las posiciones se calculan una vez con los datos de nacimiento de tus cartas, que se envían al servidor solo para eso y no se guardan; quedan en este navegador." : "");
  const go = $("#findGo");
  go.hidden = find.running || !missing.length;
  go.textContent = failed.length ? "Reintentar" : `Calcular posiciones (${missing.length} ${missing.length === 1 ? "carta" : "cartas"})`;
  $("#findProg").textContent = find.running ? `Calculando posiciones: ${find.done} de ${find.total}` : "";

  const out = $("#findOut"), nodes = [];
  const have = items.filter(findReady);
  const el = (tag, props = {}) => Object.assign(document.createElement(tag), props);
  const sign = find.sign === "all" ? -1 : +find.sign;
  const bodies = find.body === "any" ? TRIP_PLANETS : [find.body];
  const what = find.body === "any" ? "algún planeta" : FIND_ART[find.body] || BODY[find.body].name;
  const title = find.body === "any" ? "Algún planeta" : BODY[find.body].name;
  const hits = (it) => bodies.map((id) => ({ id, lon: find.pos.get(it.id).lon[id] })).filter((p) => sign < 0 || split(p.lon).sign === sign);
  const chip = (it, ps, withGlyph) => {
    const b = el("button", { type: "button", className: "home-chip find-hit", title: `Abrir la carta de ${it.name}` });
    b.append(el("span", { className: "find-nm", textContent: it.name }));
    for (const p of ps) {
      const s = el("span", { className: "find-pos" });
      if (withGlyph) s.innerHTML = mark(p.id) + " ";
      s.append(document.createTextNode(degTxt(p.lon)));
      b.append(s);
    }
    b.addEventListener("click", () => openSaved(it));
    return b;
  };
  if (have.length) {
    if (find.body === "any" && sign < 0) {
      nodes.push(el("p", { className: "find-hint", textContent: "Elegí un signo para ver qué cartas tienen algún planeta ahí." }));
    } else if (sign < 0) {                          // un planeta en todos los signos: las cartas agrupadas por signo
      nodes.push(el("p", { className: "find-sum", textContent: `${title} de ${have.length} ${have.length === 1 ? "carta" : "cartas"}, por signo.` }));
      for (let k = 0; k < 12; k++) {
        const g = have.map((it) => [it, hits(it).filter((p) => split(p.lon).sign === k)]).filter(([, ps]) => ps.length);
        if (!g.length) continue;
        const grp = el("div", { className: "find-grp" });
        const h = el("h4");
        h.innerHTML = `<span class="g" aria-hidden="true">${signHTML(k)}</span> `;
        h.append(document.createTextNode(`${SIGNS[k]} `), el("span", { className: "find-n", textContent: String(g.length) }));
        grp.append(h, Object.assign(el("div", { className: "home-chips" }), {}));
        grp.lastChild.append(...g.map(([it, ps]) => chip(it, ps, false)));
        nodes.push(grp);
      }
    } else {
      const g = have.map((it) => [it, hits(it)]).filter(([, ps]) => ps.length);
      if (g.length) {
        nodes.push(el("p", { className: "find-sum" }));
        nodes[0].append(el("strong", { textContent: `${title} en ${SIGNS[sign]}` }), document.createTextNode(` · ${g.length} de ${have.length} ${have.length === 1 ? "carta" : "cartas"}`));
        const row = el("div", { className: "home-chips" });
        row.append(...g.map(([it, ps]) => chip(it, ps, find.body === "any")));
        nodes.push(row);
      } else {
        nodes.push(el("p", { className: "find-none", textContent: have.length === 1 ? `Tu carta no tiene ${what} en ${SIGNS[sign]}.` : `Ninguna de tus ${have.length} cartas tiene ${what} en ${SIGNS[sign]}.` }));
      }
    }
  }
  if (failed.length && !find.running) {
    nodes.push(el("p", { className: "find-err", textContent: `No se pudo calcular la posición de ${failed.map((it) => it.name).join(", ")}${[...find.errs.values()].some((e) => e instanceof TypeError) ? ": no hay conexión con el servidor" : ""}.` }));
  } else if (have.length && have.length < items.length && !find.running && missing.length) {
    nodes.push(el("p", { className: "find-hint", textContent: `Faltan ${missing.length} ${missing.length === 1 ? "carta" : "cartas"} por calcular; se buscó en las otras.` }));
  }
  out.replaceChildren(...nodes);
}

/** «Abrir en Tránsitos»: la carta, en el modo de tránsitos y en este momento. */
async function openSavedInTransit(item) {
  if (mode !== "transit") { mode = "transit"; rememberView(); paintMode(); }
  setNow();
  await openSaved(item);
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

// ---------- arranque ------------------------------------------------------
async function init() {
  await config();
  setupBackup();
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
