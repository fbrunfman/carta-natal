import { SIGNS, signHTML, BODY, ASPECT, split, fmtPos, fmtOrb, orbCode, mark, glyphHTML, badge, esc, setClassic, setCuspRing } from "./astro-data.js";
import { renderWheel } from "./wheel.js";
import { stairHTML, ORB_LEGEND, STAIR_HINT } from "./stair.js";
import { elementsHTML } from "./elements.js";
import { createSaved } from "./saved.js";
import { charts, compute, config, isPublic } from "./api.js";
import { setupPrint } from "./print.js";
import { initSettings, load as loadSettings, ORB_DEFAULTS, ORBS_VERSION, sameOrbs, FONTS, FONT_FAMILY, FONT_NOTE, NOTE_FONT_FAMILY } from "./settings.js";
import { fontPicker } from "./fontpick.js";
import { initPlanetDialog } from "./planet-dialog.js";
import { initAspectDialog } from "./aspect-dialog.js";
import { profection, profectionHTML, featuredHTML, featuredRowsHTML, upcomingHTML, SOON_PERIODS } from "./summary.js";
import { moonCornerHTML, moonLinesHTML, moonIcon, phasesHTML, calendarHTML, monthTitle, todayIn } from "./moon.js";
import { layoutSky, planetHTML, skyInfoHTML, skyShellHTML } from "./sky.js";
import { pickPoem, poemHTML } from "./poems.js";
import { showCombine, refreshCombine } from "./combinar.js";
import { keyPl, keyAsp, keyHouse, parseKey, snapOf, changeOf, aspectBetween, noteCount, cleanNotes, touches, refExists, detectRefs, newId, REF_MAX, toSymbols } from "./notes.js";
import { computeTrips, groupTrips, groupWords, tripNotation, tripWords, tripPlain, TRIP_TYPES, TRIP_TITLES, TRIP_PLANETS, roman } from "./trips.js";

const $ = (s) => document.querySelector(s);
const form = $("#form");
const STORE = "carta:last";
const VIEW = "carta:view";

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
let curCfg = null;         // la configuración de ahora (settings.js), para los resúmenes del panel
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
  where: $("#savedWhere"),
  onOpen: openSaved,
  onChange: () => { syncPartners(); syncActions(); paintTitlePick(); paintNavChart(); if (page === "home") renderHomeCharts(); },
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
  flushNotes();
  closeNote(false);
  lightNote(null);
  showChart();
  closeForm(false);
  saved.setActive(item.id);
  fillForm(item);
  note("");
  syncSaveButtons();
  await calculate();
}

// -- cambiar de carta: la lupa al lado del nombre (o el buscador de la barra de arriba) abre la lista de las guardadas, con buscador
const cpick = $("#cpick"), cpickQ = $("#cpickQ"), cpickList = $("#cpickList");
let cpickBtn = $("#titlePick");
const dmy = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || "") ? d.split("-").reverse().join("/") : "");
function paintTitlePick() {                                  // (se llama también desde onChange de las guardadas: sin las constantes de acá)
  const b = $("#titlePick");
  b.hidden = false;                                           // aunque no haya guardadas: ahí está «Nueva carta»
  paintFind();
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
  if (!items.length) cpickList.append(Object.assign(document.createElement("li"), { className: "cpick-none", textContent: saved.items.length ? "Ninguna carta con ese nombre." : "Todavía no guardaste ninguna carta." }));
  cpickQ.hidden = !saved.items.length;
}
function openCpick(btn = $("#titlePick")) {
  if (!cpick.hidden) closeCpick(false);
  cpickBtn = btn;
  cpickQ.value = "";
  fillCpick();
  cpick.hidden = false;
  const r = btn.getBoundingClientRect(), w = cpick.offsetWidth;                // debajo del botón, sin salirse de la pantalla
  cpick.style.left = `${Math.round(Math.max(8, Math.min(r.left - 6, innerWidth - w - 8)))}px`;
  cpick.style.top = `${Math.round(r.bottom + 6)}px`;
  cpickBtn.setAttribute("aria-expanded", "true");
  (matchMedia("(pointer: coarse)").matches ? cpickList.querySelector("[aria-current]") || cpickList.querySelector("button") : cpickQ)?.focus({ preventScroll: true });
}
function closeCpick(focusBtn = true) {
  if (cpick.hidden) return;
  cpick.hidden = true;
  cpickBtn.setAttribute("aria-expanded", "false");
  if (focusBtn) cpickBtn.focus({ preventScroll: true });
}
for (const b of [$("#titlePick"), $("#tbFind")]) b.addEventListener("click", () => (cpick.hidden || cpickBtn !== b ? openCpick(b) : closeCpick()));
addEventListener("resize", () => closeCpick(false));
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
/** El buscador de la barra de arriba: con cartas guardadas, fuera de la carta (en la carta está la lupa al lado del nombre). */
function paintFind() {
  $("#tbFind").hidden = !saved.items.length || page === "chart";
}

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
  $("#cinfoText").replaceChildren(...parts.filter(([, t]) => t).map(([cls, t]) => Object.assign(document.createElement("p"), { className: cls, textContent: t })));
  $("#edit").hidden = !hasChart();
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
  } catch (err) {
    note(err.message, true);
  } finally {
    saving = false;
    syncSaveButtons();
  }
}

$("#saveAs").addEventListener("click", () => persist(true));

// ---------- el formulario: una ventana en el centro, con «Nueva carta» o «Editar los datos» ----------------
// Al cerrarla con la ✕ (o Esc) todo vuelve a como estaba; al calcular, lo que se ve pasa a ser el nuevo punto de partida.
const formDlg = $("#formDlg");
let editing = null;                     // { values, active } de antes de abrir; null con el formulario cerrado
let formBack = null;                    // a dónde vuelve el foco al cerrar
const formOpen = () => formDlg.open;
const hasChart = () => !!birth;

/** Lo que depende de si hay cartas guardadas. */
function syncActions() {
  const none = saved.items.length === 0;
  if (none) root.dataset.nocharts = ""; else delete root.dataset.nocharts;
  $("#edit").hidden = !hasChart();
}

/** kind: "new" (en blanco) o "edit" (los datos de la carta que se está viendo). */
function openForm(kind) {
  if (!formOpen()) { editing = { values: readForm(), active: saved.activeId }; formBack = document.activeElement; }
  closeCpick(false);
  closeCinfo(false);
  closeCfg(false);
  if (kind === "new") {
    saved.setActive(null);
    fillForm(BLANK);
  }
  note("");
  syncSaveButtons();
  $("#formTitle").textContent = kind === "new" ? "Nueva carta" : saved.activeId ? "Editar carta" : "Carta sin guardar";
  delArmChart(false);
  $("#formDel").hidden = !saved.activeId;
  if (!formDlg.open) formDlg.showModal();
  syncActions();
  form.elements.name.focus({ preventScroll: true });
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
  if (formDlg.open) formDlg.close();
  syncActions();
  if (formBack?.isConnected && formBack.offsetParent !== null) formBack.focus({ preventScroll: true });
  formBack = null;
}

/** El primer paso: con una carta ya a la vista (sin guardar) se guarda esa; si no, una en blanco. */
const createFirst = () => openForm(hasChart() ? "edit" : "new");

$("#edit").addEventListener("click", () => openForm("edit"));
$("#introNew").addEventListener("click", createFirst);
$("#formClose").addEventListener("click", () => closeForm(true));
formDlg.addEventListener("cancel", (e) => { e.preventDefault(); closeForm(true); });          // Esc: como la ✕
// eliminar la carta abierta: dos toques (el primero pide confirmar); después se vuelve al inicio
let delChartTimer = 0;
function delArmChart(on) {
  const b = $("#formDel");
  clearTimeout(delChartTimer);
  b.dataset.arm = on ? "1" : "";
  b.textContent = on ? "¿Eliminar? Tocá de nuevo" : "Eliminar esta carta";
  if (on) delChartTimer = setTimeout(() => delArmChart(false), 6000);      // con el dedo hace falta tiempo para el segundo toque
}
$("#formDel").addEventListener("click", async () => {
  const id = saved.activeId;
  if (!id) return;
  if ($("#formDel").dataset.arm !== "1") { delArmChart(true); return; }
  delArmChart(false);
  try {
    await saved.remove(id);
  } catch (err) { note(err.message, true); return; }
  editing = null;
  if (formDlg.open) formDlg.close();
  fillForm(BLANK);
  chart = null; birth = null;
  chartStarted = false;
  $("#stage").hidden = true;
  syncSaveButtons();
  syncActions();
  go("#inicio");
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
$("#tNow").addEventListener("click", () => { setNow(); loadSoon(); paintPill(); });
for (const el of [tDate, tTime, tTz]) el.addEventListener("change", () => { loadSoon(); paintPill(); });
$("#tStep").addEventListener("change", paintPill);

// -- celular, en Tránsitos: los controles de la fecha no ocupan lugar arriba de la rueda. Una pastilla flotante muestra
// la fecha y la hora, con ‹ › para mover el paso elegido; al tocar la fecha sube una hoja con todos los controles.
const PILL_MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function paintPill() {
  const d = tDate.value, t = tTime.value;
  const [y, m, dd] = (d || "").split("-").map(Number);
  $("#tpWhen").textContent = d && m ? `${dd} ${PILL_MES[m - 1]} ${y} · ${t || "--:--"}` : "Elegir fecha";
  const st = $("#tStep");
  $("#tpBy").textContent = `de a ${st.options[st.selectedIndex]?.text || ""}`;
  $("#tpPrev").setAttribute("aria-label", `Retroceder ${st.options[st.selectedIndex]?.text || ""}`);
  $("#tpNext").setAttribute("aria-label", `Avanzar ${st.options[st.selectedIndex]?.text || ""}`);
}
function setTsheet(open, focusBtn = false) {
  document.documentElement.toggleAttribute("data-tsheet", open);
  $("#tpOpen").setAttribute("aria-expanded", String(open));
  if (open) { setFab(false); hideFicha(); $("#tsheetX").focus({ preventScroll: true }); }      // (no al campo de la fecha: en el celular abriría el teclado)
  else if (focusBtn) $("#tpOpen").focus({ preventScroll: true });
}
$("#tpOpen").addEventListener("click", () => setTsheet(!document.documentElement.hasAttribute("data-tsheet")));
$("#tsheetX").addEventListener("click", () => setTsheet(false, true));
$("#tpPrev").addEventListener("click", () => { stepTransit(-1); paintPill(); });
$("#tpNext").addEventListener("click", () => { stepTransit(1); paintPill(); });
document.addEventListener("pointerdown", (e) => {
  if (document.documentElement.hasAttribute("data-tsheet") && !$("#toolsTransit").contains(e.target) && !$("#tpill").contains(e.target)) setTsheet(false);
}, true);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.documentElement.hasAttribute("data-tsheet")) { e.preventDefault(); setTsheet(false, true); }
});

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
  $("#notesBtn").hidden = true;
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
  const par = pop.offsetParent?.getBoundingClientRect() || { left: 0 };     // que no se salga de la ventana (con la barra de arriba, puede pasar a la izquierda de los botones)
  const min = 8 - par.left, max = document.documentElement.clientWidth - 8 - par.left - pop.offsetWidth;
  pop.style.left = `${Math.round(Math.max(min, Math.min(btn.offsetLeft + btn.offsetWidth - pop.offsetWidth, max)))}px`;
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
  if (typeof paintNoteMarks === "function") { paintNoteMarks(); paintLit(); }
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
  paintMerge();
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
/**
 * Escritorio ancho, en la carta: el nombre (con la lupa y la info), los modos y los botones de la carta van en la barra de
 * arriba (style.css, data-tbmerge). El nombre empieza después del botón de las secciones y termina antes de los modos.
 */
function paintMerge() {
  const on = page === "chart" && deskWide.matches && innerWidth >= 900 && !$("#stage").hidden;
  root.toggleAttribute("data-tbmerge", on);
  if (!on) return;
  const l = $("#appMenuBtn").getBoundingClientRect().right + 14;
  const r = innerWidth - $("#theme").getBoundingClientRect().left + 12;
  root.style.setProperty("--tb-l", `${Math.round(l)}px`);
  root.style.setProperty("--tb-r", `${Math.round(r)}px`);
  root.style.setProperty("--tb-mb", `${Math.round($("#chartPage > .modebar").offsetWidth)}px`);
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
  $("#notesBtn").hidden = mode !== "natal";
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

  if (!notesOn()) closeNote(false);
  else restoreNotes();
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
  renderNotes();
  applyTabs();
  paintNoteMarks();
}

function renderPositions(c) {
  const reach = spillOn && mode === "natal" ? new Map(reachData().map((r) => [r.id, r])) : new Map();
  const notes = notesOn();
  const row = (id, lon, house, retro) => {
    const s = split(lon);
    return `<tr data-id="${id}">
      <td>${mark(id)}${BODY[id].name}</td>
      <td><span class="g">${signHTML(s.sign)}</span>${SIGNS[s.sign]}</td>
      <td class="num">${fmtPos(lon)}${retro ? '<span class="rx-t" title="Retrógrado">R</span>' : ""}</td>
      <td class="num">${house}${reachChip(reach.get(id))}</td>${notes ? `<td class="ncell">${noteBtn(id === "asc" || id === "mc" ? id : keyPl(id), BODY[id].name)}</td>` : ""}</tr>`;
  };
  let html = `<table><thead><tr><th>Cuerpo</th><th>Signo</th><th class="num">Posición</th><th class="num">Casa</th>${notes ? '<th class="ncell"><span class="sr">Nota</span></th>' : ""}</tr></thead><tbody>`;
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
  const notes = mode === "natal" && notesOn();
  let html = `<table><thead><tr><th>Casa</th><th>Cúspide</th><th class="num">Posición</th><th>Contiene</th>${notes ? '<th class="ncell"><span class="sr">Nota</span></th>' : ""}</tr></thead><tbody>`;
  c.houses.cusps.forEach((lon, i) => {
    const s = split(lon);
    const inside = c.bodies.filter((b) => b.house === i + 1 && !passed.has(b.id))
      .map((b) => `<span class="g" title="${BODY[b.id].name}">${glyphHTML(b.id)}</span>`).join("") +
      // los que vienen de la casa anterior («Entre casas»): con borde macizo si cuentan solo acá, punteado si cuentan en las dos
      reach.filter((r) => r.also === i + 1)
        .map((r) => `<span class="g also ${r.kind}" title="${reachTip(r)}">${glyphHTML(r.id)}</span>`).join("");
    html += `<tr><td class="num" style="text-align:left">${i + 1}</td>
      <td><span class="g">${signHTML(s.sign)}</span>${SIGNS[s.sign]}</td>
      <td class="num">${fmtPos(lon)}</td><td class="contains">${inside}</td>${notes ? `<td class="ncell">${noteBtn(keyHouse(i + 1), `casa ${i + 1}`)}</td>` : ""}</tr>`;
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
  const notes = !cross && notesOn();
  let html = `<table><thead><tr><th>${heads}</th><th></th><th class="num">Orbe</th>${phaseCol ? "<th>Fase</th>" : ""}${notes ? '<th class="ncell"><span class="sr">Nota</span></th>' : ""}</tr></thead><tbody>`;
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
      ${phaseCol ? `<td class="small muted">${phase}</td>` : ""}${notes ? `<td class="ncell">${noteBtn(keyAsp(a.a, a.b), `${bodyName(a.a)} ${A.name.toLowerCase()} ${bodyName(a.b)}`)}</td>` : ""}</tr>`;
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


// ---------- notas de la carta natal ------------------------------------------
// Cada carta guardada tiene una lista de notas. Una nota es un texto libre con sus vínculos: planetas (en su casa y su
// signo), casas, el Ascendente, el Medio Cielo y aspectos que tiene la carta. Mientras se escribe, la app lee el texto y
// propone vínculos («Sol en I en Aries» → el Sol; «cuadratura con la Luna» → Sol □ Luna); también se vinculan a mano.
// Al abrir una nota, la rueda ilumina lo que vincula; lo que tiene notas lleva un puntito. La pestaña «Notas» las junta
// (con un filtro por planeta, casa, ángulo o aspecto) y el botón de nota de las tablas y la ficha del planeta muestran las
// que nombran a ese elemento o empiezan una nueva ya vinculada. Viven con la carta guardada y se guardan solas.
const NOTE_IC = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h10l4 4V19.5H5Z"/><path d="M15 4.5v4h4"/><path d="M8.5 12.5h7M8.5 16h5"/></svg>`;
const X_IC = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>`;
const notesOn = () => mode === "natal" && !!chart && !!saved.activeId && !!saved.find(saved.activeId);
let notesPending = null, notesTimer = 0;
const normCache = new WeakMap();
/** Las notas de la carta abierta, como lista (con lo que se está escribiendo y todavía no se guardó). */
function notesNow() {
  const id = saved.activeId;
  if (!id) return [];
  if (notesPending?.id === id) return notesPending.notes;
  const raw = saved.find(id)?.notes;
  if (!raw || typeof raw !== "object") return [];
  if (!normCache.has(raw)) normCache.set(raw, cleanNotes(raw));      // (las de antes, una por cosa, pasan a la lista)
  return normCache.get(raw);
}
const noteById = (nid) => notesNow().find((n) => n.id === nid) || null;
const touching = (key) => notesNow().filter((n) => touches(n, key, chart));
const isoNow = () => new Date().toISOString().replace(/\.\d+Z$/, "Z");
const visAsp = () => vis(chart.aspects);
/** Guarda (en un rato) la lista de notas con esta nota como está ahora: sin texto, no queda. */
function putNote(note) {
  const id = saved.activeId;
  if (!id || !chart) return;
  const list = notesNow().filter((n) => n.id !== note.id);
  if (note.text.trim()) {
    const i = notesNow().findIndex((n) => n.id === note.id);
    const copy = { ...note, refs: [...note.refs], snap: { ...note.snap } };
    if (i < 0) list.push(copy); else list.splice(i, 0, copy);
  }
  notesPending = { id, notes: list };
  paintNoteMarks();
}
// Si no se pudo guardar (por ejemplo, el servidor de la Mac es de una versión anterior), las notas quedan de respaldo en
// este navegador y se vuelven a guardar al abrir la carta: cerrar la ventana no las pierde.
const NOTES_BAK = "carta:notes-pending";
const bakGet = () => { try { return JSON.parse(localStorage.getItem(NOTES_BAK) || "null"); } catch { return null; } };
const bakSet = (v) => { try { if (v) localStorage.setItem(NOTES_BAK, JSON.stringify(v)); else localStorage.removeItem(NOTES_BAK); } catch { /* sin almacenamiento */ } };
/** Al abrir una carta: si quedaron notas sin guardar de esa carta, se retoman y se guardan. */
function restoreNotes() {
  const b = bakGet(), id = saved.activeId;
  if (!b || !id || b.id !== id || notesPending || !saved.find(id)) return;
  notesPending = { id, notes: cleanNotes(b.notes) };
  flushNotes();
}
async function flushNotes() {
  clearTimeout(notesTimer);
  const p = notesPending;
  if (!p) return;
  try {
    await saved.setNotes(p.id, p.notes);
    if (notesPending === p) notesPending = null;
    if (bakGet()?.id === p.id) bakSet(null);
    noteStatus(`Guardado · ${new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })}`);
  } catch (err) {
    bakSet({ id: p.id, notes: p.notes });
    noteStatus(`No se pudo guardar: ${err.message}${/[.!?]$/.test(err.message) ? "" : "."}`, true);
  }
  if (page === "chart" && mode === "natal" && !$("#panel-notas").hidden) renderNotes();
}
addEventListener("pagehide", flushNotes);
document.addEventListener("visibilitychange", () => { if (document.hidden) flushNotes(); });
function noteStatus(text, err = false) {
  const el = $("#noteEdStatus");
  el.textContent = text;
  el.classList.toggle("err", err);
}

const bodyName = (id) => BODY[id]?.name || id;
const gl = (id) => `<span class="g" aria-hidden="true">${glyphHTML(id) || BODY[id]?.tag || ""}</span>`;
const sgl = (i) => `<span class="g" aria-hidden="true">${signHTML(i)}</span>`;
const signOfLon = (lon) => split(lon).sign;
const ASP_WORD = Object.fromEntries(Object.entries(ASPECT).map(([k, v]) => [k, v.name.toLowerCase()]));
/** Un vínculo en palabras (para las listas, el filtro y los lectores de pantalla). */
function refText(key) {
  const k = parseKey(key);
  if (!k || !chart) return key;
  if (k.kind === "angle") return `${bodyName(key)} en ${SIGNS[signOfLon(chart.angles[key])]}`;
  if (k.kind === "house") return `Casa ${roman(k.n)} (cúspide en ${SIGNS[signOfLon(chart.houses.cusps[k.n - 1])]})`;
  if (k.kind === "pl") {
    const b = chart.bodies.find((x) => x.id === k.ids[0]);
    return b ? `${bodyName(b.id)} en casa ${roman(b.house)}, ${SIGNS[signOfLon(b.lon)]}` : bodyName(k.ids[0]);
  }
  const x = aspectBetween(visAsp(), ...k.ids);
  return x ? `${bodyName(x.a)} ${ASP_WORD[x.type]} ${bodyName(x.b)}` : `${bodyName(k.ids[0])} y ${bodyName(k.ids[1])}`;
}
/** De qué es una nota nueva: «el Sol», «la casa IV», «el Ascendente», «Sol cuadratura Luna». */
function refAbout(key) {
  const k = parseKey(key);
  if (!k) return key;
  if (k.kind === "angle") return key === "asc" ? "el Ascendente" : "el Medio Cielo";
  if (k.kind === "house") return `la casa ${roman(k.n)}`;
  if (k.kind === "pl") return bodyName(k.ids[0]);
  return refText(key);
}
/** Un vínculo, corto, en HTML (con los símbolos): lo que va en cada chip. */
function refHTML(key) {
  const k = parseKey(key);
  if (!k || !chart) return esc(key);
  if (k.kind === "angle") return `${BODY[key].tag} ${sgl(signOfLon(chart.angles[key]))}`;
  if (k.kind === "house") return `Casa ${roman(k.n)}`;
  if (k.kind === "pl") {
    const b = chart.bodies.find((x) => x.id === k.ids[0]);
    return b ? `${gl(b.id)} en ${roman(b.house)} · ${sgl(signOfLon(b.lon))}` : gl(k.ids[0]);
  }
  const x = aspectBetween(visAsp(), ...k.ids);
  if (!x) return `${gl(k.ids[0])} ${gl(k.ids[1])}`;
  const A = ASPECT[x.type];
  return `${gl(x.a)}<span class="a-ic ${A.cls}" aria-hidden="true">${A.icon}</span>${gl(x.b)}`;
}
/** Qué tiene de distinto la carta desde que se vinculó (o "" si nada). */
function refChange(key, snap) {
  const c = changeOf(key, snap, chart, visAsp());
  if (!c) return "";
  const k = parseKey(key), w = c.was;
  if (k.kind === "asp") return c.now.type ? `Se vinculó cuando era ${ASP_WORD[w.type] || "otro aspecto"}.` : "Se vinculó cuando formaban aspecto; con los datos de ahora, no.";
  const parts = [];
  if ("sign" in w && w.sign !== c.now.sign) parts.push(`en ${SIGNS[w.sign]}`);
  if ("house" in w && w.house !== c.now.house) parts.push(`en la casa ${roman(w.house)}`);
  return `Se vinculó cuando estaba ${parts.join(" y ")} (después cambiaron los datos de la carta).`;
}
const noteWhen = (at) => {
  const d = new Date(at);
  if (Number.isNaN(+d)) return "";
  const today = new Date();
  return d.toDateString() === today.toDateString() ? "hoy" : d.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" }).replace(".", "");
};
const REF_ORDER = ["asc", "mc", "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "node"];
function refSort(a, b) {
  const rank = (key) => {
    const k = parseKey(key);
    if (!k) return [9, 0, 0];
    if (k.kind === "angle") return [0, REF_ORDER.indexOf(key), 0];
    if (k.kind === "pl") return [1, REF_ORDER.indexOf(k.ids[0]), 0];
    if (k.kind === "house") return [2, k.n, 0];
    return [3, Math.min(...k.ids.map((i) => REF_ORDER.indexOf(i))), Math.max(...k.ids.map((i) => REF_ORDER.indexOf(i)))];
  };
  const x = rank(a), y = rank(b);
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}
const DETECT_NAMES = { signs: SIGNS, aspects: ASP_WORD };

// -- iluminar en la rueda lo que vincula una nota
let litId = null;          // la nota iluminada (abierta en el editor, o «Ver en la carta» en el celular)
function litSel(note) {
  const sel = { bodies: [], pairs: [], houses: [], angles: [] };
  for (const r of note?.refs || []) {
    const k = parseKey(r);
    if (!k || !refExists(r, chart, visAsp())) continue;
    if (k.kind === "pl") sel.bodies.push(k.ids[0]);
    else if (k.kind === "asp") sel.pairs.push(k.ids);
    else if (k.kind === "house") sel.houses.push(k.n);
    else sel.angles.push(r);
  }
  return sel;
}
function paintLit() {
  if (!wheel?.note) return;
  const n = litId && notesOn() ? (edNote?.id === litId ? edNote : noteById(litId)) : null;
  wheel.note(n && n.refs.length ? litSel(n) : null);
  for (const c of document.querySelectorAll("#noteList .ncard")) c.classList.toggle("lit", c.dataset.nid === n?.id);
  const bar = $("#noteLit");
  const show = !!n && !!litBar;
  bar.hidden = !show;
  if (show) $("#noteLitText").textContent = n.text.trim().replace(/\s+/g, " ");
}
let litBar = false;        // celular: el cartelito de arriba de la barra (la nota iluminada, con «Editar» y la ×)
function lightNote(nid, bar = false) {
  litId = nid; litBar = !!nid && bar;
  paintLit();
}

// -- el editor: una ventana en el centro (en el celular también), con «Guardar». No se guarda solo: si se cierra con
// cambios, pregunta si guardarlos o descartarlos.
let edNote = null, edOrig = "", edAnchor = null, edSugTimer = 0;
const edState = (n) => JSON.stringify([n.text, n.refs]);
const edDirty = () => !!edNote && edState(edNote) !== edOrig;
function openNote(nid, anchor, preRefs = []) {
  if (!notesOn()) return;
  closePop();
  closeLinkMenu();
  setFab?.(false);
  hideFicha();
  closeView?.();
  wheel?.clear();                                    // (suelta lo tocado con el dedo: la rueda pasa a mostrar la nota)
  const n = nid ? noteById(nid) : null;
  edNote = n ? { ...n, refs: [...n.refs], snap: { ...n.snap } } : { id: newId(), text: "", at: isoNow(), refs: [], snap: {} };
  edOrig = edState(edNote);
  for (const r of preRefs) addRef(r);
  edAnchor = anchor || null;
  $("#noteEdTitle").textContent = n ? `Nota · ${noteWhen(n.at)}` : "Nota nueva";
  $("#noteEdText").value = edNote.text;
  symUndo = null; paintSym();
  setPal(false);
  askClose(false);
  delArm(false);
  $("#noteEdDel").hidden = !n;
  noteStatus("");
  paintEditor();
  const ed = $("#noteEd");
  if (!ed.open) ed.showModal();
  placeNoteEd();
  lightNote(edNote.id, litBar && litId === edNote.id);
  $("#noteEdText").focus({ preventScroll: true });
}
/** En el centro de lo que se ve (en el celular, con el teclado abierto, en el centro de lo que queda arriba del teclado). */
function placeNoteEd() {
  const ed = $("#noteEd");
  if (!ed.open) return;
  const vv = window.visualViewport;
  const H = vv ? vv.height : innerHeight, top0 = vv ? vv.offsetTop : 0;
  ed.style.maxHeight = `${Math.floor(H - 16)}px`;
  const h = ed.offsetHeight;
  ed.style.top = `${Math.round(top0 + Math.max(8, (H - h) / 2))}px`;
}
window.visualViewport?.addEventListener("resize", placeNoteEd);
window.visualViewport?.addEventListener("scroll", placeNoteEd);
function paintSave() {
  const dirty = edDirty(), empty = !edNote?.text.trim();
  $("#noteEdSave").disabled = !dirty || empty;
  if (!$("#noteEdStatus").classList.contains("err")) {
    $("#noteEdStatus").textContent = dirty ? (empty ? "Escribí algo para poder guardar." : "Sin guardar") : "";
  }
}
/** Guarda la nota abierta; si se pudo, cierra el editor. */
async function saveNote() {
  if (!edNote || !edNote.text.trim()) return false;
  edNote.at = isoNow();
  putNote(edNote);
  noteStatus("Guardando…");
  await flushNotes();
  if (notesPending) return false;                    // no se pudo: el error queda a la vista (y las notas, de respaldo)
  edOrig = edState(edNote);
  closeNote(true, true);
  return true;
}
/** Cerrar: si hay cambios sin guardar, primero pregunta. */
function closeNote(focusBack = true, force = false) {
  const ed = $("#noteEd");
  if (!ed.open) return;
  if (!force && edDirty() && edNote.text.trim()) { askClose(true); return; }
  askClose(false);
  ed.close();
  closeLinkMenu();
  clearTimeout(edSugTimer);
  const a = edAnchor, wasLit = litBar;
  edNote = edAnchor = null;
  if (!wasLit) lightNote(null); else paintLit();
  if (focusBack && a?.isConnected) a.focus({ preventScroll: true });
}
function askClose(on) {
  $("#noteEdAsk").hidden = !on;
  if (on) $("#noteAskSave").focus({ preventScroll: true });
  placeNoteEd();
}
let delTimer = 0;
function delArm(on) {
  const b = $("#noteEdDel");
  clearTimeout(delTimer);
  b.dataset.arm = on ? "1" : "";
  b.textContent = on ? "¿Borrar? Tocá de nuevo" : "Borrar nota";
  if (on) delTimer = setTimeout(() => delArm(false), 4000);
}
function addRef(key, paint = true) {
  if (!edNote || edNote.refs.includes(key) || edNote.refs.length >= REF_MAX || !refExists(key, chart, visAsp())) return;
  edNote.refs.push(key);
  const s = snapOf(key, chart, visAsp());
  if (Object.keys(s).length) edNote.snap[key] = s;
  if (paint && $("#noteEd").open) { paintEditor(); paintLit(); }
}
function dropRef(key) {
  if (!edNote) return;
  edNote.refs = edNote.refs.filter((r) => r !== key);
  delete edNote.snap[key];
  paintEditor(); paintLit();
}
const chipHTML = (key, cls, extra = "") => `<span class="nchip ${cls}" data-ref="${esc(key)}"${extra}>${refHTML(key)}</span>`;
/** Los vínculos de la nota abierta, los sugeridos por el texto y el aviso si algo cambió. */
function paintEditor() {
  if (!edNote) return;
  const refs = [...edNote.refs];
  $("#noteRefs").innerHTML = refs.length
    ? refs.map((r) => {
      const w = refChange(r, edNote.snap[r]);
      return `<span class="nchip on${w ? " warn" : ""}" data-ref="${esc(r)}"${w ? ` title="${esc(w)}"` : ""}>${refHTML(r)}` +
        `<button type="button" class="nchip-x" data-drop="${esc(r)}" aria-label="Quitar el vínculo: ${esc(refText(r))}">${X_IC}</button></span>`;
    }).join("")
    : `<span class="nrefs-none">Sin vínculos: es sobre la carta en general.</span>`;
  const warns = refs.map((r) => refChange(r, edNote.snap[r])).filter(Boolean);
  $("#noteEdWarn").hidden = !warns.length;
  $("#noteEdWarn").textContent = warns.length ? `Algo cambió desde que se vinculó: ${warns.join(" ")}` : "";
  const sugs = detectRefs(edNote.text, chart, visAsp(), DETECT_NAMES).filter((s) => !refs.includes(s.key));
  $("#noteSugRow").hidden = !sugs.length;
  $("#noteSugAll").hidden = sugs.length < 2;
  $("#noteSugs").innerHTML = sugs.map((s) => `<button type="button" class="nchip sug${s.warn ? " warn" : ""}" data-add="${esc(s.key)}" ` +
    `aria-label="Vincular: ${esc(refText(s.key))}${s.warn ? `. Ojo: ${esc(s.warn)}` : ""}"${s.warn ? ` title="Ojo: ${esc(s.warn)}"` : ""}>` +
    `<span class="nchip-plus" aria-hidden="true">+</span>${refHTML(s.key)}</button>`).join("");
  $("#noteLink").disabled = refs.length >= REF_MAX;
  paintSave();
  placeNoteEd();
}
// «Pasar a símbolos»: los nombres por sus símbolos y las casas en romanos (se puede deshacer, también con Cmd/Ctrl+Z)
let symUndo = null, symBusy = false;
function setNoteText(text) {
  const ta = $("#noteEdText");
  symBusy = true;
  ta.focus({ preventScroll: true });
  ta.select();
  // como si se escribiera: así el deshacer del navegador lo deshace
  if (!document.execCommand?.("insertText", false, text) || ta.value !== text) {
    ta.value = text;
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }
  ta.setSelectionRange(text.length, text.length);
  symBusy = false;
}
function paintSym() {
  const b = $("#noteSym");
  b.innerHTML = symUndo !== null ? "Deshacer los símbolos" : 'Pasar a símbolos <span aria-hidden="true">☉︎ ♈︎ □</span>';
}
// «Insertar símbolo»: una paleta de planetas, signos, aspectos y ángulos que escribe el símbolo donde está el cursor
// (por si «Pasar a símbolos» no reconoce una palabra, o para escribir directamente con símbolos)
const PAL_PLANETS = [["sun", "☉"], ["moon", "☽"], ["mercury", "☿"], ["venus", "♀"], ["mars", "♂"], ["jupiter", "♃"], ["saturn", "♄"], ["uranus", "♅"], ["neptune", "♆"], ["pluto", "⯓"], ["node", "☊"]];
const PAL_SIGNS = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];
const PAL_ASPECTS = [["conjunction", "☌"], ["opposition", "☍"], ["square", "□"], ["trine", "△"], ["sextile", "⚹"], ["quincunx", "⚻"], ["semisquare", "∠"], ["sesquiquadrate", "⚼"]];
const VS15 = "\uFE0E";
let palSel = null;          // dónde estaba el cursor al abrir la paleta (en el celular, tocarla saca el foco del texto)
function palHTML() {
  const b = (ch, label, inner) => `<button type="button" data-ins="${ch}" title="${esc(label)}" aria-label="${esc(label)}">${inner}</button>`;
  return `<div class="npal-row"><span>Planetas</span>${PAL_PLANETS.map(([id, ch]) => b(ch + VS15, bodyName(id), gl(id))).join("")}</div>` +
    `<div class="npal-row"><span>Signos</span>${PAL_SIGNS.map((ch, i) => b(ch + VS15, SIGNS[i], sgl(i))).join("")}</div>` +
    `<div class="npal-row"><span>Aspectos</span>${PAL_ASPECTS.map(([t, ch]) => b(ch, ASPECT[t].name, `<span class="a-ic ${ASPECT[t].cls}" aria-hidden="true">${ASPECT[t].icon}</span>`)).join("")}</div>` +
    `<div class="npal-row"><span>Ángulos</span>${b("Asc", "Ascendente", "Asc")}${b("MC", "Medio Cielo", "MC")}</div>`;
}
function setPal(open) {
  const p = $("#notePal");
  if (open && !p.innerHTML) p.innerHTML = palHTML();
  p.hidden = !open;
  $("#notePalBtn").setAttribute("aria-expanded", String(open));
  $("#notePalBtn").textContent = open ? "Cerrar símbolos" : "Insertar símbolo";
  if (open) { const ta = $("#noteEdText"); palSel = [ta.selectionStart, ta.selectionEnd]; }
  placeNoteEd();
}
$("#notePalBtn").addEventListener("click", () => setPal($("#notePal").hidden));
$("#notePal").addEventListener("pointerdown", (e) => { if (e.target.closest("[data-ins]")) e.preventDefault(); });     // con el mouse, el texto no pierde el foco
$("#notePal").addEventListener("click", (e) => {
  const b = e.target.closest("[data-ins]");
  if (!b || !edNote) return;
  const ta = $("#noteEdText");
  if (document.activeElement !== ta) { ta.focus({ preventScroll: true }); if (palSel) ta.setSelectionRange(...palSel); }
  const ins = b.dataset.ins;
  // como si se escribiera: así el deshacer del navegador lo deshace
  if (!document.execCommand?.("insertText", false, ins)) {
    ta.setRangeText(ins, ta.selectionStart, ta.selectionEnd, "end");
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }
  palSel = [ta.selectionStart, ta.selectionEnd];
});
$("#noteEdText").addEventListener("blur", (e) => { palSel = [e.target.selectionStart, e.target.selectionEnd]; });
$("#noteSym").addEventListener("click", () => {
  if (!edNote) return;
  if (symUndo !== null) { const t = symUndo; symUndo = null; setNoteText(t); paintSym(); return; }
  const before = $("#noteEdText").value, after = toSymbols(before);
  if (after === before) { noteStatus("No hay nombres de planetas, signos, aspectos ni casas para pasar."); return; }
  setNoteText(after);
  symUndo = before;
  paintSym();
});
$("#noteEdText").addEventListener("input", (e) => {
  if (!edNote) return;
  if (e.target.value.includes("♇")) {                // Plutón: siempre con su símbolo astrológico (⯓), no el «PL»
    const a = e.target.selectionStart, b = e.target.selectionEnd;
    e.target.value = e.target.value.replace(/♇/g, "⯓");
    e.target.setSelectionRange(a, b);
  }
  if (symUndo !== null && !symBusy) { symUndo = null; paintSym(); }
  edNote.text = e.target.value;
  $("#noteEdStatus").classList.remove("err");
  askClose(false);
  paintSave();
  clearTimeout(edSugTimer);
  edSugTimer = setTimeout(paintEditor, 250);         // las sugerencias, cuando se para de escribir un momento
  if (litBar) paintLit();
});
$("#noteEd").addEventListener("click", (e) => {
  const drop = e.target.closest("[data-drop]"), add = e.target.closest("[data-add]");
  if (drop) { dropRef(drop.dataset.drop); $("#noteEdText").focus({ preventScroll: true }); }
  else if (add) addRef(add.dataset.add);
  else if (e.target.closest("#noteSugAll")) {
    for (const b of [...$("#noteSugs").querySelectorAll("[data-add]")]) addRef(b.dataset.add, false);
    paintEditor(); paintLit();
  }
});
$("#noteEdX").addEventListener("click", () => closeNote());
$("#noteEdSave").addEventListener("click", saveNote);
$("#noteAskSave").addEventListener("click", saveNote);
$("#noteAskDrop").addEventListener("click", () => closeNote(true, true));
$("#noteAskBack").addEventListener("click", () => { askClose(false); $("#noteEdText").focus({ preventScroll: true }); });
$("#noteEd").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); saveNote(); }
});
$("#noteEd").addEventListener("cancel", (e) => {        // Esc: primero cierra un menú abierto; si hay cambios, pregunta
  e.preventDefault();
  if (!$("#noteLinkMenu").hidden) closeLinkMenu(true);
  else if (!$("#noteEdAsk").hidden) askClose(false);
  else closeNote();
});
$("#noteEd").addEventListener("click", (e) => { if (e.target === e.currentTarget) closeNote(); });      // el fondo
$("#noteEdDel").addEventListener("click", async () => {
  if (!edNote) return;
  if ($("#noteEdDel").dataset.arm !== "1") { delArm(true); return; }
  delArm(false);
  const id = edNote.id;
  putNote({ ...edNote, text: "" });
  await flushNotes();
  if (notesPending) return;
  if (litId === id) litBar = false;
  closeNote(true, true);
});
addEventListener("beforeunload", (e) => { if (edDirty() && edNote.text.trim()) e.preventDefault(); });

// «+ Vincular»: un planeta, una casa, el Ascendente, el Medio Cielo o un aspecto de los que tiene la carta
function linkMenuHTML(view) {
  const on = (key) => edNote?.refs.includes(key);
  const item = (key, html, sub = "") => `<button type="button" role="menuitemcheckbox" aria-checked="${on(key)}" class="nmi${on(key) ? " has" : ""}" data-pick="${esc(key)}">${html}${sub ? `<small>${sub}</small>` : ""}</button>`;
  const back = `<button type="button" role="menuitem" class="nmi nback" data-view="main">‹ Volver</button>`;
  const asp = visAsp();
  if (view === "pl") return back + chart.bodies.filter((b) => BODY[b.id]).sort((a, b) => REF_ORDER.indexOf(a.id) - REF_ORDER.indexOf(b.id))
    .map((b) => item(keyPl(b.id), `${gl(b.id)} ${bodyName(b.id)}`, `${SIGNS[signOfLon(b.lon)]} · casa ${roman(b.house)}`)).join("");
  if (view === "house") return back + chart.houses.cusps.map((lon, i) => {
    const inside = chart.bodies.filter((b) => b.house === i + 1).map((b) => bodyName(b.id)).join(", ");
    return item(keyHouse(i + 1), `Casa ${roman(i + 1)}`, `Cúspide en ${SIGNS[signOfLon(lon)]}${inside ? ` · ${inside}` : ""}`);
  }).join("");
  if (view === "asp") return back + [...asp].sort((a, b) => a.orb - b.orb).map((x) => item(keyAsp(x.a, x.b),
    `${gl(x.a)} <span class="a-ic ${ASPECT[x.type].cls}" aria-hidden="true">${ASPECT[x.type].icon}</span> ${gl(x.b)} ${bodyName(x.a)} ${ASP_WORD[x.type]} ${bodyName(x.b)}`, `orbe ${fmtOrb(x.orb)}`)).join("");
  return `<button type="button" role="menuitem" class="nmi" data-view="pl">Un planeta ›<small>En su casa y su signo</small></button>` +
    `<button type="button" role="menuitem" class="nmi" data-view="house">Una casa ›</button>` +
    item("asc", "Ascendente", SIGNS[signOfLon(chart.angles.asc)]) + item("mc", "Medio Cielo", SIGNS[signOfLon(chart.angles.mc)]) +
    `<button type="button" role="menuitem" class="nmi" data-view="asp"${asp.length ? "" : " disabled"}>Un aspecto ›<small>De los ${asp.length} que tiene la carta</small></button>`;
}
function openLinkMenu(view = "main") {
  const m = $("#noteLinkMenu");
  m.innerHTML = linkMenuHTML(view);
  m.hidden = false;
  $("#noteLink").setAttribute("aria-expanded", "true");
  m.querySelector("button:not([disabled])")?.focus({ preventScroll: true });
}
function closeLinkMenu(focusBtn = false) {
  const m = $("#noteLinkMenu");
  if (m.hidden) return;
  m.hidden = true;
  $("#noteLink").setAttribute("aria-expanded", "false");
  if (focusBtn) $("#noteLink").focus({ preventScroll: true });
}
$("#noteLink").addEventListener("click", () => ($("#noteLinkMenu").hidden ? openLinkMenu() : closeLinkMenu()));
$("#noteLinkMenu").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  if (b.dataset.view) { openLinkMenu(b.dataset.view); return; }
  if (!b.dataset.pick) return;
  if (edNote?.refs.includes(b.dataset.pick)) dropRef(b.dataset.pick); else addRef(b.dataset.pick);
  closeLinkMenu(true);
});
$("#noteLinkMenu").addEventListener("keydown", (e) => {
  const items = [...$("#noteLinkMenu").querySelectorAll("button:not([disabled])")];
  const i = items.indexOf(document.activeElement);
  if (e.key === "ArrowDown") { e.preventDefault(); (items[i + 1] || items[0])?.focus(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); (items[i - 1] || items[items.length - 1])?.focus(); }
});

// -- el atajo: el botón de nota de una fila (o de la ficha) muestra las notas que nombran a ese elemento y deja empezar
// una nueva ya vinculada; si no hay ninguna, abre directamente la nueva
let popKey = null, popAnchor = null;
function openShortcut(key, anchor) {
  if (!notesOn()) return;
  const list = touching(key);
  if (!list.length) { openNote(null, anchor, [key]); return; }
  closeNote(false);
  popKey = key; popAnchor = anchor;
  const p = $("#notePop");
  p.innerHTML = `<p class="npop-h">${refHTML(key)} <span>${list.length === 1 ? "1 nota" : `${list.length} notas`}</span></p>` +
    list.slice().reverse().map((n) => `<button type="button" class="npop-i" data-open="${n.id}"><span class="npop-t"></span><small>${noteWhen(n.at)}</small></button>`).join("") +
    `<button type="button" class="npop-new" data-new="${esc(key)}">+ Nota nueva sobre ${esc(refAbout(key))}</button>`;
  const ts = p.querySelectorAll(".npop-t");
  list.slice().reverse().forEach((n, i) => { ts[i].textContent = n.text.trim().replace(/\s+/g, " "); });
  p.hidden = false;
  const r = anchor.getBoundingClientRect(), w = p.offsetWidth, h = p.offsetHeight;
  let top = r.bottom + 6;
  if (top + h > innerHeight - 8 && r.top - h - 6 > 8) top = r.top - h - 6;
  p.style.left = `${Math.round(Math.max(8, Math.min(r.right - w, innerWidth - w - 16)) + scrollX)}px`;
  p.style.top = `${Math.round(top + scrollY)}px`;
  p.querySelector("button")?.focus({ preventScroll: true });
}
function closePop(focusBack = false) {
  const p = $("#notePop");
  if (p.hidden) return;
  p.hidden = true;
  const a = popAnchor;
  popKey = popAnchor = null;
  if (focusBack && a?.isConnected) a.focus({ preventScroll: true });
}
$("#notePop").addEventListener("click", (e) => {
  const o = e.target.closest("[data-open]"), nw = e.target.closest("[data-new]");
  const a = popAnchor;
  if (o) { closePop(); openView(o.dataset.open); }
  else if (nw) { closePop(); openNote(null, a?.closest?.("#wheel") ? null : a, [nw.dataset.new]); }
});

document.addEventListener("pointerdown", (e) => {
  const t = e.target;
  if (!$("#noteLinkMenu").hidden && !$("#noteLinkMenu").contains(t) && !$("#noteLink").contains(t)) closeLinkMenu();
  if (!$("#notePop").hidden && !$("#notePop").contains(t) && !t.closest?.("[data-note]")) closePop();
}, true);
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!$("#noteLinkMenu").hidden) { e.preventDefault(); closeLinkMenu(true); }
  else if (!$("#notePop").hidden) { e.preventDefault(); closePop(true); }
});
addEventListener("resize", () => { placeNoteEd(); closePop(); });
// los botones de nota de las tablas: antes que los otros clics de la fila (abrir la lectura, resaltar)
for (const sel of ["#panel-pos", "#panel-asp", "#panel-casas"]) {
  $(sel).addEventListener("click", (e) => {
    const b = e.target.closest("[data-note]");
    if (!b) return;
    e.stopPropagation();
    if (popKey === b.dataset.note && !$("#notePop").hidden) closePop();
    else openShortcut(b.dataset.note, b);
  }, true);
}
const noteBtn = (key, label) => {
  const n = notesOn() ? touching(key).length : 0;
  return `<button type="button" class="nbtn${n ? " has" : ""}" data-note="${esc(key)}" aria-label="${n ? `Notas (${n})` : "Escribir una nota"}: ${esc(label)}" title="${n ? (n === 1 ? "1 nota" : `${n} notas`) : "Nota"}">${NOTE_IC}</button>`;
};

/** Marca lo que tiene notas: los botones de las tablas y un puntito en la rueda (planetas, casas, ángulos, aspectos). */
function paintNoteMarks() {
  const on = notesOn();
  for (const b of document.querySelectorAll(".nbtn[data-note]")) {
    const n = on ? touching(b.dataset.note).length : 0;
    b.classList.toggle("has", n > 0);
    b.title = n ? (n === 1 ? "1 nota" : `${n} notas`) : "Nota";
  }
  const svg = $("#wheel");
  svg.querySelectorAll(".wnote").forEach((e) => e.remove());
  svg.querySelectorAll(".amark.noted-a").forEach((e) => e.classList.remove("noted-a"));
  if (on) {
    const notes = notesNow();
    const refs = new Set(notes.flatMap((n) => n.refs));
    const dot = (parent, x, y, r = 4.4) => {
      const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c.setAttribute("class", "wnote");
      c.setAttribute("cx", (+x).toFixed(1)); c.setAttribute("cy", (+y).toFixed(1)); c.setAttribute("r", r);
      c.setAttribute("aria-hidden", "true");
      parent.append(c);
    };
    for (const b of chart.bodies) {
      if (!notes.some((n) => touches(n, keyPl(b.id), chart))) continue;
      const g = svg.querySelector(`.pl[data-id="${b.id}"]:not(.trip):not(.out):not(.ghost) .pdw`);
      const m = g && /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(g.getAttribute("transform") || "");
      if (m) dot(g.closest(".pl"), +m[1] + 11, +m[2] - 11);
    }
    for (const t of svg.querySelectorAll(".hnum[data-h]")) {
      if (refs.has(keyHouse(+t.dataset.h))) dot(t.parentNode, +t.getAttribute("x") + 9, +t.getAttribute("y") - 8, 3.6);
    }
    for (const ax of ["asc", "mc"]) {
      const t = refs.has(ax) && svg.querySelector(`.axis-label[data-ax="${ax}"]`);
      if (!t) continue;
      const bb = t.getBBox();
      dot(t.parentNode, bb.x + bb.width + 4, bb.y + 2, 3.6);
    }
    for (const m of svg.querySelectorAll(".amark[data-a]")) if (refs.has(keyAsp(m.dataset.a, m.dataset.b))) m.classList.add("noted-a");
    // las casas y los ángulos que se pueden tocar para ver sus notas
    for (const e of svg.querySelectorAll(".hwedge[data-h], .hnum[data-h]")) e.classList.toggle("nt", touching(keyHouse(+e.dataset.h)).length > 0);
    for (const e of svg.querySelectorAll(".axis-label[data-ax]")) e.classList.toggle("nt", (e.dataset.ax === "asc" || e.dataset.ax === "mc") && refs.has(e.dataset.ax));
  } else {
    svg.querySelectorAll(".nt").forEach((e) => e.classList.remove("nt"));
  }
  if (!$("#panel-notas").hidden) $("#noteCount").textContent = countText();
  paintNotesCount();
}
/** El número de notas en el botón «Notas». */
function paintNotesCount() {
  const n = notesOn() ? noteCount(notesNow()) : 0;
  $("#notesCount").hidden = !n;
  $("#notesCount").textContent = n;
  $("#notesBtn").title = n ? `Las notas de la carta (${n})` : "Las notas de la carta";
}
const countText = () => { const n = noteCount(notesNow()); return n === 0 ? "Sin notas" : n === 1 ? "1 nota" : `${n} notas`; };

// -- las marcas doradas en la rueda (lo que tiene notas): apagadas salvo que se pidan; se recuerda en este navegador
let noteMarksOn = false;
try { noteMarksOn = localStorage.getItem("carta:notemarks") === "1"; } catch { /* sin almacenamiento */ }
const paintMarksPref = () => {
  document.documentElement.toggleAttribute("data-nmarks", noteMarksOn);
  $("#noteMarks").checked = $("#cfgMarks").checked = noteMarksOn;
  if (typeof paintCfgSums === "function") paintCfgSums();
};
paintMarksPref();
for (const id of ["#noteMarks", "#cfgMarks"]) $(id).addEventListener("change", (e) => {
  noteMarksOn = e.target.checked;
  try { localStorage.setItem("carta:notemarks", noteMarksOn ? "1" : "0"); } catch { /* sin almacenamiento */ }
  paintMarksPref();
});

// -- la pestaña «Notas»: todas, la más nueva arriba, con un filtro por elemento
let noteFilter = "";
function renderNotes() {
  const list = $("#noteList");
  if (!chart || mode !== "natal") { list.replaceChildren(); return; }
  if (!notesOn()) {
    $("#noteCount").textContent = "";
    $("#noteAdd").hidden = true;
    $("#noteFilter").hidden = true;
    $("#noteMarksRow").hidden = true;
    list.innerHTML = `<p class="muted nempty">Guardá la carta para poder escribirle notas.</p>`;
    return;
  }
  $("#noteAdd").hidden = false;
  $("#noteCount").textContent = countText();
  const notes = notesNow();
  $("#noteMarksRow").hidden = !notes.length;
  // el filtro: lo que vinculan las notas (y los planetas de sus aspectos)
  const keys = new Set();
  for (const n of notes) for (const r of n.refs) {
    if (!refExists(r, chart, visAsp()) && !r.startsWith("asp:")) continue;
    keys.add(r);
    if (r.startsWith("asp:")) r.slice(4).split("|").forEach((id) => keys.add(keyPl(id)));
  }
  if (noteFilter && !keys.has(noteFilter)) noteFilter = "";
  const f = $("#noteFilter");
  f.hidden = !keys.size;
  f.innerHTML = `<option value="">Todas</option>` + [...keys].sort(refSort)
    .map((k) => `<option value="${esc(k)}"${k === noteFilter ? " selected" : ""}>${esc(refText(k))} (${notes.filter((n) => touches(n, k, chart)).length})</option>`).join("");
  if (!notes.length) {
    list.innerHTML = `<p class="muted nempty">Todavía no hay notas. Tocá «+ Nota» y escribí: la app te propone qué vincular (planetas en su casa, casas, el Ascendente, el Medio Cielo, aspectos). También desde ${NOTE_IC.replace("<svg", '<svg class="nic-inline"')} en Posiciones, Casas o Aspectos.</p>`;
    return;
  }
  const shown = notes.filter((n) => !noteFilter || touches(n, noteFilter, chart)).reverse();
  const phone = matchMedia("(max-width: 640px)").matches;
  list.innerHTML = shown.map((n) => {
    const warn = n.refs.some((r) => refChange(r, n.snap[r]));
    const chips = [...n.refs].sort(refSort).map((r) => {
      const w = refChange(r, n.snap[r]);
      return `<button type="button" class="nchip${r === noteFilter ? " cur" : ""}${w ? " warn" : ""}" data-filter="${esc(r)}" aria-label="Filtrar: ${esc(refText(r))}"${w ? ` title="${esc(w)}"` : ""}>${refHTML(r)}</button>`;
    }).join("");
    return `<article class="ncard${n.id === litId ? " lit" : ""}" data-nid="${n.id}">` +
      `<p class="ntext"></p>` +
      `<div class="nchips">${chips || `<span class="nchip gen">General</span>`}</div>` +
      `<div class="nfoot"><span class="nd">${noteWhen(n.at)}${warn ? ` · <span class="nwarn">algo cambió en la carta</span>` : ""}</span>` +
      `${phone && n.refs.length ? `<button type="button" class="nlink-btn" data-see="${n.id}">Ver en la carta</button>` : ""}` +
      `<button type="button" class="nlink-btn" data-edit="${n.id}">Editar</button></div></article>`;
  }).join("") || `<p class="muted nempty">Ninguna nota nombra eso.</p>`;
  const ps = list.querySelectorAll(".ntext");
  shown.forEach((n, i) => { ps[i].textContent = n.text; });      // el texto va como texto (puede tener cualquier cosa)
}
$("#noteFilter").addEventListener("change", (e) => { noteFilter = e.target.value; renderNotes(); });
$("#noteAdd").addEventListener("click", () => openNote(null, $("#noteAdd")));
$("#noteList").addEventListener("click", (e) => {
  const fb = e.target.closest("[data-filter]"), ed = e.target.closest("[data-edit]"), see = e.target.closest("[data-see]");
  if (fb) { noteFilter = noteFilter === fb.dataset.filter ? "" : fb.dataset.filter; renderNotes(); return; }
  if (see) {                                   // celular: a la rueda, con la nota iluminada y un cartelito para volver
    closeNote(false);
    mview = "carta"; paintBar(); scrollTo(0, 0);
    lightNote(see.dataset.see, true);
    return;
  }
  const card = e.target.closest(".ncard");
  if (ed) { if (edNote?.id === ed.dataset.edit) closeNote(); else openNote(ed.dataset.edit, card); }
  else if (card && !e.target.closest("button, a")) openView(card.dataset.nid);
});

// -- leer una nota: en el centro, grande y sin editar, con sus vínculos (iluminados en la rueda) y «Editar»
let viewId = null;
function openView(nid) {
  const n = noteById(nid);
  if (!n || !notesOn()) return;
  closeNote(false);
  closePop();
  hideFicha();
  viewId = nid;
  $("#noteViewCtx").textContent = `Nota · ${noteWhen(n.at)}`;
  $("#noteViewTitle").textContent = chart.input.name || "Carta natal";
  $("#noteViewText").textContent = n.text.trim();
  const warns = n.refs.map((r) => refChange(r, n.snap[r])).filter(Boolean);
  $("#noteViewWarn").hidden = !warns.length;
  $("#noteViewWarn").textContent = warns.join(" ");
  $("#noteViewRefs").innerHTML = n.refs.length
    ? [...n.refs].sort(refSort).map((r) => { const w = refChange(r, n.snap[r]); return `<span class="nchip${w ? " warn" : ""}" title="${esc(w || refText(r))}">${refHTML(r)}</span>`; }).join("")
    : `<span class="nchip gen">General</span>`;
  const d = $("#noteView");
  if (!d.open) d.showModal();
  d.querySelector(".nview-body").scrollTop = 0;
  lightNote(nid, litBar && litId === nid);
}
function closeView() {
  const d = $("#noteView");
  if (d.open) d.close();
}
$("#noteView").addEventListener("close", () => {
  if (viewId && !edNote && !litBar) lightNote(null);
  viewId = null;
});
$("#noteView").addEventListener("click", (e) => { if (e.target === e.currentTarget) closeView(); });     // el fondo
$("#noteViewX").addEventListener("click", closeView);
$("#noteViewEdit").addEventListener("click", () => {
  const nid = viewId;
  closeView();
  if (nid) openNote(nid, null);
});
// con el mouse, pasar por una tarjeta ilumina en la rueda lo que vincula (si no hay otra nota abierta)
$("#noteList").addEventListener("mouseover", (e) => {
  const card = e.target.closest(".ncard");
  if (!card || edNote || !wheel?.note) return;
  const n = noteById(card.dataset.nid);
  wheel.note(n && n.refs.length ? litSel(n) : null);
});
$("#noteList").addEventListener("mouseleave", () => { if (!edNote) paintLit(); });
// -- tocar en la rueda algo que tiene notas (un planeta, una casa, el Asc o el MC, un aspecto) las ofrece. Con el dedo, el
// planeta abre su ficha (que ya trae sus notas); con lecturas, el planeta y los ángulos abren su ventana como siempre.
let wheelPointer = "mouse";
$("#wheel").addEventListener("pointerdown", (e) => { wheelPointer = e.pointerType || "mouse"; }, true);
$("#wheel").addEventListener("click", (e) => {
  if (!notesOn() || !e.target.closest) return;
  const t = e.target;
  let key = null, anchor = null;
  const pl = t.closest(".pl"), ax = t.closest(".axis-label[data-ax]"), am = t.closest(".amark[data-a], .asp[data-a]"), h = t.closest(".hnum[data-h], .hwedge[data-h]");
  if (pl) {
    if (pl.classList.contains("out") || pl.classList.contains("trip") || pl.dataset.tip || interpOn || wheelPointer !== "mouse") return;
    key = keyPl(pl.dataset.id); anchor = pl.querySelector(".pdw") || pl;
  } else if (ax) {
    if (interpOn || (ax.dataset.ax !== "asc" && ax.dataset.ax !== "mc")) return;
    key = ax.dataset.ax; anchor = ax;
  } else if (am) {
    if (am.dataset.a.startsWith("o:") || am.dataset.b.startsWith("o:")) return;
    key = keyAsp(am.dataset.a, am.dataset.b); anchor = am;
  } else if (h) {
    key = keyHouse(+h.dataset.h); anchor = svg_hnum(h);
  }
  if (!key || !touching(key).length) return;
  e.stopPropagation();
  openShortcut(key, anchor);
});
const svg_hnum = (el) => $("#wheel").querySelector(`.hnum[data-h="${el.dataset.h}"]`) || el;
$("#noteLitEdit").addEventListener("click", () => { if (litId) openNote(litId, null); });
$("#noteLitX").addEventListener("click", () => { closeNote(false); lightNote(null); });

// -- la ficha del planeta tocado en la rueda (con el dedo y sin lecturas): signo, grados, casa y sus aspectos, en una
// tarjeta abajo de la pantalla. Se va al soltar el planeta (tocar afuera, de nuevo el mismo o la ×).
/** En la ficha: las notas que nombran a ese planeta (tocarlas las abre) y empezar una nueva ya vinculada. */
function pfiNotesHTML(bid) {
  const list = touching(keyPl(bid)).slice().reverse();
  return `<div class="pfi-nsec"><p class="pfi-nlab">${NOTE_IC} Notas${list.length ? ` <span class="pfi-ncount">${list.length}</span>` : ""}</p>` +
    list.map((n) => `<button type="button" class="pfi-ni" data-open="${n.id}">${esc(n.text.trim().replace(/\s+/g, " "))}</button>`).join("") +
    `<button type="button" class="pfi-nnew" data-new="${keyPl(bid)}">+ Nota sobre ${esc(bodyName(bid))}</button></div>`;
}
$("#pfi").addEventListener("click", (e) => {
  const o = e.target.closest("[data-open]"), nw = e.target.closest("[data-new]");
  if (o) openView(o.dataset.open);
  else if (nw) openNote(null, null, [nw.dataset.new]);
});
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
    (!out && notesOn() ? pfiNotesHTML(bid) : "") +
    (rows ? `<ul class="pfi-list" aria-label="Aspectos">${rows}</ul>` : `<p class="pfi-none">Sin aspectos en la rueda.</p>`);
  el.hidden = false;
}

// -- celular: la barra de abajo. «Carta» es la rueda natal sola, «Tablas» las tablas de la carta natal; «Tránsitos» y
// «Sinastría» son sus vistas (rueda y tablas). Reemplaza al selector Natal / Tránsitos / Sinastría de arriba.
function paintBar() {
  const root = document.documentElement;
  root.toggleAttribute("data-mbar", page === "chart" && !$("#stage").hidden);
  if (!root.hasAttribute("data-mbar")) setFab(false);
  if (!root.hasAttribute("data-mbar") || mode !== "transit") setTsheet(false);
  paintPill();
  fitTitle();
  root.dataset.mview = mview;
  const cur = mode === "natal" ? mview : mode;
  $("#mbar").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === cur)));
}
// -- celular: el botón flotante despliega Entre casas, Viajes e Imprimir (la CSS los ubica arriba de él). Prender o apagar
// no lo cierra (se ve cómo quedó); Imprimir y el filtro de viajes sí. Un puntito avisa si hay algo prendido.
function setFab(open) {
  const root = document.documentElement;
  root.toggleAttribute("data-fab", open);
  $("#fab").setAttribute("aria-expanded", String(open));
}
$("#fab").addEventListener("click", () => {
  const open = !document.documentElement.hasAttribute("data-fab");
  setFab(open);
  if (open) $(".modeacts > button:not([hidden])")?.focus({ preventScroll: true });
});
function paintFab() {
  const spill = $("#spillBtn").getAttribute("aria-pressed") === "true" && !$("#spillBtn").hidden;
  const trip = $("#tripBtn").getAttribute("aria-pressed") === "true" && !$("#tripBtn").hidden;
  $("#fab").classList.toggle("on", spill || trip);
  $("#fab").classList.toggle("reach", spill && !trip);
}
new MutationObserver(paintFab).observe($(".modeacts"), { subtree: true, attributes: true, attributeFilter: ["aria-pressed", "hidden"] });
$("#printBtn").addEventListener("click", () => setFab(false));
// «Notas»: abre las notas en la columna de las tablas (de nuevo, vuelve a la pestaña de antes); en el celular, desde el
// botón flotante, va a «Tablas» con las notas
let tabBeforeNotes = "tab-stair";
$("#notesBtn").addEventListener("click", () => {
  const phone = document.documentElement.hasAttribute("data-mbar");
  setFab(false);
  if (!$("#panel-notas").hidden && !(phone && mview !== "tablas")) {
    selectTab(visibleTabs().find((t) => t.id === tabBeforeNotes) || visibleTabs()[0]);
    return;
  }
  if (phone) { wheel?.clear(); mview = "tablas"; paintBar(); }
  selectTab($("#tab-notas"));
  if (phone) scrollTo(0, 0);
});
$("#tripMore").addEventListener("click", () => setFab(false));
document.addEventListener("pointerdown", (e) => {
  if (document.documentElement.hasAttribute("data-fab") && !$(".modeacts").contains(e.target) && !$("#fab").contains(e.target)) setFab(false);
}, true);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.documentElement.hasAttribute("data-fab")) { e.preventDefault(); setFab(false); $("#fab").focus({ preventScroll: true }); }
});

$("#mbar").addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-v]");
  if (!b) return;
  const v = b.dataset.v, cur = mode === "natal" ? mview : mode;
  setFab(false);
  if (v === "inicio") { go("#inicio"); return; }
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
    if (!wheel || !t || !t.type || t.type === "mouse" || e.target.closest?.("#pfi, #noteEd, [data-note], #notePop, #noteLit, #panel-notas, #noteView")) return;      // (dentro de la ficha se lee, no se suelta)
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
// (la de Notas no va en la fila: se abre con el botón «Notas» de arriba, o desde el botón flotante en el celular)
const visibleTabs = () => tabs.filter((t) => t.id !== "tab-notas" && t.dataset.modes.split(" ").includes(mode));

function selectTab(tab) {
  if (tab.id === "tab-notas" && lastTab[mode] !== "tab-notas") tabBeforeNotes = lastTab[mode];
  lastTab[mode] = tab.id;
  $("#notesBtn").setAttribute("aria-pressed", String(tab.id === "tab-notas"));
  for (const t of tabs) {
    const on = t === tab;
    t.setAttribute("aria-selected", on);
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
  }
  wheel?.clear();
  if (tab.id === "tab-cal") ensureCalendar();
  if (tab.id === "tab-sum") ensureSummary();
  if (tab.id === "tab-notas") renderNotes();
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
  selectTab((mode === "natal" && lastTab.natal === "tab-notas" ? $("#tab-notas") : null) || vis.find((t) => t.id === lastTab[mode]) || vis[0]);
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
  if (!$("#stage").hidden) { $("#spillBtn").hidden = mode !== "natal"; $("#tripBtn").hidden = mode !== "natal"; $("#notesBtn").hidden = mode !== "natal"; }
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

// ---------- la barra de arriba: las secciones (un menú), el tema y la configuración --------------------------
// Las secciones van en un menú que se abre con el botón de la izquierda (dice en cuál estás). En la carta, en pantallas
// anchas, el nombre, los modos y los botones de la carta pasan a esta misma fila (style.css, data-tbmerge): así la rueda
// tiene todo el alto. En el celular la barra es solo el botón del menú y el de la configuración.
const root = document.documentElement;
const appBtn = $("#appMenuBtn"), appMenu = $("#appMenu");
const PAGE_NAME = { home: "Inicio", lunar: "Luna", chart: "Carta", combine: "Combinar" };
function setAppMenu(open, focus = false) {
  appMenu.hidden = !open;
  appBtn.setAttribute("aria-expanded", String(open));
  if (open && focus) (appMenu.querySelector('[aria-current="page"]') || appMenu.querySelector("a"))?.focus();
}
appBtn.addEventListener("click", () => setAppMenu(appMenu.hidden, true));
appBtn.addEventListener("keydown", (e) => { if (e.key === "ArrowDown") { e.preventDefault(); setAppMenu(true, true); } });
appMenu.addEventListener("keydown", (e) => {
  const links = [...appMenu.querySelectorAll("a")], i = links.indexOf(document.activeElement);
  if (e.key === "ArrowDown") { e.preventDefault(); (links[i + 1] || links[0]).focus(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); (links[i - 1] || links[links.length - 1]).focus(); }
  else if (e.key === "Escape") { e.preventDefault(); setAppMenu(false); appBtn.focus(); }
});
document.addEventListener("pointerdown", (e) => { if (!appMenu.hidden && !e.target.closest(".tb-nav")) setAppMenu(false); }, true);
/** El nombre de la carta abierta, al lado de «Carta» en el menú. */
function paintNavChart() {
  const it = saved.activeId ? saved.find(saved.activeId) : null;
  $("#navChartName").textContent = it ? it.name : "";
}

// -- configuración: un panel que entra por la derecha (en el celular, a pantalla completa), con los grupos plegados
const cfgPanel = $("#cfgPanel"), cfgBtn = $("#cfgBtn");
let cfgBack = null;
function openCfg(group = null) {
  closeCpick(false);
  setAppMenu(false);
  cfgBack = document.activeElement;
  cfgPanel.hidden = false;
  $("#cfgScrim").hidden = false;
  cfgBtn.setAttribute("aria-expanded", "true");
  root.toggleAttribute("data-cfg", true);
  if (group) { const g = $("#" + group); g.open = true; requestAnimationFrame(() => g.scrollIntoView({ block: "start" })); }
  paintCfgSums();
  cfgPanel.focus({ preventScroll: true });
}
function closeCfg(focusBack = true) {
  if (cfgPanel.hidden) return;
  cfgPanel.hidden = true;
  $("#cfgScrim").hidden = true;
  cfgBtn.setAttribute("aria-expanded", "false");
  root.toggleAttribute("data-cfg", false);
  if (focusBack && cfgBack?.isConnected) cfgBack.focus({ preventScroll: true });
  cfgBack = null;
}
cfgBtn.addEventListener("click", () => (cfgPanel.hidden ? openCfg() : closeCfg()));
$("#cfgClose").addEventListener("click", () => closeCfg());
$("#cfgScrim").addEventListener("click", () => closeCfg());
cfgPanel.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !e.target.closest(".fpick-list")) { e.preventDefault(); closeCfg(); return; }
  if (e.key !== "Tab") return;                       // el foco no sale del panel (como en una ventana)
  const f = [...cfgPanel.querySelectorAll("button, summary, input, select, a[href]")].filter((x) => x.offsetParent !== null && !x.disabled);
  if (!f.length) return;
  if (e.shiftKey && (document.activeElement === f[0] || document.activeElement === cfgPanel)) { e.preventDefault(); f[f.length - 1].focus(); }
  else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
});

// ---------- tema: claro, oscuro o el del sistema (automático) ----------------------------------------------------------
const themeBtn = $("#theme");
const themePref = () => { try { return localStorage.getItem("carta:theme") || "auto"; } catch { return "auto"; } };
const isDark = () => (root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches);
function setTheme(t) {
  if (t === "auto") { delete root.dataset.theme; try { localStorage.removeItem("carta:theme"); } catch {} }
  else { root.dataset.theme = t; try { localStorage.setItem("carta:theme", t); } catch {} }
  paintTheme();
}
function paintTheme() {
  const label = isDark() ? "Modo claro" : "Modo oscuro";
  themeBtn.setAttribute("aria-label", label); themeBtn.title = label;
  themeBtn.classList.toggle("dark", isDark());
  const pref = themePref();
  document.querySelectorAll("#cfgTheme button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.themeSet === pref)));
  paintCfgSums();
}
themeBtn.addEventListener("click", () => setTheme(isDark() ? "light" : "dark"));
document.querySelectorAll("#cfgTheme button").forEach((b) => b.addEventListener("click", () => setTheme(b.dataset.themeSet)));
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", paintTheme);

// ---------- imprimir ------------------------------------------------------
// «Imprimir» abre un cuadro para elegir qué va en la hoja; lo demás está en print.js y en el @media print de style.css.
setupPrint({ root, getMode: () => mode });

// ---------- configuración: estilo, letra, mandala --------------------------
// Solo cambiar el estilo de los gráficos obliga a volver a dibujar; lo demás lo resuelve la CSS.
const cfg0 = initSettings((cfg, what) => {
  curCfg = cfg;
  paintCfgSums();
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
curCfg = cfg0;
// las letras, con vista previa (cada una escrita con la suya)
fontPicker($("#cfgFont"), (v) => FONT_FAMILY[v], (v) => FONT_NOTE[v] || "");
fontPicker($("#cfgNoteFont"), (v) => NOTE_FONT_FAMILY[v]);
// el resumen de cada grupo de Configuración (lo que se ve con el grupo plegado)
const pctTxt = (v) => `${Math.round(v * 100)} %`;
function paintCfgSums() {
  const c = curCfg;
  if (!c || !$("#cfgLookSum")) return;
  const pref = themePref();
  $("#cfgLookSum").textContent = `Tema ${pref === "light" ? "claro" : pref === "dark" ? "oscuro" : "automático"} · ${FONTS[c.font]} · letra ${pctTxt(c.fs)}`;
  $("#cfgWheelGSum").textContent = `Tamaño ${pctTxt(c.wheel)} · ${c.cuspRing ? "con" : "sin"} anillo de cúspides${noteMarksOn ? " · marcas de notas" : ""}`;
  const hs = form.elements.hsys, nAsp = Object.keys(ASPECT).length - c.aspOff.length;
  $("#cfgAspGSum").textContent = `${hs.selectedOptions[0]?.textContent || ""} · ${nAsp === Object.keys(ASPECT).length ? "todos los aspectos" : `${nAsp} de ${Object.keys(ASPECT).length} aspectos`} a la vista`;
  $("#cfgAdvGSum").textContent = `Planetas entre casas · Viajes de planetas${$("#cfgResetAdv").disabled ? "" : " · con cambios"}`;
  $("#cfgDataGSum").textContent = isPublic() ? "Exportar · importar · tus cartas quedan en este navegador" : "Exportar · importar · dónde se guardan tus cartas";
}
form.elements.hsys.addEventListener("change", paintCfgSums);
paintTheme();

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
      if (page === "chart" && chart && mode === "natal") { renderNotes(); paintNoteMarks(); renderPositions(chart); renderHouses(chart); renderAspects(); }
      // (una carta con la misma fecha, hora y ciudad ya está, aunque tenga otro nombre: no se duplica, se le suman sus notas)
      const parts = r.added || (!r.updated && !r.skipped) ? [`Se ${r.added === 1 ? "importó" : "importaron"} ${plural(r.added, "carta nueva", "cartas nuevas")}`] : [];
      if (r.updated) parts.push(`${plural(r.updated, "ya estaba", "ya estaban")}: se ${r.notes === 1 ? "sumó" : "sumaron"} ${plural(r.notes, "nota", "notas")}`);
      if (r.skipped) parts.push(`${plural(r.skipped, "ya estaba", "ya estaban")} sin nada nuevo`);
      if (r.failed) parts.push(`${plural(r.failed, "no se pudo leer", "no se pudieron leer")}`);
      say(parts.join(" · ") + ".", !r.added && !r.skipped && !r.updated);
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
    if (saved.items.length) { openSaved(saved.items[0]); return; }      // hay cartas guardadas: abre la primera
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
  $("#appMenuLabel").textContent = PAGE_NAME[page];
  appBtn.setAttribute("aria-label", `Secciones: ${PAGE_NAME[page]}`);
  root.dataset.page = page;
  if (page !== "chart") root.removeAttribute("data-tbmerge");
  setAppMenu(false);
  closeCpick(false);
  paintFind();
  if (prev !== page) {
    if (prev === "home") stopHome();
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
appMenu.querySelectorAll("a").forEach((a) => a.addEventListener("click", (e) => {
  setAppMenu(false);
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

/** «Tus cartas»: una tarjeta por carta (la última abierta primero) con el Sol, la Luna y el Ascendente si ya se conocen sus
 *  posiciones (las del buscador por posición, que quedan en este navegador). Los nombres los escribe quien usa la app: todo con DOM. */
const homeQ = { text: "" };
const HOME_SEARCH_FROM = 7;
function renderHomeCharts() {
  paintHomeCards();
  renderHomeTr();
  renderHomeFind();
  $("#homePrivTxt").textContent = isPublic() ? "Tus cartas se guardan solo en este navegador." : "Tus cartas se guardan en esta computadora.";
}
function paintHomeCards() {
  const body = $("#homeChartBody");
  const items = saved.items;
  const act = saved.activeId ? saved.find(saved.activeId) : null;
  const v = readForm();
  const el = (tag, props = {}, fn) => {
    const e = Object.assign(document.createElement(tag), props);
    if (fn) e.addEventListener("click", fn);
    return e;
  };
  $("#homeChartsN").textContent = items.length ? String(items.length) : "";
  $("#homeChartsQWrap").hidden = items.length < HOME_SEARCH_FROM;
  if (items.length < HOME_SEARCH_FROM) homeQ.text = "";
  if (!items.length) {
    const nodes = [];
    if (formReady(v)) {
      nodes.push(el("button", { type: "button", className: "home-continue", textContent: `Continuar con ${v.name || "la carta sin guardar"}` }, () => go("#carta")));
      nodes.push(el("button", { type: "button", className: "home-tr-all hc-add", textContent: "Nueva carta" }, () => openForm("new")));
    }
    else {
      nodes.push(el("p", { className: "home-empty", textContent: "Todavía no guardaste ninguna carta." }));
      nodes.push(el("button", { type: "button", className: "home-continue", textContent: "Crear mi primera carta" }, () => createFirst()));
    }
    body.replaceChildren(...nodes);
    return;
  }
  const q = homeQ.text.trim().toLocaleLowerCase("es");
  const list = [...(act ? [act] : []), ...items.filter((it) => it !== act)].filter((it) => !q || it.name.toLocaleLowerCase("es").includes(q));
  const grid = el("div", { className: "hc-cards" });
  for (const it of list) {
    const card = el("button", { type: "button", className: "hc-card", title: `Abrir la carta de ${it.name}` }, () => openSaved(it));
    if (it === act) card.classList.add("cur");
    card.append(el("b", { className: "hc-nm", textContent: it.name }));
    const sub = el("small", { className: "hc-sub", textContent: [it.date ? it.date.split("-").reverse().join("/") : "", it.time || "", (it.place || "").split(",")[0]].filter(Boolean).join(" · ") });
    if (it === act) sub.append(" · ", el("strong", { textContent: "última abierta" }));
    card.append(sub);
    const pos = findReady(it) ? find.pos.get(it.id).lon : null;
    if (pos) {
      const trio = el("span", { className: "hc-trio" });
      for (const [id, lab] of [["sun", null], ["moon", null], ["asc", "Asc"]]) {
        const k = split(pos[id]).sign;
        const t = el("span", { className: "hc-pos", title: `${BODY[id].name} en ${SIGNS[k]}` });
        t.innerHTML = `<em>${lab || mark(id)}</em><span class="g" aria-hidden="true">${signHTML(k)}</span>`;
        t.append(SIGNS[k]);
        trio.append(t);
      }
      card.append(trio);
    }
    grid.append(card);
  }
  if (!q) {
    const add = el("button", { type: "button", className: "hc-card hc-new", id: "homeNew", title: "Cargar una carta nueva" }, () => openForm("new"));
    add.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Nueva carta`;
    grid.append(add);
  }
  const nodes = [grid];
  if (q && !list.length) nodes.unshift(el("p", { className: "home-empty", textContent: "Ninguna carta tiene ese nombre." }));
  body.replaceChildren(...nodes);
}
$("#homeChartsQ").addEventListener("input", (e) => { homeQ.text = e.target.value; paintHomeCards(); });
$("#homePriv").addEventListener("click", () => openCfg("cfgDataG"));

// -- inicio: tránsitos destacados de hoy con las cartas guardadas. Se piden al apretar el botón (cada carta es un
// cálculo de años de recorrido), de a dos a la vez; si el servidor pide esperar (versión pública) se espera y se sigue.
const homeTr = { on: new Set(), res: new Map(), running: false, seq: 0, done: 0, total: 0, at: null, edit: false, saved: false };
// Las cartas elegidas se recuerdan (en este navegador) después de calcular una vez: la próxima vez los tránsitos se calculan
// solos al entrar al inicio. Hasta entonces no se calcula nada sin apretar el botón (en la versión pública los datos viajan).
const HTR_KEY = "carta:htr";
try {
  const raw = JSON.parse(localStorage.getItem(HTR_KEY));
  if (raw?.v === 1 && Array.isArray(raw.on) && raw.on.length) { homeTr.on = new Set(raw.on.filter((x) => typeof x === "string")); homeTr.saved = true; }
} catch {}
function htrSave() {
  try {
    if (homeTr.on.size) localStorage.setItem(HTR_KEY, JSON.stringify({ v: 1, on: [...homeTr.on] }));
    else localStorage.removeItem(HTR_KEY);
  } catch {}
}
/** Lo que identifica los datos de una carta: si se edita, lo que se calculó antes deja de valer. */
const trSig = (it) => [it.date, it.time, it.lat, it.lon, it.tz, it.manual, it.offset].join("|");

function renderHomeTr() {
  const sec = $("#homeTr"), items = saved.items;
  sec.hidden = !items.length;                      // sin cartas guardadas no hay con qué calcular
  if (!items.length) return;
  const on = items.filter((it) => homeTr.on.has(it.id));      // la primera vez no hay ninguna elegida: se eligen a mano
  const auto = homeTr.saved && on.length && !homeTr.edit;
  if (auto && !homeTr.running && page === "home" && (!homeTr.at || homeTr.at.date !== nowIn(moonTz()).date || on.some((it) => homeTr.res.get(it.id)?.sig !== trSig(it)))) {
    runHomeTr(); return;                         // se actualizan solos: al entrar, si cambió el día o alguna carta
  }
  $("#homeTrEdit").hidden = !!auto;
  const autoP = $("#homeTrAuto");
  autoP.hidden = !auto;
  if (auto) {
    const ch = Object.assign(document.createElement("button"), { type: "button", className: "home-tr-all", textContent: "Cambiar cartas" });
    ch.addEventListener("click", () => { homeTr.edit = true; renderHomeTr(); $("#homeTrPick button")?.focus(); });
    autoP.replaceChildren(`De ${on.map((it) => it.name).join(", ")} · ${homeTr.running ? `calculando ${homeTr.done} de ${homeTr.total}…` : "se actualizan solos"} · `, ch);
  }
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
  go.textContent = homeTr.running ? "Calculando…" : !on.length ? (homeTr.saved ? "Listo" : "Calcular") : on.length === 1 ? "Calcular con 1 carta" : `Calcular con ${on.length} cartas`;
  if (homeTr.saved && !on.length) go.disabled = homeTr.running;
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
  homeTr.edit = false;
  homeTr.saved = items.length > 0;
  htrSave();
  if (!items.length) { homeTr.res = new Map(); renderHomeTr(); return; }
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
  if (page === "home") { renderHomeFind(); paintHomeCards(); }
}
$("#findGo").addEventListener("click", runFind);
// «Buscar por posición» va plegado; si lo abrís, queda abierto la próxima vez (en este navegador)
try { $("#homeFind").open = localStorage.getItem("carta:findopen") === "1"; } catch {}
$("#homeFind").addEventListener("toggle", (e) => { try { localStorage.setItem("carta:findopen", e.target.open ? "1" : "0"); } catch {} });

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
