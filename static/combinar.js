// Pestaña «Combinar» (beta): se pintan dos o más planetas y sale un texto al azar entre los que los tienen a todos.
// Los textos y la búsqueda están en combos.js; acá solo la pantalla.
import { BODY, badge } from "./astro-data.js";
import { PLANETS, findTexts, pickText, textHTML, sortPlanets, combosWithText, countTexts } from "./combos.js";

const $ = (s) => document.querySelector(s);
const name = (id) => BODY[id].name;
const label = (ids) => sortPlanets(ids).map(name).join(" + ");

// El estado vive mientras la app está abierta: al volver a la pestaña, queda lo que se había elegido y lo último que salió.
const st = { sel: new Set(), shown: null, combo: [], built: false };

const comboRow = (ids) => ids.map((id) => badge(id, "s")).join("") + `<span>${label(ids)}</span>`;
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function paintPicker() {
  $("#cmbPick").innerHTML = PLANETS.map((id) =>
    `<button type="button" class="cmb-pl" data-b="${id}" aria-pressed="${st.sel.has(id)}">`
    + `<span aria-hidden="true">${badge(id)}</span><span class="cmb-nm">${name(id)}</span></button>`).join("");
}

function paintState() {
  const n = st.sel.size, ids = sortPlanets([...st.sel]);
  document.querySelectorAll("#cmbPick .cmb-pl").forEach((b) => b.setAttribute("aria-pressed", String(st.sel.has(b.dataset.b))));
  $("#cmbGo").disabled = n < 2;
  $("#cmbClear").disabled = n === 0;
  $("#cmbHint").textContent = n === 0 ? "Tocá los círculos para pintarlos. Hacen falta al menos dos."
    : n === 1 ? `${name(ids[0])}. Pintá al menos uno más.`
    : `${label(ids)}. Listo para buscar.`;
}

function say(msg) { $("#cmbStatus").textContent = msg; }

/** Muestra el resultado de una búsqueda (o el aviso de que no hay nada) debajo del botón. */
function paintResult(ids, t) {
  const out = $("#cmbOut");
  const head = `<p class="cmb-combo">${comboRow(ids)}</p>`;
  if (!t) {
    const alt = combosWithText();
    out.innerHTML = `<div class="cmb-none"><strong>No encontré ningún texto para ${label(ids)}.</strong>`
      + `<p>Probá con otra combinación. Esta sección está en construcción y todavía tiene pocos textos.</p>`
      + (alt.length ? `<p class="cmb-try">Combinaciones que sí tienen texto:</p><div class="home-chips">${alt.map((c) =>
        `<button type="button" class="home-chip" data-combo="${c.join(",")}">${label(c)}</button>`).join("")}</div>` : "")
      + `</div>`;
    say(`No encontré ningún texto para ${label(ids)}.`);
  } else {
    const n = findTexts(ids).length;
    out.innerHTML = `<article class="cmb-res" aria-label="${label(ids)}">${head}${textHTML(t)}`
      + `<p class="cmb-more">${n > 1 ? `Hay ${n} textos para esta combinación.` : "Es el único texto que hay por ahora para esta combinación."}`
      + `${n > 1 ? ` <button type="button" class="cmb-again" id="cmbAgain">Otro texto</button>` : ""}</p></article>`;
    say(`Encontré un texto: ${t.titulo}, de ${t.autor}.`);
  }
  out.hidden = false;
  if (out.getBoundingClientRect().top > innerHeight * 0.55) out.scrollIntoView({ block: "start", behavior: reduced() ? "auto" : "smooth" });
}

function search() {
  const ids = sortPlanets([...st.sel]);
  if (ids.length < 2) return;
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
  const n = countTexts();
  $("#cmbCount").textContent = n === 1 ? "un solo texto de prueba" : `${n} textos de prueba`;
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
    if (c) {                                   // «Combinaciones que sí tienen texto»: las pinta y busca
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
