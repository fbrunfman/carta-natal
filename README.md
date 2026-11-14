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

- **Colores** (de fábrica, la paleta «Océano»): tinta sobre celeste muy claro de día (`--bg` #F1F6FA) y sobre azul marino de
  noche (#0B1622); **lo elegido va en azul** (`--accent`, `--accent-2`: modos, pestañas, filtros, botones principales, la
  tarjeta abierta). Se cambian en Configuración → Apariencia → Colores. Los colores
  de «Entre casas» y «Viajes» prendidos no cambiaron (`--reach`, `--trip`). El **logo** es una estrella de cuatro
  puntas que toma el color de los botones (cambia con la paleta; arriba a la izquierda, lleva al inicio; también es el ícono de la pestaña, `static/icon.svg`; el ícono de
  `Carta natal.app` sigue siendo el de antes).
- **La barra de arriba** (no hay menú lateral): a la izquierda, el logo y un botón con el nombre de la sección en la que estás
  («Inicio ▾»), que despliega el menú de secciones (Inicio · Luna · Carta, con el nombre de la carta abierta · Combinar;
  con teclado: flecha abajo abre, flechas, Esc); a la derecha, **«Buscar o cambiar de carta…»** (la misma lista de la lupa
  de la carta; no aparece en la página Carta, que tiene su lupa), el tema (luna/sol: claro u oscuro) y el **engranaje** de la
  Configuración. **En la carta, en pantallas de 900 px o más**, el nombre de la carta, la lupa, la ⓘ, Natal / Tránsitos /
  Sinastría (con su ícono, desde 1440 px) y los botones de la carta pasan a esa misma fila (`app.js::paintMerge` pone `data-tbmerge` y las medidas
  `--tb-l`, `--tb-r` y `--tb-mb`): así la rueda tiene todo el alto de la pantalla (1600 × 1000: de 840 a 863 px; 1024 × 768:
  de 504 a 674). Por debajo de 1440 px los botones de la carta quedan solo con su ícono (el nombre está en el tooltip). Los
  datos de nacimiento (fecha, hora, lugar, sistema de casas y la hora UTC) están detrás de la **ⓘ**, con **«Editar los datos»**.
  **En el celular** la barra es solo el ícono de las secciones y el engranaje (se van con el scroll), y la barra de abajo de
  la carta suma **Inicio**.
- **Cinco páginas** (Inicio · Luna · Carta · Mis cartas · Combinar). La dirección lleva la página
  (`#inicio`, `#luna`, `#luna/2026-10`, `#carta`, `#cartas`, `#combinar`): el botón «atrás» del celular vuelve del calendario al inicio y al
  recargar queda la misma página. Sin nada en la dirección se abre **Inicio**.
  - **Inicio**: **el cielo de hoy visto desde la Tierra**. En el centro está la Tierra, alrededor los 12 signos (Aries a
    la derecha y siguiendo en contra de las agujas del reloj, como en la eclíptica) con el color de su elemento, y el Sol,
    la Luna y los planetas en la longitud que tienen ahora (la «R» marca a los retrógrados). La Luna se dibuja con su fase.
    Tocar un planeta dice en qué grado y signo está. Cuando dos están juntos se separan hacia adentro o hacia afuera sin
    cambiar el ángulo (y si en un grupo muy apretado no hay lugar, los círculos se achican un poco); el nombre va del lado
    donde hay lugar. **La Luna** también está en una tarjeta con lo de ahora: signo y grado, fase y porcentaje
    iluminado (en pantallas medianas, chica, abajo a la izquierda del mapa y arriba del rótulo de Escorpio; en el celular,
    debajo del mapa); el enlace «Calendario lunar ›» (debajo del
    mapa, o en la tarjeta en el celular) lleva al calendario. **Al tocar la Luna —la de la tarjeta o la del mapa— se abre el poema**: un
    cuadro con **un poema para la Luna en ese signo**, con el nombre del autor y la obra, entero, más desde cuándo está en
    el signo, cuándo pasa al siguiente (y en cuánto) y la próxima fase. Sale uno al azar entre los de ese signo (cada vez que
    se entra al inicio sale otro, sin repetir el anterior; las actualizaciones no lo cambian); la barra de la izquierda lleva
    el color del elemento del signo; con las lecturas apagadas (hoy) el poema no se muestra. Se actualiza solo cada 5 minutos y al volver a la
    pestaña. Los poemas están en `static/poems.js` (uno por objeto, por signo; un poema sin `autor` no sale).
    **Arriba de todo, «Últimas cartas»**: las **6 últimas que abriste** (la que tenés abierta primero, marcada «última
    abierta»; las que nunca abriste van después, las más nuevas primero; se recuerda en este navegador, `carta:recent`), como
    tarjetas con la fecha, la hora y la ciudad, y el **Sol, la Luna y el Ascendente**. **Las cartas fijadas van primero**
    (con el marcador; si fijás más de 6, se ven todas): se fijan con el **marcador** al lado del nombre de la carta, que se
    vuelve a tocar para soltarla (`carta:pins`, en este navegador). El Sol, la Luna y el Ascendente aparecen cuando ya se conocen sus posiciones
    (en la versión local se calculan solas; en la pública, después de calcularlas en Mis cartas). Tocar una la abre; al
    final, **«+ Nueva carta»**, y con más de 6, **«Ver todas (N) ›»**, que lleva a **Mis cartas**. Sin cartas: «Crear mi
    primera carta». Debajo, el mapa con la Luna en su rincón (en el celular, debajo), y al pie, en una línea, dónde se
    guardan las cartas y «Privacidad y copias» (abre la Configuración en *Datos*). No se abre ninguna carta hasta entrar
    a **Carta**. (Los «Tránsitos destacados de hoy» y «Buscar por posición» ya no están en el inicio.)
  - **Mis cartas** (`#cartas`): **todas las cartas, en orden alfabético, de a 24 por página** (‹ 1 2 … 9 ›). Se buscan:
    - **por nombre** (sin importar mayúsculas ni tildes: «agata» encuentra «Ágata»);
    - **por inicial**: una fila de letras (las que no tienen cartas no se pueden tocar; «Ágata» va en la A);
    - **por posición**: *planeta en signo / casa* (un planeta —o «cualquier planeta», el Ascendente o el Medio Cielo— en un
      signo, en una casa o en los dos; el Ascendente y el Medio Cielo solo con signo; con **«con Entre casas»** la casa se
      cuenta con la lógica del botón «Entre casas»: un planeta cerca de la cúspide de la casa que sigue cuenta también en
      ella, o solo en ella si está en cúspide, con los orbes de *Reglas avanzadas*, y la tarjeta lo dice: «casas X y XI» o
      «casa XI (en cúspide, desde la X)») y *planeta en aspecto duro* con otro
      (o con cualquiera): «cualquier aspecto duro» son los de los viajes de planetas (Configuración → *Reglas avanzadas*;
      de fábrica conjunción, oposición y cuadratura), o uno en particular (también semicuadratura y sesquicuadratura). Los
      aspectos usan los orbes de Configuración y las casas, el sistema de casas elegido. Todo se combina (nombre, inicial y
      las dos búsquedas por posición), y cada tarjeta dice lo que encontró (por ejemplo «☉ □ ♂ cuadratura con Marte 7°46′»).
      «Limpiar la búsqueda» vuelve a todas.
    - **Editar y eliminar** desde cada tarjeta (el lápiz y el tacho, arriba a la derecha): «Editar» abre el formulario con
      esa carta sin abrirla y, al guardar, te quedás en Mis cartas (la carta que tenías abierta sigue siendo la misma);
      «Eliminar» pide confirmar con un segundo toque (se desarma solo a los 6 segundos). Esta parte arranca **plegada** (dice «Búsqueda activa» si hay una).
    Para buscar por posición hace falta calcular cada carta una vez (`/api/chart`, de a dos a la vez; en la versión pública,
    esperando si el servidor lo pide). Queda en este navegador (`carta:pos`, sin el nombre): las longitudes, la casa de cada
    planeta y sus aspectos duros, con la firma de los datos de nacimiento (si se edita la carta, se recalcula) y del sistema
    de casas y los orbes (si cambian, se recalculan las casas y aspectos). **Servidor propio:** se calcula solo. **Versión
    pública:** los datos de nacimiento viajan al servidor, así que no se manda nada hasta apretar «Calcular posiciones»;
    después solo las cartas nuevas, editadas o con otra configuración. Si una falla se dice cuál y hay «Reintentar».
    Test: `e2e_miscartas`.
  - **Luna** (calendario lunar): el mes en una grilla de lunes a domingo, con la fase de cada día (al mediodía), el
    signo en que termina el día y, el día que la Luna cambia de signo, **la hora del cambio**. Arriba, las fases
    principales del mes (nueva, cuarto creciente, llena, cuarto menguante) con día, hora y signo. Flechas y «Hoy»
    para cambiar de mes (de 1800 a 2400; cambiar de mes no suma pasos al historial), hoy resaltado y un selector
    **Sur / Norte** (en el hemisferio sur la Luna creciente se ve iluminada a la izquierda; se recuerda). Las horas
    son las de la zona horaria del navegador.
  - **Carta**: todo lo de abajo (natal, tránsitos, sinastría), como siempre. Si no hay ninguna carta abierta y hay
    guardadas, abre la primera. **Cambiar de carta**: la lupa
    al lado del nombre abre la lista de las cartas guardadas (con su fecha y la abierta marcada) y un buscador (sin
    importar mayúsculas ni tildes; Enter abre la primera, flechas para moverse, Esc cierra), más «Nueva carta». En
    tránsitos o sinastría se queda en esa vista con la carta elegida. La lupa no agranda el renglón del título: la rueda
    mide lo mismo. Test: `e2e_cambiar`. **La rueda y su leyenda entran en la
    pantalla**: el encabezado es compacto (la equivalencia de la hora va como una línea gris más, sin recuadro) y la rueda
    se achica según el alto de la ventana y lo que tiene arriba (modos, fecha de los tránsitos, selector de viajes), sin
    bajar de 440 px (`app.js::fitWheel` → `--wheel-room`; con el mandala agrandado en Configuración manda ese tamaño). **Las
    pestañas de las tablas van siempre en una fila**: si no entran (celular, letra grande) se deslizan de costado, el borde
    que corta se esfuma y la elegida queda a la vista. **En escritorio la rueda crece**: el encabezado va en la barra de
    arriba (ver «La barra de arriba») y, si la leyenda entra en una columna en
    el rincón de abajo a la izquierda sin tocar la rueda (la rueda es redonda: su esquina queda vacía; se mide con la
    rueda del tamaño que tendría), pasa ahí y la rueda usa también ese alto
    (en una pantalla de 1904 × 1015 pasa de unos 670 a 880 px). El tope de la rueda es 1100 px (antes 920).
    El panel de la derecha queda del mismo ancho. `fitWheel` pone `data-headrow` y `data-legend-side` en `<html>`.
    Test: `e2e_escritorio`.
    **Los símbolos de la rueda son ≈ 15 % más grandes** (los círculos de los planetas 27,5 en vez de 24, los signos de la
    pila y del anillo, y los grados, minutos, «R», números de casa y Asc/MC); la pila se reacomodó entre el zodíaco y el
    círculo de las casas y los planetas juntos se separan 7° en vez de 6,2° (`layout.js::SEP`).
    **En el celular (hasta 640 px de ancho)**, con una carta abierta, abajo hay una **barra fija: Carta · Tablas ·
    Tránsitos · Sinastría** que reemplaza al selector Natal / Tránsitos / Sinastría de arriba. «Carta» es la rueda natal
    sola (con el encabezado más chico entra entera en la primera pantalla); «Tablas», las tablas de la carta natal solas;
    «Tránsitos» y «Sinastría», sus vistas de siempre (rueda doble y tablas). Arriba, el nombre con la lupa y un **ícono de info** al lado: los
    datos de nacimiento (o la fecha del tránsito) y la hora UTC ya no ocupan lugar, se ven al tocar la info (se cierra
    tocándola otra vez o afuera). Si el nombre no entra con los íconos, los íconos pasan arriba del nombre; si el nombre
    solo no entra, se achica (hasta 20 px) y si igual no entra termina en «…» (`app.js::fitTitle`). Test: `e2e_info`.
    **Entre casas, Viajes e Imprimir viven en un botón flotante** abajo a la derecha (arriba de la barra): al tocarlo se
    despliegan hacia arriba, con su nombre (Viajes con la flechita del filtro al lado). Prender o apagar no lo pliega (se
    ve cómo quedó); Imprimir, el filtro de viajes, cambiar de vista, tocar afuera, Esc o el mismo botón sí. Un puntito en
    el botón avisa si «Entre casas» o «Viajes» están prendidos. Con la ficha de un planeta o el filtro de viajes abiertos
    (hojas de abajo) el botón se corre. En «Tablas», Tránsitos y Sinastría solo trae Imprimir. Test: `e2e_fab`.
    **En Tránsitos, la fecha va en una pastilla flotante** abajo a la izquierda (al lado del botón flotante): muestra la
    fecha y la hora («11 nov 2026 · 15:23») y el paso («de a 1 día»), con ‹ › para retroceder o avanzar ese paso. Al tocar
    la fecha sube una hoja con todos los controles (fecha, hora, zona horaria, paso y «Ahora»); se cierra con la ×, Esc o
    tocando afuera, y mientras está abierta los flotantes se corren. Los controles ya no ocupan lugar arriba de la rueda.
    Test: `e2e_tpill`. Al bajar, **las pestañas de las tablas quedan pegadas arriba** (dejando lugar al botón
    de las secciones). La barra no está en el Inicio, la Luna ni Combinar, ni en la tableta o el escritorio. Test: `e2e_celu`.
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
- Fecha, hora local y lugar → posiciones de Sol a Plutón, Ascendente y Medio Cielo. **El nodo lunar está apagado**: no se
  calcula ni se muestra en ninguna parte (ver «Cosas apagadas a pedido», más abajo, para volver a ponerlo).
- Zona horaria histórica con la base IANA (cambios de horario de verano incluidos). Avisa si la hora
  fue ambigua o no existió, y permite fijar el offset UTC a mano.
- Sistemas de casas: Placidus, Koch, Porfirio, Regiomontano, Campanus, iguales y signos enteros (en Configuración).
- **Aspectos entre planetas** (conjunción 0°, oposición 180°, trígono 120°, cuadratura 90°, sextil 60°, semicuadratura 45°,
  sesquicuadratura 135° y quincuncio 150°) con orbe y fase aplicativa o separativa. **El Ascendente y el Medio Cielo no
  forman aspectos**: no aparecen en ninguna lista, cuadro, cuadrícula, calendario ni línea de la rueda (siguen en las
  posiciones, las casas y el mandala, y se pueden tocar para leer su signo). El orbe máximo sale de esta tabla, por grupo
  de planetas y tipo de aspecto; **entre dos cuerpos de grupos distintos manda el orbe mayor** (Sol con Neptuno: el del Sol):

  | | conjunción, oposición, cuadratura | trígono | sextil | 45°, 135° y 150° |
  |---|---|---|---|---|
  | Sol, Luna | 10° | 8° | 6° | 2° |
  | Mercurio, Venus, Marte | 8° | 7° | 5° | 2° |
  | Júpiter, Saturno | 7° | 6° | 5° | 2° |
  | Urano, Neptuno, Plutón | 5° | 3° | 3° | 2° |

  El Nodo norte (apagado) no está en la tabla: usaría la última fila. En los trígonos de Mercurio, Venus y Marte (7/6) y de
  Júpiter y Saturno (6/5) la hoja trae dos valores; se usa el primero. Los números de fábrica están en `ORB_TABLE` y `HOUSE_ORBS` (`astro.py`) y, iguales, en `ORB_DEFAULTS` (`static/settings.js`): si se cambian, cambiarlos en los dos.
  El orbe de «Tránsitos destacados» es aparte (3°, y 2° en trígonos y sextiles), porque ahí se buscan los aspectos cerrados.
  **Esa tabla es la de fábrica y se puede cambiar** (Configuración → *Orbes*, ver abajo): el navegador manda los orbes
  elegidos con cada pedido (`orbs` en el cuerpo de la solicitud de la carta, los tránsitos y la sinastría) y el servidor
  los sanea (números de 0° a 15°; lo que falte o venga mal queda en el valor de fábrica, así que un pedido sin `orbs`
  calcula como siempre). En la sinastría mandan los de la carta A.
  Pasar el cursor por un planeta, o por una fila de la tabla, resalta sus aspectos, y **sobre cada
  línea resaltada aparece su orbe** (en una etiqueta del color del aspecto, sin pisarse con las otras; lo mismo con el
  teclado al enfocar el planeta). **Con el dedo** (celular, iPad) lo que se toca —un planeta de la rueda, una fila de la
  tabla o un aspecto— queda resaltado, y para volver a ver todos los aspectos se toca **afuera** o **de nuevo lo mismo**
  (tocar otro pasa al otro; arrastrar para desplazarse no lo suelta). Con el mouse sigue como antes: se suelta al salir.
  Test: `e2e_toque`. **Ficha del planeta**: con el dedo y las lecturas apagadas, tocar un planeta de la rueda abre abajo una
  tarjeta con su signo, grados (y «R»), su casa y sus aspectos —los mismos que resalta la rueda—, del más cerrado al más
  abierto, con el orbe y «A» (aplicativo) o «S» (separativo). En tránsitos y sinastría dice de qué carta es cada planeta
  («tránsito», «natal» o el nombre). Se cierra con la ×, tocando afuera, tocando de nuevo el planeta o cambiando de
  vista; leerla (tocar dentro) no la cierra. Con lecturas se abre la ventana del planeta, como siempre. Si el planeta pasa
  a otra casa («Entre casas») o es un viajero («Viajes»), la ficha trae arriba de los aspectos la misma explicación del
  cartelito (con el borde del color de cada cosa) y el cartelito aparte no se abre; con el mouse, el cartelito de siempre.
  Test: `e2e_fichatip`.
- **Notas de la carta natal**: cada carta guardada puede llevar **muchas notas** (de esa persona). Una nota es un texto
  libre con sus **vínculos**: planetas (en su casa y su signo), casas, el Ascendente, el Medio Cielo y aspectos que tiene
  la carta. Sin vínculos, la nota es sobre la carta en general. Solo se vincula lo que la carta tiene de verdad.
  - **El editor**: en la compu se abre **dentro del drawer de las notas** (ver abajo); en el iPad y el celular, en una
    ventana en el centro (en el celular se acomoda en lo que queda arriba del teclado). Tiene el texto, lo **vinculado** (chips con × para quitar), los **sugeridos por el texto** y
    **«+ Vincular»** (un planeta, una casa, el Asc, el MC o un aspecto de la carta). **No se guarda solo:** el botón
    **Guardar** (o Cmd/Ctrl+Enter) guarda y cierra; cerrar con cambios sin guardar (×, Esc o tocar afuera) pregunta
    «Guardar / Descartar / Seguir editando». «Borrar nota» pide tocarlo dos veces.
  - **Sugeridos**: la app lee el texto en castellano y propone vínculos que se confirman tocándolos (o «Sumar todos»).
    «Un Sol en I en Aries, haciendo cuadratura con la Luna y con Marte en IV, … el ascendente en Piscis» propone ☉ en I,
    la casa I, ☉□☽, ☉□♂, ☽ en IV, ♂ en IV, la casa IV y el Asc. Entiende planetas, signos, casas («en IV», «casa 4»,
    «cuarta casa», «5ta casa», «casas II y VII»), Asc y MC, y aspectos con la palabra («cuadratura con…», «la oposición
    entre…», «Sol y Luna en trígono», «Sol-Luna»). Si el texto dice otra cosa que la carta («Marte en III» y está en la IV,
    o «trígono» y es cuadratura), lo propone igual con un aviso (!). **Las casas siguen la lógica de «Entre casas»**: si
    Marte está al final de la III cerca de la cúspide de la IV (con los orbes de *Reglas avanzadas*), «Marte en IV» no
    lleva aviso, el aviso de «Marte en V» lo dice («está en la III (y entre casas, en la IV)»), el filtro «casa IV» de las
    notas encuentra las notas de Marte, y los vínculos lo muestran («♂ en III/IV», «casas III y IV», «casa III, en cúspide
    de la IV»). Un número suelto después de «en» o «la» también es
    una casa («Marte en 4»), salvo que siga una unidad («en 3 días»). El texto con símbolos se entiende igual.
  - **«Pasar a símbolos»** (en el editor) cambia los nombres por sus símbolos (Sol → ☉, Aries → ♈, cuadratura → □,
    Ascendente → Asc, Medio Cielo → MC) y las casas a romanos («casa 12» → «casa XII», «cuarta casa» → «casa IV»,
    «Marte en 4» → «Marte en IV»). «Leo» y «Libra» solo después de «en» o «de» (para no tocar «leo mucho»). Se deshace
    con el mismo botón o con Cmd/Ctrl+Z.
  - **La letra de las notas** es Kalam (manuscrita y clara, de Indian Type Foundry) y Plutón va siempre con su símbolo
    astrológico (⯓): el «PL» (♇) de notas viejas o pegado en el texto se cambia solo. Las dos letras van incluidas en `static/fonts` (licencia OFL,
    con sus textos ahí mismo): la app no pide nada a internet.
  - **«Insertar símbolo»** (en el editor) abre una paleta con los planetas, los signos, los aspectos, Asc y MC: tocar uno
    lo escribe donde está el cursor (se deshace con Cmd/Ctrl+Z). Sirve cuando «Pasar a símbolos» no reconoce una palabra.
  - **En la rueda:** con una nota abierta se iluminan sus planetas, sus aspectos, sus casas (sombreadas) y el Asc o el MC;
    lo demás queda tenue. Lo que tiene notas lleva un **puntito dorado** (planetas, número de casa, Asc/MC; el símbolo del
    aspecto, con borde dorado); esas marcas están **apagadas por defecto** y se prenden con «Marcar en el mandala lo que
    tiene notas» en las notas (se recuerda en ese navegador). Con el mouse, pasar por una tarjeta de «Notas» la ilumina.
  - **Leer una nota:** tocar una tarjeta (o una nota de las listas) la abre grande y sin editar (en la compu, en el
    drawer; en el iPad y el celular, en el centro), con sus vínculos iluminados en la rueda y «Editar».
  - **Tocar la rueda:** un planeta, el número o la zona de una casa, el Asc o el MC o el símbolo de un aspecto que tienen
    notas muestran esas notas (y «+ Nota nueva sobre…»). Con el dedo, el planeta abre su ficha, que ya las trae; con
    lecturas, el planeta y los ángulos abren su ventana como siempre.
  - **Las notas** se abren con el botón **«Notas»** de arriba, entre Viajes e Imprimir (con la cantidad); en el celular
    está en el botón flotante. **En la compu** se abren en un **drawer al costado**, debajo de la barra y en el lugar de
    las tablas, **sin oscurecer nada**: el mandala queda a la vista y se puede usar mientras se lee o se escribe. La nota
    (nueva, para leer o para editar) se abre adentro, encima de la lista, con **«‹ Notas»** para volver; Esc cierra la
    nota y, otra vez, el drawer (también la ✕ o el botón «Notas»). Si la nota se empezó desde una tabla o la rueda, al
    guardarla o cerrarla se vuelve ahí (`data-ndock` en la raíz; test `nd_dock`). **En el iPad** (pantallas de hasta 1180 px o
    con el dedo) se abren en un **panel que entra por la derecha**, como la Configuración (en el celular, a pantalla
    completa; el panel de las notas se mueve adentro mientras está abierto), con el nombre de la carta; se cierra con la ✕, Esc o
    tocando afuera. Todas, la más nueva arriba, con sus chips; tocar una tarjeta la abre para leer. **Filtro** por elemento
    (un planeta encuentra también las notas de sus aspectos; una casa, las de los planetas que están en ella); tocar un
    chip filtra por eso. En el iPad y el celular, «Ver en la carta» cierra el panel y va a la rueda con la nota iluminada y un cartelito (Editar, ×).
  - **Atajos:** en Posiciones, Casas y Aspectos cada fila tiene un botón de nota (marcado si hay notas que lo nombran): sin
    notas empieza una nueva ya vinculada; con notas, muestra las que lo nombran y «+ Nota nueva sobre…». En el celular, la
    ficha del planeta lista sus notas y «+ Nota sobre…».
  - Cada vínculo guarda **qué había cuando se vinculó** (signo y casa, el tipo de aspecto): si después se corrigen los
    datos de nacimiento y eso cambió, la nota no se pierde y avisa.
  - Se guardan con la carta (`notes`: una lista de `{id, text, at, refs, snap}`): en la versión pública, en el navegador
    (no pasan por el servidor, tampoco al importar); en el servidor propio, en el archivo de cartas
    (`PUT /api/charts/<id>/notes`). Si el servidor de la Mac es de una versión anterior (quedó abierto al actualizar),
    lo dice y las notas quedan de respaldo en el navegador hasta poder guardarlas (al volver a abrir la carta). Cambiar los datos de la carta no las borra, y viajan al exportar e importar. Las de la
    versión anterior (una por cosa) pasan solas a la lista; una figura de tres queda como nota con sus tres aspectos. Hasta
    150 notas por carta, 24 vínculos por nota y 5000 caracteres. Solo carta natal y solo cartas guardadas. Lógica en
    `static/notes.js` (sin DOM). Tests: `test_notes.mjs`, `test_store_notes.py`, `e2e_notas`.
- **Símbolo del aspecto sobre cada raya**: en el punto medio de cada línea de la rueda va el **símbolo del aspecto**
  (trígono △, cuadratura □, sextil ✱, semicuadratura ∠, sesquicuadratura, quincuncio, oposición) sobre un fondo del color del
  panel, para que se lea encima de las rayas. Siguen la paleta de la app: **rojo** los tensos (oposición, cuadratura,
  y también la semicuadratura y la sesquicuadratura), **azul** los fluidos (trígono, sextil) y **dorado** el quincuncio.
  Los tres aspectos menores (45°, 135° y 150°) llevan la **raya punteada**, aunque la semi y la sesquicuadratura sean rojas.
  El símbolo de la sesquicuadratura es un cuadrado con la semicuadratura (∠) cruzándole la base. Al resaltar un planeta quedan a pleno los de sus rayas y
  el resto se atenúa, y las etiquetas de orbe se acomodan para no taparlos. Son íconos vectoriales (`ASPECT_SVG` en
  `glyphs.js`), así que se ven igual en todas las fuentes; los usan también la lista de Aspectos, el Cuadro, la cuadrícula,
  el calendario, los botones de Configuración y las ventanas de lectura. El estilo **Clásico** también los usa para los
  aspectos (lo que cambia entre estilos son los signos y los planetas).
- **Conjunciones en la rueda**: no llevan raya (sería un punto). En su lugar va un **circulito rojo** en el punto medio
  entre los dos cuerpos, sobre el círculo de los aspectos. Al pasar el cursor por uno de los planetas se resalta y muestra
  su orbe, igual que las rayas.
- **Anillo exterior con las cúspides**: por afuera del zodíaco hay un anillo (una banda con su circunferencia) que lleva, en
  cada cúspide, **grados · signo · minutos** apilados a lo largo del arco, como en otros programas: arriba o a la izquierda
  los grados, en el medio el **signo con el color de su elemento** (rojo fuego, verde tierra, dorado aire, azul agua) y
  abajo o a la derecha los minutos. **Los bordes de las 12 casas saltan el anillo de colores del zodíaco (no lo pisan) y reaparecen en
  este anillo**, con un hueco donde se asienta el signo; los de los ejes (casas 1, 4, 7 y 10) van más gruesos. Los nombres **Asc, MC, Dsc e IC** quedan
  afuera, sobre la prolongación del eje (Asc y MC siguen siendo tocables si las lecturas están prendidas). Si dos cúspides
  quedan tan cerca que sus rótulos se pisarían (casas de tamaños muy distintos), los rótulos se separan lo justo y su borde
  va entero. La letra grande (Configuración) los reacomoda. Funciona con cualquier sistema de casas, en el estilo Clásico
  (el signo va como símbolo de texto) y en la **rueda doble** de tránsitos y sinastría: ahí el anillo va por afuera del de
  tránsitos y los bordes cruzan ese anillo más tenues; las cúspides son las de la carta de adentro. El mandala se achica un poco
  (≈ 8 %) para que entre. **Se puede apagar** (Configuración → *Mandala* → «Anillo exterior con las cúspides»): vuelven
  los grados y minutos sueltos afuera del zodíaco, sin el signo, como antes. La pestaña Casas ya los traía en tabla.
- **Planetas entre casas** (botón «Entre casas», arriba a la derecha de la carta natal; viene apagado y solo está en la
  vista Natal): marca los planetas que **pasan a la casa que sigue** y los que **están en las dos**. **Se cuenta siempre
  hacia adelante**, nunca para atrás: lo que importa es cuántos grados le **faltan** al planeta para llegar a la cúspide de
  la casa que sigue; un planeta que ya pasó una cúspide es de esa casa y nada más. Los orbes de fábrica salen de la segunda
  tabla de la hoja (en las otras casas la hoja trae «3/2» y se toma un solo valor, 2,5°, el promedio):

  | | cúspide angular (casas 1, 4, 7, 10) | cúspide de las otras casas |
  |---|---|---|
  | En cúspide: pasa a la casa que sigue | hasta 4° | hasta 2,5° |
  | En las 2 casas: cuenta en las dos | de 4° a 7° | de 2,5° a 5° |

  *En cúspide*: si le faltan hasta esos grados, el planeta cuenta en la casa que sigue **y ya no en la suya**. *En las 2
  casas*: si le faltan más que eso y hasta estos grados, cuenta **en las dos**. Lo calcula el servidor (`_house_reach` en
  `astro.py`; la respuesta de la carta trae `house_reach`, con `kind` = `pass` o `both`, la casa donde cae, `also` = la
  que sigue y `dist` = los grados que le faltan). Cómo se ve: en la **rueda**, los planetas que pasan se dibujan **adentro de la casa que sigue**, con la pila de siempre (círculo, grados, signo y minutos, en la misma zona de los demás planetas) y un **borde violeta**: macizo si cuentan solo en la que sigue (el planeta sale de su casa), punteado si cuentan en las dos (queda su pila en la casa propia y otra copia en la que sigue). Una raya sale de la posición real, sobre la graduación. Se acomodan con el mismo reparto de siempre (`placePlanets`): como acaban de pasar la cúspide, quedan antes que los planetas de esa casa. Al pasar el cursor se resalta el planeta (las dos copias) y sus aspectos; al **tocar**, o con Enter, sale un **cartelito** con la misma explicación del hover («Venus está en la casa 5, a 0°28′ de la cúspide de la 6: cuenta en la 6 y no en la 5»); se cierra al tocar afuera, con Esc o al desplazar, y con las lecturas prendidas trae un botón «Ver lectura». En **Posiciones**, junto a la casa, `→ 11` (cuenta en la 11 y no en
  la suya) o `+ 11` (cuenta en las dos). En **Casas**, el planeta que pasa sale de su casa y aparece en la que sigue con
  borde macizo; el que cuenta en las dos queda en la suya y aparece también en la que sigue con borde punteado. La leyenda
  de la rueda y una nota debajo de las tablas lo explican con los orbes que se estén usando. Se recuerda (`spill` en
  `carta:cfg`). Los orbes se cambian en Configuración → *Orbes*. No cambia la casa que figura en el resto de la app.
  **Servidor de una versión anterior**: el cálculo vive en `astro.py`, y la página nueva puede estar hablando con un servidor que sigue
  abierto con el cálculo viejo (hay que cerrar la ventana de Carta natal, esperar unos segundos y volver a abrirla). La
  respuesta de la carta trae `orbs_v: 2`; si falta, la página no usa lo que el servidor calculó de las casas y avisa arriba
  (solo si hay orbes cambiados o «Entre casas» prendido).
- **Viajes de los planetas por las casas** (solo carta natal): un planeta «viaja» a una casa que no es la suya y ahí también actúa.
  Se calcula en el navegador (`static/trips.js`, sin DOM) a partir de los aspectos que ya trae el servidor
  (los mismos orbes de Configuración, estén o no a la vista en la rueda), las casas de cada planeta y las cúspides. Hay tres
  tipos, todos con aspectos duros: **por aspecto** (dos planetas en aspecto duro se intercambian de casa: Saturno en la III en
  oposición a Venus en la IX → Saturno viaja a la IX y Venus a la III), **por eje** (un planeta pegado a una cúspide, antes o
  después, viaja a la casa opuesta: Mercurio pegado a la cúspide de la V → viaja a la XI) y **por implicancia** (un planeta en
  aspecto duro con otro viaja a las casas cuya cúspide está en un signo que rige ese otro: Venus se opone a Saturno, que rige
  Capricornio, y la VIII tiene Capricornio → Venus viaja a la VIII; Saturno se opone a Venus, que rige Libra y Tauro → Saturno
  viaja a la V y a la XII). Un planeta nunca viaja a la casa donde ya está. Probado con la carta del pizarrón: da exactamente
  esos seis viajes.
  - **Pestaña «Viajes»** (carta natal, después de Casas): los tres grupos con la cantidad, y cada viaje con la notación del
    pizarrón y números romanos, `♄ → IX (♄ ☍ ♀ IX)` · `☿ → XI (☿ ☌ V)` · `♀ → VIII (♀ ☍ ♄ reg. de ♑ VIII)`. Al tocar una fila
    se lee la explicación en palabras (otra vez para cerrarla); al pasar el cursor, la rueda resalta el planeta.
  - **Botón «Viajes»** (arriba a la derecha de la carta natal, apagado de fábrica): dibuja en la rueda a cada viajero, solo el
    círculo del planeta, dentro de la casa a la que viaja, con borde **macizo** (por aspecto), **doble** (dos anillos, por eje) o
    **punteado** (por implicancia); si un planeta llega a una casa por más de un camino es un solo círculo, con el borde del
    tipo más fuerte. Al enfocar al planeta o a uno de sus viajeros sale una **flecha** desde su lugar hasta cada casa a la que
    viaja. Al **tocar** un viajero (o Enter) sale el cartelito con la explicación en palabras, un párrafo por camino; se cierra
    al tocar afuera, con Esc o al desplazar. Funciona junto con «Entre casas». Se recuerda (`tripsOn` en `carta:cfg`).
    Al prenderlo, el botón suma una **flechita ▾** que abre el **filtro de viajes** flotando debajo (en el celular, una hoja
    que sube desde abajo, arriba de la barra): no ocupa lugar arriba de la rueda, que no se mueve. Se cierra con la ×, Esc o
    tocando afuera (tocar las fichas no lo cierra). Con un filtro puesto, el botón dice cuántos se dibujan («Viajes 7/10»,
    o «11/12» por casa). Test: `e2e_tpop`. En el filtro se elige ver los viajes **«por Planeta»** (de fábrica) o **«por
    Casa»**, y nunca las dos cosas a la vez; se despliega solo la lista elegida. Por Planeta: una ficha por planeta con a cuántas
    casas viaja. Por Casa: una ficha por casa, I a XII, con cuántos viajeros llegan a ella (la casa de llegada, que es donde se
    dibuja). Vienen todas marcadas y se desmarcan de a una, con **Marcar todos / Desmarcar todos** (planetas) o **Marcar todas /
    Desmarcar todas** (casas). Al cambiar entre Planeta y Casa, o al volver a prender «Viajes», vuelve a estar todo marcado y
    rige solo el filtro elegido (no se guarda). La pestaña «Viajes» sigue mostrando todos los viajes. No sale en la hoja impresa.
  - **Configuración → «Viajes de planetas»** (`trips` en `carta:cfg`): los **aspectos duros** que cuentan (de fábrica conjunción,
    oposición y cuadratura; se pueden sumar semicuadratura y sesquicuadratura, o sacar cualquiera) y el **orbe a la cúspide**
    del viaje por eje (de fábrica 1° en las angulares y 1° en las otras, de 0° a 15°). Los **regentes** son siempre los modernos,
    como en la cruz de elementos (Escorpio de Plutón, Acuario de Urano, Piscis de Neptuno): ya no hay opción de regentes
    tradicionales. «Restablecer viajes» vuelve a los de fábrica. Lo guardado con los valores de fábrica de antes (oposición y
    cuadratura, 4° y 2,5°) pasa solo a los de ahora; lo que se haya elegido a mano se respeta. Solo viajan los diez planetas
    (sin nodo).
  - No sale en la hoja impresa (la rueda sí, con los viajeros si el botón está prendido).
- **Qué aspectos se ven** (Configuración → *Aspectos*): ocho botones, uno por tipo (conjunción, oposición, trígono,
  cuadratura, sextil, semicuadratura, sesquicuadratura y quincuncio). Apagar uno lo saca de **la rueda** (rayas, símbolos y circulitos),
  **la lista de Aspectos**, **el Cuadro y la cuadrícula**, **los aspectos de tránsitos y sinastría** y **el calendario de
  aspectos exactos**; volver a prenderlo los trae de vuelta. Es solo de la vista: el cálculo no cambia, y «Tránsitos
  destacados» y «Próximamente» (que buscan sus propios aspectos cerrados) no se filtran. Se recuerda en el navegador
  (`aspOff` dentro de `carta:cfg`) y «Restablecer» los prende todos.
- **Cuadro** (pestaña en las tres vistas; en la carta natal es la **primera** y la que se abre): los aspectos en escalera, con cada planeta como un círculo de
  color en la diagonal y, en cada celda, el **símbolo del aspecto con su orbe debajo**, como `0S41` o `3A49`
  (grados, **A** aplicativo o **S** separativo, minutos; la clave se explica abajo del Cuadro). Las celdas vacías son pares sin aspecto. Natal: todos contra todos
  (sin Ascendente ni Medio Cielo). Tránsitos y sinastría: filas = la carta de adentro, columnas = la de
  afuera. En tránsitos y sinastría la **cuadrícula** de aspectos lleva el mismo símbolo y orbe en cada celda. Al pasar el cursor se ve el orbe y la fase completos, y la rueda resalta el par y muestra su orbe sobre la línea. En el
  celular o la tablet, donde no hay cursor, se toca la celda y se abre la ventana del aspecto.
- **Elementos** (solo natal): una cruz con Fuego arriba a la izquierda, Aire arriba a la derecha, Tierra abajo
  a la izquierda y Agua abajo a la derecha. Cada cuadrante lista los planetas personales (Sol a Saturno, sin
  Urano, Neptuno ni Plutón) y el Ascendente según el elemento de su signo, sin porcentajes. El regente del
  Ascendente queda marcado en su cuadrante si es un planeta personal; con la regencia moderna, Escorpio,
  Acuario y Piscis tienen regentes transpersonales (Plutón, Urano, Neptuno) y no se marca ninguno. Ya no hay
  opción de «regente tradicional» en esta pestaña (las profecciones siguen usando los regentes tradicionales).
- **Crear y editar cartas**: el formulario se abre en una **ventana en el centro** al tocar **«Nueva carta»** (en la
  lista de la lupa, en «Buscar o cambiar de carta…» o en el inicio; en blanco) o **«Editar los datos»** (en la ⓘ de la
  carta, con sus datos). Abajo de todo, con una carta guardada abierta, **«Eliminar esta carta»** (dos toques; la
  confirmación espera 6 segundos) la borra y vuelve al inicio. Hay **un solo botón**, **«Calcular y
  guardar»** (también con Enter en cualquier campo): valida los datos, guarda la carta (hace falta un nombre), la
  calcula, cierra el formulario y la muestra. Con una carta guardada abierta dice **«Calcular y guardar cambios»** y
  actualiza esa carta; **«Guardar como carta nueva»** la duplica en vez de pisarla. Si falta algo (el nombre, la
  fecha…), no se guarda nada y el aviso queda debajo del formulario hasta que se corrija un campo. La **✕** de arriba
  (o Esc) cierra el formulario sin guardar y vuelve a como estaba antes de abrirlo (los campos, la carta elegida).
  El *sistema de casas* ya no está en el formulario: es una preferencia de la vista, está en
  Configuración, vale para todas las cartas y se aplica al instante, sin apretar nada.
- **Imprimir** (botón arriba a la derecha de la carta): abre un cuadro para **elegir qué va en la hoja**: el mandala y,
  según la vista, las tablas (natal: Cuadro de aspectos, Posiciones, Casas, Viajes, Aspectos y Elementos; tránsitos: Tránsitos,
  Cuadro y Aspectos; sinastría: Superposición, Cuadro y Aspectos). Con tres atajos: **Solo el mandala** (sale grande,
  en una hoja), **Mandala y cuadro** (también en una hoja) y **Todo** (en la carta natal, dos hojas: el título, la rueda
  y las tablas de Posiciones y Casas en la primera; el Cuadro, los Aspectos y los Elementos en la segunda). También se
  puede imprimir sin mandala, solo tablas. Lo que elegís se recuerda por vista, y Ctrl/Cmd + P imprime eso mismo sin
  abrir el cuadro. Después se abre la impresión del navegador, donde también se guarda como PDF. Sale sin menú ni
  botones, y **siempre en claro**, aunque la pantalla esté en modo oscuro. La lista de Aspectos sale en dos columnas, para
  que entre aunque tenga muchos.
- **Mover la hora** (carta natal; botón de arriba, entre Viajes y Notas; en el celular, en el botón flotante): abre
  `‹ paso ›` para correr la fecha y la hora de la carta de a **1 minuto, 5 minutos, 15 minutos, 1 hora, 1 día, 1 semana,
  1 mes o 1 año** (meses y años sobre el calendario), y se recalcula todo: rueda, tablas, casas, aspectos. Muestra la hora
  que se ve y cuánto se movió («+1 h 15 min»), también en el subtítulo y en lo que se imprime. **No cambia la carta
  guardada**: «Volver a la de nacimiento» la deja como estaba (también apagar el botón, cambiar de carta o editarla) y
  «Guardar esta hora…» abre los datos de la carta con esa fecha y hora para guardarlas (sirve para rectificar). Con la
  hora movida no se muestran las notas (son de la hora de nacimiento). En Tránsitos y Sinastría no se usa: la carta
  natal va con su hora; al volver a Natal sigue movida. En el celular, la hora va en una pastilla abajo con ‹ ›, como
  la fecha de los tránsitos, y tocarla abre los controles. Test: `nd_shift`.
- **Mientras piensa**: si un pedido al servidor tarda más de un instante (200 ms), aparece una **barrita animada arriba de
  todo** (`#busyBar`; `api.js` cuenta los pedidos en curso y avisa con el evento `carta:net`). Al recalcular la carta
  (cambiar de carta, de modo, de fecha o de ajustes) la **rueda y las tablas se atenúan** con un circulito girando en el
  centro del mandala (`data-calc` en la raíz); la primera vez, cuando todavía no hay nada para mostrar, dice
  **«Calculando la carta…»**. Si responde rápido no se ve nada. No sale al imprimir. Test: `busy_test`.
- **Configuración** (el engranaje de arriba a la derecha): un **panel que entra por la derecha** (en el celular, a pantalla
  completa; se cierra con la ✕, Esc o tocando afuera; siempre arranca cerrado). Los ajustes van en **cinco grupos
  plegados**, cada uno con una línea que resume cómo está («Tema automático · Redondeada · letra 100 %»), los textos
  largos detrás de **«¿Cómo funciona?»** y su propio **«Restablecer»** (apagado si ya está como de fábrica):
  - **Apariencia**: tema (Claro / Oscuro / Automático, el del sistema; el botón de la barra cambia entre claro y oscuro),
    **colores** (paletas Océano —la de fábrica—, Violeta, Bosque, Ámbar y Mineral, o un color a mano para los **botones** —y
    todo lo elegido—, el **fondo** —las tarjetas y paneles salen de él— y las **líneas**, por separado para el modo claro y
    el oscuro; si el fondo elegido es claro en el modo oscuro, o al revés, el texto se acomoda solo; la rueda no cambia y
    la hoja impresa sale con los de fábrica; `colors` en `carta:cfg` y la hoja armada en `carta:colorcss`, que el `<head>`
    pone antes de pintar),
    **letra de la app**, **letra de las notas**, tamaño de la letra (85 % a 130 %; escala todo el texto; el de la rueda sube
    con un tope ×1,25 para que no se pise con los símbolos) y estilo de los gráficos: **Nuevo** (círculos de colores con
    símbolos vectoriales, banda oscura de signos) o **Clásico** (los símbolos de texto de antes, sin círculos y con el anillo
    de signos claro; al elegirlo se activa también el tinte por elemento).
    - *Letra de la app*: un selector donde **cada opción se ve escrita con su letra** (`static/fontpick.js`, sobre un
      `<select>`; flechas, Enter, Esc). **Del dispositivo**: Sistema (SF Pro), Redondeada, Helvetica Neue, Avenir Next, New
      York y Monoespaciada (dependen de lo que tenga la compu: Avenir o New York solo existen en Apple). **Incluidas**, que
      se ven igual en todos lados: sin serif Inter, Source Sans, Nunito, Atkinson Hyperlegible (muy legible) e IBM Plex Sans;
      con serif Lora, Source Serif y EB Garamond. **De fábrica: Redondeada.**
    - *Letra de las notas*: Kalam (de fábrica), Patrick Hand, Mali, Shantell Sans o la misma de la app.
    - Las letras incluidas están en `static/fonts` (de `@fontsource`, licencia OFL; los textos de las licencias están al
      lado), en versión variable cuando existe, partidas en latín y latín extendido: no se pide nada a internet.
  - **Mandala**: tamaño (60 % a 140 %; por encima de 100 % el mandala pasa a ocupar todo el ancho, más grande que el que
    entra en la pantalla, y las tablas bajan debajo de él), anillo exterior con las cúspides (ver arriba; **prendido de
    fábrica**), tinte por elemento en el anillo de signos (**prendido de fábrica**) y marcar en el mandala lo que tiene notas.
  - **Aspectos y orbes**: sistema de casas (Placidus, Koch, Porfirio, Regiomontano, Campanus, iguales o signos enteros;
    recalcula al instante), qué tipos de aspecto se ven (ver «Qué aspectos se ven», arriba) y los **orbes de los aspectos**
    por grupo de planetas y tipo de aspecto (Sol y Luna · Mercurio, Venus y Marte · Júpiter y Saturno · Urano, Neptuno y
    Plutón × conjunción/oposición/cuadratura · trígono · sextil · 45°, 135° y 150°). Se aplican a la carta natal, los
    tránsitos y la sinastría (y recalculan la carta que estás viendo); los de «Tránsitos destacados» y «Próximamente» son
    aparte, y el calendario de aspectos exactos busca el momento exacto, así que no los usa. Cada casilla acepta de 0° a 15°
    (más se acomoda a 15°; vacía vuelve a su valor de fábrica) y las modificadas se resaltan. Los «7/6» y «6/5» de la hoja
    (trígonos de personales y sociales) se cargan con el primer número.
  - **Reglas avanzadas**: los **orbes de los planetas en las casas** (ver «Planetas entre casas»; el «3/2» de las otras
    casas en cúspide se cargó como 2,5°) y los **viajes de planetas** (ver «Viajes»).
  - **Datos**: el zodíaco y el cálculo (en tu computadora, con Swiss Ephemeris), dónde se guardan las cartas y
    **Exportar / Importar cartas**.
  - *Interpretación*: **ya no está** (ver «Cosas apagadas a pedido»). La app queda siempre en «solo datos»: sin la
    ventana de lectura al tocar un planeta (rueda, tablas y Elementos) ni la de los aspectos (lista, Cuadro y cuadrícula;
    ahí los aspectos dejan de ser tocables), sin los temas de las casas (profecciones y «Próximamente»), sin los textos de
    los tránsitos destacados, sin las pistas de «tocá un planeta…» y sin el poema de la Luna. Quedan las posiciones, casas,
    aspectos, orbes, fechas y horas.
  - Todo se recuerda en el navegador (clave `carta:cfg`; el tema en `carta:theme`) y se aplica antes de dibujar la
    página, así que no hay parpadeo al abrir. Mientras nadie toque la configuración no se guarda nada y rige lo de
    fábrica. Una configuración guardada antes de este cambio (sin `v`) que seguía en los valores de entonces (letra del
    sistema, sin tinte en el estilo Nuevo) cuenta como «sin elegir» y pasa a los de ahora; lo que se haya elegido de
    verdad (otra letra, el estilo Clásico sin tinte, tamaños) se respeta. Una configuración vieja con las lecturas prendidas
    no las reactiva: mientras estén apagadas en el código, mandan las del código.
- **Lectura de cada planeta** *(apagada a pedido; el código sigue)*: tocá un planeta en la rueda (o su fila en Posiciones, Tránsitos y Superposición, o su
  casilla en Elementos; también «Asc» y «MC» en la rueda) y se abre una ventana con:
  - *el signo*: elemento, modalidad, dignidad clásica (domicilio, exaltación, exilio, caída) y la lectura del planeta
    en ese signo. Para Urano, Neptuno y Plutón aclara que el signo describe a una generación;
  - *la casa*: el tema de la casa y la lectura del planeta ahí (el Nodo norte incluye su eje con el nodo sur;
    Ascendente y Medio Cielo no llevan casa ni aspectos);
  - *los aspectos*: cada uno con orbe y fase, qué relaciona ese par de cuerpos y cómo se comporta ese tipo de aspecto.
    Se respeta el filtro de orbe (hasta 1° / hasta 3° / todos, que es como arranca: los orbes de la tabla) y hay un botón para ver también los de orbe mayor. Tocando el
    otro planeta se salta a su lectura, y la flecha de la esquina vuelve;
  - *retrogradación*, con una aclaración en Urano, Neptuno y Plutón, donde es un estado muy frecuente.
  En **tránsitos** y **sinastría** el planeta del anillo exterior se lee igual (signo, casa de la carta de adentro y
  aspectos a esa carta) y el de adentro agrega los aspectos que recibe del anillo exterior.
- **Lectura de un aspecto** *(apagada a pedido; el código sigue)*: tocá un aspecto en la lista de Aspectos, en el Cuadro o en la cuadrícula (natal, tránsitos
  y sinastría; con el teclado, Enter o espacio sobre la celda o la fila) y se abre una ventana. La cabecera lleva los
  dos planetas con el símbolo del aspecto, su nombre, el orbe y si es aplicativo o separativo. Debajo:
  - *Los dos puntos*: dónde está cada uno (signo, casa y, en tránsitos y sinastría, de quién es: «tránsito», «natal» o el
    nombre de cada carta);
  - *El aspecto*: el ángulo exacto, qué es el orbe, cómo se lee esa fase (aplicativo / separativo) y cómo se comporta ese
    tipo de aspecto;
  - *Qué une a este par*: el tema que relaciona a esos dos cuerpos (los mismos textos de `interp-aspects.js`);
  - *Movimiento*: si alguno de los dos está retrógrado.
  Cada planeta de la ventana es un botón: cierra el aspecto y abre la lectura de ese planeta. Mientras la ventana está
  abierta, la rueda deja resaltada la línea. El orbe sobre las líneas es un dato, así que se ve igual con las lecturas apagadas.
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
    o planetas hasta Saturno. Orbe de hasta 3° (2° en trígonos y sextiles); «punto máximo»
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
  el momento de a 15 minutos, 1 hora, día, semana, mes o año. Tres tablas: dónde está cada planeta y qué casa natal
  recorre; aspectos del tránsito a la carta natal con orbe y fase (aplicativo / separativo); y un
  **calendario** de aspectos exactos con fecha y hora, para 3, 6, 12 o 24 meses desde la fecha que quieras
  (Júpiter–Plutón, más Marte, o del Sol a Plutón), con los mismos ocho aspectos de arriba y sin el Ascendente ni el Medio Cielo. El calendario marca los retrógrados y numera las
  pasadas (1ª de 3). Tocando una fila, la rueda salta a ese instante exacto.
- **Sinastría**: pestaña «Sinastría» y elegís otra carta guardada en «Comparar con». Adentro la carta
  abierta con sus casas, afuera la otra. Aspectos cruzados entre los planetas de ambas (sin Ascendente ni Medio Cielo),
  un cuadro de aspectos (filas = una carta, columnas = la otra) y la superposición de casas: en qué
  casa de cada una cae cada planeta de la otra. Al ser dos fechas de nacimiento, no se calcula fase.
- En las dos vistas el filtro de orbe (hasta 1° / hasta 3° / todos) también decide qué líneas se dibujan en la rueda.
- **Cartas guardadas**: guardá todas las que quieras con nombre. Se abren desde las tarjetas del inicio, la lupa al
  lado del nombre de la carta o «Buscar o cambiar de carta…» de la barra de arriba (una lista con buscador, sin tildes ni
  mayúsculas). «Calcular y guardar cambios» actualiza la abierta y «Guardar como carta nueva» la duplica. Eliminar: en
  «Editar los datos», «Eliminar esta carta» (dos toques; la confirmación espera 6 segundos).
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

`verificar.py` compara el motor con resultados ya verificados: una carta natal conocida (10 planetas más Ascendente y Medio Cielo —el nodo, solo si `SHOW_NODE` está en `True`—, con signo,
grado, minuto y casa), dos sinastrías de los documentos del proyecto (aspectos, orbes
y casas cruzadas; los aspectos al Ascendente y al Medio Cielo de los documentos ya no se calculan) y la gran conjunción Júpiter–Saturno del 21/12/2020. Trae fechas de nacimiento reales, por
eso no se sube al repositorio (ver `.gitignore`). Los momentos exactos del
calendario se afinan por bisección (precisión de un segundo) y se probaron contra un barrido por fuerza
bruta: mismos eventos, orbe menor a 0,001° en cada uno.

## Cosas apagadas a pedido (y cómo volver a ponerlas)

Dos cosas se sacaron sin borrar el código; las dos se vuelven a poner con una bandera:

- **Nodo lunar**: en `astro.py`, `SHOW_NODE = False`. Con `True` el cálculo vuelve a traerlo (Nodo norte, con su orbe de la
  última fila de la tabla, aspectos, casa, etc.). En `static/index.html`, sacar `hidden` del campo «Nodo lunar» de
  Configuración (el que tiene el comentario) para elegir entre verdadero y medio.
- **Lecturas e interpretación** (ventanas de planeta y de aspecto, temas de casas, textos de tránsitos, poema de la Luna,
  pistas de «tocá un planeta…», y la opción *Interpretación* de Configuración): en `static/settings.js`,
  `export const INTERP_ENABLED = false` y, en la cabecera de `static/index.html`, `var INTERP_ENABLED = false`. Para volver
  a ponerlas: las dos en `true` y sacar `hidden` del título, el selector y la aclaración de *Interpretación* en
  Configuración (el comentario ahí lo recuerda). Con eso vuelve el selector «Con lecturas / Solo datos» y arranca con
  lecturas. Se probó así: con las banderas en `true` pasan las pruebas de las ventanas de aspectos y de planetas.

## Dónde se guardan las cartas

En un archivo JSON fuera de la carpeta de la app, así que **reemplazar la carpeta por una versión nueva
no borra nada**:

- macOS: `~/Library/Application Support/Carta natal/`
- Windows: `%APPDATA%\Carta natal\`
- Linux: `~/.local/share/carta-natal/`

La ruta exacta aparece en Configuración → *Datos* y en la terminal al iniciar. Para usar otra carpeta:
variable de entorno `CARTA_NATAL_DATA`. Para hacer copia de seguridad alcanza con copiar ese archivo, o usar
**Exportar cartas** / **Importar cartas…** en Configuración → *Datos*: bajan y suben un archivo JSON con todas las cartas
(`cartas-natales-AAAA-MM-DD.json`). Al importar se suman a las que ya tenés. Una carta con la **misma fecha, hora y
ciudad** que una que ya está (el lugar con el mismo nombre, sin importar mayúsculas ni tildes, o casi las mismas
coordenadas) es la misma aunque traiga **otro nombre**: no se duplica, y se le **suman las notas** que trae y no tiene
(las de igual texto no se repiten); queda con su nombre de siempre. Las que no se pueden leer se cuentan aparte, y el
aviso dice cuántas cartas nuevas entraron, cuántas ya estaban y a cuántas se les sumaron notas. Es el mismo archivo de la
versión pública, así que sirve para pasar cartas de una a la otra.
Si el archivo se corrompe, la app lo aparta con otro nombre y empieza uno vacío en vez de pisarlo.
(En la versión pública es distinto: ver «Alojarla en internet».)

## Alojarla en internet (Render)

La app también puede correr en un servidor para que otras personas la usen con un link. Es la **versión
pública**: `python3 app.py --public` (o la variable `CARTA_NATAL_PUBLIC=1`, que ya trae el `Dockerfile`).
Es la misma app con tres diferencias:

- **Las cartas guardadas viven en el navegador de cada persona**, nunca en el servidor: cada uno ve solo
  las suyas, sin cuentas ni contraseñas. Si borran los datos del sitio se pierden, por eso hay
  *Exportar cartas* e *Importar cartas…* (un archivo JSON) en Configuración → *Datos*.
- **El servidor no guarda nada**: recibe los datos de nacimiento, calcula y responde. Los datos viajan en el
  cuerpo de un pedido POST (no en la URL) y el registro del servidor solo anota «POST /api/chart → 200».
  El formulario arranca vacío: tu carta de arranque está en `static/defaults-local.js`, que no se sube al
  repositorio y que la versión pública no sirve (devuelve 404).
  El mapa del inicio y el calendario lunar no mandan ningún dato personal: solo la zona horaria del navegador (y el mes).
  «Buscar por posición» en Mis cartas sí manda los datos de nacimiento de las cartas, recién al apretar «Calcular
  posiciones» y solo para calcular (como al abrir una carta).
- **Límites**: hasta 60 pedidos seguidos por persona y después 2 por segundo (el calendario de tránsitos cuesta
  20 pedidos; los destacados, 6; lo que viene, 8; el calendario lunar, 3; la Luna y los planetas de hoy, 1), 3 de esos cálculos pesados a la vez y 20 pedidos por segundo entre todos. Si se pasan, responde 429 o 503 con
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
                  cambios de signo y fases principales del mes) y dónde están el Sol y los planetas ahora (el mapa del inicio)
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
  settings.js                       Configuración (el panel del engranaje): estilo, letras, tinte, letra, tamaños, tipos de aspecto, orbes, «Entre casas» y viajes (se guarda y se aplica)
  trips.js                          viajes de los planetas por las casas (por aspecto, por eje, por implicancia): cálculo, notación y explicaciones
  print.js                          el cuadro de «Imprimir»: qué va en la hoja (la hoja misma la arma el @media print de style.css)
  summary.js                        pestaña Resumen: profecciones, tránsitos destacados y próximamente
  planet-dialog.js                  ventana de lectura que se abre al tocar un planeta
  aspect-dialog.js                  ventana que explica un aspecto (se abre al tocarlo en la lista, el Cuadro o la cuadrícula)
  reading.js                        qué muestran esas ventanas según la vista (natal, tránsitos, sinastría): subjectFor (planeta) y aspectFor (aspecto)
  interp.js                         junta los textos: signo, casa, dignidades, aspectos
  interp-signs.js, interp-houses.js, interp-aspects.js   los textos de interpretación (editables)
  glyphs.js                         símbolos de planetas y signos dibujados como vectores
  saved.js, api.js                  cartas guardadas (la lista, crear, editar, borrar) y cliente de la API
  fontpick.js                       el selector de letras con vista previa (cada opción con su letra)
  fonts/                            letras incluidas (OFL): Inter, Source Sans, Nunito, Atkinson, IBM Plex Sans, Lora, Source Serif, EB Garamond; Kalam, Patrick Hand, Mali, Shantell Sans; Plutón (⯓)
  notes.js                          notas de la carta: vínculos, leer el texto, qué cambió (sin DOM: se prueba con node)
  local-charts.js                   cartas guardadas en el navegador (versión pública), exportar e importar
                                    (en la versión local lo hace el servidor: POST /api/charts/import)
  defaults-local.js                 tu carta de arranque en la versión local (si lo borrás, el formulario arranca vacío)
  stair.js                          cuadro de aspectos en escalera
  elements.js                       balance de elementos y regente del Ascendente (moderno)
  moon.js                           la Luna del inicio, el calendario lunar: grilla del mes, íconos de fase
  sky.js                            el mapa del inicio: signos alrededor, Sol, Luna y planetas en su lugar sin encimarse (sin DOM: se prueba con node)
  poems.js                          los poemas de la Luna (por signo; se leen al tocar la Luna del inicio) y cómo se eligen y se dibujan
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
- Tránsitos: los planetas en tránsito son Sol a Plutón (el nodo está apagado); el calendario y «Próximamente» dejan afuera
  la Luna (cambia de aspecto y de signo cada pocas horas). Los destacados son solo de Júpiter a Plutón.
- Luna: de 1800 a 2400, con las efemérides Moshier (la hora del cambio de signo y de las fases es al minuto; otro
  sitio puede diferir en un minuto según cómo redondee). Signos tropicales. La fase de cada día es la del mediodía
  y el signo mostrado es el del final del día; la hora indica cuándo entra en él.
- Profecciones: signos enteros y regentes tradicionales; el nacido un 29/2 cumple el 28/2 en años comunes. No hay progresiones, retornos ni revoluciones solares todavía.
- Sinastría: aspectos y casas cruzadas; falta la carta compuesta.
- El calendario muestra como máximo 800 aspectos; con «Todos» y 24 meses se llega a ese tope (con las semicuadraturas y sesquicuadraturas se llega antes que antes).
