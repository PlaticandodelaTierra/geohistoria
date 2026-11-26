// Colocación de las letras A, B, C… sobre cada unidad o evento, sin que se encimen.
//
// Cada objeto a etiquetar trae varios lugares posibles (candidatos) con un puntaje. Se colocan primero los
// más difíciles (ver `prioridad`; a igualdad, los que tienen menos candidatos) y cada uno toma su mejor
// candidato que: quede dentro de la ventana, no se encime con otra etiqueta y no tape ninguna línea
// (fallas, discordancias, medias flechas). Si ninguno cumple, una etiqueta obligatoria va donde menos
// estorbe y se deja un aviso; una opcional (un trozo extra de una capa) se omite.
//
// Orden: las unidades, el símbolo del basculamiento, las líneas y, al final, los trozos extra de las capas.
// Las cajas se calculan con el tamaño de letra del celular (el más grande), así tampoco se enciman en
// pantallas grandes, donde la letra es menor. Módulo puro: sin DOM.

import { distanciaAlBorde } from '../motor/visibilidad.js';
import { AIRE } from '../motor/modelo.js';

/** Caja de una letra (con su halo blanco), en unidades de la sección. */
export const CAJA_LETRA = Object.freeze({ ancho: 34, alto: 40 });

/** Caja del símbolo de giro del basculamiento. */
export const CAJA_SIMBOLO = Object.freeze({ ancho: 64, alto: 64 });

const MARGEN = 3; // separación mínima con el borde de la ventana
// Separación mínima entre etiquetas: suficiente para que dos letras vecinas no se lean como un par
// (p. ej. la de una discordancia junto a la de la capa de encima). Las opcionales (trozos extra de una
// capa) piden más espacio: si el lugar está justo, mejor omitirlas.
const SEPARACION = 30;
const SEPARACION_OPCIONAL = 60;

/**
 * @param {object} datos
 * @param {Array<{id: string, tipo: string, obligatoria: boolean, caja: {ancho, alto},
 *   candidatos: Array<{x, y, puntaje}>}>} datos.objetos coordenadas SVG
 * @param {Array<[{x, y}, {x, y}]>} datos.obstaculos segmentos que no se deben tapar (coordenadas SVG)
 * @param {{ancho: number, alto: number}} datos.ventana
 * @returns {{colocadas: Array<{id, tipo, x, y, caja}>, avisos: string[]}}
 */
export function colocarEtiquetas({ objetos, obstaculos, ventana }) {
  const colocadas = [];
  const avisos = [];
  const orden = [...objetos].sort((a, b) => prioridad(a) - prioridad(b) || a.candidatos.length - b.candidatos.length);

  for (const objeto of orden) {
    const candidatos = [...objeto.candidatos].sort((a, b) => b.puntaje - a.puntaje);
    let elegido = null;
    let menosMalo = null;
    const separacion = objeto.obligatoria ? SEPARACION : SEPARACION_OPCIONAL;
    for (const c of candidatos) {
      const caja = cajaEn(c, objeto.caja);
      const conflictos = contarConflictos(caja, colocadas, obstaculos, ventana, separacion);
      if (conflictos === 0) {
        elegido = c;
        break;
      }
      if (!menosMalo || conflictos < menosMalo.conflictos) menosMalo = { c, conflictos };
    }
    if (!elegido && objeto.obligatoria && menosMalo) {
      elegido = menosMalo.c;
      avisos.push(`La etiqueta ${objeto.id} (${objeto.tipo}) no cabe sin tocar algo; se colocó donde menos estorba.`);
    }
    if (!elegido && objeto.obligatoria) {
      avisos.push(`La etiqueta ${objeto.id} (${objeto.tipo}) no tiene ningún lugar posible.`);
    }
    if (elegido) {
      colocadas.push({ id: objeto.id, tipo: objeto.tipo, x: elegido.x, y: elegido.y, caja: objeto.caja });
    }
  }
  return { colocadas, avisos };
}

// Primero las unidades (necesitan su interior y a veces tienen un solo lugar); luego el símbolo del
// basculamiento (grande, pero puede ir en cualquier parte de la zona basculada); después las líneas
// (pueden ir en cualquier punto de su largo); al final, las opcionales (trozos extra de una capa).
function prioridad(objeto) {
  if (!objeto.obligatoria) return 4;
  if (objeto.tipo === 'unidad') return 1;
  return objeto.tipo === 'simbolo' ? 2 : 3;
}

function cajaEn({ x, y }, { ancho, alto }) {
  return { x0: x - ancho / 2, y0: y - alto / 2, x1: x + ancho / 2, y1: y + alto / 2 };
}

function contarConflictos(caja, colocadas, obstaculos, ventana, separacion) {
  let conflictos = 0;
  if (caja.x0 < MARGEN || caja.y0 < MARGEN || caja.x1 > ventana.ancho - MARGEN || caja.y1 > ventana.alto - MARGEN) {
    conflictos += 1;
  }
  for (const otra of colocadas) {
    const o = cajaEn(otra, otra.caja);
    if (
      caja.x0 < o.x1 + separacion && caja.x1 > o.x0 - separacion &&
      caja.y0 < o.y1 + separacion && caja.y1 > o.y0 - separacion
    ) {
      conflictos += 1;
    }
  }
  // La letra ocupa algo menos que su caja (el halo es el borde): se revisa una caja un poco reducida.
  const nucleo = { x0: caja.x0 + 3, y0: caja.y0 + 3, x1: caja.x1 - 3, y1: caja.y1 - 3 };
  for (const [a, b] of obstaculos) {
    if (segmentoTocaCaja(a, b, nucleo)) conflictos += 1;
  }
  return conflictos;
}

/** ¿El segmento a–b toca el rectángulo? (recorte de Liang–Barsky) */
export function segmentoTocaCaja(a, b, { x0, y0, x1, y1 }) {
  if (Math.max(a.x, b.x) < x0 || Math.min(a.x, b.x) > x1 || Math.max(a.y, b.y) < y0 || Math.min(a.y, b.y) > y1) {
    return false;
  }
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;
  for (const [p, q] of [
    [-dx, a.x - x0],
    [dx, x1 - a.x],
    [-dy, a.y - y0],
    [dy, y1 - a.y],
  ]) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
      if (t0 > t1) return false;
    }
  }
  return true;
}

/** ¿Se enciman dos etiquetas colocadas? (para las pruebas) */
export function seEnciman(a, b) {
  const p = cajaEn(a, a.caja);
  const q = cajaEn(b, b.caja);
  return p.x0 < q.x1 && p.x1 > q.x0 && p.y0 < q.y1 && p.y1 > q.y0;
}

// ───────────────────────── Candidatos ─────────────────────────

/**
 * Candidatos dentro de una región de la cuadrícula (un trozo de unidad, o la zona basculada):
 * celdas alejadas del borde, repartidas, con más puntaje cuanto más adentro y más cerca del centro.
 * @param {object} cuadricula
 * @param {Float32Array} distancia transformada de distancia de la cuadrícula
 * @param {number[]} celdas índices k de la región
 * @param {number} [cantidad] máximo de candidatos
 */
export function candidatosEnRegion(cuadricula, distancia, celdas, cantidad = 30) {
  const { columnas: n, paso } = cuadricula;
  let maxima = 0;
  let sumaX = 0;
  let sumaY = 0;
  for (const k of celdas) {
    maxima = Math.max(maxima, distancia[k]);
    sumaX += k % n;
    sumaY += Math.floor(k / n);
  }
  const centro = { x: sumaX / celdas.length, y: sumaY / celdas.length };
  const radio = Math.max(1, Math.sqrt(celdas.length / Math.PI));
  const puntuadas = [];
  for (const k of celdas) {
    if (distancia[k] < 0.5 * maxima) continue;
    const i = k % n;
    const j = Math.floor(k / n);
    const lejania = Math.hypot(i - centro.x, j - centro.y) / radio;
    puntuadas.push({
      x: (i + 0.5) * paso,
      y: (j + 0.5) * paso,
      puntaje: distancia[k] / Math.max(maxima, 1) - 0.35 * Math.min(lejania, 1.5),
    });
  }
  puntuadas.sort((a, b) => b.puntaje - a.puntaje);
  // Se reparten: cada candidato a más de 18 unidades de los ya elegidos.
  const elegidos = [];
  for (const c of puntuadas) {
    if (elegidos.every((e) => Math.hypot(e.x - c.x, e.y - c.y) > 18)) elegidos.push(c);
    if (elegidos.length >= cantidad) break;
  }
  return elegidos;
}

/** Transformada de distancia de una región binaria (1 dentro, 0 fuera) de la cuadrícula. */
export function distanciaEnRegion(cuadricula, dentro) {
  const valores = new Int16Array(cuadricula.valores.length);
  for (let k = 0; k < valores.length; k++) {
    const v = cuadricula.valores[k];
    valores[k] = v !== AIRE && dentro(v) ? 1 : 0;
  }
  return { valores, distancia: distanciaAlBorde({ ...cuadricula, valores }) };
}
