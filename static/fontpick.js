// Un selector de letras con vista previa: cada opción está escrita con su propia letra. Se arma sobre un <select>, que
// sigue siendo el que manda (el cambio se avisa con «change»; si el valor cambia desde afuera, «fpick:sync» lo repinta).
// Se maneja como una lista: flechas, Inicio/Fin, Enter o espacio para elegir, Esc para cerrar.

let seq = 0;

/**
 * @param select   el <select> (con <option> y, opcionalmente, <optgroup>)
 * @param familyOf (valor) → font-family de la vista previa
 * @param noteOf   (valor) → texto chico a la derecha («redondeada»), o ""
 */
export function fontPicker(select, familyOf, noteOf = () => "") {
  const wrap = select.parentElement;
  const id = `fpick${++seq}`;
  select.hidden = true;
  select.tabIndex = -1;
  select.setAttribute("aria-hidden", "true");

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "fpick-btn";
  btn.id = `${id}b`;
  btn.setAttribute("aria-haspopup", "listbox");
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-controls", `${id}l`);
  const lab = select.getAttribute("aria-labelledby");
  btn.setAttribute("aria-labelledby", `${lab ? lab + " " : ""}${btn.id}`);
  btn.innerHTML = `<span class="fpick-v"></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>`;

  const list = document.createElement("div");
  list.className = "fpick-list";
  list.id = `${id}l`;
  list.setAttribute("role", "listbox");
  if (lab) list.setAttribute("aria-labelledby", lab);
  list.hidden = true;

  const opts = [];
  const addOpt = (o) => {
    const d = document.createElement("div");
    d.className = "fpick-o";
    d.id = `${id}-${o.value}`;
    d.setAttribute("role", "option");
    d.tabIndex = -1;
    d.dataset.value = o.value;
    d.style.fontFamily = familyOf(o.value);
    d.append(Object.assign(document.createElement("span"), { textContent: o.textContent }));
    const n = noteOf(o.value);
    if (n) d.append(Object.assign(document.createElement("small"), { textContent: n }));
    list.append(d);
    opts.push(d);
  };
  for (const ch of select.children) {
    if (ch.tagName === "OPTGROUP") {
      list.append(Object.assign(document.createElement("p"), { className: "fpick-g", textContent: ch.label, role: "presentation" }));
      [...ch.children].forEach(addOpt);
    } else addOpt(ch);
  }
  wrap.append(btn, list);

  function paint() {
    const o = select.selectedOptions[0];
    const v = btn.querySelector(".fpick-v");
    v.textContent = o ? o.textContent : "";
    v.style.fontFamily = o ? familyOf(o.value) : "";
    for (const d of opts) d.setAttribute("aria-selected", String(d.dataset.value === select.value));
  }
  function open() {
    list.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    const cur = opts.find((d) => d.dataset.value === select.value) || opts[0];
    cur.focus({ preventScroll: true });
    cur.scrollIntoView({ block: "nearest" });
  }
  function close(focusBtn = true) {
    if (list.hidden) return;
    list.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    if (focusBtn) btn.focus({ preventScroll: true });
  }
  function choose(d) {
    if (select.value !== d.dataset.value) {
      select.value = d.dataset.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    paint();
    close();
  }

  btn.addEventListener("click", () => (list.hidden ? open() : close()));
  btn.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); open(); }
  });
  list.addEventListener("click", (e) => { const d = e.target.closest(".fpick-o"); if (d) choose(d); });
  list.addEventListener("keydown", (e) => {
    const i = opts.indexOf(document.activeElement);
    const to = (k) => { const d = opts[Math.max(0, Math.min(opts.length - 1, k))]; d.focus({ preventScroll: true }); d.scrollIntoView({ block: "nearest" }); };
    if (e.key === "ArrowDown") { e.preventDefault(); to(i + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); to(i - 1); }
    else if (e.key === "Home") { e.preventDefault(); to(0); }
    else if (e.key === "End") { e.preventDefault(); to(opts.length - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (opts[i]) choose(opts[i]); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === "Tab") close(false);
  });
  document.addEventListener("pointerdown", (e) => { if (!list.hidden && !wrap.contains(e.target)) close(false); }, true);
  select.addEventListener("fpick:sync", paint);
  select.addEventListener("change", paint);
  paint();
  return { paint, close };
}
