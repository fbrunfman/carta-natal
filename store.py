"""Cartas guardadas: un archivo JSON en la carpeta de datos del usuario.

Vive fuera de la carpeta de la app a propósito: así sobrevive a reemplazarla por una
versión nueva. Se puede cambiar de lugar con la variable CARTA_NATAL_DATA.
"""
from __future__ import annotations

import json
import math
import os
import re
import sys
import threading
import time
import uuid
from datetime import date as _date
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import available_timezones


class StoreError(ValueError):
    """Dato inválido; el mensaje está en español y se muestra tal cual."""


class NotFound(StoreError):
    pass


def data_dir() -> Path:
    env = os.environ.get("CARTA_NATAL_DATA")
    if env:
        return Path(env).expanduser()
    home = Path.home()
    if sys.platform == "darwin":
        return home / "Library" / "Application Support" / "Carta natal"
    if os.name == "nt":
        return Path(os.environ.get("APPDATA", home)) / "Carta natal"
    return Path(os.environ.get("XDG_DATA_HOME", home / ".local" / "share")) / "carta-natal"


_TZ_NAMES: set[str] | None = None


def _num(value, lo: float, hi: float, label: str) -> float:
    try:
        x = float(value)
    except (TypeError, ValueError):
        raise StoreError(f"{label} tiene que ser un número.")
    if math.isnan(x) or math.isinf(x) or not lo <= x <= hi:
        raise StoreError(f"{label} tiene que estar entre {lo:g} y {hi:g}.")
    return x


def clean(data) -> dict:
    """Valida y normaliza los datos de nacimiento de una carta."""
    global _TZ_NAMES
    if not isinstance(data, dict):
        raise StoreError("Datos inválidos.")

    name = str(data.get("name") or "").strip()
    if not name:
        raise StoreError("Poné un nombre para guardar la carta.")
    if len(name) > 80:
        raise StoreError("El nombre puede tener hasta 80 caracteres.")

    date = str(data.get("date") or "")
    try:
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
            raise ValueError
        _date.fromisoformat(date)
    except ValueError:
        raise StoreError("Completá la fecha de nacimiento.")

    time_ = str(data.get("time") or "")
    if not re.fullmatch(r"\d{2}:\d{2}(:\d{2})?", time_) or int(time_[:2]) > 23 or int(time_[3:5]) > 59:
        raise StoreError("Completá la hora de nacimiento (HH:MM).")

    lat = _num(data.get("lat"), -90, 90, "La latitud")
    lon = _num(data.get("lon"), -180, 180, "La longitud")

    manual = bool(data.get("manual"))
    tz = str(data.get("tz") or "").strip()[:64]
    offset = None
    if manual:
        offset = _num(data.get("offset"), -14, 14, "El offset UTC")
    else:
        if _TZ_NAMES is None:
            _TZ_NAMES = available_timezones()
        if not tz:
            raise StoreError("Falta la zona horaria (o fijá el offset a mano).")
        if tz not in _TZ_NAMES:
            raise StoreError(f"Zona horaria desconocida: «{tz}».")

    return {
        "name": name, "date": date, "time": time_,
        "place": str(data.get("place") or "").strip()[:120],
        "lat": lat, "lon": lon, "tz": tz, "manual": manual, "offset": offset,
    }


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _key(c) -> tuple | None:
    """Lo que hace igual a dos cartas: mismos datos de nacimiento (el id y las fechas de guardado no cuentan)."""
    try:
        manual = bool(c.get("manual"))
        return (str(c.get("name")), str(c.get("date")), str(c.get("time")), float(c.get("lat")), float(c.get("lon")),
                str(c.get("tz") or ""), manual, float(c.get("offset")) if manual else None)
    except (AttributeError, TypeError, ValueError):
        return None


class ChartStore:
    def __init__(self, directory: Path | str | None = None):
        self.dir = Path(directory) if directory else data_dir()
        self.file = self.dir / "cartas.json"
        self._lock = threading.Lock()

    def display_path(self) -> str:
        p = str(self.dir)
        home = str(Path.home())
        return "~" + p[len(home):] if p.startswith(home) else p

    # -- lectura / escritura ------------------------------------------------
    def _read(self) -> list[dict]:
        if not self.file.exists():
            return []
        try:
            charts = json.loads(self.file.read_text(encoding="utf-8"))["charts"]
            if not isinstance(charts, list):
                raise ValueError("charts no es una lista")
            return charts
        except Exception as e:  # archivo dañado: lo apartamos en vez de perderlo
            aside = self.file.with_name(f"cartas.dañado-{int(time.time())}.json")
            try:
                self.file.rename(aside)
                print(f"cartas.json estaba dañado ({e}); se guardó como {aside.name}", file=sys.stderr)
            except OSError:
                pass
            return []

    def _write(self, charts: list[dict]) -> None:
        self.dir.mkdir(parents=True, exist_ok=True)
        tmp = self.file.with_suffix(".tmp")
        tmp.write_text(json.dumps({"version": 1, "charts": charts}, ensure_ascii=False, indent=1), encoding="utf-8")
        os.replace(tmp, self.file)  # escritura atómica: nunca queda a medias

    # -- operaciones ----------------------------------------------------------
    def list(self) -> list[dict]:
        with self._lock:
            return self._read()

    def create(self, data) -> dict:
        rec = clean(data)
        rec["id"] = uuid.uuid4().hex[:12]
        rec["created"] = rec["updated"] = _now()
        with self._lock:
            charts = self._read()
            charts.append(rec)
            self._write(charts)
        return rec

    def import_many(self, items) -> dict:
        """Suma las cartas de un archivo exportado (de esta versión o de la pública). Las que ya están, con los
        mismos datos de nacimiento, se saltean; las que no pasan la validación se cuentan aparte."""
        if not isinstance(items, list) or len(items) > 100:
            raise StoreError("Demasiadas cartas de una vez.")
        added = skipped = failed = 0
        with self._lock:
            charts = self._read()
            known = {_key(c) for c in charts}
            for it in items:
                try:
                    rec = clean(it)
                except StoreError:
                    failed += 1
                    continue
                k = _key(rec)
                if k in known:
                    skipped += 1
                    continue
                known.add(k)
                rec["id"] = uuid.uuid4().hex[:12]
                rec["created"] = rec["updated"] = _now()
                charts.append(rec)
                added += 1
            if added:
                self._write(charts)
        return {"added": added, "skipped": skipped, "failed": failed}

    def update(self, chart_id: str, data) -> dict:
        rec = clean(data)
        with self._lock:
            charts = self._read()
            for i, old in enumerate(charts):
                if old.get("id") == chart_id:
                    rec["id"] = chart_id
                    rec["created"] = old.get("created", _now())
                    rec["updated"] = _now()
                    charts[i] = rec
                    self._write(charts)
                    return rec
        raise NotFound("Esa carta ya no existe.")

    def delete(self, chart_id: str) -> None:
        with self._lock:
            charts = self._read()
            kept = [c for c in charts if c.get("id") != chart_id]
            if len(kept) == len(charts):
                raise NotFound("Esa carta ya no existe.")
            self._write(kept)
