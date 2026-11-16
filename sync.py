"""Sincronizar entre dispositivos (opcional).

Cada dispositivo deja acá sus cambios y busca los de los otros. Todo llega **cifrado desde el navegador** con una clave
que sale del código de sincronización, que nunca viaja: el servidor solo ve un identificador del espacio (`sid`), una
clave opaca por cosa (`k`), cuándo se cambió en el dispositivo (`mtime`) y el texto cifrado (`v`). No puede leer ni
nombres ni fechas de nacimiento ni notas.

La base es un Postgres (pensado para Neon, plan gratis). Se configura con la variable `CARTA_NATAL_SYNC_DB` (la cadena
de conexión `postgresql://…`) o, en la compu, con el archivo `sync-db.txt` en la carpeta de datos de la app. Sin eso,
la sincronización queda apagada y la app anda igual que siempre.

Gana el cambio más nuevo (por `mtime`). `seq` es el orden de llegada: cada dispositivo pide «lo que llegó después de
lo último que vi». Los envíos de un mismo espacio se hacen de a uno (un candado de Postgres) para que `seq` llegue en
orden también entre el servidor de internet y el de la compu.
"""
import os
import re
import threading

from store import data_dir

SID = re.compile(r"^[0-9a-f]{64}$")
KEY = re.compile(r"^[0-9a-f]{32}$")
B64 = re.compile(r"^[A-Za-z0-9+/]+={0,2}$")
ITEM_MAX = 1_500_000          # un ítem cifrado (una carta con muchas notas)
PUSH_MAX = 200                # ítems por envío
SPACE_ITEMS = 3000            # ítems por espacio (cartas, más la configuración y las fijadas, más las borradas)
SPACE_BYTES = 40_000_000      # bytes por espacio
PAGE = 200                    # ítems por respuesta al bajar
PAGE_BYTES = 3_000_000        # y bytes (si no, la respuesta sigue en otra página)
MTIME_MAX = 2 ** 53

SCHEMA = [
    """create table if not exists sync_items (
        sid text not null,
        k text not null,
        mtime bigint not null,
        seq bigint not null,
        v text not null,
        primary key (sid, k))""",
    "create sequence if not exists sync_seq",
    "create index if not exists sync_items_seq on sync_items (sid, seq)",
]


class SyncError(ValueError):
    """Pedido inválido (400)."""


class SyncOff(Exception):
    """La sincronización no está configurada o no se puede usar (503)."""


def db_url() -> str:
    url = os.environ.get("CARTA_NATAL_SYNC_DB", "").strip()
    if url:
        return url
    try:
        p = data_dir() / "sync-db.txt"
        if p.is_file():
            return p.read_text(encoding="utf-8").strip()
    except OSError:
        pass
    return ""


def _sid(value) -> str:
    if not isinstance(value, str) or not SID.match(value):
        raise SyncError("Código de sincronización inválido.")
    return value


class SyncStore:
    def __init__(self, url: str):
        self.url = url
        self._conn = None
        self._ready = False
        self._lock = threading.Lock()

    # -- conexión: una sola, reusada; Neon la corta cuando duerme y se vuelve a abrir sola --------------------
    def _connect(self):
        try:
            import psycopg
        except ImportError:
            raise SyncOff("Falta instalar psycopg en el servidor (pip install \"psycopg[binary]\").")
        # prepare_threshold=None: sin sentencias preparadas, así anda también con la conexión «pooled» de Neon (PgBouncer)
        conn = psycopg.connect(self.url, autocommit=True, connect_timeout=20, prepare_threshold=None)
        if not self._ready:
            for sql in SCHEMA:
                conn.execute(sql)
            self._ready = True
        return conn

    def _run(self, fn):
        try:
            import psycopg
        except ImportError as e:
            raise SyncOff(f"Falta instalar psycopg en el Python de la app (corré sincronizar.command de nuevo). [{e}]")
        with self._lock:
            for attempt in (0, 1):
                try:
                    if self._conn is None or self._conn.closed:
                        self._conn = self._connect()
                    return fn(self._conn)
                except psycopg.OperationalError:
                    try:
                        if self._conn is not None:
                            self._conn.close()
                    except Exception:
                        pass
                    self._conn = None
                    if attempt:
                        raise SyncOff("No se pudo conectar con la base de sincronización. Probá de nuevo en un rato.")

    def check(self) -> None:
        """Prueba la conexión (y crea la tabla la primera vez)."""
        self._run(lambda conn: conn.execute("select 1").fetchone())

    # -- bajar: lo que llegó después de `since` -------------------------------------------------------------
    def pull(self, data) -> dict:
        sid = _sid(data.get("sid"))
        since = data.get("since", 0)
        if not isinstance(since, int) or since < 0:
            raise SyncError("Datos inválidos.")

        def go(conn):
            rows = conn.execute(
                "select k, mtime, seq, v from sync_items where sid = %s and seq > %s order by seq limit %s",
                (sid, since, PAGE + 1)).fetchall()
            items, size, last, more = [], 0, since, False
            for i, (k, mtime, seq, v) in enumerate(rows):
                if i >= PAGE or (items and size + len(v) > PAGE_BYTES):
                    more = True
                    break
                items.append({"k": k, "m": mtime, "v": v})
                size += len(v)
                last = seq
            return {"items": items, "seq": last, "more": more}
        return self._run(go)

    # -- subir: gana el más nuevo; `stale` son los que ya había más nuevos en la base -----------------------
    def push(self, data) -> dict:
        sid = _sid(data.get("sid"))
        items = data.get("items")
        if not isinstance(items, list) or not items or len(items) > PUSH_MAX:
            raise SyncError("Datos inválidos.")
        clean, seen = [], set()
        for it in items:
            if not isinstance(it, dict):
                raise SyncError("Datos inválidos.")
            k, m, v = it.get("k"), it.get("m"), it.get("v")
            if not isinstance(k, str) or not KEY.match(k) or k in seen:
                raise SyncError("Datos inválidos.")
            if not isinstance(m, int) or isinstance(m, bool) or not 0 < m < MTIME_MAX:
                raise SyncError("Datos inválidos.")
            if not isinstance(v, str) or not v or len(v) > ITEM_MAX or not B64.match(v):
                raise SyncError("Datos demasiado grandes." if isinstance(v, str) and len(v) > ITEM_MAX else "Datos inválidos.")
            seen.add(k)
            clean.append((k, m, v))

        def go(conn):
            stale = []
            with conn.transaction():
                conn.execute("select pg_advisory_xact_lock(hashtextextended(%s, 0))", (sid,))
                n, size = conn.execute("select count(*), coalesce(sum(length(v)), 0) from sync_items where sid = %s",
                                       (sid,)).fetchone()
                have = {k: ln for k, ln in conn.execute(
                    "select k, length(v) from sync_items where sid = %s and k = any(%s)", (sid, [c[0] for c in clean])).fetchall()}
                new_n = n + sum(1 for k, _, _ in clean if k not in have)
                new_size = size + sum(len(v) - have.get(k, 0) for k, _, v in clean)
                if new_n > SPACE_ITEMS or new_size > SPACE_BYTES:
                    raise SyncError("Se llegó al límite de lo que se puede sincronizar.")
                for k, m, v in clean:
                    cur = conn.execute(
                        """insert into sync_items (sid, k, mtime, seq, v) values (%s, %s, %s, nextval('sync_seq'), %s)
                           on conflict (sid, k) do update set mtime = excluded.mtime, seq = excluded.seq, v = excluded.v
                           where sync_items.mtime < excluded.mtime""", (sid, k, m, v))
                    if cur.rowcount == 0:
                        stale.append(k)
            return {"ok": True, "stale": stale}
        return self._run(go)
