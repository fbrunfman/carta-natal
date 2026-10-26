# Carta natal

App local para calcular y ver cartas natales, tránsitos y sinastría: rueda en SVG, posiciones, casas y aspectos.
Cálculo con Swiss Ephemeris (Moshier) por `pyswisseph`, zodiaco tropical. Todo corre en tu
computadora; no usa internet.

## Instalar como app en el Mac (ícono propio, sin Terminal)

Se hace una sola vez. En Terminal escribí `bash ` (con el espacio al final), arrastrá el archivo
**`instalar-app.command`** a la ventana y apretá Enter. (Así macOS no lo frena por venir de internet;
con doble clic puede avisar que no puede verificarlo, como en `iniciar.command`, más abajo.)

El instalador prepara Python (la primera vez, uno o dos minutos), crea **`Carta natal.app`** en
`~/Applications` y la abre. Después:

- Se abre con doble clic, desde Launchpad o Spotlight. Arrastrala al Dock para dejarla fija.
- Arranca el servidor en segundo plano y abre una **ventana propia, sin pestañas ni barra de direcciones**
  (con Chrome, Edge o Brave si tenés alguno; con Safari u otro, una pestaña común).
- **Cuando cerrás la última ventana, el servidor se apaga solo** unos segundos después. No queda nada
  corriendo. Si la abrís de nuevo, vuelve a arrancar.
- **Corre desde la carpeta donde la instalaste**: lo que cambies ahí se ve al abrir la app (los cambios
  de interfaz, en `static/`, con solo recargar la ventana; los del motor, cerrándola y abriéndola de nuevo).
  Si movés o borrás esa carpeta, la app usa una copia completa que lleva adentro; si el código de la
  carpeta tiene un error y no arranca, también cae en esa copia y lo avisa con una notificación (el detalle
  queda en el registro). Para volver a enlazarla a otra carpeta, corré `instalar-app.command` desde ahí.
- Si el cambio agrega una librería nueva (`requirements.txt`), hay que volver a correr `instalar-app.command`.
  Tus cartas guardadas no se tocan nunca.
- Mientras la ventana está abierta, el Dock normalmente muestra el ícono del navegador (Chrome, Edge o
  Brave) y no el de Carta natal: la ventana la dibuja el navegador. El ícono propio se ve en Launchpad,
  Finder, Spotlight y en el Dock cuando la dejás fija como acceso directo.
- La ventana de la app usa su propio perfil de navegador, así que «lo último que calculaste» no se comparte
  con lo que hayas usado en una pestaña común. Las cartas guardadas sí, porque están en un archivo.
- Si algo falla, un aviso lo dice y ofrece abrir el registro (`~/Library/Application Support/Carta natal/servidor.log`).
- Para que use siempre su copia interna, borrá `Carta natal.app/Contents/Resources/carpeta.txt`
  (clic derecho → Mostrar contenido del paquete).
- Para quitarla: arrastrá `Carta natal.app` a la papelera. El entorno de Python
  (`~/Library/Application Support/Carta natal/venv`) y `ventana` se pueden borrar; `cartas.json` es
  tu archivo de cartas: dejalo si querés conservarlas.

**Alternativa sin instalar nada: «Agregar al Dock» de Safari.** Con la app abierta (por `iniciar.command`)
en Safari (macOS Sonoma o posterior): Archivo → Agregar al Dock. Queda un ícono con ventana propia, pero ese ícono no inicia el
servidor: tiene que estar corriendo por otro lado. Por eso la opción de arriba es la recomendada.

## Abrir desde Terminal (`iniciar.command`)

Doble clic en **`iniciar.command`**. La primera vez crea un entorno propio (`.venv`) e instala
`pyswisseph`; después abre el navegador en http://127.0.0.1:8765. Para cerrar la app, cerrá la ventana
de Terminal. Esta forma no cierra el servidor sola (eso lo hace `Carta natal.app`).

- Si macOS dice que no puede verificar `iniciar.command` (el archivo no está firmado por Apple):
  elegí «Done», no «Move to Trash». Después, en Terminal, dentro de esta carpeta:
  `xattr -dr com.apple.quarantine .` y volvé a abrirlo. En macOS 15 o posterior, clic derecho → Abrir
  ya no alcanza; la alternativa es Ajustes del Sistema → Privacidad y seguridad → «Open Anyway».
- Si falla la instalación de `pyswisseph`, falta el compilador de Apple: `xcode-select --install`.
- A mano: `python3 -m venv .venv && .venv/bin/pip install -r requirements.txt && .venv/bin/python app.py --open`.
  Con `--idle-exit` el servidor se cierra solo al cerrar la última ventana (lo que usa `Carta natal.app`).

## Qué hace

- **Cuatro páginas**, que se cambian desde el menú lateral (Inicio · Luna · Carta · Combinar). La dirección lleva la página
  (`#inicio`, `#luna`, `#luna/2026-10`, `#carta`, `#combinar`): el botón «atrás» del celular vuelve del calendario al inicio y al
  recargar queda la misma página. Sin nada en la dirección se abre **Inicio**.
  - **Inicio**: la Luna ahora: signo y grado, fase y porcentaje iluminado, desde cuándo está en ese signo, cuándo
    pasa al siguiente (y en cuánto tiempo) y la próxima fase principal. Se actualiza solo cada 5 minutos y al volver
    a la pestaña. Tocar la tarjeta abre el calendario. Debajo de la tarjeta, **un poema para la Luna en ese signo**,
    con el nombre del autor y la obra: sale uno al azar entre los de ese signo (cada vez que se entra al inicio sale
    otro, sin repetir el anterior; las actualizaciones de la tarjeta no lo cambian). Los largos se ven recortados con
    «Leer completo»; la barra de la izquierda lleva el color del elemento del signo y «Solo datos» lo oculta. Los
    poemas están en `static/poems.js` (uno por objeto, por signo; un poema sin `autor` no sale). Abajo: «Continuar con…» la carta que estabas viendo y atajos
    a las otras cartas guardadas (o «Crear mi primera carta»). No se calcula ninguna carta hasta entrar a **Carta**.
  - **Luna** (calendario lunar): el mes en una grilla de lunes a domingo, con la fase de cada día (al mediodía), el
    signo en que termina el día y, el día que la Luna cambia de signo, **la hora del cambio**. Arriba, las fases
    principales del mes (nueva, cuarto creciente, llena, cuarto menguante) con día, hora y signo. Flechas y «Hoy»
    para cambiar de mes (de 1800 a 2400; cambiar de mes no suma pasos al historial), hoy resaltado y un selector
    **Sur / Norte** (en el hemisferio sur la Luna creciente se ve iluminada a la izquierda; se recuerda). Las horas
    son las de la zona horaria del navegador.
  - **Carta**: todo lo de abajo (natal, tránsitos, sinastría), como siempre.
  - **Combinar** (**beta, en construcción**): diez círculos despintados, uno por planeta (Sol a Plutón); al tocarlos
    se pintan con su color. Con uno o más pintados se habilita «Buscar» y sale uno al azar de lo que coincide: con
    **un** planeta, lo que es de ese planeta solo («Neptuno solo»); con dos o más, lo que tiene **todos** los
    planetas elegidos (elegir de más acota). Si no hay nada, lo dice y ofrece las combinaciones que sí tienen algo.
    «Ver otro» (si hay más de uno para esa combinación) no repite el último, y el pie cuenta cuántos hay y cuántos
    están validados. Se ve también con «Solo datos», porque es una búsqueda que se pide a propósito.
    Lo que hay viene del grupo de **Conjugarnos**, tanto lo **validado** como lo que sigue **en debate**; cada
    resultado lo marca con «Validado» (círculo lleno) o «En debate» (círculo vacío). Puede ser un texto, una
    biografía, una película o una canción: las películas y canciones pueden venir sin texto y con un link
    (botón «Ver» o «Escuchar», que abre en otra pestaña y solo acepta http o https), y si el grupo escribió por qué
    lo propuso, se lee debajo («Por qué esta combinación»). Los versos de un poema conservan sus renglones.
    - **Cómo actualizarlo**: en Conjugarnos, página *Grupo* → *Descargar todo (JSON)* (solo quien administra; baja un
      `conjugarnos-….json`), y después `python3 importar_conjugarnos.py conjugarnos-….json`. Reescribe `static/combos-conjugarnos.js` entero (una
      entrada por combinación de planetas) y avisa lo que salteó (un link que no es web, un tipo raro…). Hay que
      subir el cambio (commit y push) para que Render lo publique: es una **foto** del grupo, no se actualiza sola.
    - **Qué no pasa**: los nombres de las personas (quién propuso, votó o comentó), los votos y los comentarios.
      La carta natal se abre con un link, sin ser del grupo, así que solo viaja lo que se ve en la pantalla.
      El export en sí trae esos nombres: no lo subas al repositorio (el `.gitignore` ya deja afuera `conjugarnos-*.json`).
    - **Algo propio**: `TEXTOS_PROPIOS` en `static/combos.js` (un objeto por entrada: `planetas`, `titulo`, `autor`
      y `texto`; opcionales `clase`, `tipo`, `enlace` y `porque`; los párrafos se separan con una línea en blanco;
      una entrada sin título, autor o texto —salvo película y canción—, o sin ningún planeta, no sale).
      Ojo con los derechos de autor de lo que se publica: los fragmentos largos de obras vigentes pueden dar problemas.
    La pantalla está en `static/combinar.js`.
- Fecha, hora local y lugar → posiciones de Sol a Plutón, nodo norte, Ascendente y Medio Cielo.
- Zona horaria histórica con la base IANA (cambios de horario de verano incluidos). Avisa si la hora
  fue ambigua o no existió, y permite fijar el offset UTC a mano.
- Sistemas de casas: Placidus, Koch, Porfirio, Regiomontano, Campanus, iguales y signos enteros (en Configuración).
- Nodo lunar verdadero o medio (en Configuración).
- Aspectos (conjunción, oposición, trígono, cuadratura, sextil, quincuncio) con orbe y fase
  aplicativa o separativa. Pasar el cursor por un planeta, o por una fila de la tabla, resalta sus aspectos.
- **Cuadro** (pestaña en las tres vistas): los aspectos en escalera, con cada planeta como un círculo de
  color en la diagonal y un símbolo por aspecto en las celdas, vacías si no hay. Natal: todos contra todos
  (incluye Ascendente y Medio Cielo). Tránsitos y sinastría: filas = la carta de adentro, columnas = la de
  afuera. Al pasar el cursor se ve el orbe y la fase, y la rueda resalta el par.
- **Elementos** (solo natal): una cruz con Fuego arriba a la izquierda, Aire arriba a la derecha, Tierra abajo
  a la izquierda y Agua abajo a la derecha. Cada cuadrante lista los planetas personales (Sol a Saturno, sin
  Urano, Neptuno ni Plutón) y el Ascendente según el elemento de su signo, sin porcentajes. El regente del
  Ascendente queda marcado en su cuadrante si es un planeta personal; con la regencia moderna, Escorpio,
  Acuario y Piscis tienen regentes transpersonales (Plutón, Urano, Neptuno) y no se marca ninguno. Ya no hay
  opción de «regente tradicional» en esta pestaña (las profecciones siguen usando los regentes tradicionales).
- **Menú lateral, fijo o solapado**: el botón de la esquina superior del menú (o Ctrl/Cmd + \) lo oculta y deja todo
  el ancho para la rueda y las tablas. Con el menú oculto, al **pasar el mouse** por el borde izquierdo o por el botón
  de la esquina, el menú aparece **flotando encima** del gráfico, sin moverlo, y se va solo al alejar el mouse (o con
  Esc, o tocando afuera; si tenés el formulario abierto o estás escribiendo en un campo, queda abierto). Un **clic** en
  ese botón (que mientras flota pasa a ser una chincheta) lo deja **fijo** de nuevo. En escritorio el menú es un poco
  más ancho (352 px) y se recuerda si lo dejaste fijo u oculto.
- **En el celular y la tableta** el menú arranca **oculto** y no ocupa lugar: el botón de la esquina lo abre
  **encima** de la carta, como un cajón con una cortina oscura detrás; se cierra tocando la cortina, con Esc, con el
  botón de ocultar, al elegir una carta o al calcular/guardar. Mientras no haya ninguna carta guardada, ese botón es
  un **«+»**: lo tocás y se abre el menú con el formulario para crear la primera (la pantalla de bienvenida tiene el
  mismo botón). Si querés el menú fijo en una pantalla grande o en la tableta, está en Configuración → *Menú lateral*.
- **Crear y editar cartas**: el formulario está **oculto** y se despliega en el menú al tocar **«Nueva carta»**
  (en blanco) o **«Editar»** (con los datos de la carta que estás viendo). *Calcular carta* muestra el resultado y
  deja el formulario abierto; *Guardar* lo guarda, lo cierra y muestra la carta guardada. La **✕** de arriba cierra el
  formulario y vuelve a como estaba antes de abrirlo (los campos, la carta elegida), salvo lo que ya hayas calculado.
  *Sistema de casas* y *nodo lunar* ya no están en el formulario: son preferencias de la vista, están en
  Configuración, valen para todas las cartas y se aplican al instante, sin apretar nada.
- **Configuración** (el desplegable con el engranaje, en el menú lateral, debajo de las cartas; abierto en pantallas
  grandes y cerrado en el celular, y se recuerda):
  - *Cálculo*: sistema de casas (Placidus, Koch, Porfirio, Regiomontano, Campanus, iguales o signos enteros) y nodo lunar
    (verdadero o medio). Recalcula la carta que estás viendo al elegir.
  - *Menú lateral*: Fijo u Oculto (el mismo ajuste que los botones del menú; «Oculto» es el modo solapado).
  - *Interpretación*: **Con lecturas** o **Solo datos**. En «Solo datos» desaparece toda la interpretación: la ventana
    de lectura al tocar un planeta (rueda, tablas y Elementos), los temas de las casas (profecciones y «Próximamente»),
    los textos de los tránsitos destacados y las pistas de «tocá un planeta…». Quedan las posiciones, casas, aspectos,
    orbes, fechas y horas. Es un modo: se recuerda, se aplica antes de dibujar y se puede cambiar en cualquier momento.
  - *Estilo de los gráficos*: **Nuevo** (círculos de colores con símbolos vectoriales, banda oscura de signos)
    o **Clásico** (los símbolos de texto de antes, sin círculos y con el anillo de signos claro). Al elegir
    Clásico se activa también el tinte por elemento; se puede apagar.
  - *Tinte por elemento*: pinta cada signo de la banda con el color de su elemento (fuego, tierra, aire,
    agua). Funciona en los dos estilos y en modo claro y oscuro. **Viene activado de fábrica.**
  - *Tipo de letra*: Sistema (SF Pro), Helvetica Neue, Avenir Next, Redondeada, Serif (New York) o
    Monoespaciada. Usan las fuentes que ya trae macOS. **De fábrica: Redondeada.**
  - *Tamaño de la letra*: 85 % a 130 %. Escala todo el texto de la página; el de la rueda sube con un tope
    (×1,25) para que no se pise con los símbolos.
  - *Tamaño del mandala*: 60 % a 140 %. Por encima de 100 % el mandala pasa a ocupar todo el ancho y las
    tablas bajan debajo de él.
  - «Restablecer» vuelve a los valores de fábrica (estilo Nuevo, con tinte por elemento, letra Redondeada, tamaños al
    100 %, con lecturas). Todo se recuerda en el navegador (clave `carta:cfg`) y se aplica antes de dibujar la
    página, así que no hay parpadeo al abrir. Mientras nadie toque la configuración no se guarda nada y rige lo de
    fábrica. Una configuración guardada antes de este cambio (sin `v`) que seguía en los valores de entonces (letra del
    sistema, sin tinte en el estilo Nuevo) cuenta como «sin elegir» y pasa a los de ahora; lo que se haya elegido de
    verdad (otra letra, el estilo Clásico sin tinte, tamaños, «Solo datos») se respeta.
- **Lectura de cada planeta**: tocá un planeta en la rueda (o su fila en Posiciones, Tránsitos y Superposición, o su
  casilla en Elementos; también «Asc» y «MC» en la rueda) y se abre una ventana con:
  - *el signo*: elemento, modalidad, dignidad clásica (domicilio, exaltación, exilio, caída) y la lectura del planeta
    en ese signo. Para Urano, Neptuno y Plutón aclara que el signo describe a una generación;
  - *la casa*: el tema de la casa y la lectura del planeta ahí (el Nodo norte incluye su eje con el nodo sur;
    Ascendente y Medio Cielo no llevan casa);
  - *los aspectos*: cada uno con orbe y fase, qué relaciona ese par de cuerpos y cómo se comporta ese tipo de aspecto.
    Se respeta el filtro de orbe (1° / 3° / todos) y hay un botón para ver también los de orbe mayor. Tocando el
    otro planeta se salta a su lectura, y la flecha de la esquina vuelve;
  - *retrogradación*, con una aclaración en Urano, Neptuno y Plutón, donde es un estado muy frecuente.
  En **tránsitos** y **sinastría** el planeta del anillo exterior se lee igual (signo, casa de la carta de adentro y
  aspectos a esa carta) y el de adentro agrega los aspectos que recibe del anillo exterior.
  Las lecturas son generales y simbólicas, no calculadas para la persona; al pie de la ventana se aclara que describen
  tendencias y no causas ni predicciones. Los textos están en `static/interp-signs.js`, `interp-houses.js` e
  `interp-aspects.js`, uno por línea, para editarlos a gusto.
- **Resumen de tránsitos**: la primera pestaña de la vista Tránsitos, para la fecha y la hora elegidas (arranca en «ahora»).
  - *Profecciones*: el año de la casa en que estás (por edad, con signos enteros desde el Ascendente), su **señor
    del año** (regente tradicional del signo: Acuario es de Saturno, Piscis de Júpiter…) con dónde está ese planeta
    ahora, y los señores del **mes** y del **día**. Los tres son botones que abren la lectura del planeta. El año
    cambia en el cumpleaños; el mes, un signo por mes calendario desde el cumpleaños; el día, un signo por día
    desde el aniversario del mes. Se calcula en el navegador, no hace falta pedir nada.
  - *Destacados*: los **tránsitos lentos (Júpiter a Plutón)** que están en aspecto cerrado con tu Sol, Luna,
    Ascendente, Medio Cielo o planetas hasta Saturno. Orbe de hasta 3° (2° en trígonos y sextiles); «punto máximo»
    es a menos de 1° del exacto. Cada tarjeta dice de qué se trata (título y texto del par de planetas), hasta cuándo
    dura, desde cuándo está activo y las fechas exactas (tachadas las pasadas, resaltada la próxima, con «R» si el
    planeta está retrógrado). Muestra los 12 más importantes. Tocar una tarjeta abre la lectura del planeta en tránsito.
  - *Próximamente*: lo que viene en **30 días, 90 días o 6 meses**, agrupado por día y con la hora: ingresos de los
    planetas a un signo (con «R» si están retrógrados), estaciones (cuando un planeta se detiene para cambiar de
    sentido) y entradas a las casas de tu carta. Sin la Luna. Tocar un evento lleva la rueda a ese momento exacto.
  Los destacados y lo que viene los calcula el servidor (`/api/featured` y `/api/upcoming`) y solo se piden al abrir
  cada vista; si cambiás la fecha se recalculan, y si volvés a una vista ya calculada no se vuelve a pedir.
  Las fechas de «hasta» usan esos orbes de 3° y 2°, así que pueden diferir de las de otras apps que usan otros orbes.
- **Tránsitos**: pestaña «Tránsitos». La rueda pasa a ser doble: adentro la carta natal, afuera los
  planetas de la fecha que elijas (arranca en «ahora»). La pestaña «Tránsitos» es la tabla de posiciones. Fecha, hora y zona horaria se editan, y ‹ › mueven
  el momento de a 1 hora, día, semana, mes o año. Tres tablas: dónde está cada planeta y qué casa natal
  recorre; aspectos del tránsito a la carta natal con orbe y fase (aplicativo / separativo); y un
  **calendario** de aspectos exactos con fecha y hora, para 3, 6, 12 o 24 meses desde la fecha que quieras
  (Júpiter–Plutón, más Marte, o del Sol a Plutón). El calendario marca los retrógrados y numera las
  pasadas (1ª de 3). Tocando una fila, la rueda salta a ese instante exacto.
- **Sinastría**: pestaña «Sinastría» y elegís otra carta guardada en «Comparar con». Adentro la carta
  abierta con sus casas, afuera la otra. Aspectos cruzados (incluyen Ascendente y Medio Cielo de ambas),
  un cuadro de aspectos (filas = una carta, columnas = la otra) y la superposición de casas: en qué
  casa de cada una cae cada planeta de la otra. Al ser dos fechas de nacimiento, no se calcula fase.
- En las dos vistas el filtro de orbe (1° / 3° / todos) también decide qué líneas se dibujan en la rueda.
- **Cartas guardadas**: guardá todas las que quieras con nombre. En el menú de la izquierda hay un
  selector que muestra la carta abierta (con su fecha); al tocarlo se despliega la lista, flotando sobre los
  botones, y elegir una carta la abre y cierra la lista. Desde 7 cartas aparece un buscador (sin tildes
  ni mayúsculas, también por fecha). Con teclado: flecha abajo abre, flechas se mueven, Enter elige y Esc
  cierra. Se cierra también al tocar afuera. «Guardar cambios» actualiza la abierta y «Guardar como carta
  nueva» la duplica. Eliminar (la × al pasar el mouse por una carta de la lista) pide confirmación (dos toques).
- En la rueda cada planeta es un círculo de color con su símbolo adentro (el Sol, con borde ondulado) y,
  debajo, grados, signo y minutos (como iPhemeris). Los signos van en una banda oscura con los símbolos en
  blanco. Cada planeta se dibuja siempre dentro de la casa a la que pertenece: si hay varios juntos se
  separan sin salirse de los límites de la casa. En la rueda doble, los círculos del anillo exterior llevan
  borde naranja.
- **Símbolos propios**: en el estilo Nuevo los de planetas y signos están dibujados como vectores
  (`static/glyphs.js`), con trazo redondeado, así que se ven igual en cualquier Mac y no dependen de ninguna
  fuente. Son los mismos en la rueda, las tablas y los cuadros. El estilo Clásico usa los símbolos de texto de
  la fuente del sistema (Plutón sigue siendo el vector de órbita). Los colores de cada planeta están en `static/style.css` (`.pb-sun`,
  `.pb-moon`, …) y los de la banda de signos en `--ring-bg` y `--ring-ink`.
- Lo último que calculaste se recuerda en el navegador. Los datos iniciales (tu carta) están en
  `DEFAULTS` al principio de `static/app.js`.

Los minutos de arco se **truncan** (no se redondean), igual que iPhemeris y la notación sexagesimal
habitual: 3°37′48″ se muestra como 3°37′. Plutón se dibuja con la forma de órbita (⯓).

`verificar.py` compara el motor con resultados ya verificados: una carta natal conocida (13 cuerpos, signo,
grado, minuto y casa), dos sinastrías de los documentos del proyecto (aspectos, orbes
y casas cruzadas) y la gran conjunción Júpiter–Saturno del 21/12/2020. Trae fechas de nacimiento reales, por
eso no se sube al repositorio (ver `.gitignore`). Los momentos exactos del
calendario se afinan por bisección (precisión de un segundo) y se probaron contra un barrido por fuerza
bruta: mismos eventos, orbe menor a 0,001° en cada uno.

## Dónde se guardan las cartas

En un archivo JSON fuera de la carpeta de la app, así que **reemplazar la carpeta por una versión nueva
no borra nada**:

- macOS: `~/Library/Application Support/Carta natal/`
- Windows: `%APPDATA%\Carta natal\`
- Linux: `~/.local/share/carta-natal/`

La ruta exacta aparece al pie de la barra lateral y en la terminal al iniciar. Para usar otra carpeta:
variable de entorno `CARTA_NATAL_DATA`. Para hacer copia de seguridad alcanza con copiar ese archivo.
Si el archivo se corrompe, la app lo aparta con otro nombre y empieza uno vacío en vez de pisarlo.
(En la versión pública es distinto: ver «Alojarla en internet».)

## Alojarla en internet (Render)

La app también puede correr en un servidor para que otras personas la usen con un link. Es la **versión
pública**: `python3 app.py --public` (o la variable `CARTA_NATAL_PUBLIC=1`, que ya trae el `Dockerfile`).
Es la misma app con tres diferencias:

- **Las cartas guardadas viven en el navegador de cada persona**, nunca en el servidor: cada uno ve solo
  las suyas, sin cuentas ni contraseñas. Si borran los datos del sitio se pierden, por eso hay
  *Exportar cartas* e *Importar cartas…* (un archivo JSON) al pie del menú.
- **El servidor no guarda nada**: recibe los datos de nacimiento, calcula y responde. Los datos viajan en el
  cuerpo de un pedido POST (no en la URL) y el registro del servidor solo anota «POST /api/chart → 200».
  El formulario arranca vacío: tu carta de arranque está en `static/defaults-local.js`, que no se sube al
  repositorio y que la versión pública no sirve (devuelve 404).
  El inicio y el calendario lunar no mandan ningún dato personal: solo la zona horaria del navegador (y el mes).
- **Límites**: hasta 60 pedidos seguidos por persona y después 2 por segundo (el calendario de tránsitos cuesta
  20 pedidos; los destacados, 6; lo que viene, 8; el calendario lunar, 3; la Luna de hoy, 1), 3 de esos cálculos pesados a la vez y 20 pedidos por segundo entre todos. Si se pasan, responde 429 o 503 con
  un mensaje. No hay `/api/charts` ni `/api/presence`, y `/healthz` responde `ok` para el hosting.

**Pasos en Render** (el plan gratis alcanza para compartir con amigos):

1. Subí esta carpeta a un repositorio **privado** de GitHub. El `.gitignore` ya deja afuera `verificar.py`,
   que trae fechas de nacimiento reales:
   ```
   cd ~/Documents/carta-natal
   git init -b main && git add . && git commit -m "Carta natal"
   gh repo create carta-natal --private --source=. --push
   ```
   (sin `gh`: creá el repositorio vacío en github.com y seguí las dos líneas que te da GitHub:
   `git remote add origin …` y `git push -u origin main`).
2. En render.com: **New + → Blueprint**, conectá tu cuenta de GitHub, elegí el repositorio y **Apply**.
   Render lee `render.yaml` y construye la imagen con el `Dockerfile` (la primera vez tarda unos minutos
   porque compila `pyswisseph`).
3. Cuando diga *Live*, el link es `https://carta-natal-….onrender.com` (aparece arriba en el servicio).
   Abrí `/healthz` en ese link: tiene que decir `ok`.
4. Para actualizar: `git push` y Render vuelve a construir solo (`autoDeploy`).

Cosas a saber:

- En el plan gratis Render duerme el servicio tras un rato sin visitas (hoy, unos 15 minutos); el primer
  pedido siguiente tarda hasta un minuto en despertarlo. Los planes pagos no se duermen.
- El link es público para quien lo tenga: no pide contraseña. Lleva `noindex`, así que los buscadores no
  lo listan, pero cualquiera con el link puede usarla.
- Variables de entorno opcionales: `CARTA_NATAL_HOSTS` (dominios permitidos, separados por coma; útil si le
  ponés un dominio propio), `CARTA_NATAL_RATE` (pedidos por segundo por persona, 2 por defecto) y
  `CARTA_NATAL_PROXIES` (cuántos proxies hay delante, 1 por defecto; la IP que se usa es la que anotó el último).
- Probarla en tu computadora: `python3 app.py --public` y abrí http://127.0.0.1:10000 (o el puerto de `PORT`).
  Con Docker: `docker build -t carta-natal . && docker run -p 10000:10000 carta-natal`.

## Estructura

```
astro.py          motor: zona horaria → UTC, posiciones, casas, aspectos, tránsitos, sinastría, calendario,
                  tránsitos destacados y próximos eventos (ingresos, estaciones, casas), y la Luna (signo, fase,
                  cambios de signo y fases principales del mes)
store.py          cartas guardadas: archivo JSON, validación, escritura atómica
app.py            servidor (local: solo 127.0.0.1; con --public, para alojarla): /api/chart, /api/timezones,
                  /api/charts, /api/transits, /api/featured, /api/upcoming, /api/synastry, /api/transit-calendar,
                  /api/moon, /api/moon-calendar, /api/validate-chart, /api/ping, /api/presence, /healthz
presence.py       cuándo cerrar el servidor: cuando no queda ninguna ventana abierta (--idle-exit)
limits.py         límites de la versión pública: pedidos por persona y cálculos pesados a la vez
Dockerfile, render.yaml, .dockerignore, .gitignore   para alojarla en Render
instalar-app.command  crea «Carta natal.app» en ~/Applications
assets/           launcher.sh (lo que ejecuta la app), AppIcon.icns, hacer_icono.py (regenera el ícono)
static/           interfaz
  index.html, style.css, app.js     página y lógica
  wheel.js                          dibujo de la rueda
  layout.js                         planetas dentro de su casa; separación del anillo exterior
  astro-data.js                     nombres, aspectos, formato de posiciones, círculos de color de cada cuerpo
  settings.js                       Configuración (en el menú): estilo, tinte, letra, tamaños (se guarda y se aplica)
  summary.js                        pestaña Resumen: profecciones, tránsitos destacados y próximamente
  planet-dialog.js                  ventana de lectura que se abre al tocar un planeta
  reading.js                        qué muestra esa ventana según la vista (natal, tránsitos, sinastría)
  interp.js                         junta los textos: signo, casa, dignidades, aspectos
  interp-signs.js, interp-houses.js, interp-aspects.js   los textos de interpretación (editables)
  glyphs.js                         símbolos de planetas y signos dibujados como vectores
  saved.js, api.js                  selector de cartas guardadas (desplegable con buscador) y cliente de la API
  local-charts.js                   cartas guardadas en el navegador (versión pública), exportar e importar
  defaults-local.js                 tu carta de arranque en la versión local (si lo borrás, el formulario arranca vacío)
  stair.js                          cuadro de aspectos en escalera
  elements.js                       balance de elementos y regente del Ascendente (moderno)
  moon.js                           inicio y calendario lunar: tarjeta de la Luna, grilla del mes, íconos de fase
  poems.js                          los poemas de la tarjeta de la Luna (por signo) y cómo se eligen y se dibujan
  combos.js, combinar.js            la pestaña Combinar (beta): cómo se busca por planetas y la pantalla
  combos-conjugarnos.js             lo del grupo de Conjugarnos (generado por importar_conjugarnos.py: no se edita a mano)
  presence.js                       avisa al servidor que la ventana está abierta; avisa si el servidor se cierra
  icon.svg, icon-*.png, manifest.webmanifest   ícono y datos de instalación como app web
  places.json                       lugares incluidos
importar_conjugarnos.py  trae el export de Conjugarnos a la pestaña Combinar (genera static/combos-conjugarnos.js)
verificar.py      prueba contra una carta conocida
```

## Seguridad

En local, el servidor escucha solo en 127.0.0.1 y rechaza pedidos cuyo `Host` u `Origin` no sean locales, así
que otra página abierta en tu navegador no puede leer ni modificar tus cartas.

En la versión pública escucha en todas las interfaces, pero no guarda nada de nadie: rechaza un `Origin`
que no sea el mismo sitio, exige JSON para escribir, limita los pedidos por persona (la IP es la que anotó
el proxy del hosting, no la que diga el navegador en `X-Forwarded-For`), no sirve código del servidor ni
lista carpetas, y manda `X-Frame-Options`, `nosniff`, `no-referrer` y `noindex`.

## Límites

- Lista de lugares incluida: Argentina (capitales provinciales y ciudades grandes) y ~45 ciudades
  del mundo. Para otro lugar, escribí latitud y longitud.
- Efemérides Moshier: no incluye Quirón ni asteroides (requieren los archivos `.se1`).
- Tránsitos: los planetas en tránsito son Sol a Plutón y el nodo; el calendario y «Próximamente» dejan afuera
  la Luna (cambia de aspecto y de signo cada pocas horas). Los destacados son solo de Júpiter a Plutón.
- Luna: de 1800 a 2400, con las efemérides Moshier (la hora del cambio de signo y de las fases es al minuto; otro
  sitio puede diferir en un minuto según cómo redondee). Signos tropicales. La fase de cada día es la del mediodía
  y el signo mostrado es el del final del día; la hora indica cuándo entra en él.
- Profecciones: signos enteros y regentes tradicionales; el nacido un 29/2 cumple el 28/2 en años comunes. No hay progresiones, retornos ni revoluciones solares todavía.
- Sinastría: aspectos y casas cruzadas; falta la carta compuesta.
- El calendario muestra como máximo 800 aspectos; con «Todos» y 24 meses se llega a ese tope.
