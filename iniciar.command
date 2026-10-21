#!/bin/bash
# Doble clic para abrir Carta natal. La primera vez prepara un entorno propio (.venv).
cd "$(dirname "$0")" || exit 1

pausa() { echo; read -n 1 -s -r -p "Presioná una tecla para cerrar."; echo; }

if ! command -v python3 >/dev/null 2>&1; then
  echo "No encuentro Python 3."
  echo "Instalá las herramientas de línea de comandos de Apple con:  xcode-select --install"
  pausa; exit 1
fi

if [ ! -x .venv/bin/python ]; then
  echo "Primera vez: preparando el entorno (puede tardar uno o dos minutos)..."
  rm -rf .venv
  python3 -m venv .venv || { pausa; exit 1; }
  .venv/bin/pip install -q --upgrade pip setuptools wheel
  if ! .venv/bin/pip install -q -r requirements.txt; then
    echo
    echo "No se pudo instalar pyswisseph. Suele faltar el compilador de Apple:"
    echo "    xcode-select --install"
    echo "Después volvé a abrir este archivo."
    rm -rf .venv
    pausa; exit 1
  fi
fi

exec .venv/bin/python app.py --open --port "${PORT:-8765}"
