// Grafo de relaciones de edad (arista A → B: A es más antiguo que B), orden topológico,
// unicidad del orden y validación de respuestas.
//
// La respuesta correcta es CUALQUIER orden compatible con el grafo (cualquier ordenamiento topológico).
// Módulo puro: sin DOM y sin Math.random.

/** Máximo de eventos para contar órdenes de forma exacta (2^n estados). */
const MAXIMO_PARA_CONTAR = 20;

/**
 * Crea el grafo. Cada arista necesita al menos {desde, hacia}; el resto (principio, explicación…) se conserva.
 * @param {string[]} ids eventos; su orden decide los empates del orden topológico
 * @param {object[]} aristas
 */
export function crearGrafo(ids, aristas) {
  if (!Array.isArray(ids) || new Set(ids).size !== ids.length) {
    throw new TypeError('Los ids del grafo deben ser una lista sin repetidos');
  }
  const sucesores = new Map(ids.map((id) => [id, []]));
  const predecesores = new Map(ids.map((id) => [id, []]));
  for (const arista of aristas) {
    if (!sucesores.has(arista.desde) || !sucesores.has(arista.hacia)) {
      throw new RangeError(`Arista con un evento desconocido: ${arista.desde} → ${arista.hacia}`);
    }
    if (arista.desde === arista.hacia) {
      throw new RangeError(`Arista de un evento consigo mismo: ${arista.desde}`);
    }
    sucesores.get(arista.desde).push(arista);
    predecesores.get(arista.hacia).push(arista);
  }
  return Object.freeze({ ids: Object.freeze([...ids]), aristas: Object.freeze([...aristas]), sucesores, predecesores });
}

/**
 * Un orden topológico (del más antiguo al más joven). Los empates se deciden por el orden de `ids`.
 * Lanza un error si el grafo tiene ciclos.
 */
export function ordenTopologico(grafo) {
  const { orden, completo } = kahn(grafo);
  if (!completo) {
    throw new RangeError('El grafo tiene un ciclo: no existe un orden válido');
  }
  return orden;
}

export function tieneCiclo(grafo) {
  return !kahn(grafo).completo;
}

/** ¿Hay exactamente un orden válido? (en cada paso hay un solo evento disponible) */
export function esOrdenUnico(grafo) {
  const { completo, siempreUnico } = kahn(grafo);
  return completo && siempreUnico;
}

/** Número exacto de órdenes válidos (0 si hay ciclos). */
export function contarOrdenes(grafo) {
  const n = grafo.ids.length;
  if (n > MAXIMO_PARA_CONTAR) {
    throw new RangeError(`Demasiados eventos para contar órdenes: ${n}`);
  }
  const requisitos = mascarasDePredecesores(grafo);
  const formas = new Float64Array(1 << n);
  formas[0] = 1;
  for (let mascara = 0; mascara < 1 << n; mascara++) {
    if (formas[mascara] === 0) continue;
    for (let i = 0; i < n; i++) {
      const bit = 1 << i;
      if (mascara & bit) continue;
      if ((requisitos[i] & mascara) === requisitos[i]) {
        formas[mascara | bit] += formas[mascara];
      }
    }
  }
  return formas[(1 << n) - 1];
}

/** Lista los órdenes válidos (hasta `limite`), en orden lexicográfico según `ids`. */
export function listarOrdenes(grafo, limite = 10) {
  const n = grafo.ids.length;
  const requisitos = mascarasDePredecesores(grafo);
  const resultado = [];
  const actual = [];
  function explorar(mascara) {
    if (resultado.length >= limite) return;
    if (actual.length === n) {
      resultado.push(actual.map((i) => grafo.ids[i]));
      return;
    }
    for (let i = 0; i < n; i++) {
      const bit = 1 << i;
      if (mascara & bit || (requisitos[i] & mascara) !== requisitos[i]) continue;
      actual.push(i);
      explorar(mascara | bit);
      actual.pop();
    }
  }
  explorar(0);
  return resultado;
}

/**
 * Valida una respuesta (lista de ids, del más antiguo al más joven).
 * Cada par mal ordenado se señala con la cadena de evidencias que lo contradice:
 * una sola arista si la relación es directa, o varias (A → B → C) si es indirecta.
 * @returns {{valida: boolean, errores: Array<{antiguo: string, joven: string, cadena: object[]}>}}
 */
export function validarRespuesta(grafo, respuesta) {
  if (!Array.isArray(respuesta)) {
    throw new TypeError('La respuesta debe ser una lista de ids');
  }
  const posicion = new Map(respuesta.map((id, i) => [id, i]));
  if (
    respuesta.length !== grafo.ids.length ||
    posicion.size !== respuesta.length ||
    !grafo.ids.every((id) => posicion.has(id))
  ) {
    throw new RangeError('La respuesta debe incluir cada evento exactamente una vez');
  }

  const errores = [];
  for (const antiguo of grafo.ids) {
    // Búsqueda en anchura: la cadena más corta de evidencias desde `antiguo` hasta cada evento posterior.
    const llegada = new Map([[antiguo, null]]);
    const cola = [antiguo];
    while (cola.length > 0) {
      const actual = cola.shift();
      for (const arista of grafo.sucesores.get(actual)) {
        if (llegada.has(arista.hacia)) continue;
        llegada.set(arista.hacia, arista);
        cola.push(arista.hacia);
      }
    }
    for (const joven of grafo.ids) {
      if (joven === antiguo || !llegada.has(joven)) continue;
      if (posicion.get(joven) < posicion.get(antiguo)) {
        errores.push({ antiguo, joven, cadena: reconstruirCadena(llegada, joven) });
      }
    }
  }
  return { valida: errores.length === 0, errores };
}

// ───────────────────────── Auxiliares ─────────────────────────

// Algoritmo de Kahn con empates decididos por el orden de `ids`.
function kahn(grafo) {
  const indice = new Map(grafo.ids.map((id, i) => [id, i]));
  const pendientes = new Map(grafo.ids.map((id) => [id, grafo.predecesores.get(id).length]));
  let disponibles = grafo.ids.filter((id) => pendientes.get(id) === 0);
  const orden = [];
  let siempreUnico = true;
  while (disponibles.length > 0) {
    if (disponibles.length > 1) siempreUnico = false;
    const id = disponibles.shift();
    orden.push(id);
    for (const arista of grafo.sucesores.get(id)) {
      const resto = pendientes.get(arista.hacia) - 1;
      pendientes.set(arista.hacia, resto);
      if (resto === 0) disponibles.push(arista.hacia);
    }
    disponibles = disponibles.sort((a, b) => indice.get(a) - indice.get(b));
  }
  return { orden, completo: orden.length === grafo.ids.length, siempreUnico };
}

// Para cada evento, la máscara de bits de sus predecesores directos.
function mascarasDePredecesores(grafo) {
  const indice = new Map(grafo.ids.map((id, i) => [id, i]));
  return grafo.ids.map((id) =>
    grafo.predecesores.get(id).reduce((mascara, arista) => mascara | (1 << indice.get(arista.desde)), 0),
  );
}

function reconstruirCadena(llegada, destino) {
  const cadena = [];
  let arista = llegada.get(destino);
  while (arista) {
    cadena.unshift(arista);
    arista = llegada.get(arista.desde);
  }
  return cadena;
}
