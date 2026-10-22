// Poemas para la tarjeta de la Luna del inicio: al azar entre los del signo en que está la Luna.
// Los textos son los que pegó Federico en «Poemas de lunas»; acá solo se ordenan por signo. «Brahma», «Entrégalo todo al amor» y «Adiós» (Emerson) van en español, en la traducción que se hizo para esta app; «El triunfo de ella» (Yeats), en la versión en español que pegó Federico. Los versos van tal cual,
// una estrofa por bloque (línea en blanco entre estrofas); los espacios al principio de un verso son sangría.
// Agregar un poema: sumar un objeto al signo que corresponda (0 Aries … 11 Piscis). Un poema sin `autor` no se muestra.
// Campos: autor, obra (título o libro), trad (traducción, opcional) y texto.

export const POEMS = [
  // Aries
  [
    {
      autor: "Alejandra Pizarnik", obra: "Árbol de Diana, 1",
      texto: `He dado el salto de mí al alba. He dejado mi cuerpo junto a la luz y he cantado la tristeza de lo que nace`,
    },
  ],
  // Tauro
  [
    {
      autor: "Fernando Pessoa (Alberto Caeiro)", obra: "El guardador de rebaños, I",
      texto: `Yo nunca guardé rebaños
Pero es como si los guardara.
Mi alma es como un pastor,
Conoce el viento y el sol
Y anda de la mano de las Estaciones
Siguiendo y mirando.
Toda la paz de la Naturaleza sin gente
Viene a sentarse a mi lado.
Pero yo quedo triste como una puesta de sol
Para nuestra imaginación,
Cuando enfría el fondo del llano
Y se siente la noche entrada
Como una mariposa por la ventana.`,
    },
    {
      autor: "Ralph Waldo Emerson", obra: "Adiós",
      texto: `¡Adiós, mundo soberbio! Me voy a casa:
tú no eres mi amigo, y yo no soy tuyo.
Largo tiempo vagué entre tus multitudes cansadas;
como un arca de río sobre la salmuera del océano,
largo tiempo me zarandearon igual que espuma arrastrada;
pero ahora, ¡mundo soberbio!, me voy a casa.

Adiós al rostro zalamero de la Adulación;
a la Grandeza y su sabia mueca;
a la mirada esquiva de la Riqueza advenediza;
al flexible Cargo, alto y bajo;
a los salones atestados, a la corte y a la calle;
a los corazones helados y los pies apresurados;
a los que van y a los que vienen;
¡adiós, mundo soberbio! Me voy a casa.

Voy a mi propio hogar,
solo, en el seno de aquellas colinas verdes,
un rincón secreto en una tierra amable,
cuyas arboledas trazaron las hadas retozonas;
donde arcos verdes, todo el santo día,
hacen eco al rondó del mirlo,
y pies vulgares nunca han pisado
un lugar que es sagrado para el pensamiento y para Dios.

Ah, cuando estoy a salvo en mi hogar de bosque,
piso el orgullo de Grecia y de Roma;
y cuando me tiendo bajo los pinos,
donde brilla tan santa la estrella de la tarde,
me río del saber y del orgullo del hombre,
de las escuelas de sofistas y del clan de los eruditos;
pues ¿qué son todos ellos, en su alto engreimiento,
cuando el hombre puede encontrarse con Dios en el monte?`,
    },
  ],
  // Géminis
  [
    {
      autor: "Fernando Pessoa", obra: "Autopsicografía",
      texto: `El poeta es un fingidor.
Finge tan completamente
Que hasta finge que es dolor
El dolor que de veras siente.

Y quienes leen lo que escribe,
Sienten, en el dolor leído,
No los dos que el poeta vive
Sino aquél que no han tenido.

Y así va por su camino,
Distrayendo a la razón,
Ese tren sin real destino
Que se llama corazón.`,
    },
  ],
  // Cáncer
  [
    {
      autor: "Victor Hugo", obra: "Mañana, al alba…",
      texto: `Mañana, al alba, cuando blanquea el campo,
Yo partiré. Mira, sé que me esperas.
Iré por el bosque, iré por la montaña.
No puedo permanecer lejos de ti más tiempo.

Caminaré, los ojos fijos en mis pensamientos,
Sin ver nada alrededor, sin escuchar ningún ruido,
Solo, desconocido, la espalda encorvada, las manos cruzadas,
Triste, y el día para mí será como la noche.

No miraré ni el oro de la tarde que cae,
Ni las velas lejanas descendiendo hacia Harfleur,
Y al llegar, pondré sobre tu tumba,
Un ramo de acebo verde y de brezo en flor.`,
    },
  ],
  // Leo
  [
    {
      autor: "William Shakespeare", obra: "Soneto 29",
      texto: `Cuando en desgracia ante la fortuna
Y los ojos de otros, solo mi exilio lloro,
Y turbo al sordo cielo con mis inútiles gritos
Y me miro a mí mismo y maldigo mi sino,

Queriéndome como uno en esperanza rico,
Como aquel, o como este, con amigos.
De un hombre deseo talento, de otro el rango,
Lo que más contenta apenas lo disfruto.

Pero, cuando con estas ideas me desgasto
Feliz pienso en ti y entonces mi alma,
Como la alondra, vuela de la morosa tierra
Y canta himnos a las puertas del cielo,

Pues tan dulce es tu amor así recordado,
Que no cambio con reyes mi estado.`,
    },
    {
      autor: "William Shakespeare", obra: "Soneto 55",
      texto: `Ni el mármol, ni de los príncipes dorados
Monumentos, sobrevivirán esta poderosa rima,
Pues tú brillarás más radiante en estas líneas
Que roca sin pulir, por el desaseado tiempo teñida.

Cuando la ruinosa guerra derribe estatuas
Y el tumulto arrase trabajadas murallas,
Ni Marte, su espada, ni el fuego de la guerra,
Arderán de tu memoria el registro vivo.

Contra la muerte y todo hostil olvido
Irás adelante y tu elogio encontrará espacio
Ante los ojos de toda posteridad, que usará
Este mundo hasta el último de los instantes.

Así, hasta que ante El Juicio te levantes,
Tú vivirás aquí, y en ojos amantes.`,
    },
    {
      autor: "William Shakespeare", obra: "Antonio y Cleopatra, acto II, escena II",
      texto: `La galera en que iba sentada, resplandeciente como un trono, parecía arder sobre el agua. La popa era de oro batido; las velas, de púrpura, y tan perfumadas, que se dijera que los vientos languidecían de amor por ellas; los remos, que eran de plata, acordaban sus golpes al son de flautas y forzaban al agua que batían a seguir más a prisa, como enamorada de ellos. En cuanto a la persona misma de Cleopatra, hacía pobre toda descripción. Reclinada en su pabellón, hecho de brocado de oro, excedía a la pintura de esa Venus, donde vemos, sin embargo, a la imaginación sobrepujar la naturaleza. En cada uno de sus costados se hallaban lindos niños con hoyuelos, semejantes a Cupidos sonrientes, con abanicos de diversos colores. El viento parecía encenderles las delicadas mejillas, al mismo tiempo que las refrescaba, haciendo así lo que deshacía.`,
    },
  ],
  // Virgo
  [
    {
      autor: "Jorge Luis Borges", obra: "Los justos",
      texto: `Un hombre que cultiva un jardín, como quería Voltaire.
El que agradece que en la tierra haya música.
El que descubre con placer una etimología.
Dos empleados que en un café del Sur juegan un silencioso ajedrez.
El ceramista que premedita un color y una forma.
Un tipógrafo que compone bien esta página, que tal vez no le agrada
Una mujer y un hombre que leen los tercetos finales de cierto canto.
El que acaricia a un animal dormido.
El que justifica o quiere justificar un mal que le han hecho.
El que agradece que en la tierra haya Stevenson.
El que prefiere que los otros tengan razón.
Esas personas, que se ignoran, están salvando el mundo.`,
    },
    {
      autor: "Jorge Luis Borges", obra: "Del rigor en la ciencia",
      texto: `En aquel Imperio, el Arte de la Cartografía logró tal Perfección que el mapa de una sola Provincia ocupaba toda una Ciudad, y el mapa del Imperio, toda una Provincia. Con el tiempo, estos Mapas Desmesurados no satisficieron y los Colegios de Cartógrafos levantaron un Mapa del Imperio, que tenía el tamaño del Imperio y coincidía puntualmente con él.

Menos Adictas al Estudio de la Cartografía, las Generaciones Siguientes entendieron que ese dilatado Mapa era Inútil y no sin Impiedad lo entregaron a las Inclemencias del Sol y los Inviernos. En los desiertos del Oeste perduran despedazadas Ruinas del Mapa, habitadas por Animales y por Mendigos; en todo el País no hay otra reliquia de las Disciplinas Geográficas.

Suárez Miranda, Viajes de Varones Prudentes, Libro Cuarto, Cap. XLV, Lérida, 1658.`,
    },
  ],
  // Libra
  [
    {
      autor: "Rafael Alberti", obra: "Al color (A la pintura)",
      texto: `A ti, sonoro, puro, quieto, blando,
incalculable al mar de la paleta,
por quien la neta luz, la sombra neta
en su trasmutación pasan soñando.

A ti, por quien la vida combinando
color y color busca ser concreta;
metamorfosis de la forma, meta
del paisaje tranquilo o caminando.

A ti, armónica lengua, cielo abierto,
descompasado dios, orden, concierto,
raudo relieve, lisa investidura.

Los posibles en ti nunca se acaban.
Las materias sin términos te alaban.
A ti, gloria y pasión de la Pintura.`,
    },
    {
      autor: "Friedrich Hölderlin", obra: "Quejas de Menón por Diotima, 3", trad: "José María Valverde",
      texto: `¡Luz del amor!, ¿también te muestras tú a los muertos, tú luz dorada?
¿imágenes de tiempo más claro lucís para mí en la noche?
¡Amorosos jardines, montañas crepusculares,
sed bienvenidos, y vosotros, silenciosos senderos del bosquecillo,
testigos de celeste ventura, y vosotras, estrellas mirando desde lo alto,
que en otros tiempos me concedisteis miradas de bendición!
¡Y vosotras también, amorosas hijas del día de mayo,
rosas tranquilas, y vosotros, lirios, aún os nombro a menudo!
Pasan las primaveras, un año empuja al otro,
alternando y luchando, así muge el tiempo al fluir
sobre las cabezas mortales; pero no ante los ojos felices,
pues a los amantes otra vida les es concedida.
Porque todos los días y los años de las estrellas estaban,
¡oh Diotima!, en torno nuestro íntima y eternamente unidos.`,
    },
    {
      autor: "Rainer Maria Rilke", obra: "Canción de amor",
      texto: `Retener mi alma para que no roce
la tuya ¿cómo hacer? ¿cómo elevarla
hacia otras cosas, más allá de ti?
¡Ah! ¡Cuánto desearía que repose
junto a un perdido objeto oscuro! ¡Allí—
en silencioso, ajeno sitio— atarla!
Que no resuene cuando tu alma sí.
Mas todo lo que rózanos, disjuntos,
nos toca, como un golpe de arco, juntos,
que con dos cuerdas crea una voz de encanto.
¿En qué instrumento nuestro son se tiene?
¿y quién, entre sus manos, nos sostiene?
Oh, dulce canto.`,
    },
    {
      autor: "Ralph Waldo Emerson", obra: "Brahma",
      texto: `Si el rojo asesino cree que mata,
o si el muerto cree que lo han matado,
no conocen bien los sutiles caminos
que sigo, y paso, y vuelvo a recorrer.

Lo lejano o lo olvidado me es cercano;
la sombra y la luz del sol son lo mismo;
los dioses desvanecidos se me aparecen;
y para mí son uno la vergüenza y la fama.

Calculan mal quienes me dejan fuera;
cuando huyen de mí, yo soy las alas;
yo soy el que duda y la duda,
yo soy el himno que canta el brahmán.

Los dioses fuertes anhelan mi morada,
y en vano la anhelan los Siete sagrados;
pero tú, ¡manso amante del bien!,
hállame, y dale la espalda al cielo.`,
    },
  ],
  // Escorpio
  [
    {
      autor: "Arthur Rimbaud", obra: "El durmiente del valle",
      texto: `Es un surco de verdura donde canta un río
Prendiendo entre risas jirones de plata por las yerbas;
donde el sol alumbra desde la altiva montaña:
es una vaguada que hierve de fulgor.

Un soldado joven, cabeza desnuda, boca abierta
Y la nuca encharcada entre el fresco berro azul,
Duerme; está tendido sobre la yerba, bajo el cielo,
Pálido en su lecho verde donde llueve la luz.

Duerme con los pies entre gladiolos. Sonriendo
Como haría un niño enfermo, sueña:
¡Mécelo con amor Naturaleza, que tiene frío!

Los aromas ya no estremecen sus sentidos,
Duerme tranquilo al sol, con una mano sobre el pecho.
Dos hoyos rojos se abren en su costado.`,
    },
    {
      autor: "Alejandra Pizarnik", obra: "El infierno musical",
      texto: `Golpean con soles

Nada se acopla con nada aquí

Y de tanto animal muerto en el cementerio de huesos filosos de mi memoria

Y de tantas monjas como cuervos que se precipitan a hurgar entre mis piernas

La cantidad de fragmentos me desgarra

Impuro diálogo

Un proyectarse desesperado de la materia verbal

Liberada a sí misma

Naufragando en sí misma`,
    },
    {
      autor: "Rafael Alberti", obra: "Los ángeles muertos",
      texto: `Buscad, buscadlos:
en el insomnio de las cañerías olvidadas,
en los cauces interrumpidos por el silencio de las basuras.
No lejos de los charcos incapaces de guardar una nube,
unos ojos perdidos,
una sortija rota
o una estrella pisoteada.
Porque yo los he visto:
en esos escombros momentáneos que aparecen en las neblinas.
Porque yo los he tocado:
en el destierro de un ladrillo difunto,
venido a la nada desde una torre o un carro.
Nunca más allá de las chimeneas que se derrumban,
ni de esas hojas tenaces que se estampan en los zapatos.
En todo esto.
Más en esas astillas vagabundas que se consumen sin fuego,
en esas ausencias hundidas que sufren los muebles desvencijados,
no a mucha distancia de los nombres y signos que se enfrían en las paredes.
Buscad, buscadlos:
debajo de la gota de cera que sepulta la palabra de un libro
o la firma de uno de esos rincones de cartas
que trae rodando el polvo.
Cerca del casco perdido de una botella,
de una suela extraviada en la nieve,
de una navaja de afeitar abandonada al borde de un precipicio.`,
    },
    {
      autor: "William Butler Yeats", obra: "El triunfo de ella",
      texto: `Hice lo que el dragón quiso hasta que apareciste.
Porque creía que el amor era una fortuita
improvisación, o un juego establecido
que dura mientras dura la caída de un pañuelo.
Lo mejor de todo eran las alas que tenía un minuto
y si luego había ingenio es que hablaban los ángeles;
entonces surgiste entre los anillos del dragón.
Me burlé, ofuscada, pero tú lo venciste,
rompiste la cadena y liberaste mis tobillos
como un Perseo pagano o un San Jorge;
y ahora vemos atónitos el mar
y un ave milagrosa grazna mientras nos mira.`,
    },
  ],
  // Sagitario
  [
    {
      autor: "Antonio Machado", obra: "Caminante, no hay camino",
      texto: `Caminante, son tus huellas
el camino y nada más;
Caminante, no hay camino,
se hace camino al andar.
Al andar se hace el camino,
y al volver la vista atrás
se ve la senda que nunca
se ha de volver a pisar.
Caminante no hay camino
sino estelas en la mar.`,
    },
    {
      autor: "Jorge Luis Borges", obra: "A Luis de Camoens",
      texto: `Sin lástima y sin ira el tiempo mella
las heroicas espadas. Pobre y triste
a tu patria nostálgica volviste,
oh capitán, para morir en ella
y con ella. En el mágico desierto
la flor de Portugal se había perdido
y el áspero español, antes vencido,
amenazaba su costado abierto.
Quiero saber si aquende la ribera
última comprendiste humildemente
que todo lo perdido, el Occidente
y el Oriente, el acero y la bandera,
perduraría (ajeno a toda humana
mutación) en tu Eneida lusitana.`,
    },
  ],
  // Capricornio
  [
    {
      autor: "Jorge Luis Borges", obra: "El reloj de arena",
      texto: `Está bien que se mida con la dura
Sombra que una columna en el estío
Arroja o con el agua de aquel río
En que Heráclito vio nuestra locura

El tiempo, ya que al tiempo y al destino
Se parecen los dos: la imponderable
Sombra diurna y el curso irrevocable
Del agua que prosigue su camino.

Está bien, pero el tiempo en los desiertos
Otra substancia halló, suave y pesada,
Que parece haber sido imaginada
Para medir el tiempo de los muertos.

Surge así el alegórico instrumento
De los grabados de los diccionarios,
La pieza que los grises anticuarios
Relegarán al mundo ceniciento

Del alfil desparejo, de la espada
Inerme, del borroso telescopio,
Del sándalo mordido por el opio
Del polvo, del azar y de la nada.

¿Quién no se ha demorado ante el severo
Y tétrico instrumento que acompaña
En la diestra del dios a la guadaña
Y cuyas líneas repitió Durero?

Por el ápice abierto el cono inverso
Deja caer la cautelosa arena,
Oro gradual que se desprende y llena
El cóncavo cristal de su universo.

Hay un agrado en observar la arcana
Arena que resbala y que declina
Y, a punto de caer, se arremolina
Con una prisa que es del todo humana.

La arena de los ciclos es la misma
E infinita es la historia de la arena;
Así, bajo tus dichas o tu pena,
La invulnerable eternidad se abisma.

No se detiene nunca la caída
Yo me desangro, no el cristal. El rito
De decantar la arena es infinito
Y con la arena se nos va la vida.

En los minutos de la arena creo
Sentir el tiempo cósmico: la historia
Que encierra en sus espejos la memoria
O que ha disuelto el mágico Leteo.

El pilar de humo y el pilar de fuego,
Cartago y Roma y su apretada guerra,
Simón Mago, los siete pies de tierra
Que el rey sajón ofrece al rey noruego,

Todo lo arrastra y pierde este incansable
Hilo sutil de arena numerosa.
No he de salvarme yo, fortuita cosa
De tiempo, que es materia deleznable.`,
    },
    {
      autor: "Friedrich Hölderlin", obra: "Mitad de la vida",
      texto: `Con peras amarillas
y llena de rosas silvestres
la tierra pende sobre el lago.
Vosotros, hermosos cisnes,
sumergís ebrios de besos la cabeza
en la sagrada sobriedad del agua.

¡Ay de mí! ¿Dónde recogeré flores
en invierno? ¿Dónde
el espejo del sol
y las sombras de la tierra?
Los muros se alzan
mudos y fríos. En el viento
chirrían las veletas.`,
    },
  ],
  // Acuario
  [
    {
      autor: null, obra: "Un hombre de traje camina…",
      texto: `Un hombre de traje camina al fondo de la calle;
está cansado,
mas no ha llegado al deber ser.
Su reloj marca las 5:30 p. m.,
ya es tarde para el café,
para la vida,
de hecho.

El maletín le pesa,
sus pasos,
mas aún falta para arribar a casa;
hace una pausa,
repasa lo ocurrido hasta ese entonces
y recuerda el ciclo habitual
y la rigurosa realidad le hace entender que el punto en el que se encuentra es,
en sí,
el mismo que el de la mesa,
el del baño,
de la cama,
la oficina,
el del monitor,
nada nuevo ha pasado en la última década,
hace años que repite minucioso cada acto,
sin pecado,
impoluto,
perfecto.

A dos cuadras de su hogar,
se decide a cruzar,
como siempre,
la avenida.
El semáforo en rojo le invita a que pase;
sin embargo,
y en contra de la costumbre,
de la regla,
un conductor ignora la luz y le atropella.

Todo vuela por los aires:
facturas por pagar,
cheques,
tarjetas,
deudas,
papeles y más papeles,
y él y su cuerpo irremediable.

La gente se espanta y se acerca a la lúgubre escena;
cada rostro allí es de espanto,
salvo uno:
el del hombre de traje;
una sonrisa de cuando niño rompe su cara de adulto realizado
y no se le va ni luego de la autopsia.

Al día siguiente un periódico reseña:
“Muere en fatídico accidente
un hombre sonriente
en la calle Libertad”.`,
    },
    {
      autor: "Arthur Rimbaud", obra: "Después del Diluvio",
      texto: `En cuanto la idea del Diluvio húbose serenado, Una liebre se detuvo entre las esparcetas y las campanillas móviles y levantó su oración al arcoíris a través de la telaraña. ¡Oh!, las piedras preciosas que se escondían, – las flores que ya miraban. En la ancha calle sucia se levantaron los tenderetes y arrastraron las barcas hacia el mar escalonado arriba como en los grabados. La sangre corrió, en la casa de Barba Azul, – en los mataderos-, en los circos, donde el sello de Dios emblanqueció las ventanas. La sangre y la leche corrieron. Los castores construyeron. Los “mazagranes” humearon en los cafés. En la mansión de cristales aun mojados los niños de luto contemplaron las maravillosas imágenes. Una puerta sonó, y en la plaza de la aldea, un niño giró sus brazos siendo comprendido por las veletas y los gallos de los campanarios de todas partes, bajo el brillante aguacero. Madame *** colocó un piano en los Alpes. La misa y las primeras comuniones se celebraron en los cien mil altares de la catedral. Las caravanas se retiraron. Y el Splendide-Hotel fue edificado en el caos de los hielos y la noche polar. Desde entonces, la Luna escuchó el quejido de los chacales por los desiertos de tomillo, – y las églogas en zuecos gruñir en el huerto. Luego, en el oquedal violeta, pleno de brotes, Eucaris me dijo que era primavera. Mana, estanque; – Espuma, rueda sobre el puente y entre los bosques; – sábanas negras y órganos, – relámpagos y truenos, – suban y rueden; – Agua y tristezas, suban y reanimen los Diluvios. Porque desde que se disiparon, ¡oh, las piedras preciosas enterrándose y las flores abiertas! – ¡qué aburrimiento!, y la Reina, la Bruja que enciende su brasa en la olla de barro, nunca querrá contarnos lo que ella sabe, aquello que ignoramos.`,
    },
  ],
  // Piscis
  [
    {
      autor: "Jorge Luis Borges", obra: "La luna",
      texto: `Hay tanta soledad en ese oro. La luna de las noches no es la luna que vio el primer Adán. Los largos siglos de la vigilia humana la han colmado de antiguo llanto. Mírala. Es tu espejo.`,
    },
    {
      autor: "Victor Hugo", obra: "Oceano nox",
      texto: `¿Dónde están los náufragos de las noches oscuras? ¿Conocen ustedes, olas, sus siniestras aventuras, olas a las que en vano suplican las madres de rodillas? ¡Ustedes las cuentan cuando sube la marea, y eso es lo que les da esa voz amarga y doliente con la que lloran de noche, golpeando las orillas!`,
    },
    {
      autor: "Ralph Waldo Emerson", obra: "Entrégalo todo al amor",
      texto: `Entrégalo todo al amor;
obedece a tu corazón;
amigos, parientes, días,
bienes, buena fama,
planes, crédito y la Musa:
nada rehúses.

Es un bravo amo;
dale espacio:
síguelo por completo,
espera más allá de toda esperanza:
cada vez más alto
se zambulle en el mediodía,
con el ala sin agotar,
propósito no dicho;
pero es un dios,
conoce su propio camino
y las salidas del cielo.

Nunca fue para los mezquinos;
exige un coraje recio.
A las almas por encima de la duda,
al valor inflexible,
las recompensará:
volverán
más de lo que eran,
y siempre ascendiendo.

Déjalo todo por el amor;
pero escúchame, aún,
una palabra más necesita tu corazón,
un latido más de firme empeño:
mantente hoy,
mañana, para siempre,
libre como un árabe
de tu amada.

Aférrate con la vida a la doncella;
pero cuando la sorpresa,
la primera sombra vaga de una sospecha
cruce su joven pecho
de una alegría aparte de ti,
libre sea ella, libre de ataduras;
ni retengas tú el borde de su vestido,
ni la rosa más pálida que arrojó
de su diadema de verano.

Aunque la hayas amado como a ti mismo,
como a un yo de arcilla más pura,
aunque su partida oscurezca el día
robando la gracia a todo lo vivo;
sabe de corazón:
cuando los semidioses se van,
los dioses llegan.`,
    },
    {
      autor: "Juan L. Ortiz", obra: null,
      texto: `Canta la calandria... canta...
Toda criatura canta, no es cierto? canta para "ser" aún en el misterio
  en el extrañamiento de sí...

Canta la calandria, y de repente parece que halló
      la deidad del "silencio"...

Excedió el pajarillo, pues, el hálito
         de las ocho,
 al no encontrar la respuesta
            cerca,
y perdérsele en el gris las otras frases del minuto?

  Por qué calló entonces?
  Alguien sufre...

Nada asegura que la melodía
pasó a "ser", allá, allá, donde las perlas se disolverían y de donde, a la vez,
se desprenderían las perlas...

      Pero vuelve...
   y con qué dulzura vuelve... es la melancolía
      que vuelve?

      Oh amor de diciembre,
           amor:
dale el eco de una rama de ahí, o, si lo prefieres, del confín,
       para que no "sea" en ese "allá"
antes de "ser" su "resonancia", en el intervalo de "aquí",
       aunque el aire deba sufrir, asimismo, porque nadie, nadie,
           pueda herirlo así...
           y quede en una suerte de molicie
           que se ilumina
hasta arder en las cigarras y medir, intermitentemente, con ellas,
         los espacios, ya, de un arcángel...`,
    },
  ],
];

// ---------- elegir y dibujar -------------------------------------------------------------------------------

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** Los poemas de un signo que ya tienen autor (0 Aries … 11 Piscis). */
export const poemsFor = (sign) => (POEMS[sign] || []).filter((p) => p.autor && p.texto);

/** Uno al azar entre los del signo. `avoid`: el que se mostró antes (se evita repetirlo si hay otro). */
export function pickPoem(sign, avoid = null, rnd = Math.random) {
  const all = poemsFor(sign);
  const pool = all.length > 1 && avoid ? all.filter((p) => p !== avoid) : all;
  if (!pool.length) return null;
  return pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))];
}

const stanzas = (p) => p.texto.split(/\n{2,}/).map((s) => s.split("\n"));
const PROSE = 150;                                   // un verso más largo que esto es prosa: sin sangría francesa

/** ¿Es largo para mostrarlo entero? Cuenta renglones (los versos largos ocupan más de uno) y los espacios entre estrofas. */
export function isLong(p) {
  const st = stanzas(p);
  const rows = st.reduce((n, s) => n + s.reduce((m, v) => m + Math.max(1, Math.ceil(v.trim().length / 70)), 0), 0);
  return rows + (st.length - 1) * 0.6 > 15;
}

/** Los versos como HTML: una estrofa por <p>, un <span> por verso; los espacios del principio pasan a clases de sangría. */
export function verseHTML(p) {
  return stanzas(p).map((s) => `<p class="mp-st">${s.map((v) => {
    const ind = Math.min(12, v.length - v.trimStart().length);
    const t = v.trim();
    return `<span class="v${ind ? ` in${ind}` : ""}${t.length > PROSE ? " pr" : ""}">${esc(t)}</span>`;
  }).join("")}</p>`).join("");
}

/** El contenido del bloque del poema: versos, autor y obra, y el botón de «Leer completo» si es largo. */
export function poemHTML(p) {
  return `<figure class="mp-fig"><blockquote class="mp-text" id="moonPoemText" lang="es">${verseHTML(p)}</blockquote>` +
    `<figcaption class="mp-by"><strong class="mp-au">${esc(p.autor)}</strong>` +
    (p.obra ? `<cite class="mp-ob">${esc(p.obra)}</cite>` : "") +
    (p.trad ? `<span class="mp-tr">trad. ${esc(p.trad)}</span>` : "") + `</figcaption></figure>` +
    (isLong(p) ? `<button type="button" class="mp-more" aria-expanded="false" aria-controls="moonPoemText">Leer completo</button>` : "");
}
