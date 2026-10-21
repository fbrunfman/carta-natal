// Cartas guardadas: un botón con la carta abierta que despliega la lista (con buscador si hay muchas).
// Los nombres los escribe el usuario: todo se arma con DOM, nunca con innerHTML.
import { charts } from "./api.js";

const SEARCH_FROM = 7;   // desde cuántas cartas aparece el buscador

/**
 * @param list/empty/where  <ul> de la lista, aviso de «no hay cartas» y párrafo con la ruta del archivo
 * @param picker            { root, btn, pop, q, none, count } los elementos del desplegable
 * @param onOpen            se llama con la carta elegida
 * @param onChange          se llama con la lista cada vez que se redibuja
 */
export function createSaved({ list, empty, where, picker, onOpen, onChange = () => {} }) {
  const { root, btn, pop, q, none, count } = picker;
  let items = [];
  let activeId = null;
  let armed = null;       // id de la carta cuyo "Eliminar" espera confirmación
  let armTimer = 0;
  let isOpen = false;
  let query = "";

  const byName = (a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" });
  const shortDate = (iso) => iso.split("-").reverse().join("/");
  // sin tildes ni mayúsculas: «mama» encuentra «Mamá»
  const fold = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const matches = (it) => !query || fold(`${it.name} ${shortDate(it.date)}`).includes(fold(query));

  function row(it) {
    const li = document.createElement("li");

    const open = document.createElement("button");
    open.type = "button";
    open.className = "chart-btn";
    if (it.id === activeId) open.setAttribute("aria-current", "true");
    const nm = Object.assign(document.createElement("span"), { className: "nm", textContent: it.name });
    const dt = Object.assign(document.createElement("span"), { className: "dt", textContent: shortDate(it.date) });
    open.append(nm, dt);
    open.addEventListener("click", () => choose(it));

    const isArmed = armed === it.id;
    const del = document.createElement("button");
    del.type = "button";
    del.className = "del" + (isArmed ? " armed" : "");
    del.textContent = isArmed ? "¿Eliminar?" : "×";
    del.setAttribute("aria-label", isArmed ? `Confirmar: eliminar la carta de ${it.name}` : `Eliminar la carta de ${it.name}`);
    del.addEventListener("click", () => (isArmed ? remove(it) : arm(it.id)));

    li.append(open, del);
    return li;
  }

  /** El botón muestra la carta abierta; sin ninguna, invita a elegir. */
  function paintButton() {
    const cur = items.find((x) => x.id === activeId);
    btn.querySelector(".pk-nm").textContent = cur ? cur.name : "Elegí una carta…";
    btn.querySelector(".pk-dt").textContent = cur ? shortDate(cur.date) : "";
    btn.classList.toggle("is-empty", !cur);
    btn.setAttribute("aria-label", cur ? `Carta abierta: ${cur.name}, ${shortDate(cur.date)}. Elegir otra carta guardada` : "Elegir una carta guardada");
  }

  function render() {
    const sorted = [...items].sort(byName);
    empty.hidden = items.length > 0;
    root.hidden = items.length === 0;
    count.hidden = items.length === 0;
    count.textContent = items.length;
    if (!items.length && isOpen) close(false);

    q.hidden = items.length < SEARCH_FROM;
    if (q.hidden) query = "";
    const shown = sorted.filter(matches);
    list.replaceChildren(...shown.map(row));
    none.hidden = shown.length > 0;
    paintButton();
    onChange(items);
  }

  // ---- desplegable -----------------------------------------------------------
  const focusables = () => [...(q.hidden ? [] : [q]), ...list.querySelectorAll(".chart-btn")];

  function open() {
    if (isOpen || root.hidden) return;
    isOpen = true;
    pop.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    root.classList.add("open");
    const cur = list.querySelector('[aria-current="true"]');
    cur?.scrollIntoView({ block: "nearest" });
    (q.hidden ? cur || list.querySelector(".chart-btn") : q)?.focus({ preventScroll: true });
  }

  function close(refocus = true) {
    if (!isOpen) return;
    isOpen = false;
    clearTimeout(armTimer);
    armed = null;
    pop.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    root.classList.remove("open");
    if (query) { query = ""; q.value = ""; }
    render();
    if (refocus) btn.focus({ preventScroll: true });
  }

  function choose(it) {
    close(true);
    onOpen(it);
  }

  btn.addEventListener("click", () => (isOpen ? close(true) : open()));
  btn.addEventListener("keydown", (e) => {
    if (!isOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      e.stopPropagation();          // si no, la misma flecha avanzaría un paso más dentro de la lista recién abierta
      open();
    }
  });

  q.addEventListener("input", () => { query = q.value.trim(); render(); });

  root.addEventListener("keydown", (e) => {
    if (!isOpen) return;
    if (e.key === "Escape") {                 // cierra solo el desplegable; el Esc del menú flotante no se entera
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const all = focusables();
      if (!all.length) return;
      e.preventDefault();
      const i = all.indexOf(document.activeElement);
      const next = e.key === "ArrowDown" ? (i < 0 ? 0 : Math.min(i + 1, all.length - 1)) : (i <= 0 ? -1 : i - 1);
      (next < 0 ? btn : all[next]).focus({ preventScroll: next < 0 });
      if (next >= 0) all[next].scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && e.target === q) {
      e.preventDefault();                      // Enter en el buscador abre la primera coincidencia
      const first = list.querySelector(".chart-btn");
      if (first) first.click();
    }
  });

  document.addEventListener("pointerdown", (e) => { if (isOpen && !root.contains(e.target)) close(false); });
  root.addEventListener("focusout", (e) => {   // Tab hacia afuera
    if (isOpen && e.relatedTarget && !root.contains(e.relatedTarget)) close(false);
  });

  // ---- datos ---------------------------------------------------------------
  function arm(id) {
    armed = id;
    render();
    list.querySelector(".del.armed")?.focus();
    clearTimeout(armTimer);
    armTimer = setTimeout(() => { armed = null; render(); }, 3500);
  }

  async function remove(it) {
    clearTimeout(armTimer);
    armed = null;
    await charts.remove(it.id);
    items = items.filter((x) => x.id !== it.id);
    if (activeId === it.id) activeId = null;
    render();
  }

  return {
    async refresh() {
      const r = await charts.list();
      items = r.charts;
      where.textContent = r.note ?? `Tus cartas se guardan en ${r.path}.`;
      render();
    },
    get activeId() { return activeId; },
    setActive(id) { activeId = id; render(); },
    find: (id) => items.find((x) => x.id === id),
    get items() { return [...items].sort(byName); },
    get pickerOpen() { return isOpen; },
    closePicker: (refocus = false) => close(refocus),
    async create(birth) {
      const rec = await charts.create(birth);
      items.push(rec);
      return rec;
    },
    async update(id, birth) {
      const rec = await charts.update(id, birth);
      items = items.map((x) => (x.id === id ? rec : x));
      return rec;
    },
  };
}
