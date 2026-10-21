#!/bin/bash
# Carta natal.app — lanzador. Arranca el servidor si hace falta y abre la ventana de la app.
# Lo ejecuta macOS al hacer doble clic en el ícono; no abre Terminal.
#
# De dónde saca el código: si el instalador anotó la carpeta del proyecto (Resources/carpeta.txt) y esa
# carpeta sigue existiendo, corre desde ahí, así que los cambios en esos archivos se ven al abrir la app.
# Si no existe, o el servidor no arranca desde ahí, usa la copia que lleva la propia app (Resources/app).

RES="$(cd "$(dirname "$0")/../Resources" && pwd)"
INTERNA="$RES/app"
CARPETA="$(cat "$RES/carpeta.txt" 2>/dev/null)"
DATA="$HOME/Library/Application Support/Carta natal"
PY="$DATA/venv/bin/python"
LOG="$DATA/servidor.log"
FIRST_PORT="${CARTA_PORT:-8765}"

aviso() {   # aviso "mensaje" ["ver-registro"]
  local msg="$1" botones='{"Cerrar"}'
  [ -n "$2" ] && botones='{"Cerrar", "Ver registro"}'
  local r
  r="$(osascript -e "display dialog \"$msg\" with title \"Carta natal\" buttons $botones default button 1 with icon caution" 2>/dev/null)"
  case "$r" in *"Ver registro"*) open "$LOG" ;; esac
}

notificar() {
  osascript -e "display notification \"$1\" with title \"Carta natal\"" >/dev/null 2>&1
}

# ¿Ya hay un servidor de Carta natal en ese puerto? (el parámetro le avisa que enseguida llega una ventana)
vivo() { curl -s --max-time 1 "http://127.0.0.1:$1/api/ping?launcher=1" 2>/dev/null | grep -q '"carta-natal"'; }

# ¿Hay algo escuchando en ese puerto?
ocupado() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

carpeta_valida() { [ -n "$1" ] && [ -r "$1/app.py" ] && [ -r "$1/static/index.html" ]; }

# arrancar CARPETA: deja el puerto en PORT. Falla si el servidor muere o no responde.
arrancar() {
  local carpeta="$1" p pid
  for p in $(seq "$FIRST_PORT" $((FIRST_PORT + 9))); do
    ocupado "$p" && continue                        # lo usa otro programa: probar el siguiente
    # --idle-exit: el servidor se cierra solo cuando se cierra la última ventana
    nohup "$PY" "$carpeta/app.py" --port "$p" --idle-exit >>"$LOG" 2>&1 &
    pid=$!
    for _ in $(seq 1 100); do                       # hasta ~10 s para que responda
      if vivo "$p"; then PORT="$p"; return 0; fi
      kill -0 "$pid" 2>/dev/null || return 1        # murió: el problema es el código, no el puerto
      sleep 0.1
    done
    kill "$pid" 2>/dev/null
    return 1
  done
  return 1
}

if [ ! -x "$PY" ] || [ ! -f "$INTERNA/app.py" ]; then
  aviso "Falta terminar la instalación de Carta natal. Ejecutá de nuevo instalar-app.command."
  exit 1
fi

PORT=""
for p in $(seq "$FIRST_PORT" $((FIRST_PORT + 9))); do
  if vivo "$p"; then PORT="$p"; break; fi
done

if [ -z "$PORT" ]; then
  mkdir -p "$DATA"
  : > "$LOG"
  if carpeta_valida "$CARPETA"; then
    echo "Carpeta de la app: $CARPETA" >> "$LOG"
    if ! arrancar "$CARPETA"; then
      echo "No arrancó desde esa carpeta; se usa la copia interna." >> "$LOG"
      notificar "No pude usar la carpeta del proyecto; abrí la copia interna. Detalle en el registro."
    fi
  fi
  if [ -z "$PORT" ]; then
    echo "Carpeta de la app: $INTERNA (copia interna)" >> "$LOG"
    arrancar "$INTERNA"
  fi
fi

if [ -z "$PORT" ]; then
  aviso "No pude iniciar el servidor de Carta natal." ver
  exit 1
fi

URL="http://127.0.0.1:$PORT"

# Ventana propia, sin pestañas ni barra de direcciones, si hay un navegador basado en Chromium.
# Lleva su propio perfil, así que cerrarla no toca tus otras ventanas de Chrome.
for nombre in "Google Chrome" "Microsoft Edge" "Brave Browser" "Chromium"; do
  for base in "/Applications" "$HOME/Applications"; do
    bin="$base/$nombre.app/Contents/MacOS/$nombre"
    if [ -x "$bin" ]; then
      nohup "$bin" --app="$URL" --user-data-dir="$DATA/ventana" \
        --no-first-run --no-default-browser-check --window-size=1440,920 >/dev/null 2>&1 &
      exit 0
    fi
  done
done

# Sin Chrome/Edge/Brave: pestaña en el navegador predeterminado (Safari, por ejemplo).
open "$URL"
