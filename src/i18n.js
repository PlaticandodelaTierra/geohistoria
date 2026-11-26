// Textos en español e inglés: interfaz, nombres de los principios y explicaciones de las evidencias.
//
// - El idioma de la interfaz es español por defecto; la elección del visitante se recuerda en
//   localStorage (envuelto en try/catch: sin almacenamiento, vale solo para esta visita).
// - `TEXTOS` da los textos del idioma activo: `TEXTOS.revisar`, `TEXTOS.profesor.titulo`… Se debe leer al
//   dibujar (no al cargar un módulo), para que un cambio de idioma se note al volver a dibujar la página.
// - Las explicaciones de las evidencias se generan en ambos idiomas a la vez (`explicar`).
// Los textos que van al PDF solo usan caracteres de la fuente Helvetica (sin flechas).

export const IDIOMAS = Object.freeze(['es', 'en']);

const CLAVE_ALMACEN = 'geohistoria.idioma';

let idiomaActual = 'es';

/** Idioma activo de la interfaz. */
export function idioma() {
  return idiomaActual;
}

/** Cambia el idioma activo (no lo guarda: ver guardarIdioma). */
export function cambiarIdioma(nuevo) {
  if (IDIOMAS.includes(nuevo)) idiomaActual = nuevo;
  return idiomaActual;
}

/** Idioma guardado en este navegador, o español. */
export function idiomaGuardado() {
  try {
    const guardado = window.localStorage.getItem(CLAVE_ALMACEN);
    return IDIOMAS.includes(guardado) ? guardado : 'es';
  } catch {
    return 'es';
  }
}

/** Recuerda el idioma en este navegador (si el navegador lo permite). */
export function guardarIdioma(nuevo) {
  try {
    window.localStorage.setItem(CLAVE_ALMACEN, nuevo);
  } catch {
    // Sin almacenamiento (ventana privada, bloqueado): el idioma vale solo para esta visita.
  }
}

// ───────────────────────── Diccionario de la interfaz ─────────────────────────

const LITOLOGIAS = {
  es: { arenisca: 'Arenisca', caliza: 'Caliza', lutita: 'Lutita', conglomerado: 'Conglomerado', basalto: 'Basalto', granito: 'Granito' },
  en: { arenisca: 'Sandstone', caliza: 'Limestone', lutita: 'Shale', conglomerado: 'Conglomerate', basalto: 'Basalt', granito: 'Granite' },
};

const DICCIONARIO = {
  es: {
    tituloPagina: 'GeoHistoria — Rompecabezas de edad relativa',
    titulo: 'GeoHistoria',
    subtitulo: 'Rompecabezas de edad relativa',
    saltar: 'Saltar al contenido',
    idiomaSelector: 'Idioma',
    nombresIdiomas: { es: 'Español', en: 'English' },
    navegacion: 'Modos',
    modos: { practica: 'Práctica', reto: 'Reto del día', profesor: 'Profesor', principios: 'Principios' },
    litologias: LITOLOGIAS.es,
    tarjetas: {
      capa: (litologia) => `Capa de ${litologia.toLowerCase()}`,
      dique: (litologia) => `Dique de ${litologia.toLowerCase()}`,
      falla: 'Falla',
      erosion: 'Erosión / discordancia',
      basculamiento: 'Basculamiento',
    },
    elegirNivel: 'Elige un nivel',
    niveles: {
      1: { nombre: 'Nivel 1', descripcion: 'Capas y un dique: superposición y relaciones de corte.' },
      2: { nombre: 'Nivel 2', descripcion: 'Fallas y diques que se cruzan: relaciones de corte entre estructuras.' },
      3: {
        nombre: 'Nivel 3',
        descripcion: 'Capas basculadas, erosión y capas nuevas: horizontalidad original y discordancia angular.',
      },
    },
    ejercicio: 'Ejercicio',
    nivel: 'Nivel',
    semilla: (semilla) => `Semilla ${semilla}`,
    copiarEnlace: 'Copiar enlace',
    enlaceCopiado: 'Enlace copiado.',
    enlaceNoCopiado: (enlace) => `No se pudo copiar. Este es el enlace: ${enlace}`,
    otroEjercicio: 'Otro ejercicio',
    descargarSVG: 'Descargar SVG',
    descargarPNG: 'Descargar PNG',
    instrucciones:
      'Ordena los eventos: lo más joven arriba y lo más antiguo abajo. ' +
      'Arrastra las tarjetas o usa los botones ↑ ↓ (con el teclado: Alt + ↑ / ↓).',
    masJoven: 'Más joven ↑',
    masAntiguo: 'Más antiguo ↓',
    listaTarjetas: 'Eventos, del más joven (arriba) al más antiguo (abajo)',
    subir: (id) => `Subir ${id} (más joven)`,
    bajar: (id) => `Bajar ${id} (más antiguo)`,
    posicion: (nombre, posicion, total) => `${nombre}, posición ${posicion} de ${total} desde arriba`,
    movida: (nombre, posicion, total) => `${nombre}: ahora en la posición ${posicion} de ${total} desde arriba.`,
    revisar: 'Revisar',
    correcto: '¡Correcto!',
    correctoDetalle: 'Este es el único orden compatible con lo que se ve. Estas son las evidencias:',
    enSuLugar: (n, total) => `${n} de ${total} en su lugar.`,
    contradichas: 'Tu orden contradice estas evidencias:',
    sigueIntentando: 'Mueve las tarjetas y vuelve a revisar.',
    verSolucion: 'Ver la solución',
    solucion: 'Solución, del más joven al más antiguo:',
    todasLasEvidencias: 'Todas las evidencias que se ven:',
    bien: 'en su lugar',
    mal: 'fuera de lugar',
    descripcionSeccion: (partes) => `Sección geológica con ${partes}.`,
    marcadoConFlecha: 'marcado con una flecha de giro',
    leyenda: 'Leyenda',
    simbolos: {
      falla: 'Falla (las medias flechas muestran el movimiento)',
      erosion: 'Discordancia (superficie de erosión)',
      basculamiento: 'Basculamiento (flecha de giro)',
    },

    profesor: {
      titulo: 'Hojas de ejercicios',
      explicacion:
        'Elige el nivel y la cantidad de ejercicios. Las semillas son consecutivas a partir de la primera: ' +
        'con el mismo enlace, todo el grupo tiene exactamente los mismos ejercicios.',
      cantidad: 'Ejercicios',
      primeraSemilla: 'Primera semilla',
      semillaAlAzar: 'al azar si la dejas vacía',
      papel: 'Papel',
      papeles: { carta: 'Carta', a4: 'A4' },
      generar: 'Preparar hoja',
      resumen: (cantidad, nivel, primera, ultima) =>
        `${cantidad} ${cantidad === 1 ? 'ejercicio' : 'ejercicios'} de nivel ${nivel}, ` +
        (primera === ultima ? `semilla ${primera}` : `semillas ${primera} a ${ultima}`),
      pdfEjercicios: 'Hoja de ejercicios (PDF)',
      pdfRespuestas: 'Hoja de respuestas (PDF)',
      copiarEnlace: 'Copiar enlace de esta hoja',
      generando: (n, total) => `Generando PDF… ${n} de ${total}`,
      listo: (nombre) => `Listo: ${nombre}`,
      error: 'No se pudo generar el PDF.',
      ejercicio: (numero, semilla) => `Ejercicio ${numero} · semilla ${semilla}`,
      respuesta: 'Respuesta',
      ordenCorrecto: 'Del más antiguo al más joven:',
      archivos: { ejercicios: 'ejercicios', respuestas: 'respuestas' },
      pdf: {
        tituloEjercicios: 'GeoHistoria · Hoja de ejercicios',
        tituloRespuestas: 'GeoHistoria · Hoja de respuestas',
        datosAlumno: 'Nombre: ________________________________   Grupo: __________   Fecha: __________',
        instrucciones:
          'Ordena los eventos de cada sección del más antiguo al más joven y escribe sus letras en ese orden. ' +
          'Para cada relación, anota el principio que la demuestra.',
        eventos: 'Eventos:',
        lineaRespuesta: 'Orden, del más antiguo al más joven: ',
        enLinea: (enlace) => `Practica este ejercicio en línea: ${enlace}`,
        evidencias: 'Evidencias que se ven:',
        pagina: (n, total) => `Página ${n} de ${total}`,
      },
    },

    reto: {
      titulo: (fecha, nivel) => `Reto del ${fecha} · nivel ${nivel}`,
      explicacion: 'El mismo ejercicio para todos durante el día de hoy. Se cuentan tus revisiones hasta acertar.',
      racha: (dias) => `Racha: ${dias} ${dias === 1 ? 'día' : 'días'}`,
      resuelto: (intentos) => (intentos === 1 ? '¡Resuelto al primer intento!' : `¡Resuelto en ${intentos} intentos!`),
      rendido: 'Viste la solución: el reto de hoy no cuenta para la racha.',
      yaJugado: 'Ya jugaste el reto de hoy. Puedes volver a ordenarlo, pero ya no cuenta.',
      compartir: 'Compartir resultado',
      compartido: 'Resultado copiado.',
      noCompartido: 'No se pudo copiar; este es el texto:',
      vistaPrevia: 'Lo que se comparte (no revela la respuesta):',
      sinGuardar: 'Tu navegador no permite guardar datos: el resultado y la racha no se conservarán.',
    },

    // Texto para compartir el resultado del reto (sin letras de eventos).
    compartir: {
      encabezado: (fecha, nivel) => `GeoHistoria · Reto del ${fecha} (nivel ${nivel})`,
      primerIntento: 'Resuelto al primer intento',
      resueltoEn: (n) => `Resuelto en ${n} intentos`,
      racha: (dias) => `racha: ${dias} ${dias === 1 ? 'día' : 'días'}`,
      solucion: 'Vi la solución',
      solucionDespues: (n) => `Vi la solución después de ${n} ${n === 1 ? 'intento' : 'intentos'}`,
    },
    formatoFecha: 'es-MX',

    principios: {
      titulo: 'Principios de la datación relativa',
      explicacion:
        'Cada esquema está generado por el mismo motor que los ejercicios. Debajo de cada uno está lo que se ve ' +
        'en él y lo que se deduce.',
      loQueSeVe: 'Lo que se ve:',
      practicar: 'Practicar',
    },
  },

  en: {
    tituloPagina: 'GeoHistoria — Relative dating puzzle',
    titulo: 'GeoHistoria',
    subtitulo: 'Relative dating puzzle',
    saltar: 'Skip to content',
    idiomaSelector: 'Language',
    nombresIdiomas: { es: 'Español', en: 'English' },
    navegacion: 'Modes',
    modos: { practica: 'Practice', reto: 'Daily challenge', profesor: 'Teacher', principios: 'Principles' },
    litologias: LITOLOGIAS.en,
    tarjetas: {
      capa: (litologia) => `${litologia} layer`,
      dique: (litologia) => `${litologia} dike`,
      falla: 'Fault',
      erosion: 'Erosion / unconformity',
      basculamiento: 'Tilting',
    },
    elegirNivel: 'Choose a level',
    niveles: {
      1: { nombre: 'Level 1', descripcion: 'Layers and a dike: superposition and cross-cutting relationships.' },
      2: { nombre: 'Level 2', descripcion: 'Faults and dikes that cross each other: cross-cutting between structures.' },
      3: {
        nombre: 'Level 3',
        descripcion: 'Tilted layers, erosion and new layers: original horizontality and angular unconformity.',
      },
    },
    ejercicio: 'Exercise',
    nivel: 'Level',
    semilla: (semilla) => `Seed ${semilla}`,
    copiarEnlace: 'Copy link',
    enlaceCopiado: 'Link copied.',
    enlaceNoCopiado: (enlace) => `Could not copy. Here is the link: ${enlace}`,
    otroEjercicio: 'Another exercise',
    descargarSVG: 'Download SVG',
    descargarPNG: 'Download PNG',
    instrucciones:
      'Put the events in order: youngest at the top, oldest at the bottom. ' +
      'Drag the cards or use the ↑ ↓ buttons (keyboard: Alt + ↑ / ↓).',
    masJoven: 'Youngest ↑',
    masAntiguo: 'Oldest ↓',
    listaTarjetas: 'Events, from youngest (top) to oldest (bottom)',
    subir: (id) => `Move ${id} up (younger)`,
    bajar: (id) => `Move ${id} down (older)`,
    posicion: (nombre, posicion, total) => `${nombre}, position ${posicion} of ${total} from the top`,
    movida: (nombre, posicion, total) => `${nombre}: now in position ${posicion} of ${total} from the top.`,
    revisar: 'Check',
    correcto: 'Correct!',
    correctoDetalle: 'This is the only order consistent with what you can see. Here is the evidence:',
    enSuLugar: (n, total) => `${n} of ${total} in the right place.`,
    contradichas: 'Your order contradicts this evidence:',
    sigueIntentando: 'Move the cards and check again.',
    verSolucion: 'Show the solution',
    solucion: 'Solution, from youngest to oldest:',
    todasLasEvidencias: 'All the evidence you can see:',
    bien: 'in the right place',
    mal: 'out of place',
    descripcionSeccion: (partes) => `Geological cross-section with ${partes}.`,
    marcadoConFlecha: 'marked with a rotation arrow',
    leyenda: 'Legend',
    simbolos: {
      falla: 'Fault (half arrows show the movement)',
      erosion: 'Unconformity (erosion surface)',
      basculamiento: 'Tilting (rotation arrow)',
    },

    profesor: {
      titulo: 'Exercise sheets',
      explicacion:
        'Choose the level and the number of exercises. Seeds are consecutive from the first one: with the same ' +
        'link, the whole class gets exactly the same exercises.',
      cantidad: 'Exercises',
      primeraSemilla: 'First seed',
      semillaAlAzar: 'random if left empty',
      papel: 'Paper',
      papeles: { carta: 'Letter', a4: 'A4' },
      generar: 'Prepare sheet',
      resumen: (cantidad, nivel, primera, ultima) =>
        `${cantidad} level ${nivel} ${cantidad === 1 ? 'exercise' : 'exercises'}, ` +
        (primera === ultima ? `seed ${primera}` : `seeds ${primera} to ${ultima}`),
      pdfEjercicios: 'Exercise sheet (PDF)',
      pdfRespuestas: 'Answer key (PDF)',
      copiarEnlace: 'Copy link to this sheet',
      generando: (n, total) => `Generating PDF… ${n} of ${total}`,
      listo: (nombre) => `Done: ${nombre}`,
      error: 'The PDF could not be generated.',
      ejercicio: (numero, semilla) => `Exercise ${numero} · seed ${semilla}`,
      respuesta: 'Answer',
      ordenCorrecto: 'From oldest to youngest:',
      archivos: { ejercicios: 'exercises', respuestas: 'answers' },
      pdf: {
        tituloEjercicios: 'GeoHistoria · Exercise sheet',
        tituloRespuestas: 'GeoHistoria · Answer key',
        datosAlumno: 'Name: ________________________________   Class: __________   Date: __________',
        instrucciones:
          'Put the events of each cross-section in order from oldest to youngest and write their letters in that ' +
          'order. For each relationship, write down the principle that proves it.',
        eventos: 'Events:',
        lineaRespuesta: 'Order, from oldest to youngest: ',
        enLinea: (enlace) => `Practice this exercise online: ${enlace}`,
        evidencias: 'Evidence you can see:',
        pagina: (n, total) => `Page ${n} of ${total}`,
      },
    },

    reto: {
      titulo: (fecha, nivel) => `Challenge of ${fecha} · level ${nivel}`,
      explicacion: 'The same exercise for everyone today. Your checks are counted until you get it right.',
      racha: (dias) => `Streak: ${dias} ${dias === 1 ? 'day' : 'days'}`,
      resuelto: (intentos) => (intentos === 1 ? 'Solved on the first try!' : `Solved in ${intentos} tries!`),
      rendido: 'You looked at the solution: today’s challenge does not count toward your streak.',
      yaJugado: 'You already played today’s challenge. You can order it again, but it no longer counts.',
      compartir: 'Share result',
      compartido: 'Result copied.',
      noCompartido: 'Could not copy; here is the text:',
      vistaPrevia: 'What will be shared (it does not reveal the answer):',
      sinGuardar: 'Your browser does not allow saving data: your result and streak will not be kept.',
    },

    compartir: {
      encabezado: (fecha, nivel) => `GeoHistoria · Challenge of ${fecha} (level ${nivel})`,
      primerIntento: 'Solved on the first try',
      resueltoEn: (n) => `Solved in ${n} tries`,
      racha: (dias) => `streak: ${dias} ${dias === 1 ? 'day' : 'days'}`,
      solucion: 'I looked at the solution',
      solucionDespues: (n) => `I looked at the solution after ${n} ${n === 1 ? 'try' : 'tries'}`,
    },
    formatoFecha: 'en-US',

    principios: {
      titulo: 'Principles of relative dating',
      explicacion:
        'Each diagram is generated by the same engine as the exercises. Below each one is what you can see in ' +
        'it and what follows from it.',
      loQueSeVe: 'What you can see:',
      practicar: 'Practice',
    },
  },
};

/** Textos de un idioma (para la lógica pura y las pruebas). */
export function textosEn(cual) {
  return DICCIONARIO[cual];
}

/** Textos del idioma activo: TEXTOS.revisar, TEXTOS.profesor.titulo… */
export const TEXTOS = new Proxy(
  {},
  {
    get: (_, clave) => DICCIONARIO[idiomaActual][clave],
    has: (_, clave) => clave in DICCIONARIO[idiomaActual],
    ownKeys: () => Reflect.ownKeys(DICCIONARIO[idiomaActual]),
    getOwnPropertyDescriptor: (_, clave) => ({ ...Reflect.getOwnPropertyDescriptor(DICCIONARIO[idiomaActual], clave), configurable: true }),
  },
);

/** Nombre de un evento en su tarjeta: "Capa de arenisca" / "Sandstone layer", "Falla" / "Fault"… */
export function nombreDeTarjeta(evento, cual = idiomaActual) {
  const { tarjetas, litologias } = DICCIONARIO[cual];
  switch (evento.tipo) {
    case 'deposito':
      return tarjetas.capa(litologias[evento.litologia]);
    case 'dique':
      return tarjetas.dique(litologias[evento.litologia]);
    case 'falla':
      return tarjetas.falla;
    case 'erosion':
      return tarjetas.erosion;
    case 'basculamiento':
      return tarjetas.basculamiento;
    default:
      return evento.tipo;
  }
}

// ───────────────────────── Principios y explicaciones ─────────────────────────

export const PRINCIPIOS = Object.freeze({
  superposicion: Object.freeze({ es: 'superposición', en: 'superposition' }),
  'relaciones-de-corte': Object.freeze({ es: 'relaciones de corte', en: 'cross-cutting relationships' }),
  'horizontalidad-original': Object.freeze({ es: 'horizontalidad original', en: 'original horizontality' }),
});

// Nombre de un evento con su artículo: "la capa A", "el dique D", "fault F"…
const NOMBRES = {
  es: {
    deposito: (id) => `la capa ${id}`,
    dique: (id) => `el dique ${id}`,
    falla: (id) => `la falla ${id}`,
    erosion: (id) => `la superficie de erosión ${id}`,
    basculamiento: (id) => `el basculamiento ${id}`,
  },
  en: {
    deposito: (id) => `layer ${id}`,
    dique: (id) => `dike ${id}`,
    falla: (id) => `fault ${id}`,
    erosion: (id) => `erosion surface ${id}`,
    basculamiento: (id) => `tilting ${id}`,
  },
};

export function nombreDe(evento, cual) {
  return NOMBRES[cual][evento.tipo](evento.id);
}

// Plantillas de explicación por tipo de evidencia. `a` es el evento más antiguo y `j` el más joven.
// Todas terminan diciendo quién es más joven y con qué principio.
const PLANTILLAS = {
  es: {
    superposicion: (a, j) => `${may(j)} descansa sobre ${a}`,
    corte: (a, j) => `${may(j)} corta ${al(a)}`,
    truncamiento: (a, j) => `${may(j)} trunca ${al(a)}; es una discordancia`,
    'sobre-erosion': (a, j) => `${may(j)} se depositó sobre ${a}`,
    desplazamiento: (a, j) => `${may(j)} desplaza ${al(a)}`,
    'capa-inclinada': (a) => `${may(a)} está inclinada y las capas se depositan horizontales`,
    'discordancia-angular': (a, j) => `${may(j)} corta capas inclinadas sin estar inclinada ella misma`,
  },
  en: {
    superposicion: (a, j) => `${may(j)} rests on ${a}`,
    corte: (a, j) => `${may(j)} cuts across ${a}`,
    truncamiento: (a, j) => `${may(j)} truncates ${a}; it is an unconformity`,
    'sobre-erosion': (a, j) => `${may(j)} was deposited on ${a}`,
    desplazamiento: (a, j) => `${may(j)} offsets ${a}`,
    'capa-inclinada': (a) => `${may(a)} is tilted, and layers are deposited horizontally`,
    'discordancia-angular': (a, j) => `${may(j)} cuts across tilted layers but is not tilted itself`,
  },
};

const CONCLUSION = {
  es: (antiguo, joven, principio) =>
    `así que ${joven.id} es más joven que ${antiguo.id} (principio de ${PRINCIPIOS[principio].es}).`,
  en: (antiguo, joven, principio) =>
    `so ${joven.id} is younger than ${antiguo.id} (principle of ${PRINCIPIOS[principio].en}).`,
};

/**
 * Explicación de una evidencia en ambos idiomas, con las letras reales del ejercicio.
 * @param {string} evidencia tipo de evidencia (ver PLANTILLAS)
 * @param {string} principio clave de PRINCIPIOS
 * @param {object} antiguo evento más antiguo
 * @param {object} joven evento más joven
 * @returns {{es: string, en: string}}
 */
export function explicar(evidencia, principio, antiguo, joven) {
  const textos = {};
  for (const cual of IDIOMAS) {
    const plantilla = PLANTILLAS[cual][evidencia];
    if (!plantilla) {
      throw new RangeError(`Tipo de evidencia desconocido: ${evidencia}`);
    }
    const observacion = plantilla(nombreDe(antiguo, cual), nombreDe(joven, cual));
    textos[cual] = `${observacion}, ${CONCLUSION[cual](antiguo, joven, principio)}`;
  }
  return Object.freeze(textos);
}

// Primera letra en mayúscula.
function may(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Preposición "a" con contracción: "a la capa A", "al dique D".
function al(nombre) {
  return nombre.startsWith('el ') ? `al ${nombre.slice(3)}` : `a ${nombre}`;
}
