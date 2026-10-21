// Mantiene abierta una conexión con el servidor local mientras esta ventana existe. Así
// «Carta natal.app» sabe cuándo cerraste la última ventana y puede apagar el servidor.
// Si la conexión se cae y no vuelve, la página lo avisa. En la versión alojada en internet no se usa.
import { config } from "./api.js";

let id;
try { id = crypto.randomUUID().replaceAll("-", ""); }
catch { id = Math.random().toString(36).slice(2) + Date.now().toString(36); }

let banner = null;
let lostTimer = null;

function showLost(on) {
  if (on && !banner) {
    banner = document.createElement("div");
    banner.className = "lost";
    banner.setAttribute("role", "alert");
    banner.textContent = "Se cerró el servidor local. Abrí Carta natal de nuevo para seguir.";
    document.body.append(banner);
  } else if (!on && banner) {
    banner.remove();
    banner = null;
  }
}

function connect() {
  const es = new EventSource(`/api/presence?id=${id}`);
  es.onopen = () => {
    clearTimeout(lostTimer);
    lostTimer = null;
    showLost(false);
  };
  es.onerror = () => {
    if (!lostTimer && !banner) lostTimer = setTimeout(() => showLost(true), 5000);
    if (es.readyState === EventSource.CLOSED) setTimeout(connect, 3000);   // el navegador ya no reintenta solo
  };
}

config().then((c) => { if (!c.public) connect(); });
