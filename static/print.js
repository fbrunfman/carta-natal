// Imprimir: «Imprimir» abre un cuadro para elegir qué va en la hoja (el mandala y las tablas). Lo elegido se recuerda
// por vista (natal, tránsitos, sinastría) y Ctrl/Cmd + P imprime eso mismo.
// La hoja la arma la CSS (@media print al final de style.css) según el atributo data-print de <html>, una lista de lo
// elegido como "wheel stair pos". Siempre sale en claro, aunque la pantalla esté en oscuro.
const KEY = "carta:print";

// Lo que se puede elegir en cada vista: [id del panel sin «panel-», nombre]. «wheel» (el mandala) está siempre.
const OPTS = {
  natal: [["stair", "Cuadro de aspectos"], ["pos", "Posiciones"], ["casas", "Casas"], ["asp", "Aspectos"], ["elem", "Elementos"]],
  transit: [["tpos", "Tránsitos"], ["grid", "Cuadro de aspectos"], ["asp", "Aspectos"]],
  syn: [["over", "Superposición"], ["grid", "Cuadro de aspectos"], ["asp", "Aspectos"]],
};
const ALL = (m) => ["wheel", ...OPTS[m].map(([k]) => k)];
const FIRST = { natal: ALL("natal"), transit: ["wheel", "tpos"], syn: ["wheel", "over"] };     // lo que sale la primera vez

/** @param root  <html>   @param getMode  () => "natal" | "transit" | "syn" */
export function setupPrint({ root, getMode }) {
  const $ = (s) => document.querySelector(s);
  const dlg = $("#printDlg"), list = $("#prdList"), note = $("#prdNote");

  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { /* sin almacenamiento: no se recuerda */ }
  const selection = (m) => {
    const s = Array.isArray(saved[m]) ? ALL(m).filter((t) => saved[m].includes(t)) : [];
    return s.length ? s : FIRST[m];
  };
  const remember = (m, sel) => {
    saved[m] = sel;
    try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* idem */ }
  };

  const ticks = () => [...list.querySelectorAll("input")];
  const setTicks = (wanted) => { ticks().forEach((i) => { i.checked = wanted.includes(i.value); }); note.textContent = ""; };

  $("#printBtn").addEventListener("click", () => {
    const m = getMode(), sel = selection(m);
    list.innerHTML = `<legend class="vh">Qué va en la hoja</legend>` + [["wheel", "Mandala"], ...OPTS[m]].map(([k, t]) =>
      `<label class="check"><input type="checkbox" value="${k}"${sel.includes(k) ? " checked" : ""}>${t}</label>`).join("");
    note.textContent = "";
    dlg.showModal();
  });

  dlg.addEventListener("click", (e) => {
    const preset = e.target.closest("[data-preset]")?.dataset.preset;
    if (preset) {
      const m = getMode();
      setTicks(preset === "wheel" ? ["wheel"] : preset === "all" ? ALL(m) : ["wheel", m === "natal" ? "stair" : "grid"]);
    } else if (e.target === dlg) dlg.close();            // un toque en la cortina
  });
  $("#prdClose").addEventListener("click", () => dlg.close());
  $("#prdCancel").addEventListener("click", () => dlg.close());
  list.addEventListener("change", () => { note.textContent = ""; });

  $("#printForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const sel = ticks().filter((i) => i.checked).map((i) => i.value);
    if (!sel.length) { note.textContent = "Elegí al menos una cosa para imprimir."; return; }
    remember(getMode(), sel);
    dlg.close();
    setTimeout(() => window.print(), 150);               // que el cuadro ya no esté cuando el navegador arma la hoja
  });

  // Mientras se arma la impresión: tema claro y la lista de lo elegido; después, todo vuelve a como estaba.
  let themeAntes;                                         // undefined = no se está imprimiendo
  window.addEventListener("beforeprint", () => {
    if (themeAntes !== undefined) return;
    themeAntes = root.dataset.theme ?? null;
    root.dataset.theme = "light";
    root.dataset.print = selection(getMode()).join(" ");
  });
  window.addEventListener("afterprint", () => {
    if (themeAntes === undefined) return;
    if (themeAntes === null) delete root.dataset.theme; else root.dataset.theme = themeAntes;
    delete root.dataset.print;
    themeAntes = undefined;
  });
}
