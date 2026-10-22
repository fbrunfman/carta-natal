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


# ======================================================================
# Resumen: tránsitos destacados y próximos eventos
# ======================================================================

def _swe_at(code: int, jd: float) -> tuple[float, float]:
    """Longitud y velocidad (°/día) de un cuerpo. Llamar con _lock tomado."""
    xx, _ = swe.calc_ut(jd, code, FLAGS)
    return float(xx[0]), float(xx[3])


def _bisect(f, lo: float, hi: float, flo: float, rounds: int = 28) -> float:
    """Raíz de `f` entre `lo` y `hi`, sabiendo que `f(lo)` y `f(hi)` tienen distinto signo (flo = f(lo))."""
    for _ in range(rounds):
        mid = (lo + hi) / 2
        fm = f(mid)
        if (fm < 0) == (flo < 0):
            lo, flo = mid, fm
        else:
            hi = mid
    return (lo + hi) / 2


def _local_str(jd: float, tz) -> str:
    u = _jd_to_utc(jd).replace(tzinfo=timezone.utc)
    return u.astimezone(tz).strftime("%Y-%m-%d %H:%M")


# -- tránsitos destacados: planetas lentos con un aspecto cerrado a un punto personal de la carta

FEATURED_BODIES = ["pluto", "neptune", "uranus", "saturn", "jupiter"]            # del más al menos «pesado»
FEATURED_TARGETS = ["sun", "moon", "asc", "mc", "mercury", "venus", "mars", "jupiter", "saturn"]
# (clave, ángulo, orbe máximo): los de armonía duran más, así que se miran con menos orbe
FEATURED_ASPECTS = [("conjunction", 0, 3.0), ("opposition", 180, 3.0), ("square", 90, 3.0),
                    ("trine", 120, 2.0), ("sextile", 60, 2.0)]
FEATURED_PEAK = 1.0                      # dentro de este orbe el tránsito está «en su punto máximo»
FEATURED_SPAN = {"jupiter": (3, 2), "saturn": (4, 3), "uranus": (6, 4), "neptune": (9, 6), "pluto": (12, 8)}
FEATURED_GAP = 450                       # días: tramos separados por menos que esto son el mismo tránsito (retrogradación)
FEATURED_MAX = 12


def _transit_window(code: int, grid: list[float], lons: list[float], i0: int, goal: float, orb: float) -> dict:
    """Cuándo empieza y termina el tránsito que está activo en grid[i0], y sus momentos exactos.
    `grid` y `lons` son el recorrido del planeta; todo en días julianos."""
    near = [abs(_norm180(x - goal)) <= orb for x in lons]
    runs, start = [], None
    for i, ok in enumerate(near):
        if ok and start is None:
            start = i
        elif not ok and start is not None:
            runs.append([start, i - 1])
            start = None
    if start is not None:
        runs.append([start, len(near) - 1])
    merged: list[list[int]] = []
    for a, b in runs:
        if merged and grid[a] - grid[merged[-1][1]] <= FEATURED_GAP:
            merged[-1][1] = b
        else:
            merged.append([a, b])
    a, b = next(m for m in merged if m[0] <= i0 <= m[1])

    def edge(i_out: int, i_in: int) -> float:
        f = lambda jd: abs(_norm180(_swe_at(code, jd)[0] - goal)) - orb
        return _bisect(f, grid[i_out], grid[i_in], f(grid[i_out]), 22)

    since = edge(a - 1, a) if a > 0 else None             # None: empezó antes de lo que se recorre
    until = edge(b + 1, b) if b < len(grid) - 1 else None

    exacts = []
    g = lambda jd: _norm180(_swe_at(code, jd)[0] - goal)
    for i in range(a, b):
        d0, d1 = _norm180(lons[i] - goal), _norm180(lons[i + 1] - goal)
        if (d0 < 0) != (d1 < 0) and abs(d0) < 40 and abs(d1) < 40:
            jd = _bisect(g, grid[i], grid[i + 1], d0)
            exacts.append((jd, _swe_at(code, jd)[1] < 0))
    return {"since": since, "until": until, "exacts": exacts}


def featured_transits(natal: dict, at: dict) -> dict:
    """Tránsitos de Júpiter a Plutón que en el instante `at` forman un aspecto cerrado con el Sol, la Luna,
    los ángulos o los planetas hasta Saturno de la carta natal. De cada uno: orbe, fase, desde y hasta cuándo
    dura (con las retrogradaciones) y los momentos exactos."""
    chart = compute_chart(natal)
    utc, off_h, _, warnings = _resolve_utc(_parse_naive(at), at)
    tz = _tz_for_display(at.get("tz"), off_h)
    pts = {b["id"]: b["lon"] for b in chart["bodies"]}
    pts["asc"], pts["mc"] = chart["angles"]["asc"], chart["angles"]["mc"]

    items = []
    with _lock:
        jd0 = _julday(utc)
        for t in FEATURED_BODIES:
            code = _CODE[t]
            lon0, speed0 = _swe_at(code, jd0)
            active = []
            for n in FEATURED_TARGETS:
                for key, angle, orb in FEATURED_ASPECTS:
                    offs = (float(angle),) if angle in (0, 180) else (float(angle), -float(angle))
                    for off in offs:
                        goal = (pts[n] + off) % 360.0
                        d = _norm180(lon0 - goal)
                        if abs(d) <= orb:
                            active.append((n, key, goal, orb, d))
            if not active:
                continue

            years, step = FEATURED_SPAN[t]
            half = int(years * 365.25 / step)
            grid = [jd0 + (i - half) * step for i in range(2 * half + 1)]
            lons = [lon0 if i == half else _swe_at(code, g)[0] for i, g in enumerate(grid)]
            for n, key, goal, orb, d in active:
                w = _transit_window(code, grid, lons, half, goal, orb)
                ex = w["exacts"]
                nxt = [e for e in ex if e[0] > jd0]
                applying = bool(nxt) if ex else d * speed0 < 0
                items.append({
                    "t": t, "n": n, "type": key, "orb": round(abs(d), 4), "retro": speed0 < 0,
                    "applying": applying, "peak": abs(d) <= FEATURED_PEAK,
                    "since": _local_str(w["since"], tz) if w["since"] is not None else None,
                    "until": _local_str(w["until"], tz) if w["until"] is not None else None,
                    "exacts": [{"local": _local_str(jd, tz), "retro": r, "past": jd <= jd0} for jd, r in ex],
                })

    items.sort(key=lambda it: (not it["peak"], FEATURED_BODIES.index(it["t"]), FEATURED_TARGETS.index(it["n"]), it["orb"]))
    return {
        "at": {"date": at["date"], "time": at["time"], "tz": at.get("tz") or None, "utc": utc.strftime("%Y-%m-%d %H:%M")},
        "items": items[:FEATURED_MAX], "total": len(items), "warnings": warnings,
    }


# -- próximos eventos: ingresos a signos, estaciones y entradas a las casas natales

UPCOMING_BODIES = ["sun", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"]
UPCOMING_MAX_DAYS = 400
UPCOMING_MAX_EVENTS = 400


def upcoming_events(natal: dict, at: dict, days: int) -> dict:
    """Desde el instante `at` y durante `days` días: cuándo cada planeta (sin la Luna) cambia de signo, cuándo
    se detiene para retrogradar o volver a directo, y cuándo entra en una casa de la carta natal.
    Se busca el cruce día a día y se afina por bisección."""
    if not isinstance(days, int) or isinstance(days, bool) or not 1 <= days <= UPCOMING_MAX_DAYS:
        raise ChartError(f"El período tiene que ser de 1 a {UPCOMING_MAX_DAYS} días.")
    chart = compute_chart(natal)
    cusps = chart["houses"]["cusps"]
    utc0, off_h, _, warnings = _resolve_utc(_parse_naive(at), at)
    tz = _tz_for_display(at.get("tz"), off_h)
    signs = [30.0 * k for k in range(12)]

    found = []
    with _lock:
        jd0 = _julday(utc0)
        grid = [jd0 + i for i in range(days + 1)]
        for bid in UPCOMING_BODIES:
            code = _CODE[bid]
            series = [_swe_at(code, g) for g in grid]
            lons = [s[0] for s in series]
            speeds = [s[1] for s in series]
            f_speed = lambda jd, c=code: _swe_at(c, jd)[1]

            def crossing(i: int, boundary: float):
                """Instante en que el planeta pasa por `boundary` entre grid[i] y grid[i+1], o None."""
                d0 = _norm180(lons[i] - boundary)
                if abs(d0) > 3.0:                        # en un día no se mueve tanto
                    return None
                d1 = _norm180(lons[i + 1] - boundary)
                if (d0 < 0) == (d1 < 0):
                    return None
                f = lambda jd, c=code: _norm180(_swe_at(c, jd)[0] - boundary)
                return _bisect(f, grid[i], grid[i + 1], d0), d0 < 0       # (jd, avanzando)

            for i in range(len(grid) - 1):
                for idx, b in enumerate(signs):
                    hit = crossing(i, b)
                    if hit:
                        jd, fwd = hit
                        lon, sp = _swe_at(code, jd)
                        found.append({"jd": jd, "kind": "sign", "body": bid, "retro": sp < 0,
                                      "sign": idx if fwd else (idx - 1) % 12, "house": _house_of(lon, cusps)})
                for idx, b in enumerate(cusps):
                    hit = crossing(i, b)
                    if hit:
                        jd, fwd = hit
                        lon, sp = _swe_at(code, jd)
                        found.append({"jd": jd, "kind": "house", "body": bid, "retro": sp < 0,
                                      "sign": int(lon // 30) % 12, "house": idx + 1 if fwd else (idx if idx else 12)})
                s0, s1 = speeds[i], speeds[i + 1]
                if bid != "sun" and s0 != 0 and (s0 < 0) != (s1 < 0):
                    jd = _bisect(f_speed, grid[i], grid[i + 1], s0)
                    lon, _ = _swe_at(code, jd)
                    found.append({"jd": jd, "kind": "station", "body": bid, "to": "retro" if s0 > 0 else "direct",
                                  "retro": s0 > 0, "sign": int(lon // 30) % 12, "house": _house_of(lon, cusps)})

    found.sort(key=lambda e: e["jd"])
    truncated = len(found) > UPCOMING_MAX_EVENTS
    out = []
    for e in found[:UPCOMING_MAX_EVENTS]:
        u = _jd_to_utc(e.pop("jd"))
        e["utc"] = u.strftime("%Y-%m-%d %H:%M")
        e["local"] = u.replace(tzinfo=timezone.utc).astimezone(tz).strftime("%Y-%m-%d %H:%M")
        out.append(e)
    return {
        "from": utc0.strftime("%Y-%m-%d %H:%M"), "days": days, "events": out, "truncated": truncated,
        "warnings": warnings,
    }


# ======================================================================
# Luna: dónde está ahora y calendario del mes
# ======================================================================

MOON_QUARTERS = [(0, "new", "Luna nueva"), (90, "first", "Cuarto creciente"), (180, "full", "Luna llena"),
                 (270, "last", "Cuarto menguante")]
# nombre según la elongación (Luna − Sol), en sectores de 45° centrados en las fases principales
MOON_SECTORS = ["Luna nueva", "Luna creciente", "Cuarto creciente", "Gibosa creciente",
                "Luna llena", "Gibosa menguante", "Cuarto menguante", "Luna menguante"]
MOON_MIN_YEAR, MOON_MAX_YEAR = 1800, 2400


def _zone(name) -> ZoneInfo:
    try:
        return ZoneInfo(name or "UTC")
    except Exception:
        raise ChartError(f"Zona horaria desconocida: «{name}». Usá un nombre como America/Argentina/Buenos_Aires.")


def _moon_lon(jd: float) -> float:
    return _swe_at(swe.MOON, jd)[0]


def _elong(jd: float) -> float:
    """Elongación de la Luna al Sol, 0..360 (0 = nueva, 180 = llena). Llamar con _lock tomado."""
    return _norm360(_swe_at(swe.MOON, jd)[0] - _swe_at(swe.SUN, jd)[0])


def _first_crossing(f, jd0: float, step: float, limit: float, backwards: bool = False) -> float | None:
    """Instante en que `f` (ángulo ya centrado: negativo antes del cruce, positivo después) pasa de − a +,
    buscando desde `jd0` hacia adelante (o hacia atrás) de a `step` días hasta `limit` días."""
    sgn = -1.0 if backwards else 1.0
    a, fa = jd0, f(jd0)
    t = 0.0
    while t < limit:
        b = jd0 + sgn * (t + step)
        fb = f(b)
        lo, hi, flo, fhi = (a, b, fa, fb) if not backwards else (b, a, fb, fa)
        if flo < 0 <= fhi and abs(flo) < 90 and abs(fhi) < 90:
            return _bisect(f, lo, hi, flo)
        a, fa = b, fb
        t += step
    return None


def _utc_str(jd: float) -> str:
    return _jd_to_utc(jd).strftime("%Y-%m-%d %H:%M")


def _moon_point(jd: float, tz, ingress: int | None = None) -> dict:
    """La Luna en ese instante. Con `ingress` (índice de signo) es el momento exacto en que entra a ese signo:
    0°00′ de él, aunque el redondeo al minuto la deje apenas antes."""
    if ingress is not None:
        return {"utc": _utc_str(jd), "local": _local_str(jd, tz), "sign": ingress, "deg": 0, "min": 0}
    lon = _moon_lon(jd)
    return {"utc": _utc_str(jd), "local": _local_str(jd, tz), "sign": int(lon // 30) % 12,
            "deg": int(lon % 30), "min": int((lon % 1) * 60)}


def _phase_info(e: float) -> dict:
    return {"elong": round(e, 2), "illum": round((1 - math.cos(math.radians(e))) / 2, 4), "waxing": e < 180,
            "name": MOON_SECTORS[int(((e + 22.5) % 360) // 45)]}


def moon_now(p: dict) -> dict:
    """La Luna en este momento (o en `at`, «AAAA-MM-DD HH:MM» en UTC): signo, grado, fase, desde cuándo está
    en ese signo, cuándo cambia al siguiente y las próximas cuatro fases principales."""
    tz = _zone(p.get("tz"))
    if p.get("at"):
        try:
            utc = datetime.strptime(str(p["at"]), "%Y-%m-%d %H:%M")
        except ValueError:
            raise ChartError("El momento tiene que ser «AAAA-MM-DD HH:MM» en UTC.")
        if not MOON_MIN_YEAR <= utc.year <= MOON_MAX_YEAR:
            raise ChartError(f"El año tiene que estar entre {MOON_MIN_YEAR} y {MOON_MAX_YEAR}.")
    else:
        utc = datetime.now(timezone.utc).replace(tzinfo=None, second=0, microsecond=0)
    with _lock:
        jd = _julday(utc)
        lon, speed = _swe_at(swe.MOON, jd)
        sign = int(lon // 30) % 12
        nxt = _first_crossing(lambda j: _norm180(_moon_lon(j) - (sign + 1) * 30.0), jd, 0.25, 6)
        prv = _first_crossing(lambda j: _norm180(_moon_lon(j) - sign * 30.0), jd, 0.25, 6, backwards=True)
        phases = []
        q = int(_elong(jd) // 90)
        for k in range(1, 6):                       # cinco cruces alcanzan para cuatro fases con margen
            target = ((q + k) % 4) * 90.0
            j = _first_crossing(lambda x, t=target: _norm180(_elong(x) - t), jd, 0.25, 40)
            if j is None:
                continue
            kind = next(m for m in MOON_QUARTERS if m[0] == target)
            phases.append({"kind": kind[1], "name": kind[2], **_moon_point(j, tz)})
        info = _phase_info(_elong(jd))
    return {
        "utc": utc.strftime("%Y-%m-%d %H:%M"),
        "local": utc.replace(tzinfo=timezone.utc).astimezone(tz).strftime("%Y-%m-%d %H:%M"),
        "tz": tz.key, "lon": round(lon, 4), "sign": sign, "deg": int(lon % 30), "min": int((lon % 1) * 60),
        "speed": round(speed, 3), **info,
        "since": _moon_point(prv, tz, sign) if prv else None,
        "next_sign": _moon_point(nxt, tz, (sign + 1) % 12) if nxt else None,
        "next_phases": phases[:4],
    }


def moon_month(p: dict) -> dict:
    """Mes completo (hora de la zona elegida): por día, el signo en que termina, la hora en que la Luna cambia
    de signo (si cambia ese día) y la fase al mediodía; más las fases principales del mes con su hora."""
    tz = _zone(p.get("tz"))
    try:
        year, month = int(p["year"]), int(p["month"])
    except (KeyError, TypeError, ValueError):
        raise ChartError("Elegí un mes y un año.")
    if not 1 <= month <= 12 or not MOON_MIN_YEAR <= year <= MOON_MAX_YEAR:
        raise ChartError(f"El mes tiene que ser de 1 a 12 y el año de {MOON_MIN_YEAR} a {MOON_MAX_YEAR}.")
    ndays = (datetime(year + (month == 12), month % 12 + 1, 1) - datetime(year, month, 1)).days

    def jd_of_local(y, m, d, hh=0, mm=0):
        u = datetime(y, m, d, hh, mm, tzinfo=tz).astimezone(timezone.utc).replace(tzinfo=None)
        return _julday(u)

    days = []
    with _lock:
        for d in range(1, ndays + 1):
            j0 = jd_of_local(year, month, d)
            nxt_day = datetime(year, month, d) + timedelta(days=1)
            j1 = jd_of_local(nxt_day.year, nxt_day.month, nxt_day.day)
            s0 = int(_moon_lon(j0) // 30) % 12
            s1 = int(_moon_lon(j1 - 1 / 1440) // 30) % 12
            ingress = None
            if s0 != s1:
                jc = _bisect(lambda j, b=s1 * 30.0: _norm180(_moon_lon(j) - b), j0, j1, _norm180(_moon_lon(j0) - s1 * 30.0))
                ingress = {"sign": s1, "time": _local_str(jc, tz)[11:16], "utc": _utc_str(jc)}
            e_noon = _elong(jd_of_local(year, month, d, 12))
            days.append({"day": d, "weekday": datetime(year, month, d).weekday(), "sign": s1, "ingress": ingress,
                         "from_sign": s0, **_phase_info(e_noon)})

        # fases principales: se recorre el mes (con un día de margen) buscando cuándo la elongación cruza 0/90/180/270
        a = jd_of_local(year, month, 1) - 1.0
        b = jd_of_local(*((year + (month == 12), month % 12 + 1, 1))) + 1.0
        events, t = [], a
        prev = _elong(t)
        while t < b:
            t2 = t + 0.25
            cur = _elong(t2)
            if int(cur // 90) != int(prev // 90):
                target = (int(cur // 90) * 90) % 360
                jc = _bisect(lambda j, tg=float(target): _norm180(_elong(j) - tg), t, t2, _norm180(prev - target))
                pt = _moon_point(jc, tz)
                if pt["local"][:7] == f"{year:04d}-{month:02d}":
                    kind = next(m for m in MOON_QUARTERS if m[0] == target)
                    events.append({"kind": kind[1], "name": kind[2], "day": int(pt["local"][8:10]), **pt})
            t, prev = t2, cur

    return {"year": year, "month": month, "tz": tz.key, "days": days, "phases": events,
            "first_weekday": days[0]["weekday"]}
