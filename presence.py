"""Cuándo cerrar el servidor que lanza la app: cuando ya no queda ninguna ventana abierta.

Cada página abierta avisa «hola» al cargar y manda un latido cada pocos segundos; al cerrarse avisa
«chau». Con la última ventana cerrada se espera unos segundos (por si es una recarga) y se apaga.
Si una ventana desaparece sin avisar (se cuelga el navegador), se la da por perdida cuando deja de latir.
"""
import threading
import time


class Presence:
    def __init__(self, grace=8.0, stale=150.0, startup=90.0, launch=30.0, clock=time.monotonic):
        self.grace = grace      # espera tras la última ventana cerrada
        self.stale = stale      # sin latidos por tanto tiempo = ventana perdida
        self.launch = launch    # espera que se concede cuando el lanzador acaba de pedir una ventana
        self._clock = clock
        self._lock = threading.Lock()
        self._seen = {}         # id de ventana → último latido
        self._deadline = clock() + startup   # si nunca se abre ninguna ventana, se apaga igual

    def _extend(self, now, seconds):
        self._deadline = max(self._deadline, now + seconds)

    def hello(self, cid):
        """Una ventana está abierta (también sirve de latido)."""
        with self._lock:
            if cid not in self._seen:
                self._deadline = 0.0     # llegó una ventana: ya no hace falta esperarla
            self._seen[cid] = self._clock()

    def bye(self, cid):
        with self._lock:
            self._seen.pop(cid, None)
            if not self._seen:
                self._extend(self._clock(), self.grace)

    def touch(self):
        """El lanzador está por abrir una ventana: no apagar todavía."""
        with self._lock:
            self._extend(self._clock(), self.launch)

    @property
    def windows(self):
        with self._lock:
            return len(self._seen)

    def should_exit(self):
        now = self._clock()
        with self._lock:
            lost = [c for c, t in self._seen.items() if now - t > self.stale]
            for c in lost:
                del self._seen[c]
            if lost and not self._seen:
                self._extend(now, self.grace)
            return not self._seen and now >= self._deadline
