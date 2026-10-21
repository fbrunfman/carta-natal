#!/usr/bin/env python3
"""Servidor de Carta natal.

    python3 app.py            # local: http://127.0.0.1:8765, solo escucha en 127.0.0.1
    python3 app.py --open     # además abre el navegador
    python3 app.py --public   # para alojarla (Render, etc.): ver el README, «Alojarla en internet»
"""
import argparse
import json
import os
import re
import select
import threading
import time
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import astro
from limits import Busy, RateLimiter, Slots
from presence import Presence
from store import ChartStore, NotFound, StoreError, clean as clean_chart

STATIC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
STORE = ChartStore()
CHARTS_ROUTE = re.compile(r"^/api/charts(?:/([0-9a-f]{12}))?$")
WINDOW_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
MAX_BODY = 64 * 1024

# Ventanas abiertas. Solo decide algo con --idle-exit (lo usa «Carta natal.app»); sin esa opción
# el servidor corre hasta que lo cierres vos.
PRESENCE = Presence()
IDLE_EXIT = False

# ---- versión pública (--public) -------------------------------------------------------------
# El servidor no guarda nada de nadie: las cartas guardadas viven en el navegador de cada persona
# y el servidor solo calcula. Los pedidos se limitan por IP para que nadie lo sature.
PUBLIC = False
ALLOWED_HOSTS = set()          # vacío = cualquier dominio; con CARTA_NATAL_HOSTS se restringe
LIMITER = None                 # por IP
GLOBAL_LIMITER = None          # entre todos
HEAVY = Slots(3)               # cálculos pesados a la vez
TRUSTED_PROXIES = 1            # cuántos proxies hay delante; la IP es la que anotó el último
COST = {"/api/chart": 1, "/api/transits": 2, "/api/synastry": 2, "/api/transit-calendar": 20, "/api/validate-chart": 0.5,
        "/api/featured": 6, "/api/upcoming": 8}
HEAVY_PATHS = {"/api/transit-calendar", "/api/featured", "/api/upcoming"}     # los que recorren años o meses


def _obj(data, key):
    """Un sub-objeto obligatorio del cuerpo JSON."""
    v = data.get(key)
    if not isinstance(v, dict):
        raise astro.ChartError("Faltan datos en la solicitud.")
    return v


# Cálculos que reciben JSON (los datos de nacimiento viajan en el cuerpo, no en la URL).
COMPUTE = {
    "/api/transits": lambda d: astro.compute_transits(_obj(d, "natal"), _obj(d, "at")),
    "/api/synastry": lambda d: astro.compute_synastry(_obj(d, "a"), _obj(d, "b")),
    "/api/transit-calendar": lambda d: astro.transit_calendar(
        _obj(d, "natal"), _obj(d, "start"), d.get("months"), d.get("scope", "slow")),
    "/api/chart": lambda d: astro.compute_chart(d),
    "/api/featured": lambda d: astro.featured_transits(_obj(d, "natal"), _obj(d, "at")),
    "/api/upcoming": lambda d: astro.upcoming_events(_obj(d, "natal"), _obj(d, "at"), d.get("days", 30)),
}


def _validate(d):
    """Valida datos de nacimiento sin guardar nada (las cartas guardadas viven en el navegador).
    Con {"items": [...]} valida varias a la vez, para importar."""
    items = d.get("items")
    if items is None:
        return clean_chart(d)
    if not isinstance(items, list) or len(items) > 100:
        raise StoreError("Demasiadas cartas de una vez.")
    out = []
    for it in items:
        try:
            out.append({"chart": clean_chart(it)})
        except StoreError as e:
            out.append({"error": str(e)})
    return {"items": out}


COMPUTE["/api/validate-chart"] = _validate


class Handler(SimpleHTTPRequestHandler):
    server_version = "carta-natal"
    sys_version = ""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC, **kwargs)

    def list_directory(self, path):          # nunca listar carpetas
        self.send_error(404)
        return None

    # ---- respuestas -------------------------------------------------------
    def _json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length > MAX_BODY:
            raise StoreError("Datos demasiado grandes.")
        try:
            data = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            raise StoreError("Datos inválidos.")
        if not isinstance(data, dict):
            raise StoreError("Datos inválidos.")
        return data

    # ---- protección -------------------------------------------------------
    # El servidor solo escucha en 127.0.0.1, pero una página web cualquiera abierta en
    # el mismo navegador podría intentar hablarle. Se exige Host local, y para escribir
    # además Origin local (si viene) y contenido JSON, que un formulario ajeno no puede enviar.
    def _local_hosts(self):
        port = self.server.server_address[1]
        return {f"127.0.0.1:{port}", f"localhost:{port}"}

    def _guard(self, writing=False):
        host = (self.headers.get("Host") or "").lower()
        if PUBLIC:
            # Alojada, el servidor no guarda nada de nadie: alcanza con que escribir pida JSON y que, si el
            # navegador manda Origin, sea el mismo sitio. Con CARTA_NATAL_HOSTS se limita a esos dominios.
            if ALLOWED_HOSTS and host not in ALLOWED_HOSTS and host.rsplit(":", 1)[0] not in ALLOWED_HOSTS:
                self._json({"error": "Host no permitido."}, 403)
                return False
            origin = self.headers.get("Origin") if writing else None
            if origin is not None and urlparse(origin).netloc.lower() != host:
                self._json({"error": "Origen no permitido."}, 403)
                return False
        elif host not in self._local_hosts():
            self._json({"error": "Host no permitido."}, 403)
            return False
        elif writing:
            origin = self.headers.get("Origin")
            if origin is not None and origin.lower() not in {f"http://{h}" for h in self._local_hosts()}:
                self._json({"error": "Origen no permitido."}, 403)
                return False
        if writing:
            if self.command in ("POST", "PUT") and "application/json" not in (self.headers.get("Content-Type") or "").lower():
                self._json({"error": "Se esperaba JSON."}, 415)
                return False
        return True

    def _client_ip(self):
        """La IP de quien pide. Detrás del proxy del hosting es la que anotó el último proxy: lo que mande
        el navegador en X-Forwarded-For queda a la izquierda y no se usa, así que no se puede falsear."""
        fwd = [p.strip() for p in (self.headers.get("X-Forwarded-For") or "").split(",") if p.strip()]
        if fwd and len(fwd) >= TRUSTED_PROXIES:
            return fwd[-TRUSTED_PROXIES]
        return self.client_address[0]

    def _throttle(self, path):
        """Solo en la versión pública. Devuelve False (y ya respondió) si hay que frenar el pedido."""
        if not PUBLIC:
            return True
        cost = COST.get(path, 1)
        wait = LIMITER.allow(self._client_ip(), cost) or GLOBAL_LIMITER.allow("*", cost)
        if wait:
            body = json.dumps({"error": "Demasiados pedidos seguidos. Esperá unos segundos y probá de nuevo."}).encode()
            self.send_response(429)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Retry-After", str(int(wait)))
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return False
        return True

    # ---- rutas ------------------------------------------------------------
    def do_GET(self):
        if PUBLIC and urlparse(self.path).path == "/healthz":       # lo consulta el hosting; sin Host ni límites
            body = b"ok"
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", "2")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return
        if not self._guard():
            return
        url = urlparse(self.path)
        if PUBLIC and url.path in ("/api/charts", "/api/presence", "/defaults-local.js"):
            self._json({"error": "No disponible en la versión pública."}, 404)
        elif PUBLIC and url.path == "/api/chart":
            self._json({"error": "Usá POST: los datos de nacimiento no viajan en la URL."}, 405)
        elif url.path == "/api/chart":
            q = {k: v[0] for k, v in parse_qs(url.query).items()}
            try:
                self._json(astro.compute_chart(q))
            except astro.ChartError as e:
                self._json({"error": str(e)}, 400)
            except Exception as e:  # no tirar el servidor por un caso raro
                self._json({"error": f"Error interno de cálculo: {e}"}, 500)
        elif url.path == "/api/timezones":
            self._json(astro.timezone_names())
        elif url.path == "/api/charts":
            self._json({"charts": STORE.list(), "path": STORE.display_path()})
        elif url.path == "/api/ping":
            # El lanzador lo usa para saber si ya hay un servidor de Carta natal corriendo.
            if parse_qs(url.query).get("launcher"):
                PRESENCE.touch()
            self._json({"app": "carta-natal", "idleExit": IDLE_EXIT, "windows": PRESENCE.windows, "public": PUBLIC})
        elif url.path == "/api/presence":
            self._stream(parse_qs(url.query).get("id", [""])[0])
        else:
            super().do_GET()

    def _stream(self, cid):
        """Conexión que cada ventana mantiene abierta mientras existe. Cuando el navegador la corta
        (cerrar la ventana, Cmd+Q, un cuelgue) el servidor se entera al instante, sin depender de que
        la página alcance a avisar."""
        if not WINDOW_ID.match(cid or ""):
            self._json({"error": "Datos inválidos."}, 400)
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        PRESENCE.hello(cid)
        try:
            while True:
                ready, _, _ = select.select([self.connection], [], [], 1.0)
                if ready and not self.connection.recv(4096):
                    break                                   # el navegador cerró la conexión
                self.wfile.write(b": ok\n\n")               # falla si ya no hay nadie del otro lado
                self.wfile.flush()
                PRESENCE.hello(cid)
        except OSError:
            pass
        finally:
            PRESENCE.bye(cid)

    def _charts_write(self, action):
        if PUBLIC:
            self._json({"error": "No disponible en la versión pública: las cartas se guardan en el navegador."}, 404)
            return
        if not self._guard(writing=True):
            return
        m = CHARTS_ROUTE.match(urlparse(self.path).path)
        if not m:
            self._json({"error": "No encontrado."}, 404)
            return
        chart_id = m.group(1)
        try:
            if action == "create" and not chart_id:
                self._json(STORE.create(self._read_json()), 201)
            elif action == "update" and chart_id:
                self._json(STORE.update(chart_id, self._read_json()))
            elif action == "delete" and chart_id:
                STORE.delete(chart_id)
                self._json({"ok": True})
            else:
                self._json({"error": "Método no permitido."}, 405)
        except NotFound as e:
            self._json({"error": str(e)}, 404)
        except StoreError as e:
            self._json({"error": str(e)}, 400)
        except OSError as e:
            self._json({"error": f"No se pudo escribir en {STORE.display_path()}: {e.strerror or e}"}, 500)

    def _compute(self, run, path):
        if not self._guard(writing=True) or not self._throttle(path):
            return
        try:
            data = self._read_json()
            if path in HEAVY_PATHS and PUBLIC:
                with HEAVY:
                    result = run(data)
            else:
                result = run(data)
            self._json(result)
        except Busy:
            self._json({"error": "El servidor está ocupado con otros cálculos. Probá de nuevo en unos segundos."}, 503)
        except (astro.ChartError, StoreError) as e:
            self._json({"error": str(e)}, 400)
        except Exception as e:  # no tirar el servidor por un caso raro
            self._json({"error": f"Error interno de cálculo: {e}"}, 500)

    def do_POST(self):
        path = urlparse(self.path).path
        if path in COMPUTE:
            self._compute(COMPUTE[path], path)
        else:
            self._charts_write("create")

    def do_PUT(self):
        self._charts_write("update")

    def do_DELETE(self):
        self._charts_write("delete")

    def end_headers(self):
        if not self.path.startswith(("/api/", "/healthz")):
            self.send_header("Cache-Control", "no-cache")
        if PUBLIC:
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("X-Frame-Options", "DENY")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header("X-Robots-Tag", "noindex, nofollow")
        super().end_headers()

    def log_message(self, fmt, *args):
        path = getattr(self, "path", "").split("?")[0]
        if PUBLIC:
            # solo cálculos: nada de /healthz ni del resto, y nunca la URL completa (por si trae datos)
            if path.startswith("/api/") and path != "/api/ping":
                super().log_message("%s", f"{self.command} {path} → {args[1] if len(args) > 1 else '?'}")
            return
        # los latidos de las ventanas llegan cada pocos segundos: no se anotan
        if path.startswith("/api/") and path not in ("/api/ping", "/api/presence"):
            super().log_message(fmt, *args)


def _watch(server):
    """Apaga el servidor cuando ya no queda ninguna ventana abierta."""
    while not PRESENCE.should_exit():
        time.sleep(0.5)
    print("Sin ventanas abiertas: cerrando el servidor.", flush=True)
    server.shutdown()


def main():
    global PRESENCE, IDLE_EXIT, PUBLIC, ALLOWED_HOSTS, LIMITER, GLOBAL_LIMITER, TRUSTED_PROXIES
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=None,
                    help="puerto (local: 8765; con --public: la variable PORT del hosting, o 10000)")
    ap.add_argument("--open", action="store_true", help="abrir el navegador al iniciar")
    ap.add_argument("--idle-exit", action="store_true",
                    help="cerrar el servidor cuando se cierre la última ventana (lo usa Carta natal.app)")
    ap.add_argument("--public", action="store_true",
                    help="para alojarla en internet: escucha en todas las interfaces, no guarda cartas en el servidor "
                         "(también se activa con CARTA_NATAL_PUBLIC=1)")
    ap.add_argument("--host", default=None, help="dirección donde escuchar (con --public: 0.0.0.0)")
    ap.add_argument("--grace", type=float, default=8.0, help=argparse.SUPPRESS)    # segundos; para pruebas
    ap.add_argument("--startup", type=float, default=90.0, help=argparse.SUPPRESS)
    args = ap.parse_args()

    PUBLIC = args.public or os.environ.get("CARTA_NATAL_PUBLIC", "").lower() in ("1", "true", "yes")
    PRESENCE = Presence(grace=args.grace, startup=args.startup)
    IDLE_EXIT = args.idle_exit and not PUBLIC

    if PUBLIC:
        host = args.host or "0.0.0.0"
        port = args.port or int(os.environ.get("PORT") or 10000)
        ALLOWED_HOSTS = {h.strip().lower() for h in os.environ.get("CARTA_NATAL_HOSTS", "").split(",") if h.strip()}
        TRUSTED_PROXIES = max(1, int(os.environ.get("CARTA_NATAL_PROXIES") or 1))
        # por persona: ráfaga de 60 pedidos y 2 por segundo después; entre todas: 20 por segundo
        LIMITER = RateLimiter(rate=float(os.environ.get("CARTA_NATAL_RATE") or 2), burst=60)
        GLOBAL_LIMITER = RateLimiter(rate=20, burst=200)
        Handler.timeout = 30                      # una conexión que se queda muda no ocupa un hilo para siempre
        print(f"Carta natal (versión pública) escuchando en {host}:{port}", flush=True)
        print("No se guarda nada en el servidor: las cartas viven en el navegador de cada persona.", flush=True)
        url = None
    else:
        host = args.host or "127.0.0.1"
        port = args.port or 8765
        url = f"http://127.0.0.1:{port}"
        print(f"Carta natal en {url}  (Ctrl+C para salir)", flush=True)
        print(f"Cartas guardadas en: {STORE.file}", flush=True)

    server = ThreadingHTTPServer((host, port), Handler)
    if args.open and url:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    if IDLE_EXIT:
        threading.Thread(target=_watch, args=(server,), daemon=True).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nCerrado.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
