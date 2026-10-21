// Ventana con la lectura de un planeta: signo, casa y aspectos. Se abre al tocar un planeta en la rueda,
// en las tablas o en la cruz de elementos. Desde un aspecto se puede saltar al otro planeta y volver.
import { SIGNS, ASPECT, fmtPos, fmtOrb, badge, signHTML, esc } from "./astro-data.js";
import { subjectFor } from "./reading.js";

const NOTE = "Lectura simbólica y general: describe tendencias según la manera estándar de leer los símbolos; " +
  "no explica causas ni predice hechos, y la carta se lee siempre en conjunto.";

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const list = (items) => items.map((s) => `<span class="pdl-chip">${esc(s)}</span>`).join("");

/**
 * @param getContext () => { mode, chart, transit, syn, orbMax }  (los datos de la vista actual)
 * @param onClose    se llama al cerrar (la rueda saca el resaltado que dejó el planeta tocado)
 */
export function initPlanetDialog(getContext, onClose) {
  const dlg = document.getElementById("planetDlg");
  const $ = (s) => dlg.querySelector(s);
  const stack = [];          // planetas por los que se fue pasando (para «volver»)
  let showAll = false;       // ver también los aspectos con orbe mayor al del filtro

  function aspectItem(it) {
    const T = ASPECT[it.type];
    const owner = it.owner ? ` <span class="pdl-owner">(${esc(it.owner)})</span>` : "";
    const meta = [`orbe ${fmtOrb(it.orb)}`, it.phase].filter(Boolean).join(" · ");
    const text = it.text
      ? `<p class="pdl-theme">${esc(it.text.theme)}</p><p class="pdl-frame">${esc(it.text.frame)}${it.note ? ` <span class="pdl-note">${esc(it.note)}</span>` : ""}</p>`
      : "";
    return `<li class="pdl-asp">
      <div class="pdl-ahead">
        <span class="a-ic ${T.cls}" aria-hidden="true">${T.glyph}</span>
        <span class="pdl-atype">${T.name}</span><span class="pdl-with">con</span>
        <button type="button" class="pdl-go" data-go="${esc(it.target)}">${badge(it.other, "s")}<span>${esc(it.name)}</span></button>${owner}
        <span class="pdl-meta">${meta}</span>
      </div>${text}</li>`;
  }

  function aspectSection(title, items, hidden, always) {
    if (!items.length && !hidden && !always) return "";
    const count = items.length === 1 ? "1 aspecto" : `${items.length} aspectos`;
    let html = `<section class="pdl-sec"><h3>${esc(title)}<span class="pdl-count">${count}</span></h3>`;
    html += items.length ? `<ul class="pdl-list">${items.map(aspectItem).join("")}</ul>`
      : `<p class="pdl-empty">${hidden ? "No hay aspectos con el orbe elegido." : "No hay aspectos con otros puntos de la carta."}</p>`;
    return html + "</section>";
  }

  function content(s) {
    let html = "";
    // -- signo
    const sg = s.signReading;
    if (sg) {
      const chips = list([sg.element, sg.mode, ...sg.dignity]);
      html += `<section class="pdl-sec"><h3><span class="pdl-glyph">${signHTML(s.sign)}</span>En ${SIGNS[s.sign]}</h3>` +
        `<div class="pdl-chips">${chips}</div><p>${esc(sg.text)}</p>` +
        (sg.generational
          ? `<p class="pdl-fine">Este planeta pasa años en cada signo: el signo describe a toda una generación. Lo personal se lee por la casa y los aspectos.</p>`
          : "") +
        `</section>`;
    }
    if (s.retroText) html += `<section class="pdl-sec"><h3>Movimiento</h3><p>${esc(s.retroText)}</p></section>`;
    // -- casa
    const hr = s.houseReading;
    if (hr) {
      const title = s.outer ? `${s.houseWord}: ${s.house}` : `Casa ${s.house}`;
      html += `<section class="pdl-sec"><h3>${esc(title)}</h3><p class="pdl-theme">${esc(cap(hr.theme))}</p><p>${esc(hr.text)}</p>` +
        (s.outer ? `<p class="pdl-fine">Lectura general del planeta en esa casa: señala el área de la carta que se activa.</p>` : "") +
        `</section>`;
    }
    // -- aspectos
    html += aspectSection(s.aspects.title, s.aspects.items, s.aspects.hidden, true);
    if (s.cross) html += aspectSection(s.cross.title, s.cross.items, s.cross.hidden, false);
    const hidden = s.aspects.hidden + (s.cross ? s.cross.hidden : 0);
    if (hidden) {
      html += `<p class="pdl-more"><button type="button" class="pdl-link" data-act="more">Mostrar ${hidden === 1 ? "1 aspecto más" : `${hidden} aspectos más`} con orbe mayor</button></p>`;
    } else if (showAll) {
      html += `<p class="pdl-more"><button type="button" class="pdl-link" data-act="less">Volver al orbe elegido</button></p>`;
    }
    return html + `<p class="pdl-disclaimer">${NOTE}</p>`;
  }

  function show(key) {
    const ctx = getContext();
    const s = subjectFor({ ...ctx, orbMax: showAll ? 99 : ctx.orbMax }, key);
    if (!s) return false;
    $("#pdlBadge").innerHTML = badge(s.id, "l");
    const ctxEl = $("#pdlCtx");
    ctxEl.hidden = !s.context;
    ctxEl.textContent = s.context;
    $("#pdlTitle").textContent = `${s.name} en ${SIGNS[s.sign]}`;
    const sub = [`${fmtPos(s.lon)} de ${SIGNS[s.sign]}`];
    if (s.house) sub.push(s.houseShort);
    if (s.retro) sub.push("retrógrado");
    $("#pdlSub").textContent = sub.join(" · ");
    $("#pdlBody").innerHTML = content(s);
    $("#pdlBack").hidden = stack.length < 2;
    $("#pdlBody").scrollTop = 0;
    return true;
  }

  function open(key) {
    showAll = false;
    stack.length = 0;
    stack.push(key);
    if (!show(key)) { stack.length = 0; return; }
    if (!dlg.open) dlg.showModal();
    $("#pdlTitle").focus({ preventScroll: true });
  }

  function go(key) {
    if (stack[stack.length - 1] === key) return;
    stack.push(key);
    if (!show(key)) { stack.pop(); return; }
    $("#pdlTitle").focus({ preventScroll: true });
  }

  $("#pdlBack").addEventListener("click", () => {
    stack.pop();
    show(stack[stack.length - 1]);
    $("#pdlTitle").focus({ preventScroll: true });
  });
  $("#pdlClose").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) { dlg.close(); return; }            // fuera de la ventana
    const goBtn = e.target.closest("[data-go]");
    if (goBtn) { go(goBtn.dataset.go); return; }
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act) { showAll = act === "more"; show(stack[stack.length - 1]); }
  });
  dlg.addEventListener("close", () => { stack.length = 0; showAll = false; onClose?.(); });

  return { open, close: () => dlg.open && dlg.close(), get isOpen() { return dlg.open; } };
}
