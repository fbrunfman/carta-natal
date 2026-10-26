#!/usr/bin/env python3
"""Trae a la pestaña Combinar lo que el grupo cargó en Conjugarnos.

    python3 importar_conjugarnos.py conjugarnos-2026-10-25.json

El archivo es el que baja «Exportar» en la página Grupo de Conjugarnos (solo lo ve quien administra).
Reescribe `static/combos-conjugarnos.js` entero, así que se puede repetir cada vez que el grupo cambie.
Después hay que subir los cambios (commit y push) para que Render publique la versión nueva.

Pasan los aportes validados y los que siguen en debate, con una entrada por cada combinación de planetas:
título, autor, tipo (texto, biografía, película o canción), el texto, el link y la justificación.
NO pasan los nombres de las personas (quién lo propuso, votó o comentó), los votos ni los comentarios:
la carta natal se puede abrir con el link sin ser parte del grupo.
"""
import argparse
import json
import os
import sys
from urllib.parse import urlparse

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.path.join(AQUI, "static", "combos-conjugarnos.js")

PLANETAS = {"sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"}
CLASES = {"texto", "biografia", "pelicula", "cancion"}
CON_LINK = {"pelicula", "cancion"}
CUERPO_OPCIONAL = {"pelicula", "cancion"}
ESTADOS = {"validado", "debate"}


def js(valor):
    """Un valor como literal de JavaScript (JSON, con las tildes tal cual)."""
    return json.dumps(valor, ensure_ascii=False).replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")


def limpio(s):
    """Texto sin espacios de más al borde y con saltos de línea normales."""
    return str(s or "").replace("\r\n", "\n").replace("\r", "\n").strip()


def enlace_valido(s):
    """El link si es una dirección web (http o https); si no, None."""
    s = limpio(s)
    if not s:
        return None
    try:
        u = urlparse(s)
    except ValueError:
        return None
    return s if u.scheme in ("http", "https") and u.netloc else None


def convertir(datos):
    """(entradas, avisos) a partir del contenido del export."""
    if not isinstance(datos, dict) or not isinstance(datos.get("textos"), list):
        raise SystemExit("Ese archivo no parece un export de Conjugarnos (falta la lista «textos»).")
    entradas, avisos = [], []
    for t in datos["textos"]:
        if not isinstance(t, dict):
            continue
        titulo, autor = limpio(t.get("titulo")), limpio(t.get("autor"))
        clase = t.get("clase") or "texto"
        cuerpo = limpio(t.get("cuerpo"))
        quien = f"«{titulo or '?'}»"
        if clase not in CLASES:
            avisos.append(f"{quien}: tipo desconocido ({clase!r}); se salteó.")
            continue
        if not titulo or not autor or (not cuerpo and clase not in CUERPO_OPCIONAL):
            avisos.append(f"{quien}: le falta título, autor o texto; se salteó.")
            continue
        enlace = enlace_valido(t.get("enlace")) if clase in CON_LINK else None
        if limpio(t.get("enlace")) and not enlace:
            avisos.append(f"{quien}: el link no es una dirección web; se dejó sin link.")
        for c in t.get("combinaciones") or []:
            planetas = c.get("planetas") if isinstance(c, dict) else None
            if (not isinstance(planetas, list) or not 1 <= len(planetas) <= 2
                    or len(set(planetas)) != len(planetas) or not set(planetas) <= PLANETAS):
                avisos.append(f"{quien}: una combinación con planetas raros ({planetas!r}); se salteó.")
                continue
            if c.get("estado") not in ESTADOS:
                avisos.append(f"{quien}: una combinación con estado raro ({c.get('estado')!r}); se salteó.")
                continue
            e = {"planetas": planetas, "clase": clase, "estado": c["estado"], "titulo": titulo, "autor": autor, "texto": cuerpo}
            if enlace:
                e["enlace"] = enlace
            porque = limpio(c.get("justificacion"))
            if porque:
                e["porque"] = porque
            entradas.append(e)
    return entradas, avisos


def archivo_js(entradas, exportado):
    lineas = [
        "// Lo que el grupo cargó en Conjugarnos, para la pestaña Combinar (la lee combos.js).",
        "// GENERADO por importar_conjugarnos.py a partir del export del grupo: no se edita a mano, se vuelve a generar.",
        "// Una entrada por combinación de planetas. `estado`: «validado» (lo aprobó el grupo) o «debate» (todavía no).",
        "// No lleva nombres de personas, votos ni comentarios. Para agregar algo propio, ver TEXTOS_PROPIOS en combos.js.",
        "",
        f"export const EXPORTADO = {js(exportado)};",
        "",
        "export const CONJUGARNOS = [",
    ]
    for e in entradas:
        lineas.append("  {")
        for k in ("planetas", "clase", "estado", "titulo", "autor", "texto", "enlace", "porque"):
            if k in e:
                lineas.append(f"    {k}: {js(e[k])},")
        lineas.append("  },")
    lineas += ["];", ""]
    return "\n".join(lineas)


def main():
    ap = argparse.ArgumentParser(description="Importa el export de Conjugarnos a la pestaña Combinar.")
    ap.add_argument("export", help="el archivo .json que baja «Exportar» en Conjugarnos")
    ap.add_argument("--salida", default=SALIDA, help="dónde escribir (por defecto static/combos-conjugarnos.js)")
    args = ap.parse_args()
    try:
        with open(args.export, encoding="utf-8") as f:
            datos = json.load(f)
    except (OSError, ValueError) as err:
        raise SystemExit(f"No pude leer {args.export}: {err}")
    entradas, avisos = convertir(datos)
    exportado = str(datos.get("exportado") or "")[:19]
    tmp = args.salida + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(archivo_js(entradas, exportado))
    os.replace(tmp, args.salida)
    val = sum(1 for e in entradas if e["estado"] == "validado")
    print(f"Listo: {len(entradas)} aportes ({val} validados, {len(entradas) - val} en debate) -> {os.path.relpath(args.salida)}")
    for a in avisos:
        print("Aviso:", a, file=sys.stderr)


if __name__ == "__main__":
    main()
