// Modelo implícito de una sección: historia (lista de eventos) → unidadEn(x, z).
//
// Para saber qué roca hay HOY en un punto, se recorren los eventos del más joven al más antiguo,
// deshaciendo fallas y basculamientos con su transformación inversa:
// - Erosión: lo que queda arriba de su superficie es aire (o lo rellena un depósito más joven).
// - Dique: ocupa su franja, pero solo donde ya había roca en su momento.
// - Depósito: rellena el aire que haya debajo de su techo horizontal.
//
// Módulo puro: sin DOM y sin Math.random. Es la misma idea que servirá para un bloque 3D.

import { crearEvento, aplicar, invertir, alturaErosion, dentroDelDique } from './eventos.js';

/** Ventana de la sección, en unidades arbitrarias. */
export const VENTANA = Object.freeze({ ancho: 1000, alto: 500 });

/** Nivel desde el que se mide el espesor del primer depósito. */
export const NIVEL_BASE = 0;

/** Índice que representa el aire (ninguna unidad). */
export const AIRE = -1;

/**
 * Crea el modelo de una historia.
 * @param {object[]} historia eventos ordenados del más antiguo al más joven
 */
export function crearModelo(historia) {
  const eventos = validarHistoria(historia);
  const techos = calcularTechos(eventos);

  // Unidad en el punto (x, z), expresado en las coordenadas de justo después del evento k.
  function consultar(k, x, z) {
    if (k < 0) return AIRE;
    const evento = eventos[k];
    switch (evento.tipo) {
      case 'deposito': {
        const debajo = consultar(k - 1, x, z);
        if (debajo !== AIRE) return debajo;
        return z <= techos[k] ? k : AIRE;
      }
      case 'dique': {
        const debajo = consultar(k - 1, x, z);
        return debajo !== AIRE && dentroDelDique(evento, { x, z }) ? k : debajo;
      }
      case 'erosion':
        return z > alturaErosion(evento, x) ? AIRE : consultar(k - 1, x, z);
      case 'falla':
      case 'basculamiento': {
        const antes = invertir(evento, { x, z });
        return consultar(k - 1, antes.x, antes.z);
      }
      default:
        throw new RangeError(`Tipo de evento desconocido: ${evento.tipo}`);
    }
  }

  /** Índice del evento (depósito o dique) que ocupa hoy el punto, o AIRE. */
  function indiceEn(x, z) {
    return consultar(eventos.length - 1, x, z);
  }

  /**
   * Índice de la unidad que ocupaba el punto justo después del evento `indice`, o AIRE.
   * El punto está en las coordenadas de ese momento.
   */
  function indiceEnMomento(indice, punto) {
    return consultar(indice, punto.x, punto.z);
  }

  /** Id de la unidad que ocupa hoy el punto, o null si es aire. */
  function unidadEn(x, z) {
    const indice = indiceEn(x, z);
    return indice === AIRE ? null : eventos[indice].id;
  }

  /**
   * Lleva un punto desde las coordenadas de justo después del evento `indice` hasta hoy,
   * aplicando las transformaciones de todos los eventos posteriores.
   */
  function alPresente(indice, punto) {
    let p = { x: punto.x, z: punto.z };
    for (let k = indice + 1; k < eventos.length; k++) {
      p = aplicar(eventos[k], p);
    }
    return p;
  }

  return Object.freeze({ eventos, techos, indiceEn, indiceEnMomento, unidadEn, alPresente });
}

/**
 * Inclinación actual (grados) de la estratificación de las capas depositadas en el evento `indice`:
 * la suma de los basculamientos posteriores. Positiva si las capas buzan a la izquierda (giro antihorario),
 * negativa si buzan a la derecha.
 */
export function inclinacionActual(eventos, indice) {
  let angulo = 0;
  for (let m = indice + 1; m < eventos.length; m++) {
    const evento = eventos[m];
    if (evento.tipo === 'basculamiento') {
      angulo += (evento.sentido === 'derecha' ? -1 : 1) * evento.angulo;
    }
  }
  return angulo;
}

// Techo de cada depósito (null para los demás eventos).
// El espesor se suma al techo del depósito anterior; después de una erosión,
// se mide desde el nivel de la erosión.
function calcularTechos(eventos) {
  let referencia = NIVEL_BASE;
  return Object.freeze(
    eventos.map((evento) => {
      if (evento.tipo === 'deposito') {
        referencia += evento.espesor;
        return referencia;
      }
      if (evento.tipo === 'erosion') {
        referencia = evento.nivel;
      }
      return null;
    }),
  );
}

function validarHistoria(historia) {
  if (!Array.isArray(historia) || historia.length === 0) {
    throw new TypeError('La historia debe ser una lista de eventos no vacía');
  }
  const eventos = historia.map(crearEvento);
  if (eventos[0].tipo !== 'deposito') {
    throw new RangeError(`El primer evento debe ser un depósito, no ${eventos[0].tipo}`);
  }
  const vistos = new Set();
  for (const { id } of eventos) {
    if (vistos.has(id)) {
      throw new RangeError(`Id de evento repetido: ${id}`);
    }
    vistos.add(id);
  }
  return Object.freeze(eventos);
}
