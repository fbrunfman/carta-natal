#!/bin/bash
# Crea «Carta natal.app» en ~/Applications: un ícono que abre la app en su propia ventana, sin Terminal.
# Se corre una sola vez (y de nuevo cuando recibas una versión nueva). Doble clic, o:  bash instalar-app.command
cd "$(dirname "$0")" || exit 1

NAME="Carta natal"
APP="$HOME/Applications/$NAME.app"
DATA="$HOME/Library/Application Support/$NAME"
PY="$DATA/venv/bin/python"

pausa() { echo; read -n 1 -s -r -p "Presioná una tecla para cerrar."; echo; }
fallo() { echo; echo "$1"; pausa; exit 1; }

[ -n "$HOME" ] || fallo "No se encuentra la carpeta de usuario (HOME)."
if [ "$(uname)" != "Darwin" ] && [ -z "$CARTA_INSTALL_ANYOS" ]; then
  fallo "Este instalador es para macOS."
fi
for f in app.py astro.py store.py presence.py limits.py requirements.txt static/index.html assets/launcher.sh assets/AppIcon.icns; do
  [ -e "$f" ] || fallo "Falta «$f». Ejecutá este archivo desde la carpeta completa de Carta natal."
done

if ! command -v python3 >/dev/null 2>&1; then
  fallo "No encuentro Python 3. Instalá las herramientas de línea de comandos de Apple con:  xcode-select --install"
fi
python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)' \
  || fallo "Hace falta Python 3.9 o más nuevo (tenés $(python3 --version 2>&1))."

# 1. Entorno de Python propio (se guarda aparte de la app, así sobrevive a las actualizaciones)
if ! "$PY" -c "import swisseph, tzdata" >/dev/null 2>&1; then
  echo "Preparando el entorno de Python (la primera vez tarda uno o dos minutos)..."
  rm -rf "$DATA/venv"
  mkdir -p "$DATA"
  python3 -m venv "$DATA/venv" || fallo "No se pudo crear el entorno de Python."
  "$PY" -m pip install -q --upgrade pip setuptools wheel
  "$PY" -m pip install -q -r requirements.txt \
    || { rm -rf "$DATA/venv"; fallo "No se pudo instalar pyswisseph. Suele faltar el compilador de Apple:  xcode-select --install  (y después volvé a abrir este archivo)."; }
fi

# 2. La app: una copia completa de los archivos + el lanzador + el ícono
echo "Creando $APP ..."
case "$APP" in */"$NAME.app") ;; *) fallo "Ruta inesperada: $APP" ;; esac
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/app" || fallo "No se pudo crear la carpeta de la app."
cp app.py astro.py store.py presence.py limits.py requirements.txt "$APP/Contents/Resources/app/"
cp -R static "$APP/Contents/Resources/app/static"
find "$APP" -name "__pycache__" -prune -exec rm -rf {} + 2>/dev/null
cp assets/AppIcon.icns "$APP/Contents/Resources/AppIcon.icns"
# La app corre desde esta carpeta mientras exista (así los cambios en estos archivos se ven al abrirla);
# si la movés o la borrás, usa la copia de adentro.
pwd > "$APP/Contents/Resources/carpeta.txt"
cp assets/launcher.sh "$APP/Contents/MacOS/cartanatal"
chmod +x "$APP/Contents/MacOS/cartanatal"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Carta natal</string>
  <key>CFBundleDisplayName</key><string>Carta natal</string>
  <key>CFBundleIdentifier</key><string>local.cartanatal.app</string>
  <key>CFBundleExecutable</key><string>cartanatal</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
  <key>CFBundleDevelopmentRegion</key><string>es</string>
  <key>CFBundleShortVersionString</key><string>3.1</string>
  <key>CFBundleVersion</key><string>3.1</string>
  <key>LSMinimumSystemVersion</key><string>10.13</string>
  <key>LSApplicationCategoryType</key><string>public.app-category.lifestyle</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST

# Una app creada acá no trae la marca de «descargada de internet», pero por las dudas se la saca;
# y se la firma "ad hoc" (sin cuenta de desarrollador) para que macOS la trate como una app normal.
xattr -dr com.apple.quarantine "$APP" 2>/dev/null
command -v plutil >/dev/null 2>&1 && { plutil -lint "$APP/Contents/Info.plist" >/dev/null || fallo "Info.plist inválido."; }
command -v codesign >/dev/null 2>&1 && codesign --force --sign - "$APP" >/dev/null 2>&1
touch "$APP"

echo
echo "Listo:  $APP"
echo "Arrastrala al Dock para tenerla siempre a mano. Si la mudás o la copiás a /Applications, anda igual."
echo "Corre desde esta carpeta:  $(pwd)"
echo "(si la movés o la borrás, la app usa su copia interna; para volver a enlazarla, corré este instalador de nuevo)"

if [ "$(uname)" = "Darwin" ]; then
  open -R "$APP"      # la muestra en el Finder
  sleep 1
  open "$APP"         # y la abre
fi
