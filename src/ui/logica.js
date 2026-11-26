// Lógica del modo práctica sin DOM (se puede probar en Node): URL, orden de las tarjetas y evaluación.
//
// Convención: una "respuesta" va del más antiguo al más joven (como el motor). En pantalla, las tarjetas
// se muestran al revés: lo más joven arriba, como en una columna estratigráfica.

import { NIVELES } from '../motor/generador.js';
import { crearGrafo, validarRespuesta } from '../motor/orden.js';

/** Semillas que sortea la interfaz para un ejercicio nuevo (cortas, fáciles de compartir). */
export const SEMILLA_MAXIMA = 99999;

const SEMILLA_LIMITE = 0xffffffff;

/**
 * Lee el nivel y la semilla de la URL (`n` y `s`). Devuelve null en lo que falte o sea inválido.
 * @param {URLSearchParams|string} consulta
 * @returns {{nivel: number|null, semilla: number|null}}
 */
export function leerParametros(consulta) {
  const parametros = typeof consulta === 'string' ? new URLSearchParams(consulta) : consulta;
  const n = Number(parametros.get('n'));
  const nivel = NIVELES.includes(n) ? n : null;
  const texto = (parametros.get('s') ?? '').trim();
  const semilla = /^\d{1,10}$/.test(texto) && Number(texto) <= SEMILLA_LIMITE ? Number(texto) : null;
  return { nivel, semilla };
}

/** Ruta (hash, sin '#') de un ejercicio de práctica. */
export function rutaDePractica(nivel, semilla) {
  return `practica?n=${nivel}&s=${semilla}`;
}

/** Copia de `lista` con el elemento de la posición `desde` movido a la posición `hasta`. */
export function mover(lista, desde, hasta) {
  const copia = [...lista];
  if (desde < 0 || desde >= copia.length || hasta < 0 || hasta >= copia.length) return copia;
  const [elemento] = copia.splice(desde, 1);
  copia.splice(hasta, 0, elemento);
  return copia;
}

/**
 * Respuesta inicial (del más antiguo al más joven): orden alfabético. Como el generador nunca asigna las
 * letras en orden cronológico, esta respuesta nunca es la correcta.
 */
export function respuestaInicial(historia) {
  return historia.map((e) => e.id).sort();
}

/** Las tarjetas en pantalla (de arriba abajo: del más joven al más antiguo) ↔ respuesta. */
export function tarjetasDesdeRespuesta(respuesta) {
  return [...respuesta].reverse();
}

export function respuestaDesdeTarjetas(tarjetas) {
  return [...tarjetas].reverse();
}

/**
 * Evalúa una respuesta contra una sección generada.
 * - `posiciones`: si cada evento quedó en su lugar (el orden de los niveles 1 a 3 es único).
 * - `contradichas`: evidencias directas que la respuesta contradice (sin repetir, en el orden de la
 *   sección). Corregir esas basta para corregir toda la respuesta.
 * @param {{historia: object[], aristas: object[], orden: string[]}} seccion
 * @param {string[]} respuesta del más antiguo al más joven
 */
export function evaluarRespuesta(seccion, respuesta) {
  const ids = seccion.historia.map((e) => e.id);
  const grafo = crearGrafo(ids, seccion.aristas);
  const { valida, errores } = validarRespuesta(grafo, respuesta);
  const posiciones = respuesta.map((id, i) => ({ id, correcta: seccion.orden[i] === id }));
  const directas = new Set(errores.filter((e) => e.cadena.length === 1).map((e) => e.cadena[0]));
  return {
    correcta: valida && posiciones.every((p) => p.correcta),
    posiciones,
    enSuLugar: posiciones.filter((p) => p.correcta).length,
    contradichas: seccion.aristas.filter((a) => directas.has(a)),
  };
}
