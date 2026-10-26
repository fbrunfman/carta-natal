// Pestaña «Combinar» (beta): se pintan uno o más planetas y sale algo al azar entre lo que coincide
// (un texto, una biografía, una película o una canción del grupo).
// Lo que hay y la búsqueda están en combos.js; acá solo la pantalla.
import { BODY, badge } from "./astro-data.js";
import { PLANETS, ESTADOS, findTexts, pickText, textHTML, extrasHTML, estadoHTML, sortPlanets, combosWithText, countTexts, countByEstado } from "./combos.js";

const $ = (s) => document.querySelector(s);
const name = (id) => BODY[id].name;
// Un planeta solo se dice «Neptuno solo»: no es lo mismo que Neptuno combinado con otro.
const label = (ids) => { const s = sortPlanets(ids); return s.length === 1 ? `${name(s[0])} solo` : s.map(name).join(" + "); };

// El estado vive mientras la app está abierta: al volver a la pestaña, queda lo que se había elegido y lo último que salió.
const st = { sel: new Set(), shown: null, combo: [], built: false };

const comboRow = (ids) => ids.map((id) => badge(id, "s")).join("") + `<span>${label(ids)}</span>`;
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** «6 aportes (3 validados y 3 en debate)», para el aviso de que esto es una beta. */
function countText() {
  const n = countTexts(), c = countByEstado(), partes = [];
  if (!n) return "ningún aporte todavía";
  if (c.validado) partes.push(c.validado === 1 ? "1 validado" : `${c.validado} validados`);
  if (c.debate) partes.push(`${c.debate} en debate`);
  return (n === 1 ? "un solo aporte" : `${n} aportes`) + (partes.length ? ` (${partes.join(" y ")})` : "");
}

/** «2 validados y 1 en debate» de una lista, o vacío si no son del grupo. */
function desglose(lista) {
  const c = countByEstado(lista), partes = [];
  if (c.validado) partes.push(c.validado === 1 ? "1 validado" : `${c.validado} validados`);
  if (c.debate) partes.push(`${c.debate} en debate`);
  return partes.join(" y ");
}

function paintPicker() {
  $("#cmbPick").innerHTML = PLANETS.map((id) =>
    `<button type="button" class="cmb-pl" data-b="${id}" aria-pressed="${st.sel.has(id)}">`
    + `<span aria-hidden="true">${badge(id)}</span><span class="cmb-nm">${name(id)}</span></button>`).join("");
}

function paintState() {
  const n = st.sel.size, ids = sortPlanets([...st.sel]);
  document.querySelectorAll("#cmbPick .cmb-pl").forEach((b) => b.setAttribute("aria-pressed", String(st.sel.has(b.dataset.b))));
  $("#cmbGo").disabled = n < 1;
  $("#cmbClear").disabled = n === 0;
  $("#cmbHint").textContent = n === 0 ? "Tocá los círculos para pintarlos. Con uno buscás lo de ese planeta solo; con dos o más, lo que los junta."
    : n === 1 ? `${name(ids[0])}. Podés buscar lo de este planeta solo o pintar otro más.`
    : `${label(ids)}. Listo para buscar.`;
}

function say(msg) { $("#cmbStatus").textContent = msg; }

/** Muestra el resultado de una búsqueda (o el aviso de que no hay nada) debajo del botón. */
function paintResult(ids, t) {
  const out = $("#cmbOut");
  if (!t) {
    const alt = combosWithText();
    out.innerHTML = `<div class="cmb-none"><strong>No encontré nada para ${label(ids)}.</strong>`
      + `<p>Probá con otra combinación. Esta sección está en construcción y todavía tiene pocos aportes.</p>`
      + (alt.length ? `<p class="cmb-try">Combinaciones que sí tienen algo:</p><div class="home-chips">${alt.map((c) =>
        `<button type="button" class="home-chip" data-combo="${c.join(",")}">${label(c)}</button>`).join("")}</div>` : "")
      + `</div>`;
    say(`No encontré nada para ${label(ids)}.`);
  } else {
    const hits = findTexts(ids), n = hits.length, que = ids.length === 1 ? "este planeta solo" : "esta combinación", d = desglose(hits);
    out.innerHTML = `<article class="cmb-res" aria-label="${label(ids)}">`
      + `<div class="cmb-head"><p class="cmb-combo">${comboRow(ids)}</p>${estadoHTML(t)}</div>`
      + `${textHTML(t)}${extrasHTML(t)}`
      + `<p class="cmb-more">${n > 1 ? `Hay ${n} para ${que}${d ? ` (${d})` : ""}.` : `Es lo único que hay por ahora para ${que}.`}`
      + `${n > 1 ? ` <button type="button" class="cmb-again" id="cmbAgain">Ver otro</button>` : ""}</p></article>`;
    say(`Encontré: ${t.titulo}, de ${t.autor}.${ESTADOS[t.estado] ? " " + ESTADOS[t.estado] + "." : ""}`);
  }
  out.hidden = false;
  if (out.getBoundingClientRect().top > innerHeight * 0.55) out.scrollIntoView({ block: "start", behavior: reduced() ? "auto" : "smooth" });
}

function search() {
  const ids = sortPlanets([...st.sel]);
  if (ids.length < 1) return;
  const same = st.combo.join() === ids.join();
  const t = pickText(ids, same ? st.shown : null);
  st.shown = t; st.combo = ids;
  paintResult(ids, t);
}

function toggle(id) {
  if (st.sel.has(id)) st.sel.delete(id); else st.sel.add(id);
  paintState();
}

function build() {
  if (st.built) return;
  st.built = true;
  $("#cmbCount").textContent = countText();
  paintPicker();
  $("#cmbPick").addEventListener("click", (e) => {
    const b = e.target.closest(".cmb-pl");
    if (b) toggle(b.dataset.b);
  });
  $("#cmbGo").addEventListener("click", search);
  $("#cmbClear").addEventListener("click", () => {
    st.sel.clear(); paintState();
    $("#cmbPick .cmb-pl")?.focus();
  });
  const out = $("#cmbOut");
  out.addEventListener("click", (e) => {
    if (e.target.closest("#cmbAgain")) { search(); $("#cmbAgain")?.focus({ preventScroll: true }); return; }
    const c = e.target.closest("[data-combo]");
    if (c) {                                   // «Combinaciones que sí tienen algo»: las pinta y busca
      st.sel = new Set(c.dataset.combo.split(","));
      paintState();
      search();
      out.focus({ preventScroll: true });
    }
  });
}

/** Al entrar a la pestaña. */
export function showCombine() {
  build();
  paintState();
}

/** Cuando cambia el estilo de los gráficos (círculos de color o clásico) hay que volver a dibujar los círculos. */
export function refreshCombine() {
  if (!st.built) return;
  paintPicker();
  paintState();
  $("#cmbOut").querySelectorAll(".cmb-combo").forEach((p) => { p.innerHTML = comboRow(st.combo); });
}
