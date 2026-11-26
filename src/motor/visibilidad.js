// Geometría visible de una sección: lo que se dibuja y, por lo tanto, lo único que se puede observar.
//
// El render (render/seccion.js) dibuja exactamente esto y las evidencias (evidencias.js) lo analizan,
// así ninguna relación depende de algo que no aparezca en la figura.
// Módulo puro: sin DOM y sin Math.random.

import { VENTANA, AIRE } from './modelo.js';
import { alturaErosion, planoDe, aplicar, ladoDeFalla } from './eventos.js';

/** Separación de la cuadrícula de muestreo, en unidades de la sección. */
export const PASO = 2;

// Largo del tramo de plano o superficie que se muestrea en el marco del evento (de −LARGO a +LARGO).
const LARGO = 1500;

/**
 * Muestrea el modelo en el centro de cada celda. La fila 0 es la de arriba (como en SVG).
 * @returns {{columnas: number, filas: number, paso: number, valores: Int16Array}} índices de unidad o AIRE
 */
export function muestrear(modelo, paso = PASO) {
  const columnas = Math.round(VENTANA.ancho / paso);
  const filas = Math.round(VENTANA.alto / paso);
  const valores = new Int16Array(columnas * filas);
  for (let j = 0; j < filas; j++) {
    const z = VENTANA.alto - (j + 0.5) * paso;
    for (let i = 0; i < columnas; i++) {
      valores[j * columnas + i] = modelo.indiceEn((i + 0.5) * paso, z);
    }
  }
  return { columnas, filas, paso, valores };
}

/** Centro de la celda (i, j) en coordenadas de la sección. */
export function centroDeCelda(i, j, paso) {
  return { x: (i + 0.5) * paso, z: VENTANA.alto - (j + 0.5) * paso };
}

export function dentroDeVentana({ x, z }) {
  return x >= 0 && x <= VENTANA.ancho && z >= 0 && z <= VENTANA.alto;
}

/**
 * Tramos visibles de la traza de una falla o de una superficie de erosión (evento k).
 *
 * Se muestrea el plano (o la superficie) en el marco del evento y se lleva al presente.
 * Una muestra es visible si su "sonda" sigue siendo roca más antigua que el evento:
 * - falla: la sonda es el propio punto del plano (la falla solo se ve donde corta roca más antigua);
 * - erosión: la sonda está un paso debajo de la superficie (se ve donde sigue habiendo roca truncada).
 *
 * Cada tramo es una serie de muestras visibles consecutivas. Un tramo se corta donde la traza deja de
 * verse o donde la cruza una falla posterior (que la desplaza).
 *
 * @returns {Array<{muestras: object[], largo: number, previa: object|null, siguiente: object|null,
 *   fallaAlInicio: number, fallaAlFinal: number}>}
 *   `previa` / `siguiente`: la muestra justo antes / después del tramo (null si se acabó el muestreo);
 *   `fallaAlInicio` / `fallaAlFinal`: índice de la falla posterior que corta el tramo en ese extremo, o −1.
 *   Cada muestra: {original, sonda, presente, visible}.
 */
export function trazaVisible(modelo, k, paso = PASO) {
  const evento = modelo.eventos[k];
  const muestras = puntosDelRasgo(evento, paso).map((original) => {
    const sonda = evento.tipo === 'erosion' ? { x: original.x, z: original.z - paso } : original;
    const presente = modelo.alPresente(k, original);
    const visible = dentroDeVentana(presente) && esRocaAnterior(modelo, modelo.alPresente(k, sonda), k);
    return { original, sonda, presente, visible };
  });

  const tramos = [];
  let actual = null;
  for (let i = 0; i < muestras.length; i++) {
    const muestra = muestras[i];
    const anterior = muestras[i - 1] ?? null;
    let falla = -1;
    if (actual && muestra.visible) {
      falla = fallaQueSepara(modelo, k, anterior.original, muestra.original);
    }
    if (actual && (!muestra.visible || falla >= 0)) {
      actual.siguiente = muestra;
      actual.fallaAlFinal = falla;
      tramos.push(actual);
      actual = null;
    }
    if (muestra.visible && !actual) {
      actual = { muestras: [], previa: anterior, siguiente: null, fallaAlInicio: falla, fallaAlFinal: -1 };
    }
    if (muestra.visible) actual.muestras.push(muestra);
  }
  if (actual) tramos.push(actual);

  return tramos
    .filter((tramo) => tramo.muestras.length > 1)
    .map((tramo) => ({ ...tramo, largo: largoDe(tramo.muestras.map((m) => m.presente)) }));
}

/**
 * Índice de la primera falla posterior a k que deja a los puntos a y b (en el marco de k)
 * en bloques distintos, o −1 si ninguna los separa.
 */
export function fallaQueSepara(modelo, k, a, b) {
  const { eventos } = modelo;
  let pa = a;
  let pb = b;
  for (let m = k + 1; m < eventos.length; m++) {
    const evento = eventos[m];
    if (evento.tipo === 'falla' && ladoDeFalla(evento, pa) !== ladoDeFalla(evento, pb)) {
      return m;
    }
    pa = aplicar(evento, pa);
    pb = aplicar(evento, pb);
  }
  return -1;
}

/**
 * Distancia (en celdas) de cada celda al borde de su unidad o de la ventana: transformada de distancia
 * en dos pasadas (1 en horizontal y vertical, √2 en diagonal). Sirve para colocar etiquetas y para
 * detectar "astillas" demasiado delgadas.
 */
export function distanciaAlBorde({ columnas: n, filas: m, valores }) {
  const distancia = new Float32Array(n * m);
  for (let j = 0; j < m; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      const v = valores[k];
      const borde =
        i === 0 || j === 0 || i === n - 1 || j === m - 1 ||
        valores[k - 1] !== v || valores[k + 1] !== v || valores[k - n] !== v || valores[k + n] !== v;
      distancia[k] = borde ? 0 : Infinity;
    }
  }
  const D = Math.SQRT2;
  for (let j = 1; j < m; j++) {
    for (let i = 1; i < n - 1; i++) {
      const k = j * n + i;
      distancia[k] = Math.min(
        distancia[k], distancia[k - 1] + 1, distancia[k - n] + 1, distancia[k - n - 1] + D, distancia[k - n + 1] + D,
      );
    }
  }
  for (let j = m - 2; j >= 0; j--) {
    for (let i = n - 2; i >= 1; i--) {
      const k = j * n + i;
      distancia[k] = Math.min(
        distancia[k], distancia[k + 1] + 1, distancia[k + n] + 1, distancia[k + n + 1] + D, distancia[k + n - 1] + D,
      );
    }
  }
  return distancia;
}

/**
 * Trozos visibles: cada región conexa (vecindad de 4) de una misma unidad.
 * @returns {Array<{indice: number, area: number, grosor: number}>} área en unidades² y grosor
 *   (diámetro del círculo más grande que cabe en el trozo) en unidades de la sección.
 */
export function trozosVisibles(cuadricula) {
  const { columnas: n, filas: m, paso, valores } = cuadricula;
  const distancia = distanciaAlBorde(cuadricula);
  const visitado = new Uint8Array(n * m);
  const trozos = [];
  const pila = [];
  for (let inicio = 0; inicio < valores.length; inicio++) {
    if (visitado[inicio] || valores[inicio] === AIRE) continue;
    const indice = valores[inicio];
    let celdas = 0;
    let maxima = 0;
    visitado[inicio] = 1;
    pila.push(inicio);
    while (pila.length > 0) {
      const k = pila.pop();
      celdas += 1;
      maxima = Math.max(maxima, distancia[k]);
      const i = k % n;
      const vecinas = [i > 0 ? k - 1 : -1, i < n - 1 ? k + 1 : -1, k - n, k + n];
      for (const v of vecinas) {
        if (v >= 0 && v < valores.length && !visitado[v] && valores[v] === indice) {
          visitado[v] = 1;
          pila.push(v);
        }
      }
    }
    trozos.push({ indice, area: celdas * paso * paso, grosor: (2 * maxima + 1) * paso });
  }
  return trozos;
}

/**
 * Trozos visibles con sus celdas (para colocar etiquetas en cada trozo).
 * @returns {Array<{indice: number, celdas: number[], area: number}>} celdas = índices k de la cuadrícula
 */
export function trozosConCeldas(cuadricula) {
  const { columnas: n, paso, valores } = cuadricula;
  const visitado = new Uint8Array(valores.length);
  const trozos = [];
  for (let inicio = 0; inicio < valores.length; inicio++) {
    if (visitado[inicio] || valores[inicio] === AIRE) continue;
    const indice = valores[inicio];
    const celdas = [];
    const pila = [inicio];
    visitado[inicio] = 1;
    while (pila.length > 0) {
      const k = pila.pop();
      celdas.push(k);
      const i = k % n;
      for (const v of [i > 0 ? k - 1 : -1, i < n - 1 ? k + 1 : -1, k - n, k + n]) {
        if (v >= 0 && v < valores.length && !visitado[v] && valores[v] === indice) {
          visitado[v] = 1;
          pila.push(v);
        }
      }
    }
    trozos.push({ indice, celdas, area: celdas.length * paso * paso });
  }
  return trozos;
}

/** Largo de una polilínea de puntos {x, z}. */
export function largoDe(puntos) {
  let largo = 0;
  for (let i = 1; i < puntos.length; i++) {
    largo += Math.hypot(puntos[i].x - puntos[i - 1].x, puntos[i].z - puntos[i - 1].z);
  }
  return largo;
}

// Puntos del plano de una falla o de la superficie de una erosión, en el marco del evento.
function puntosDelRasgo(evento, paso) {
  const puntos = [];
  if (evento.tipo === 'falla') {
    const { x0, z0, abajo } = planoDe(evento);
    for (let t = -LARGO; t <= LARGO; t += paso / 2) {
      puntos.push({ x: x0 + t * abajo.x, z: z0 + t * abajo.z });
    }
  } else if (evento.tipo === 'erosion') {
    for (let x = -LARGO; x <= VENTANA.ancho + LARGO; x += paso / 2) {
      puntos.push({ x, z: alturaErosion(evento, x) });
    }
  } else {
    throw new RangeError(`Solo las fallas y las erosiones tienen traza, no ${evento.tipo}`);
  }
  return puntos;
}

function esRocaAnterior(modelo, q, k) {
  if (!dentroDeVentana(q)) return false;
  const indice = modelo.indiceEn(q.x, q.z);
  return indice !== AIRE && indice < k;
}
