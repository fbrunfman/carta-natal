"""Cartas guardadas: un archivo JSON en la carpeta de datos del usuario.

Vive fuera de la carpeta de la app a propósito: así sobrevive a reemplazarla por una
versión nueva. Se puede cambiar de lugar con la variable CARTA_NATAL_DATA.
"""
from __future__ import annotations

import json
import math
import os
import re
import secrets
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


# -- notas de una carta --------------------------------------------------------
# Cada carta lleva una lista de notas: un texto libre con sus vínculos (a qué de la carta se refiere: planetas en su casa y
# su signo, casas, el Ascendente, el Medio Cielo, aspectos). Viajan con la carta (se exportan e importan con ella). Las de
# antes (una sola por cosa, en un objeto) pasan a la lista.
NOTE_REF = re.compile(r"^(asc|mc|house:(?:[1-9]|1[0-2])|pl:[a-z]{2,10}|asp:[a-z]{2,10}\|[a-z]{2,10})$")
OLD_KEY = re.compile(r"^(general|asc|mc|pl:[a-z]{2,10}|asp:[a-z]{2,10}\|[a-z]{2,10}|fig:[a-z]{2,10}\|[a-z]{2,10}\|[a-z]{2,10})$")
NOTE_ID = re.compile(r"^[a-z0-9]{2,16}$")
NOTE_MAX = 150            # notas por carta
NOTE_TEXT = 5000          # caracteres por nota
REF_MAX = 24              # vínculos por nota
SNAP_STR = re.compile(r"^[a-z]{2,16}$")
ISO = re.compile(r"\d{4}-\d{2}-\d{2}T[\d:.]+Z?")


def _snap(v) -> dict:
    """Lo que había en la carta cuando se vinculó (signo, casa, aspecto): para avisar si cambió."""
    out = {}
    if not isinstance(v, dict):
        return out
    x = v.get("sign")
    if isinstance(x, int) and not isinstance(x, bool) and 0 <= x <= 11:
        out["sign"] = x
    x = v.get("house")
    if isinstance(x, int) and not isinstance(x, bool) and 1 <= x <= 12:
        out["house"] = x
    t = v.get("type")
    if isinstance(t, str) and SNAP_STR.match(t):
        out["type"] = t
    return out


def _asp(a: str, b: str) -> str:
    return "asp:" + "|".join(sorted((a, b)))


def _from_legacy(data: dict) -> list:
    """Las notas de antes ({cosa: {text, at, snap}}) como lista: cada una con ese vínculo (una figura, con sus tres aspectos)."""
    out = []
    for i, (k, v) in enumerate(data.items()):
        if not isinstance(k, str) or not OLD_KEY.match(k) or not isinstance(v, dict):
            raise StoreError("Notas inválidas.")
        snap = v.get("snap") if isinstance(v.get("snap"), dict) else {}
        note = {"id": f"m{i}", "text": v.get("text"), "at": v.get("at"), "refs": [], "snap": {}}
        if k.startswith("fig:"):
            a, b, c = k[4:].split("|")
            types = snap.get("types") if isinstance(snap.get("types"), list) else []
            for j, (x, y) in enumerate(((a, b), (a, c), (b, c))):
                key = _asp(x, y)
                note["refs"].append(key)
                if j < len(types):
                    note["snap"][key] = {"type": types[j]}
        elif k != "general":
            key = _asp(*k[4:].split("|")) if k.startswith("asp:") else k
            note["refs"].append(key)
            note["snap"][key] = snap
        out.append(note)
    return out


def clean_notes(data) -> list:
    """Valida las notas de una carta (una lista). Las vacías se descartan."""
    if data is None:
        return []
    if isinstance(data, dict):
        data = _from_legacy(data)
    if not isinstance(data, list):
        raise StoreError("Notas inválidas.")
    if len(data) > NOTE_MAX:
        raise StoreError(f"Una carta puede tener hasta {NOTE_MAX} notas.")
    out, seen = [], set()
    for v in data:
        if not isinstance(v, dict):
            raise StoreError("Notas inválidas.")
        text = v.get("text")
        if not isinstance(text, str):
            raise StoreError("Notas inválidas.")
        if not text.strip():
            continue
        if len(text) > NOTE_TEXT:
            raise StoreError(f"Una nota puede tener hasta {NOTE_TEXT} caracteres.")
        nid = v.get("id")
        if not isinstance(nid, str) or not NOTE_ID.match(nid) or nid in seen:
            nid = secrets.token_hex(5)
        seen.add(nid)
        at = v.get("at")
        at = at if isinstance(at, str) and ISO.fullmatch(at) else _now()
        refs_in = v.get("refs", [])
        if not isinstance(refs_in, list) or len(refs_in) > REF_MAX:
            raise StoreError(f"Una nota puede tener hasta {REF_MAX} vínculos.")
        snaps = v.get("snap") if isinstance(v.get("snap"), dict) else {}
        refs, snap = [], {}
        for r in refs_in:
            if not isinstance(r, str) or not NOTE_REF.match(r):
                raise StoreError("Notas inválidas.")
            if r.startswith("asp:"):
                a, b = r[4:].split("|")
                if a >= b:
                    raise StoreError("Notas inválidas.")
            if r in refs:
                continue
            refs.append(r)
            s = _snap(snaps.get(r))
            if s:
                snap[r] = s
        out.append({"id": nid, "text": text, "at": at, "refs": refs, "snap": snap})
    return out


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
                try:
                    notes = clean_notes(it.get("notes")) if isinstance(it, dict) else {}
                except StoreError:
                    notes = {}                      # notas dañadas: entra la carta sin ellas
                if notes:
                    rec["notes"] = notes
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
                    if old.get("notes"):            # cambiar los datos de nacimiento no borra las notas
                        rec["notes"] = old["notes"]
                    charts[i] = rec
                    self._write(charts)
                    return rec
        raise NotFound("Esa carta ya no existe.")

    def set_notes(self, chart_id: str, notes) -> dict:
        """Reemplaza las notas de una carta (sin tocar sus datos de nacimiento)."""
        clean_ = clean_notes(notes)
        with self._lock:
            charts = self._read()
            for i, old in enumerate(charts):
                if old.get("id") == chart_id:
                    rec = dict(old)
                    if clean_:
                        rec["notes"] = clean_
                    else:
                        rec.pop("notes", None)
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
