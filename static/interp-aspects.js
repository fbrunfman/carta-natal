// Lecturas de aspectos: de qué trata cada par de cuerpos (PAIR), qué significa tener el mismo cuerpo
// en las dos cartas (SAME), cómo se comporta cada tipo de aspecto (FRAME) y qué agrega la retrogradación.
// Sin DOM. Los pares van con el cuerpo que aparece primero en ORDER como clave exterior.

export const ORDER = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "node", "asc", "mc"];

export const PAIR = {
  sun: {
    moon: "Identidad consciente y mundo emocional: cómo conviven lo que se quiere ser con lo que se necesita sentir.",
    mercury: "Identidad y pensamiento: la mente se pone al servicio del yo y las ideas se viven como parte de la identidad.",
    venus: "Identidad y afecto: el valor personal, el encanto y la forma de relacionarse se entrelazan con la vitalidad.",
    mars: "Identidad y acción: voluntad, impulso y capacidad de afirmarse; cómo se canaliza la energía y la competitividad.",
    jupiter: "Identidad y expansión: confianza, optimismo y sentido de propósito; también la tendencia a exagerar.",
    saturn: "Identidad y límites: autoexigencia, sentido del deber y relación con la autoridad (a menudo la figura paterna); madurez que se gana con esfuerzo.",
    uranus: "Identidad y libertad: necesidad de originalidad, independencia y cambio; tensión entre la autenticidad y la ruptura de lo establecido.",
    neptune: "Identidad e ideal: sensibilidad, inspiración y a la vez difuminación del yo; cuesta definir los propios límites.",
    pluto: "Identidad y poder: intensidad, voluntad de transformación y lucha por el control; crisis que reconfiguran quién se es.",
    node: "Identidad y rumbo vital: cómo se alinea la expresión del yo con la dirección de crecimiento del nodo.",
    asc: "Identidad y presencia: lo que se es y cómo se muestra tienden a coincidir, con fuerte coherencia entre el yo y la imagen.",
    mc: "Identidad y vocación: el yo se orienta hacia la vida pública y las metas; sentido de propósito profesional.",
  },
  moon: {
    mercury: "Emoción y pensamiento: cómo conviven lo que se siente con lo que se piensa y se dice; comunicación afectiva.",
    venus: "Emoción y afecto: sensibilidad en los vínculos, gusto por la ternura y la armonía; necesidades afectivas y manera de expresarlas.",
    mars: "Emoción y acción: reacciones rápidas, pasión y manera de enojarse; cómo se defienden las necesidades emocionales.",
    jupiter: "Emoción y expansión: generosidad, optimismo y fe emocional; riesgo de exagerar los sentimientos.",
    saturn: "Emoción y límites: contención, cautela y sentido del deber en lo afectivo; necesidad de seguridad y miedo a la carencia.",
    uranus: "Emoción y libertad: ánimo cambiante, necesidad de espacio y reacciones súbitas; dificultad con la rutina emocional.",
    neptune: "Emoción e imaginación: empatía, sensibilidad psíquica y porosidad al ambiente; riesgo de confusión o idealización.",
    pluto: "Emoción y transformación: vivencias intensas, vínculos profundos y crisis que renuevan; tendencia al control o a los celos.",
    node: "Emoción y rumbo: cómo las necesidades emocionales acompañan, o frenan, la dirección de crecimiento.",
    asc: "Emoción y presencia: el estado de ánimo se nota enseguida; la sensibilidad es visible en la manera de mostrarse.",
    mc: "Emoción y vocación: necesidades afectivas en la vida pública; trabajo ligado al cuidado, o ánimo que fluctúa con el reconocimiento.",
  },
  mercury: {
    venus: "Pensamiento y afecto: palabras amables, gusto estético y diplomacia; ideas teñidas de valores y de gustos.",
    mars: "Pensamiento y acción: mente rápida y combativa, debate y decisión; palabras que pueden herir.",
    jupiter: "Pensamiento y expansión: visión amplia, optimismo y entusiasmo al hablar; riesgo de exagerar o de prometer en exceso.",
    saturn: "Pensamiento y estructura: seriedad, rigor y prudencia al hablar; mente metódica, con tendencia a la duda o al pesimismo.",
    uranus: "Pensamiento e innovación: ideas originales, rápidas y súbitas; mente inquieta y poco convencional.",
    neptune: "Pensamiento e intuición: imaginación, inspiración y ambigüedad; dificultad para ser concreto o riesgo de confusión.",
    pluto: "Pensamiento y profundidad: mente penetrante, persuasiva y obsesiva; interés por lo oculto y por el poder de la palabra.",
    node: "Pensamiento y rumbo: la comunicación y el aprendizaje se vuelven una vía de crecimiento.",
    asc: "Pensamiento y presencia: la mente se nota en la manera de presentarse, con locuacidad y curiosidad visibles.",
    mc: "Pensamiento y vocación: la palabra, las ideas o la enseñanza orientan la vida pública.",
  },
  venus: {
    mars: "Afecto y deseo: atracción, pasión y manera de buscar y de responder; equilibrio entre ternura e impulso.",
    jupiter: "Afecto y abundancia: generosidad, gusto por el placer y la vida social; riesgo de excesos y de dar todo por sentado.",
    saturn: "Afecto y límites: fidelidad, seriedad y reserva en el amor; miedo al rechazo o sensación de merecer poco.",
    uranus: "Afecto y libertad: atracción súbita, vínculos poco convencionales y necesidad de independencia; cambios en el amor.",
    neptune: "Afecto e ideal: romanticismo, sensibilidad artística y empatía; idealización de las parejas y límites difusos.",
    pluto: "Afecto y transformación: pasión intensa, vínculos de todo o nada y obsesiones; amores que transforman.",
    node: "Afecto y rumbo: los vínculos y los valores marcan la dirección de crecimiento; encuentros significativos.",
    asc: "Afecto y presencia: encanto natural, amabilidad visible y atractivo personal.",
    mc: "Afecto y vocación: el gusto estético, la diplomacia y la habilidad social orientan la vida pública y el trabajo.",
  },
  mars: {
    jupiter: "Acción y expansión: entusiasmo, coraje y optimismo; energía amplia que puede desbordarse o actuar sin medida.",
    saturn: "Acción y freno: disciplina, resistencia y constancia, con tensión entre el impulso y la contención; la rabia puede reprimirse.",
    uranus: "Acción y ruptura: energía súbita, rebelde e impaciente; actos impulsivos y gran capacidad de arranque.",
    neptune: "Acción e inspiración: energía difusa o idealista, que actúa por compasión o por evasión; dificultad para concretar.",
    pluto: "Acción y poder: fuerza intensa, determinación y deseo de control; potencia transformadora, con riesgo de confrontación.",
    node: "Acción y rumbo: la iniciativa se vuelca hacia el desarrollo personal y la dirección de crecimiento.",
    asc: "Acción y presencia: energía y empuje visibles; impresión de determinación y a veces de brusquedad.",
    mc: "Acción y vocación: ambición, iniciativa y liderazgo en la vida pública.",
  },
  jupiter: {
    saturn: "Expansión y límite: ciclo entre confianza y prudencia; el crecimiento necesita estructura, y la estructura, apertura.",
    uranus: "Expansión y cambio: ideas liberadoras, oportunidades súbitas y optimismo innovador; riesgo de excesos de libertad.",
    neptune: "Expansión e ideal: fe, compasión y visión espiritual; riesgo de ingenuidad, de idealización o de grandes promesas sin base.",
    pluto: "Expansión y poder: gran ambición, deseo de crecimiento y de influencia; proyectos de gran escala.",
    node: "Expansión y rumbo: oportunidades de crecimiento acordes a la dirección vital.",
    asc: "Expansión y presencia: optimismo, generosidad y una imagen amplia y confiada.",
    mc: "Expansión y vocación: oportunidades profesionales, buena reputación y proyección pública.",
  },
  saturn: {
    uranus: "Estructura y cambio: tensión entre conservar y renovar, entre la norma y la ruptura; aprendizajes sobre la libertad con responsabilidad.",
    neptune: "Estructura e ideal: la tarea de darle forma concreta a los sueños; riesgo de desilusión, de culpa o de miedos difusos.",
    pluto: "Estructura y poder: presión, perseverancia y resistencia; relación con el control, la crisis y la reconstrucción.",
    node: "Estructura y rumbo: el esfuerzo, la disciplina y la responsabilidad forman parte del camino de crecimiento.",
    asc: "Estructura y presencia: seriedad, cautela y reserva visibles; madurez precoz y cierta inhibición inicial.",
    mc: "Estructura y vocación: ambición disciplinada, responsabilidad y autoridad en la vida pública; ascenso lento pero sólido.",
  },
  uranus: {
    neptune: "Cambio e ideal: inspiración colectiva, ruptura de ilusiones y nuevas visiones espirituales o tecnológicas; aspecto generacional.",
    pluto: "Cambio y poder: transformaciones sociales radicales y rupturas profundas; aspecto generacional.",
    node: "Cambio y rumbo: el crecimiento pasa por la originalidad y por romper con lo previsible.",
    asc: "Cambio y presencia: imagen original e impredecible; la necesidad de libertad se nota enseguida.",
    mc: "Cambio y vocación: carrera poco convencional, con giros inesperados y vocación innovadora.",
  },
  neptune: {
    pluto: "Ideal y poder: transformación colectiva profunda de las creencias y del inconsciente; aspecto generacional.",
    node: "Ideal y rumbo: el crecimiento pasa por la sensibilidad, la compasión y la intuición.",
    asc: "Ideal y presencia: imagen suave, soñadora y receptiva; límites personales difusos.",
    mc: "Ideal y vocación: llamado artístico, espiritual o de servicio; riesgo de falta de rumbo claro.",
  },
  pluto: {
    node: "Poder y rumbo: la transformación profunda forma parte del camino de crecimiento.",
    asc: "Poder y presencia: imagen intensa y magnética; la identidad pasa por transformaciones profundas.",
    mc: "Poder y vocación: ambición intensa, relación con el poder y reinvenciones profesionales.",
  },
  node: {
    asc: "Rumbo y presencia: la forma de mostrarse acompaña la dirección de crecimiento, o se resiste a ella.",
    mc: "Rumbo y vocación: la dirección vital se juega en la vida pública y en las metas.",
  },
};

/** El mismo cuerpo en las dos cartas (tránsitos sobre el mismo planeta natal, sinastría Sol–Sol, etc.). */
export const SAME = {
  sun: "Sol con Sol: dos identidades del mismo tono; reconocimiento mutuo del propósito y de los modos de afirmarse.",
  moon: "Luna con Luna: afinidad emocional; las necesidades afectivas y los hábitos de cuidado se reconocen o se reflejan.",
  mercury: "Mercurio con Mercurio: estilos de pensamiento y de conversación en sintonía, o en tensión.",
  venus: "Venus con Venus: gustos, valores afectivos y formas de amar que se reconocen o se contraponen.",
  mars: "Marte con Marte: energía, deseo y estilo de pelear que se reflejan; competencia o impulso compartido.",
  jupiter: "Júpiter con Júpiter: creencias, optimismo y sentido de la abundancia en común; ciclo de expansión.",
  saturn: "Saturno con Saturno: ritmos de responsabilidad, límites y miedos que se reflejan; ciclos de maduración.",
  uranus: "Urano con Urano: afinidad generacional en la búsqueda de libertad y de originalidad.",
  neptune: "Neptuno con Neptuno: ideales, sensibilidad y sueños de una misma generación.",
  pluto: "Plutón con Plutón: afinidad generacional en las experiencias de poder y de transformación profunda.",
  node: "Nodo con Nodo: direcciones de crecimiento que coinciden o se cruzan.",
};

export const FRAME = {
  conjunction: "Conjunción: las dos funciones se funden en una sola. Se refuerzan y se tiñen mutuamente, y cuesta separarlas; el resultado depende de cómo se lleven.",
  opposition: "Oposición: las dos funciones están frente a frente. Tienden a vivirse como polos que se alternan o que se proyectan en otras personas; el desafío es integrarlos, no elegir uno.",
  trine: "Trígono: fluyen con naturalidad y se apoyan sin esfuerzo. Es un talento disponible, aunque la facilidad puede llevar a darlo por sentado.",
  square: "Cuadratura: hay fricción entre ambas, con impulsos que no coinciden. Esa tensión empuja a actuar y suele ser una fuente de logro, a costa de esfuerzo.",
  sextile: "Sextil: hay una colaboración posible entre las dos funciones. Es una oportunidad que rinde cuando se la activa con iniciativa.",
  quincunx: "Quincuncio: las dos funciones no comparten elemento ni modalidad y no se entienden de inmediato. Piden ajustes constantes y una adaptación que nunca es del todo cómoda.",
};

/** Qué agrega que el planeta esté retrógrado (Sol, Luna y nodo no lo están). */
export const RETRO = {
  mercury: "Retrógrado: el pensamiento tiende a volverse hacia adentro; revisión, relectura y una comunicación más reflexiva o rezagada.",
  venus: "Retrógrada: los valores y los afectos se revisan hacia adentro; relación más reservada o intensa con el amor y con lo que se valora.",
  mars: "Retrógrado: la energía se canaliza de manera indirecta o contenida; la acción necesita más tiempo y la ira puede acumularse.",
  jupiter: "Retrógrado: la expansión y la fe son más internas; el sentido se busca por cuenta propia más que en doctrinas externas.",
  saturn: "Retrógrado: la autoridad y las exigencias son más internas; autoexigencia silenciosa y una relación con el deber para revisar.",
  uranus: "Retrógrado: la necesidad de cambio es más interna que externa; rebeldía que se piensa más de lo que se actúa. Es un estado frecuente en los planetas lentos: aporta solo un matiz.",
  neptune: "Retrógrado: sensibilidad espiritual y fantasía vueltas hacia adentro. Es un estado frecuente en los planetas lentos: aporta solo un matiz.",
  pluto: "Retrógrado: la transformación es más interna y menos visible; trabajo psicológico profundo. Es un estado frecuente en los planetas lentos: aporta solo un matiz.",
};
