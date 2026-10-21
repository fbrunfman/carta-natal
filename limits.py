"""Límites de la versión pública: pedidos por persona y cálculos pesados a la vez.

Sin dependencias y sin estado en disco: todo vive en memoria y se pierde al reiniciar, que es lo que se quiere.
"""
import math
import threading
import time


class RateLimiter:
    """Cubeta de fichas: cada clave (una IP) tiene `burst` fichas y recupera `rate` por segundo.

    `allow(clave, costo)` devuelve 0 si el pedido pasa, o los segundos que hay que esperar para que pase.
    """

    def __init__(self, rate=2.0, burst=60.0, clock=time.monotonic, max_keys=5000, idle=600.0):
        self.rate, self.burst, self.max_keys, self.idle = rate, burst, max_keys, idle
        self._clock = clock
        self._lock = threading.Lock()
        self._buckets = {}          # clave → [fichas, último uso]

    def allow(self, key, cost=1.0):
        cost = min(cost, self.burst)            # un pedido caro nunca queda imposible
        now = self._clock()
        with self._lock:
            b = self._buckets.get(key)
            if b is None:
                if len(self._buckets) >= self.max_keys:
                    self._prune(now)
                b = self._buckets[key] = [self.burst, now]
            b[0] = min(self.burst, b[0] + (now - b[1]) * self.rate)
            b[1] = now
            if b[0] >= cost:
                b[0] -= cost
                return 0.0
            return math.ceil((cost - b[0]) / self.rate)

    def _prune(self, now):
        stale = [k for k, (_, t) in self._buckets.items() if now - t > self.idle]
        for k in stale:
            del self._buckets[k]
        if len(self._buckets) >= self.max_keys:   # ni así alcanza: se empieza de cero antes que crecer sin límite
            self._buckets.clear()


class Slots:
    """Cuántos cálculos pesados pueden correr a la vez; el resto recibe «ocupado» en vez de hacer fila."""

    def __init__(self, n):
        self._sem = threading.BoundedSemaphore(n)

    def __enter__(self):
        if not self._sem.acquire(blocking=False):
            raise Busy()
        return self

    def __exit__(self, *exc):
        self._sem.release()


class Busy(Exception):
    pass
