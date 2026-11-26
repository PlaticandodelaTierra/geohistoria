// Generador de números pseudoaleatorios con semilla (mulberry32).
//
// Todo el motor debe usar este módulo y NUNCA Math.random: así cada sección sale de una
// semilla y se puede reproducir exactamente (enlaces compartidos, reto diario, hojas del profesor).
// Módulo puro: sin DOM ni estado global.

const DOS_A_LA_32 = 4294967296;

/**
 * Convierte una semilla (número o texto) en un entero sin signo de 32 bits.
 * - Número: se trunca y se envuelve a 32 bits.
 * - Texto de solo dígitos: se trata como número, para que `s=48213` en la URL dé lo mismo que 48213.
 * - Cualquier otro texto (p. ej. la fecha "2026-11-25" del reto diario): hash FNV-1a de 32 bits.
 * Los espacios al inicio y al final del texto se ignoran.
 * @param {number|string} semilla
 * @returns {number} entero en [0, 2^32)
 */
export function normalizarSemilla(semilla) {
  if (typeof semilla === 'number') {
    if (!Number.isFinite(semilla)) {
      throw new TypeError(`Semilla inválida: ${semilla}`);
    }
    return Math.trunc(semilla) >>> 0;
  }
  if (typeof semilla === 'string') {
    const texto = semilla.trim();
    if (texto === '') {
      throw new TypeError('La semilla no puede ser un texto vacío');
    }
    if (/^\d+$/.test(texto)) {
      return Number(texto) >>> 0;
    }
    return hashTexto(texto);
  }
  throw new TypeError(`La semilla debe ser número o texto, no ${semilla === null ? 'null' : typeof semilla}`);
}

/**
 * Deriva una semilla nueva a partir de otra y un índice (0, 1, 2…).
 * La usan los reintentos del generador y las hojas de varios ejercicios.
 * Para una misma semilla, índices distintos dan siempre subsemillas distintas.
 * @param {number|string} semilla
 * @param {number} indice entero ≥ 0
 * @returns {number} entero en [0, 2^32)
 */
export function subsemilla(semilla, indice) {
  if (!Number.isInteger(indice) || indice < 0) {
    throw new TypeError(`El índice de la subsemilla debe ser un entero ≥ 0, no ${indice}`);
  }
  // 0x9e3779b9 es impar, así que multiplicar por él es una biyección en 32 bits;
  // luego se mezcla con el finalizador de MurmurHash3 (también biyectivo).
  const base = normalizarSemilla(semilla);
  return mezclar32((base ^ Math.imul(indice + 1, 0x9e3779b9)) >>> 0);
}

/**
 * Crea un generador con semilla. Cada llamada avanza la secuencia.
 * @param {number|string} semilla
 */
export function crearRng(semilla) {
  let estado = normalizarSemilla(semilla);

  /** Real en [0, 1). Algoritmo mulberry32. */
  function siguiente() {
    estado = (estado + 0x6d2b79f5) | 0;
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / DOS_A_LA_32;
  }

  /** Entero en [min, max], con ambos extremos incluidos. */
  function entero(min, max) {
    if (!Number.isInteger(min) || !Number.isInteger(max)) {
      throw new TypeError(`entero(min, max) necesita enteros, recibió ${min} y ${max}`);
    }
    if (min > max) {
      throw new RangeError(`entero(min, max): min (${min}) es mayor que max (${max})`);
    }
    return min + Math.floor(siguiente() * (max - min + 1));
  }

  /** Real en [min, max). Para espesores, ángulos, echados, etc. */
  function rango(min, max) {
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      throw new TypeError(`rango(min, max) necesita números finitos, recibió ${min} y ${max}`);
    }
    if (min > max) {
      throw new RangeError(`rango(min, max): min (${min}) es mayor que max (${max})`);
    }
    return min + siguiente() * (max - min);
  }

  /** Un elemento al azar de la lista. */
  function elegir(lista) {
    if (lista.length === 0) {
      throw new RangeError('elegir(lista): la lista está vacía');
    }
    return lista[entero(0, lista.length - 1)];
  }

  /** Copia revuelta de la lista (Fisher–Yates). No modifica la original. */
  function barajar(lista) {
    const copia = [...lista];
    for (let i = copia.length - 1; i > 0; i--) {
      const j = entero(0, i);
      [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
  }

  return Object.freeze({ siguiente, entero, rango, elegir, barajar });
}

// Hash FNV-1a de 32 bits sobre las unidades UTF-16 del texto.
function hashTexto(texto) {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Finalizador de MurmurHash3 (fmix32): reparte bien los bits de entrada.
function mezclar32(h) {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}
