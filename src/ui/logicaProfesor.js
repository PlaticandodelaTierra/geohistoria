// Lógica del modo profesor sin DOM (se puede probar en Node): URL de la hoja, semillas, lista de eventos y
// clave de respuestas. Los textos que van al PDF usan solo caracteres de la fuente Helvetica (WinAnsi).

import { NIVELES } from '../motor/generador.js';
import { nombreDeTarjeta } from '../i18n.js';

export const CANTIDAD_MAXIMA = 20;

/** Papeles disponibles (milímetros) y su nombre en jsPDF. */
export const PAPELES = Object.freeze({
  carta: Object.freeze({ ancho: 215.9, alto: 279.4, formato: 'letter' }),
  a4: Object.freeze({ ancho: 210, alto: 297, formato: 'a4' }),
});

const SEMILLA_LIMITE = 0xffffffff;

/**
 * Lee la hoja de la URL: nivel (n), cantidad (c), primera semilla (s) y papel (p).
 * Devuelve null en lo que falte o sea inválido (el papel, por defecto, es carta).
 */
export function leerParametrosProfesor(consulta) {
  const parametros = typeof consulta === 'string' ? new URLSearchParams(consulta) : consulta;
  const n = Number(parametros.get('n'));
  const c = Number(parametros.get('c'));
  const texto = (parametros.get('s') ?? '').trim();
  const papel = parametros.get('p');
  return {
    nivel: NIVELES.includes(n) ? n : null,
    cantidad: Number.isInteger(c) && c >= 1 && c <= CANTIDAD_MAXIMA ? c : null,
    semilla: /^\d{1,10}$/.test(texto) && Number(texto) <= SEMILLA_LIMITE ? Number(texto) : null,
    papel: papel in PAPELES ? papel : 'carta',
  };
}

/** Ruta (hash, sin '#') de una hoja. */
export function rutaDeProfesor({ nivel, cantidad, semilla, papel = 'carta' }) {
  return `profesor?n=${nivel}&c=${cantidad}&s=${semilla}&p=${papel}`;
}

/** Semillas consecutivas de la hoja, a partir de la primera. */
export function semillasDeLaHoja(primera, cantidad) {
  return Array.from({ length: cantidad }, (_, i) => (primera + i) % (SEMILLA_LIMITE + 1));
}

/** "A · Capa de arenisca; B · Falla; …" en orden alfabético (no revela el orden de los eventos). */
export function listaDeEventos(historia, idioma = 'es') {
  return [...historia]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((e) => `${e.id} · ${nombreDeTarjeta(e, idioma)}`)
    .join('; ');
}

/** Enlace para practicar un ejercicio en línea. */
export function enlaceDePractica(base, nivel, semilla) {
  return `${base}#practica?n=${nivel}&s=${semilla}`;
}

/**
 * Clave de respuestas: para cada ejercicio, el orden correcto (del más antiguo al más joven) y la
 * explicación de cada evidencia.
 * @param {Array<{numero: number, semilla: number, seccion: object}>} ejercicios
 * @param {'es'|'en'} [idioma]
 */
export function claveDeRespuestas(ejercicios, idioma = 'es') {
  return ejercicios.map(({ numero, semilla, seccion }) => ({
    numero,
    semilla,
    orden: seccion.orden.join(', '),
    evidencias: seccion.aristas.map((a) => a.explicacion[idioma]),
  }));
}

// Caracteres de la codificación WinAnsi (la de las fuentes estándar de los PDF, como Helvetica).
const WINANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');

/** ¿Se puede escribir este texto con Helvetica en el PDF (sin incrustar fuentes)? */
export function cabeEnHelvetica(texto) {
  for (const caracter of texto) {
    const codigo = caracter.codePointAt(0);
    const latino = (codigo >= 0x20 && codigo <= 0x7e) || (codigo >= 0xa0 && codigo <= 0xff);
    if (!latino && !WINANSI_EXTRA.has(caracter)) return false;
  }
  return true;
}
