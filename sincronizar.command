#!/bin/bash
# Conecta Carta natal de esta compu con la base de sincronización (Neon), para tener las mismas cartas que en el
# celular y el iPad. Se corre una sola vez: doble clic (o  bash sincronizar.command).
# Guarda la cadena de conexión en ~/Library/Application Support/Carta natal/sync-db.txt (solo la puede leer tu usuario)
# y prepara Python para hablar con la base. El código de sincronización se elige después, dentro de la app.
cd "$(dirname "$0")" || exit 1

DATA="${CARTA_NATAL_DATA:-$HOME/Library/Application Support/Carta natal}"
pausa() { echo; read -n 1 -s -r -p "Presioná una tecla para cerrar."; echo; }
fallo() { echo; echo "$1"; pausa; exit 1; }

echo "Pegá la cadena de conexión de Neon (empieza con postgresql://) y apretá Enter."
echo "(Para dejar de sincronizar esta compu, escribí  borrar  y Enter.)"
read -r URL
URL="$(printf '%s' "$URL" | tr -d '[:space:]' | sed -e "s/^psql//" -e "s/^'//" -e "s/'$//")"
if [ "$URL" = "borrar" ]; then
  rm -f "$DATA/sync-db.txt" && echo "Listo: esta compu ya no usa la base. Cerrá y volvé a abrir Carta natal." && pausa && exit 0
fi
case "$URL" in
  postgresql://*|postgres://*) ;;
  *) fallo "Eso no parece una cadena de conexión de Postgres (tiene que empezar con postgresql://)." ;;
esac

# Python con psycopg: el de la app de ícono y el de iniciar.command (los que existan)
PYS=()
for PY in "$DATA/venv/bin/python" ".venv/bin/python"; do
  [ -x "$PY" ] || continue
  if ! "$PY" -c "import psycopg" >/dev/null 2>&1; then
    echo "Instalando psycopg en $PY ..."
    "$PY" -m pip install -q "psycopg[binary]>=3.1" || fallo "No se pudo instalar psycopg. ¿Hay internet?"
  fi
  PYS+=("$PY")
done
[ ${#PYS[@]} -gt 0 ] || fallo "No encuentro el entorno de Carta natal. Abrí antes la app (instalar-app.command o iniciar.command) una vez."

echo "Probando la conexión..."
CARTA_NATAL_SYNC_DB="$URL" "${PYS[0]}" -c 'import sys; sys.path.insert(0, "."); from sync import SyncStore, db_url; SyncStore(db_url()).check(); print("Conexión OK.")' \
  || fallo "No se pudo conectar con esa base. Revisá la cadena (copiala de nuevo desde Neon → Connect)."

mkdir -p "$DATA" || fallo "No se pudo crear $DATA"
( umask 077; printf '%s\n' "$URL" > "$DATA/sync-db.txt" ) || fallo "No se pudo guardar la configuración."
chmod 600 "$DATA/sync-db.txt"
echo
echo "Listo. Cerrá Carta natal (todas sus ventanas) y volvé a abrirla."
echo "En Configuración → Datos aparece «Sincronizar entre dispositivos»: ahí ponés el mismo código que en el celular."
pausa
