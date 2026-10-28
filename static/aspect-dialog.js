// Ventana con la explicación de un aspecto: qué puntos une, cuánto orbe tiene y qué significa. Se abre al tocar un aspecto
// en la lista, el cuadro o la cuadrícula. Desde cada punto se puede saltar a la lectura de ese planeta.
import { SIGNS, ASPECT, fmtPos, fmtOrb, badge, esc } from "./astro-data.js";
import { aspectFor } from "./reading.js";

const NOTE = "Lectura simbólica y general: describe tendencias según la manera estándar de leer los símbolos; " +
  "no explica causas ni predice hechos, y la carta se lee siempre en conjunto.";

// Aplicativo: el planeta más rápido todavía no llegó al punto exacto; separativo: ya lo pasó.
// En una carta (natal o de sinastría) es lo que ocurría en el momento de la carta; en los tránsitos, lo que ocurre ahora.
const PHASE_TEXT = {
  aplicativo: {
    live: "Aplicativo: el aspecto todavía se está cerrando, así que se vuelve más exacto con el paso del tiempo.",
    chart: "Aplicativo: en el momento de la carta el aspecto se estaba cerrando; el planeta más rápido todavía no había llegado al punto exacto.",
  },
  separativo: {
    live: "Separativo: el aspecto ya pasó su punto exacto y se va abriendo, con una influencia que va cediendo.",
    chart: "Separativo: en el momento de la carta el aspecto se estaba abriendo; el planeta más rápido ya había pasado el punto exacto.",
  },
};

/**
 * @param getContext () => { mode, chart, transit, syn, orbMax }
 * @param onOpenPlanet se llama con la clave de un planeta (la ventana se cierra antes) para abrir su lectura
 * @param onClose      se llama al cerrar (la rueda saca el resaltado)
 */
export function initAspectDialog(getContext, onOpenPlanet, onClose) {
  const dlg = document.getElementById("aspectDlg");
  const $ = (s) => dlg.querySelector(s);

  function pointRow(p) {
    const owner = p.owner ? ` <span class="pdl-owner">(${esc(p.owner)})</span>` : "";
    const pos = [`${fmtPos(p.lon)} de ${SIGNS[p.sign]}`, p.houseShort, p.retro ? "retrógrado" : ""].filter(Boolean).join(" · ");
    return `<li class="asd-pt"><button type="button" class="pdl-go" data-go="${esc(p.key)}">${badge(p.id, "s")}<span>${esc(p.name)}</span></button>${owner}` +
      `<span class="pdl-meta">${esc(pos)}</span></li>`;
  }

  function content(s) {
    const T = ASPECT[s.type];
    const chips = [`${s.angle}°`, `orbe ${fmtOrb(s.orb)}`, s.phase].filter(Boolean).map((c) => `<span class="pdl-chip">${esc(c)}</span>`).join("");
    let html = `<section class="pdl-sec"><h3>Los dos puntos</h3><ul class="pdl-list asd-pts">${s.points.map(pointRow).join("")}</ul></section>`;
    html += `<section class="pdl-sec"><h3>El aspecto</h3><div class="pdl-chips">${chips}</div>`;
    if (s.text) html += `<p>${esc(s.text.frame)}</p>`;
    html += `<p class="pdl-fine">Este aspecto es exacto a ${s.angle}°. El orbe es cuánto le falta, o se pasó, para llegar a ese ángulo: cuanto menor, más pesa.` +
      `${s.note ? ` <span class="pdl-note">${esc(s.note)}</span>` : ""}</p>`;
    if (s.phase && PHASE_TEXT[s.phase]) html += `<p class="pdl-fine">${esc(PHASE_TEXT[s.phase][s.live ? "live" : "chart"])}</p>`;
    html += `</section>`;
    if (s.text) html += `<section class="pdl-sec"><h3>Qué une a este par</h3><p class="pdl-theme">${esc(s.text.theme)}</p></section>`;
    const retro = s.points.filter((p) => p.retroText);
    if (retro.length) {
      html += `<section class="pdl-sec"><h3>Movimiento</h3>` +
        retro.map((p) => `<p><strong>${esc(p.name)}${p.owner ? ` (${esc(p.owner)})` : ""}.</strong> ${esc(p.retroText)}</p>`).join("") + `</section>`;
    }
    return html + `<p class="pdl-disclaimer">${NOTE}</p>`;
  }

  function open(aKey, bKey) {
    const s = aspectFor(getContext(), aKey, bKey);
    if (!s) return false;
    const T = ASPECT[s.type];
    $("#aspBadges").innerHTML = `${badge(s.points[0].id, "l")}<span class="a-ic ${T.cls}" aria-hidden="true">${T.glyph}</span>${badge(s.points[1].id, "l")}`;
    const ctxEl = $("#aspCtx");
    ctxEl.hidden = !s.context;
    ctxEl.textContent = s.context;
    $("#aspTitle").textContent = T.name;
    $("#aspSub").textContent = `${s.points[0].name} – ${s.points[1].name} · orbe ${fmtOrb(s.orb)}${s.phase ? ` · ${s.phase}` : ""}`;
    $("#aspBody").innerHTML = content(s);
    $("#aspBody").scrollTop = 0;
    if (!dlg.open) dlg.showModal();
    $("#aspTitle").focus({ preventScroll: true });
    return true;
  }

  $("#aspClose").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) { dlg.close(); return; }            // fuera de la ventana
    const go = e.target.closest("[data-go]");
    if (go) { const key = go.dataset.go; dlg.close(); onOpenPlanet?.(key); }
  });
  dlg.addEventListener("close", () => onClose?.());

  return { open, close: () => dlg.open && dlg.close(), get isOpen() { return dlg.open; } };
}
