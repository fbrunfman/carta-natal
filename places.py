"""Buscador de lugares para el formulario de la carta (el autocompletado de «Lugar»).

Le pregunta a la API de geocodificación de Open-Meteo (https://open-meteo.com, gratis y sin clave para uso no comercial;
usa datos de GeoNames): por cada búsqueda devuelve localidades con provincia o estado, país en castellano, coordenadas,
zona horaria y población. El pedido lo hace el servidor (no el navegador): Open-Meteo no ve la IP de quien usa la app,
y lo ya buscado queda en memoria un tiempo, así que se repite poco.

Lo que se agrega acá arriba de Open-Meteo: abreviaturas («gral», «pto», «sta»…), números en palabras («9 de julio» →
Nueve de Julio), apodos («caba», «capital federal», «mdq»), un filtro por provincia o país después de una coma
(«san martín, mendoza»; sin coma, si no aparece nada, se prueba igual: «rosario santa fe») y el orden: primero lo que
coincide entero, después lo que empieza igual, y en cada caso las más pobladas (las de Argentina pesan más).

Si Open-Meteo no responde, el formulario sigue con la lista corta de static/places.json. Con CARTA_NATAL_GEOCODER se puede
usar otra dirección con el mismo formato (para pruebas).
"""
import json
import os
import re
import ssl
import threading
import time
import unicodedata
from collections import OrderedDict
from urllib.parse import urlencode
from urllib.request import Request, urlopen

API = os.environ.get("CARTA_NATAL_GEOCODER", "https://geocoding-api.open-meteo.com/v1/search")
MAX_Q = 80
COUNT = 25                 # cuántos resultados se piden a Open-Meteo por búsqueda
TIMEOUT = 6                # segundos
CACHE_MAX = 3000
CACHE_OK = 7 * 86400       # lo encontrado se recuerda una semana
CACHE_EMPTY = 3600         # lo que no encontró nada, una hora

# abreviaturas de los nombres de lugares (sobre todo de Argentina), números en palabras y apodos
ABBR = {"gral": "general", "gdor": "gobernador", "pto": "puerto", "sta": "santa", "sto": "santo", "cnel": "coronel",
        "cte": "comandante", "cmte": "comandante", "tte": "teniente", "pte": "presidente", "pdte": "presidente", "dr": "doctor",
        "ing": "ingeniero", "cdad": "ciudad", "cap": "capitan", "sgto": "sargento", "mte": "monte", "ntra": "nuestra",
        "sra": "senora", "va": "villa", "vla": "villa", "st": "saint", "ft": "fort", "mt": "mount"}
NUM = {str(i + 1): w for i, w in enumerate(["uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once",
       "doce", "trece", "catorce", "quince", "dieciseis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidos",
       "veintitres", "veinticuatro", "veinticinco", "veintiseis", "veintisiete", "veintiocho", "veintinueve", "treinta", "treinta y uno"])}
NICK = {"caba": "buenos aires", "capital federal": "buenos aires", "cap fed": "buenos aires", "bs as": "buenos aires",
        "bsas": "buenos aires", "mdq": "mar del plata", "nyc": "nueva york", "cdmx": "ciudad de mexico", "df": "ciudad de mexico"}


class Unavailable(Exception):
    """Open-Meteo no respondió (sin internet, caído, límite): el formulario usa la lista corta."""


def _ssl_context():
    """Los certificados para hablar con Open-Meteo por https. El Python de python.org en el Mac a veces no trae ninguno
    (hay que correr «Install Certificates»): entonces se usan los de certifi, si está, o los que trae macOS."""
    ctx = ssl.create_default_context()
    if ctx.cert_store_stats().get("x509_ca", 0):
        return ctx
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        pass
    for path in ("/etc/ssl/cert.pem", "/private/etc/ssl/cert.pem", "/etc/ssl/certs/ca-certificates.crt"):
        if os.path.exists(path):
            try:
                return ssl.create_default_context(cafile=path)
            except Exception:
                continue
    return ctx


def fold(t: str) -> str:
    t = unicodedata.normalize("NFD", str(t or "")).lower()
    t = "".join(c for c in t if not unicodedata.combining(c))
    return " ".join(re.sub(r"[^a-z0-9ñ]+", " ", t).split())


class Places:
    def __init__(self, api=API):
        self.api = api
        self._cache = OrderedDict()          # búsqueda → (cuándo vence, resultados)
        self._lock = threading.Lock()
        self.available = True                # para /api/places: si la última vez respondió
        self.last_error = ""
        self._ctx = None

    def start(self):                         # (compatibilidad: no hay nada que cargar)
        pass

    def _fetch(self, name: str) -> list:
        key = fold(name)
        now = time.time()
        with self._lock:
            hit = self._cache.get(key)
            if hit and hit[0] > now:
                self._cache.move_to_end(key)
                return hit[1]
        url = f"{self.api}?{urlencode({'name': name, 'count': COUNT, 'language': 'es', 'format': 'json'})}"
        try:
            if self._ctx is None:
                self._ctx = _ssl_context()
            req = Request(url, headers={"User-Agent": "carta-natal (autocompletado de lugares)", "Accept": "application/json"})
            with urlopen(req, timeout=TIMEOUT, context=self._ctx if url.startswith("https:") else None) as r:
                data = json.loads(r.read().decode("utf-8"))
        except Exception as e:  # sin internet, caído, 429, certificados…
            self.available = False
            self.last_error = f"{type(e).__name__}: {e}"[:300]
            raise Unavailable(self.last_error)
        self.available = True
        res = [x for x in (data.get("results") or []) if isinstance(x, dict)]
        with self._lock:
            self._cache[key] = (now + (CACHE_OK if res else CACHE_EMPTY), res)
            self._cache.move_to_end(key)
            while len(self._cache) > CACHE_MAX:
                self._cache.popitem(last=False)
        return res

    @staticmethod
    def _variants(q: str) -> list:
        """La búsqueda con las abreviaturas y los números en palabras, y los apodos (sin repetir)."""
        out = []
        exp = " ".join(ABBR.get(w, w) for w in q.split(" "))
        num = " ".join(NUM.get(w, w) for w in exp.split(" "))
        for v in (exp, num, NICK.get(q), NICK.get(exp)):
            if v and v != q and v not in out:
                out.append(v)
        return out

    @staticmethod
    def _where_ok(r: dict, filt: str) -> bool:
        if not filt:
            return True
        for c in (r.get("admin1"), r.get("country"), r.get("country_code"), r.get("admin2")):
            c = fold(c or "")
            if c and (c.startswith(filt) or (" " + filt) in (" " + c)):
                return True
        return False

    def _collect(self, names, filt, found, order):
        """Suma a `found` (id → (puntaje, resultado)) lo que devuelve Open-Meteo para cada nombre."""
        for name, q in names:
            for r in self._fetch(name):
                if not self._where_ok(r, filt):
                    continue
                nf = fold(r.get("name"))
                # entero ×10, el comienzo ×3, una palabra del medio ×2 («plata» → Mar del Plata), lo demás (Open-Meteo
                # también busca parecidos) ×1; por la población; las de Argentina ×5
                m = 10 if nf == q else 3 if nf.startswith(q) else 2 if (" " + q) in (" " + nf) else 1
                score = m * max(int(r.get("population") or 0), 1) * (5 if r.get("country_code") == "AR" else 1)
                rid = r.get("id") or (r.get("name"), r.get("latitude"), r.get("longitude"))
                if rid not in found or score > found[rid][0]:
                    found[rid] = (score, r)
                    order.setdefault(rid, len(order))

    def search(self, q, limit=12) -> list:
        raw = str(q or "")[:MAX_Q]
        head, _, tail = raw.partition(",")
        qf, filt = fold(head), fold(tail)
        if len(qf) < 2:
            return []
        found, order = {}, {}
        # lo escrito tal cual (Open-Meteo entiende tildes) y sus variantes
        names = [(head.strip(), qf)] + [(v, v) for v in self._variants(qf)]
        self._collect(names[:4], filt, found, order)
        if not found and not filt and " " in qf:           # «rosario santa fe»: lo último puede ser la provincia o el país
            words = qf.split(" ")
            for k in range(len(words) - 1, max(0, len(words) - 3), -1):
                city = " ".join(words[:k])
                if len(city) < 2:
                    break
                self._collect([(city, city)], " ".join(words[k:]), found, order)
                if found:
                    break
        ranked = sorted(found.items(), key=lambda kv: (-kv[1][0], order[kv[0]]))
        out, seen = [], set()
        for _, (score, r) in ranked:
            if len(out) >= limit:
                break
            try:
                lat, lon, tz = float(r["latitude"]), float(r["longitude"]), str(r["timezone"])
            except (KeyError, TypeError, ValueError):
                continue                                       # sin coordenadas o sin zona horaria no sirve para la carta
            name, admin, country = str(r.get("name") or ""), str(r.get("admin1") or ""), str(r.get("country") or r.get("country_code") or "")
            if admin and (fold(name) in fold(admin) or fold(name).startswith(fold(admin))):
                admin = ""                                     # «Mendoza, Mendoza» o «Buenos Aires, Ciudad de Buenos Aires»
            label = ", ".join([name] + ([admin] if admin else []) + ([country] if country else []))
            if label in seen:                                  # dos con el mismo nombre en la misma provincia: el primero
                continue
            seen.add(label)
            out.append({"label": label, "name": name, "original": "", "admin": admin, "country": country,
                        "lat": round(lat, 4), "lon": round(lon, 4), "tz": tz, "pop": int(r.get("population") or 0)})
        return out
