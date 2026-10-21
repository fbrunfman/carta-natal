"""Motor de cálculo: carta natal tropical con Swiss Ephemeris (Moshier).

Sin dependencias web. `compute_chart(params)` devuelve un dict serializable a JSON.
"""
from __future__ import annotations

import math
import threading
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, available_timezones

import swisseph as swe

# Efemérides Moshier incluidas en la librería: no requieren archivos externos.
# Precisión de sub-segundo de arco para los planetas; suficiente para carta natal.
FLAGS = swe.FLG_MOSEPH | swe.FLG_SPEED

BODIES = [
    ("sun", swe.SUN),
    ("moon", swe.MOON),
    ("mercury", swe.MERCURY),
    ("venus", swe.VENUS),
    ("mars", swe.MARS),
    ("jupiter", swe.JUPITER),
    ("saturn", swe.SATURN),
    ("uranus", swe.URANUS),
    ("neptune", swe.NEPTUNE),
    ("pluto", swe.PLUTO),
    ("node", swe.TRUE_NODE),
]

HOUSE_SYSTEMS = {
    "P": "Placidus",
    "K": "Koch",
    "O": "Porfirio",
    "R": "Regiomontano",
    "C": "Campanus",
    "E": "Casas iguales",
    "W": "Signos enteros",
}

# (clave, ángulo, orbe máximo en grados)
ASPECTS = [
    ("conjunction", 0, 8.0),
    ("opposition", 180, 8.0),
    ("trine", 120, 7.0),
    ("square", 90, 7.0),
    ("sextile", 60, 5.0),
    ("quincunx", 150, 2.0),
]

# swisseph no es seguro entre hilos (estado global): serializamos los cálculos.
_lock = threading.Lock()


class ChartError(ValueError):
    """Error de entrada del usuario, con mensaje en español."""


def _norm360(x: float) -> float:
    return x % 360.0


def _norm180(x: float) -> float:
    x = (x + 180.0) % 360.0 - 180.0
    return 180.0 if x == -180.0 else x


def _fmt_offset(hours: float) -> str:
    sign = "+" if hours >= 0 else "−"
    total_min = round(abs(hours) * 60)
    h, m = divmod(total_min, 60)
    return f"UTC{sign}{h}" + (f":{m:02d}" if m else "")


def timezone_names() -> list[str]:
    return sorted(available_timezones())


def _to_utc(naive: datetime, tz_name: str | None, manual_offset: float | None):
    """Convierte hora local civil a UTC. Devuelve (utc, offset_h, info, warnings)."""
    warnings: list[str] = []
    info = {"tzname": None, "dst": False, "manual": False}

    if manual_offset is not None:
        info["manual"] = True
        return naive - timedelta(hours=manual_offset), manual_offset, info, warnings

    if not tz_name:
        raise ChartError("Falta la zona horaria. Elegí una de la lista o fijá el offset a mano.")
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        raise ChartError(f"Zona horaria desconocida: «{tz_name}». Usá un nombre como America/Argentina/Buenos_Aires.")

    a = naive.replace(tzinfo=tz, fold=0)
    b = naive.replace(tzinfo=tz, fold=1)
    off_a, off_b = a.utcoffset(), b.utcoffset()
    utc = (a - off_a).replace(tzinfo=None)

    if off_a != off_b:
        back = utc.replace(tzinfo=ZoneInfo("UTC")).astimezone(tz).replace(tzinfo=None)
        ha, hb = off_a.total_seconds() / 3600, off_b.total_seconds() / 3600
        if back == naive:
            warnings.append(
                f"Esa hora ocurrió dos veces (fin del horario de verano). Se usó {_fmt_offset(ha)}; "
                f"si corresponde la segunda, fijá el offset a mano en {_fmt_offset(hb)}."
            )
        else:
            warnings.append(
                f"Esa hora no existió (adelanto del reloj). Se interpretó con {_fmt_offset(ha)}; "
                f"el offset posterior sería {_fmt_offset(hb)}."
            )

    info["tzname"] = a.tzname()
    info["dst"] = bool(a.dst())
    if a.tzname() == "LMT":
        warnings.append("Para esa fecha la zona usaba hora local media (LMT), no una hora estándar.")
    return utc, off_a.total_seconds() / 3600, info, warnings


def _house_of(lon: float, cusps: list[float]) -> int:
    for i in range(12):
        start, end = cusps[i], cusps[(i + 1) % 12]
        if _norm360(lon - start) < _norm360(end - start):
            return i + 1
    return 12


def _aspect_between(a: dict, b: dict) -> dict | None:
    """Aspecto entre dos puntos {id, lon, speed|None, angle}, o None. `a` y `b` conservan su orden."""
    d = _norm180(b["lon"] - a["lon"])
    dist = abs(d)
    for key, angle, max_orb in ASPECTS:
        orb = abs(dist - angle)
        if orb > max_orb:
            continue
        applying = None
        if a["speed"] is not None and b["speed"] is not None:
            rate = (1 if d >= 0 else -1) * (b["speed"] - a["speed"])  # d|d|/dt
            if orb > 1e-9:
                applying = (rate < 0) if dist > angle else (rate > 0)
        return {
            "a": a["id"], "b": b["id"], "type": key,
            "angle": angle, "orb": round(orb, 5), "applying": applying,
        }
    return None


def _aspects(points: list[dict]) -> list[dict]:
    out = []
    for i in range(len(points)):
        for j in range(i + 1, len(points)):
            a, b = points[i], points[j]
            if a["angle"] and b["angle"]:
                continue
            asp = _aspect_between(a, b)
            if asp:
                out.append(asp)
    out.sort(key=lambda x: x["orb"])
    return out


def _cross_aspects(inner: list[dict], outer: list[dict]) -> list[dict]:
    """Aspectos entre dos juegos de puntos. `a` es siempre del interior (natal / carta A) y
    `b` del exterior (tránsito / carta B). Con velocidad en ambos lados se calcula la fase."""
    out = []
    for a in inner:
        for b in outer:
            if a["angle"] and b["angle"]:
                continue
            asp = _aspect_between(a, b)
            if asp:
                out.append(asp)
    out.sort(key=lambda x: x["orb"])
    return out


def _parse_naive(p: dict) -> datetime:
    try:
        y, mo, d = (int(x) for x in p["date"].split("-"))
        parts = [int(x) for x in p["time"].split(":")]
        hh, mm = parts[0], parts[1]
        ss = parts[2] if len(parts) > 2 else 0
        naive = datetime(y, mo, d, hh, mm, ss)
    except (KeyError, ValueError, IndexError, AttributeError):
        raise ChartError("Revisá la fecha (AAAA-MM-DD) y la hora (HH:MM).")
    if naive.year < 1800 or naive.year > 2400:
        raise ChartError("El año tiene que estar entre 1800 y 2400 para el cálculo con Moshier.")
    return naive


def _resolve_utc(naive: datetime, p: dict):
    manual = p.get("offset")
    try:
        manual = None if manual in (None, "") else float(manual)
    except (TypeError, ValueError):
        raise ChartError("El offset UTC tiene que ser un número de horas.")
    if manual is not None and not -14 <= manual <= 14:
        raise ChartError("El offset UTC tiene que estar entre −14 y +14 horas.")
    return _to_utc(naive, p.get("tz"), manual)


def _julday(utc: datetime) -> float:
    return swe.julday(utc.year, utc.month, utc.day, utc.hour + utc.minute / 60 + utc.second / 3600)


def _calc_bodies(jd: float, node_kind: str, cusps: list[float] | None = None) -> list[dict]:
    """Posiciones de los 11 cuerpos en un instante. Llamar con _lock tomado."""
    bodies = []
    for bid, code in BODIES:
        if bid == "node" and node_kind == "mean":
            code = swe.MEAN_NODE
        xx, _ = swe.calc_ut(jd, code, FLAGS)
        blon, speed = float(xx[0]), float(xx[3])
        b = {"id": bid, "lon": round(blon, 6), "speed": round(speed, 5), "retro": speed < 0 and bid != "node"}
        if cusps is not None:
            b["house"] = _house_of(blon, cusps)
        bodies.append(b)
    return bodies


def compute_chart(p: dict) -> dict:
    # ---- entrada -----------------------------------------------------
    naive = _parse_naive(p)
    date_s, time_s = p["date"], p["time"]

    try:
        lat, lon = float(p["lat"]), float(p["lon"])
    except (KeyError, TypeError, ValueError):
        raise ChartError("Latitud y longitud tienen que ser números (sur y oeste en negativo).")
    if not -90 <= lat <= 90 or not -180 <= lon <= 180:
        raise ChartError("Latitud entre −90 y 90, longitud entre −180 y 180.")

    hsys = (p.get("hsys") or "P").upper()
    if hsys not in HOUSE_SYSTEMS:
        raise ChartError("Sistema de casas no reconocido.")

    utc, offset_h, tzinfo, warnings = _resolve_utc(naive, p)

    # ---- cálculo -----------------------------------------------------
    with _lock:
        jd = _julday(utc)

        used_hsys = hsys
        try:
            if hsys in ("P", "K") and abs(lat) > 66.0:
                raise swe.Error("latitud polar")
            cusps, ascmc = swe.houses_ex(jd, lat, lon, hsys.encode())
        except swe.Error:
            used_hsys = "O"
            cusps, ascmc = swe.houses_ex(jd, lat, lon, b"O")
            warnings.append(
                f"{HOUSE_SYSTEMS[hsys]} no está definido a esta latitud; se usó Porfirio."
            )
        cusps = [float(c) for c in cusps[:12]]
        asc, mc = float(ascmc[0]), float(ascmc[1])

        node_kind = "mean" if p.get("node") == "mean" else "true"
        bodies = _calc_bodies(jd, node_kind, cusps)

    points = [dict(id=b["id"], lon=b["lon"], speed=b["speed"], angle=False) for b in bodies]
    points += [
        dict(id="asc", lon=asc, speed=None, angle=True),
        dict(id="mc", lon=mc, speed=None, angle=True),
    ]

    return {
        "input": {
            "name": (p.get("name") or "").strip(), "date": date_s, "time": time_s,
            "lat": lat, "lon": lon, "tz": p.get("tz") or None,
            "place": (p.get("place") or "").strip(),
        },
        "time": {
            "utc": utc.strftime("%Y-%m-%d %H:%M:%S"),
            "offset": offset_h, "offset_label": _fmt_offset(offset_h),
            "tzname": tzinfo["tzname"], "dst": tzinfo["dst"], "manual": tzinfo["manual"],
            "jd": round(jd, 6),
        },
        "houses": {
            "system": used_hsys, "system_name": HOUSE_SYSTEMS[used_hsys],
            "cusps": [round(c, 6) for c in cusps],
        },
        "angles": {"asc": round(asc, 6), "mc": round(mc, 6)},
        "node_kind": node_kind,
        "bodies": bodies,
        "aspects": _aspects(points),
        "warnings": warnings,
    }


# ======================================================================
# Tránsitos, sinastría y calendario de aspectos exactos
# ======================================================================

def _points_of(chart: dict, speeds: bool) -> list[dict]:
    """Cuerpos de una carta + Asc y MC como puntos para calcular aspectos.
    `speeds=False` deja la velocidad en None (sin fase aplicativa/separativa)."""
    pts = [dict(id=b["id"], lon=b["lon"], speed=b["speed"] if speeds else None, angle=False) for b in chart["bodies"]]
    pts.append(dict(id="asc", lon=chart["angles"]["asc"], speed=None, angle=True))
    pts.append(dict(id="mc", lon=chart["angles"]["mc"], speed=None, angle=True))
    return pts


def compute_transits(natal: dict, at: dict) -> dict:
    """Planetas en el instante `at` {date, time, tz[, offset]} sobre la carta natal `natal`.

    Cruzados: `a` = punto natal, `b` = planeta en tránsito. La carta natal es un punto fijo,
    así que la fase (aplicativo / separativo) depende solo del movimiento del planeta."""
    chart = compute_chart(natal)
    naive = _parse_naive(at)
    utc, offset_h, tzinfo, warnings = _resolve_utc(naive, at)
    with _lock:
        jd = _julday(utc)
        bodies = _calc_bodies(jd, chart["node_kind"], chart["houses"]["cusps"])

    natal_pts = [dict(p, speed=0.0) for p in _points_of(chart, speeds=True)]   # puntos natales: quietos
    transit_pts = [dict(id=b["id"], lon=b["lon"], speed=b["speed"], angle=False) for b in bodies]
    return {
        "natal": chart,
        "at": {
            "date": at["date"], "time": at["time"], "tz": at.get("tz") or None,
            "utc": utc.strftime("%Y-%m-%d %H:%M:%S"),
            "offset": offset_h, "offset_label": _fmt_offset(offset_h),
            "tzname": tzinfo["tzname"], "dst": tzinfo["dst"], "manual": tzinfo["manual"],
            "jd": round(jd, 6),
        },
        "bodies": bodies,
        "aspects": _cross_aspects(natal_pts, transit_pts),
        "warnings": warnings,
    }


def compute_synastry(a_params: dict, b_params: dict) -> dict:
    """Dos cartas natales: aspectos cruzados y planetas de cada una en las casas de la otra.
    Ambas son posiciones de nacimiento, así que no se calcula fase."""
    a = compute_chart(a_params)
    b = compute_chart(b_params)

    def overlay(src: dict, host: dict) -> list[dict]:
        cusps = host["houses"]["cusps"]
        pts = [(x["id"], x["lon"]) for x in src["bodies"]]
        pts += [("asc", src["angles"]["asc"]), ("mc", src["angles"]["mc"])]
        return [{"id": i, "lon": lon, "house": _house_of(lon, cusps)} for i, lon in pts]

    return {
        "a": a, "b": b,
        "aspects": _cross_aspects(_points_of(a, speeds=False), _points_of(b, speeds=False)),
        "overlay": {"b_in_a": overlay(b, a), "a_in_b": overlay(a, b)},
        "warnings": [f"{who}: {w}" for who, ch in (("Carta A", a), ("Carta B", b)) for w in ch["warnings"]],
    }


# ---- calendario ------------------------------------------------------------

CAL_SCOPES = {
    "slow": ["jupiter", "saturn", "uranus", "neptune", "pluto"],
    "mars": ["mars", "jupiter", "saturn", "uranus", "neptune", "pluto"],
    "all": ["sun", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"],
}
CAL_MAX_EVENTS = 800
_CODE = dict(BODIES)


def _add_months(d: datetime, months: int) -> datetime:
    y, m = divmod(d.year * 12 + (d.month - 1) + months, 12)
    m += 1
    last = [31, 29 if (y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
    return d.replace(year=y, month=m, day=min(d.day, last))


def _jd_to_utc(jd: float) -> datetime:
    y, mo, d, h = swe.revjul(jd)
    dt = datetime(y, mo, d) + timedelta(hours=h)
    return (dt + timedelta(seconds=30)).replace(second=0, microsecond=0)   # al minuto más cercano


def _tz_for_display(tz_name, offset_h):
    if tz_name:
        try:
            return ZoneInfo(tz_name)
        except Exception:
            pass
    return timezone(timedelta(hours=offset_h or 0))


def transit_calendar(natal: dict, start: dict, months: int, scope: str = "slow") -> dict:
    """Momentos exactos en que los planetas en tránsito forman aspecto con puntos natales,
    entre `start` y `months` meses después. Se busca el cambio de signo de la diferencia
    angular día a día y se afina por bisección (precisión de un segundo)."""
    if scope not in CAL_SCOPES:
        raise ChartError("Alcance del calendario no reconocido.")
    if not isinstance(months, int) or not 1 <= months <= 36:
        raise ChartError("El período tiene que ser de 1 a 36 meses.")

    chart = compute_chart(natal)
    naive0 = _parse_naive(start)
    utc0, off0, _, warnings = _resolve_utc(naive0, start)
    naive1 = _add_months(naive0, months)
    utc1 = _resolve_utc(naive1, {**start, "date": naive1.strftime("%Y-%m-%d")})[0]

    targets = [(b["id"], b["lon"]) for b in chart["bodies"]]
    targets += [("asc", chart["angles"]["asc"]), ("mc", chart["angles"]["mc"])]
    # (clave, ángulo, desplazamientos respecto del punto natal): 0° y 180° tienen un solo punto exacto
    kinds = [(k, a, (float(a),) if a in (0, 180) else (float(a), -float(a))) for k, a, _ in ASPECTS]

    events = []
    with _lock:
        jd0, jd1 = _julday(utc0), _julday(utc1)
        grid = [jd0 + i for i in range(int(math.floor(jd1 - jd0)) + 1)]
        if grid[-1] < jd1:
            grid.append(jd1)

        def at(code, jd):
            xx, _ = swe.calc_ut(jd, code, FLAGS)
            return float(xx[0]), float(xx[3])

        for bid in CAL_SCOPES[scope]:
            code = _CODE[bid]
            lons = [at(code, jd)[0] for jd in grid]
            for tid, tlon in targets:
                for key, angle, offs in kinds:
                    for off in offs:
                        goal = (tlon + off) % 360.0
                        prev = _norm180(lons[0] - goal)
                        for i in range(1, len(grid)):
                            cur = _norm180(lons[i] - goal)
                            if abs(prev) < 40 and abs(cur) < 40 and ((prev < 0) != (cur < 0)):
                                lo, hi, flo = grid[i - 1], grid[i], prev
                                for _ in range(24):
                                    mid = (lo + hi) / 2
                                    fm = _norm180(at(code, mid)[0] - goal)
                                    if (fm < 0) == (flo < 0):
                                        lo, flo = mid, fm
                                    else:
                                        hi = mid
                                jd = (lo + hi) / 2
                                blon, speed = at(code, jd)
                                events.append({
                                    "jd": jd, "t": bid, "n": tid, "type": key, "off": off,
                                    "retro": speed < 0, "lon": round(blon, 4),
                                })
                            prev = cur

    events.sort(key=lambda e: e["jd"])
    truncated = len(events) > CAL_MAX_EVENTS
    events = events[:CAL_MAX_EVENTS]

    groups: dict = {}
    for e in events:
        groups.setdefault((e["t"], e["n"], e["type"], e["off"]), []).append(e)
    for g in groups.values():
        if len(g) > 1:
            for k, e in enumerate(g, 1):
                e["pass"], e["passes"] = k, len(g)

    disp_tz = _tz_for_display(start.get("tz"), off0)
    out = []
    for e in events:
        u = _jd_to_utc(e["jd"])
        local = u.replace(tzinfo=timezone.utc).astimezone(disp_tz)
        item = {
            "utc": u.strftime("%Y-%m-%d %H:%M"), "local": local.strftime("%Y-%m-%d %H:%M"),
            "t": e["t"], "n": e["n"], "type": e["type"], "retro": e["retro"], "lon": e["lon"],
        }
        if "pass" in e:
            item["pass"], item["passes"] = e["pass"], e["passes"]
        out.append(item)

    return {
        "from": utc0.strftime("%Y-%m-%d %H:%M"), "to": utc1.strftime("%Y-%m-%d %H:%M"),
        "months": months, "scope": scope, "events": out, "truncated": truncated, "warnings": warnings,
    }
