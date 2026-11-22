"""Imágenes propias de cada carta: solo en la versión local (la de la Mac). No se sincronizan ni van en «Exportar copia».

Viven en la carpeta de datos, al lado de cartas.json:
    imagenes.json             el índice: de qué carta es cada una, título, comentario y vínculos
    imagenes/<id>.<ext>       la imagen (la app la achica a 2000 px antes de mandarla)
    imagenes/<id>-t.<ext>     la miniatura, para la galería

Los vínculos son los mismos que los de las notas (planeta, casa, Asc, MC, aspecto), con la foto de cómo estaba la carta
al vincular (signo, casa, tipo de aspecto): así la galería busca por posición sin tener que calcular cada carta.
"""
from __future__ import annotations

import base64
import binascii
import json
import os
import secrets
import sys
import threading
import time
from pathlib import Path

from store import CHART_ID, NOTE_REF, REF_MAX, StoreError, NotFound, _snap, data_dir

IMAGE_ID = CHART_ID                     # 12 hexadecimales
IMAGE_BYTES = 12 * 1024 * 1024          # por imagen (ya achicada, suele andar por los 300 KB)
THUMB_BYTES = 1024 * 1024
IMAGE_MAX = 5000                        # entre todas las cartas
TITLE_MAX = 120
TEXT_MAX = 2000
EXT = {"webp": "image/webp", "jpg": "image/jpeg", "png": "image/png"}


def _kind(raw: bytes) -> str | None:
    """El formato por los primeros bytes (no por lo que diga quien manda)."""
    if raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":
        return "webp"
    if raw[:3] == b"\xff\xd8\xff":
        return "jpg"
    if raw[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    return None


def _decode(value, limit: int, label: str) -> tuple[bytes, str]:
    if not isinstance(value, str) or not value:
        raise StoreError(f"Falta {label}.")
    if value.startswith("data:"):
        value = value.split(",", 1)[-1]
    if len(value) > limit * 4 // 3 + 8:
        raise StoreError("La imagen es demasiado grande.")
    try:
        raw = base64.b64decode(value, validate=True)
    except (binascii.Error, ValueError):
        raise StoreError("La imagen no llegó bien.")
    kind = _kind(raw)
    if not kind:
        raise StoreError("Ese archivo no es una imagen que la app pueda guardar (WebP, JPEG o PNG).")
    return raw, kind


def _text(value, limit: int) -> str:
    if value is None:
        return ""
    if not isinstance(value, str):
        raise StoreError("Datos inválidos.")
    return value.strip()[:limit]


def _refs(data: dict) -> tuple[list, dict]:
    refs, snap = [], {}
    raw = data.get("refs") or []
    snaps = data.get("snap") if isinstance(data.get("snap"), dict) else {}
    if not isinstance(raw, list):
        raise StoreError("Datos inválidos.")
    for r in raw:
        if isinstance(r, str) and NOTE_REF.match(r) and r not in refs:
            refs.append(r)
            s = _snap(snaps.get(r))
            if s:
                snap[r] = s
        if len(refs) >= REF_MAX:
            break
    return refs, snap


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


class ImageStore:
    def __init__(self, directory: Path | str | None = None):
        self.base = Path(directory) if directory else data_dir()
        self.dir = self.base / "imagenes"
        self.file = self.base / "imagenes.json"
        self._lock = threading.Lock()

    # -- índice -----------------------------------------------------------------
    def _read(self) -> list[dict]:
        if not self.file.exists():
            return []
        try:
            items = json.loads(self.file.read_text(encoding="utf-8"))["images"]
            if not isinstance(items, list):
                raise ValueError("images no es una lista")
            return [x for x in items if isinstance(x, dict) and IMAGE_ID.match(str(x.get("id", "")))]
        except Exception as e:  # dañado: se aparta en vez de perderlo (las imágenes siguen en la carpeta)
            aside = self.file.with_name(f"imagenes.dañado-{int(time.time())}.json")
            try:
                self.file.rename(aside)
                print(f"imagenes.json estaba dañado ({e}); se guardó como {aside.name}", file=sys.stderr)
            except OSError:
                pass
            return []

    def _write(self, items: list[dict]) -> None:
        self.base.mkdir(parents=True, exist_ok=True)
        tmp = self.file.with_suffix(".tmp")
        tmp.write_text(json.dumps({"version": 1, "images": items}, ensure_ascii=False, indent=1), encoding="utf-8")
        os.replace(tmp, self.file)

    def _files(self, rec: dict) -> list[Path]:
        ext = rec.get("ext") if rec.get("ext") in EXT else "webp"
        t = rec.get("thumb_ext") if rec.get("thumb_ext") in EXT else ext
        return [self.dir / f"{rec['id']}.{ext}", self.dir / f"{rec['id']}-t.{t}"]

    # -- operaciones ------------------------------------------------------------
    def list(self) -> list[dict]:
        with self._lock:
            return self._read()

    def create(self, data) -> dict:
        if not isinstance(data, dict):
            raise StoreError("Datos inválidos.")
        chart = data.get("chart")
        if not isinstance(chart, str) or not CHART_ID.match(chart):
            raise StoreError("Falta la carta.")
        raw, ext = _decode(data.get("data"), IMAGE_BYTES, "la imagen")
        thumb, t_ext = _decode(data.get("thumb"), THUMB_BYTES, "la miniatura")
        refs, snap = _refs(data)
        dims = {}
        for k in ("w", "h"):
            v = data.get(k)
            if isinstance(v, int) and not isinstance(v, bool) and 0 < v <= 20000:
                dims[k] = v
        with self._lock:
            items = self._read()
            if len(items) >= IMAGE_MAX:
                raise StoreError(f"Ya hay {IMAGE_MAX} imágenes guardadas: borrá alguna para sumar otra.")
            ids = {x["id"] for x in items}
            iid = secrets.token_hex(6)
            while iid in ids:
                iid = secrets.token_hex(6)
            rec = {"id": iid, "chart": chart, "ext": ext, "thumb_ext": t_ext,
                   "title": _text(data.get("title"), TITLE_MAX), "text": _text(data.get("text"), TEXT_MAX),
                   "refs": refs, "snap": snap, **dims, "at": _now()}
            self.dir.mkdir(parents=True, exist_ok=True)
            (self.dir / f"{iid}.{ext}").write_bytes(raw)
            (self.dir / f"{iid}-t.{t_ext}").write_bytes(thumb)
            items.append(rec)
            try:
                self._write(items)
            except OSError:
                for p in self._files(rec):
                    p.unlink(missing_ok=True)
                raise
        return rec

    def update(self, image_id: str, data) -> dict:
        if not isinstance(data, dict):
            raise StoreError("Datos inválidos.")
        with self._lock:
            items = self._read()
            rec = next((x for x in items if x["id"] == image_id), None)
            if not rec:
                raise NotFound("Esa imagen ya no existe.")
            if "title" in data:
                rec["title"] = _text(data.get("title"), TITLE_MAX)
            if "text" in data:
                rec["text"] = _text(data.get("text"), TEXT_MAX)
            if "refs" in data:
                rec["refs"], rec["snap"] = _refs(data)
            rec["edited"] = _now()
            self._write(items)
        return rec

    def delete(self, image_id: str) -> None:
        with self._lock:
            items = self._read()
            rec = next((x for x in items if x["id"] == image_id), None)
            if not rec:
                raise NotFound("Esa imagen ya no existe.")
            self._write([x for x in items if x is not rec])
        for p in self._files(rec):
            p.unlink(missing_ok=True)

    def delete_chart(self, chart_id: str) -> int:
        """Las imágenes de una carta que se borró (a pedido de la persona, desde la app)."""
        with self._lock:
            items = self._read()
            gone = [x for x in items if x.get("chart") == chart_id]
            if gone:
                self._write([x for x in items if x.get("chart") != chart_id])
        for rec in gone:
            for p in self._files(rec):
                p.unlink(missing_ok=True)
        return len(gone)

    def file_of(self, image_id: str, thumb: bool) -> tuple[Path, str] | None:
        """El archivo de una imagen (o de su miniatura) y su tipo, o None."""
        with self._lock:
            rec = next((x for x in self._read() if x["id"] == image_id), None)
        if not rec:
            return None
        ext = rec.get("thumb_ext" if thumb else "ext")
        if ext not in EXT:
            return None
        p = self.dir / f"{image_id}{'-t' if thumb else ''}.{ext}"
        return (p, EXT[ext]) if p.is_file() else None
