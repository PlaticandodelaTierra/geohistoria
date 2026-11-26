// Render de una sección con estilo de libro de texto: muestreo del modelo en una cuadrícula →
// contornos (d3-contour) → SVG.
//
// - Unidades rellenas con su patrón de litología (que sigue la estratificación).
// - Fallas en línea gruesa con un par de medias flechas que muestran el movimiento relativo.
// - Discordancias en línea ondulada.
// - Basculamientos marcados con una flecha de giro y su letra.
// - Letras colocadas sin encimarse (render/etiquetas.js).
//
// Devuelve el SVG como texto (sin DOM), para poder probarlo, insertarlo en la página o exportarlo.

import { contours } from 'd3-contour';
import { crearModelo, VENTANA, AIRE, inclinacionActual } from '../motor/modelo.js';
import { planoDe } from '../motor/eventos.js';
import { muestrear, trazaVisible, trozosConCeldas, distanciaAlBorde, PASO } from '../motor/visibilidad.js';
import { idDePatron, definicionDePatron, COLORES } from './patrones.js';
import {
  colocarEtiquetas,
  candidatosEnRegion,
  distanciaEnRegion,
  segmentoTocaCaja,
  CAJA_LETRA,
  CAJA_SIMBOLO,
} from './etiquetas.js';

export { COLORES };

/** Trozos de una capa más grandes que esto (unidades²) llevan su propia letra, además de la principal. */
export const AREA_PARA_ETIQUETA_EXTRA = 8000;

// Ondulación de las discordancias (solo dibujo: sigue la superficie de erosión real).
const ONDA = Object.freeze({ amplitud: 3.5, longitud: 24 });

// Fuente de las letras: Helvetica (o Arial), que también usan el PNG y el PDF.
const FUENTE = 'Helvetica, Arial, sans-serif';

// Medias flechas de las fallas.
const FLECHA = Object.freeze({ separacion: 16, largo: 34, punta: 9, abertura: 6 });

/**
 * Genera el SVG de una sección.
 * @param {object[]} historia eventos del más antiguo al más joven
 * @param {{paso?: number, titulo?: string, interactiva?: boolean}} opciones
 * @returns {string}
 */
export function seccionSVG(historia, opciones = {}) {
  return componerSeccion(historia, opciones).svg;
}

/**
 * Igual que seccionSVG, pero devuelve también dónde quedaron las etiquetas y las medias flechas
 * (para las pruebas) y los avisos de etiquetas que no cupieron.
 * Con `interactiva: false` (para exportar a PNG o PDF) se omiten las franjas invisibles para el cursor.
 * Con `fondoDeLetras: true` (para el PDF) cada letra lleva un recuadro blanco detrás en lugar del halo de
 * trazo: svg2pdf no escala el grosor del trazo del texto y el halo saldría como una burbuja enorme.
 */
export function componerSeccion(
  historia,
  { paso = PASO, titulo = 'Sección geológica', interactiva = true, fondoDeLetras = false } = {},
) {
  const modelo = crearModelo(historia);
  const { eventos } = modelo;
  const cuadricula = muestrear(modelo, paso);
  const aSVG = ({ x, z }) => ({ x, y: VENTANA.alto - z });

  // ── Unidades con su patrón ──
  const patrones = new Map();
  const unidades = contornosPorUnidad(cuadricula).map(({ indice, d }) => {
    const evento = eventos[indice];
    const inclinacion = evento.tipo === 'deposito' ? inclinacionActual(eventos, indice) : 0;
    const id = idDePatron(evento.litologia, inclinacion);
    if (!patrones.has(id)) patrones.set(id, definicionDePatron(evento.litologia, inclinacion));
    return `<path class="unidad" data-id="${escapar(evento.id)}" fill="url(#${id})" fill-rule="evenodd" d="${d}"/>`;
  });

  // ── Trazas de fallas y discordancias ──
  const trazas = []; // {k, evento, tramos: [{muestras, puntos (SVG)}]}
  eventos.forEach((evento, k) => {
    if (evento.tipo !== 'falla' && evento.tipo !== 'erosion') return;
    const tramos = trazaVisible(modelo, k, paso).map((tramo) => {
      // Falla: cada tramo es recto (transformaciones rígidas). Erosión: un punto cada 2 unidades.
      const muestras =
        evento.tipo === 'falla'
          ? [tramo.muestras[0], tramo.muestras[tramo.muestras.length - 1]]
          : tramo.muestras.filter((_, i) => i % 4 === 0 || i === tramo.muestras.length - 1);
      return { muestrasCompletas: tramo.muestras, puntos: muestras.map((m) => aSVG(m.presente)) };
    });
    if (tramos.length > 0) trazas.push({ k, evento, tramos });
  });

  const lineas = [];
  const zonas = [];
  const segmentosPorEvento = new Map();
  for (const { evento, tramos } of trazas) {
    const segmentos = [];
    for (const { puntos } of tramos) {
      const dibujados = evento.tipo === 'erosion' ? ondular(puntos) : puntos;
      const clase = evento.tipo === 'falla' ? 'falla' : 'discordancia';
      const grosor = evento.tipo === 'falla' ? 4 : 3;
      lineas.push(
        `<polyline class="${clase}" data-id="${escapar(evento.id)}" stroke-width="${grosor}" ` +
          `points="${puntosSVG(dibujados)}"/>`,
      );
      zonas.push(`<polyline class="zona" data-id="${escapar(evento.id)}" points="${puntosSVG(puntos)}"/>`);
      for (let i = 1; i < dibujados.length; i++) segmentos.push([dibujados[i - 1], dibujados[i]]);
    }
    segmentosPorEvento.set(evento.id, segmentos);
  }

  // ── Medias flechas de las fallas ──
  const flechas = [];
  const datosDeFlechas = [];
  for (const traza of trazas) {
    if (traza.evento.tipo !== 'falla') continue;
    const otros = [...segmentosPorEvento].filter(([id]) => id !== traza.evento.id).flatMap(([, s]) => s);
    const par = mediasFlechas(modelo, traza, [...otros, ...flechas.flatMap((f) => f.segmentos)]);
    if (!par) continue;
    flechas.push(par);
    datosDeFlechas.push({ id: traza.evento.id, ...par.datos });
  }

  // ── Etiquetas ──
  const obstaculos = [...[...segmentosPorEvento.values()].flat(), ...flechas.flatMap((f) => f.segmentos)];
  const objetos = [
    ...objetosDeUnidades(cuadricula, eventos),
    ...objetosDeLineas(trazas),
    ...objetosDeBasculamientos(cuadricula, eventos),
  ];
  const { colocadas, avisos } = colocarEtiquetas({ objetos, obstaculos, ventana: VENTANA });
  const halos = [];
  const letras = [];
  const simbolos = [];
  for (const etiqueta of colocadas) {
    if (etiqueta.tipo === 'simbolo') {
      const evento = eventos.find((e) => e.id === etiqueta.id);
      simbolos.push(simboloDeBasculamiento(evento, etiqueta, fondoDeLetras));
    } else {
      halos.push(fondoDeLetras ? recuadroSVG(etiqueta.id, etiqueta.x, etiqueta.y) : textoSVG(etiqueta.id, etiqueta.x, etiqueta.y));
      letras.push(textoSVG(etiqueta.id, etiqueta.x, etiqueta.y, fondoDeLetras));
    }
  }

  const { ancho, alto } = VENTANA;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" class="seccion" viewBox="0 0 ${ancho} ${alto}" role="img" ` +
      `aria-label="${escapar(titulo)}">`,
    `<title>${escapar(titulo)}</title>`,
    `<defs>${[...patrones.values()].join('')}</defs>`,
    `<g class="unidades" stroke="#333" stroke-width="1.2" stroke-linejoin="round">${unidades.join('')}</g>`,
    `<g class="trazas" fill="none" stroke="#111" stroke-linecap="round" stroke-linejoin="round">${lineas.join('')}</g>`,
    `<g class="flechas" fill="none" stroke="#111" stroke-width="2.5" stroke-linecap="round" ` +
      `stroke-linejoin="round">${flechas.map((f) => f.svg).join('')}</g>`,
    `<g class="simbolos" font-family="${FUENTE}" font-size="22" font-weight="700" ` +
      `text-anchor="middle">${simbolos.join('')}</g>`,
    `<g class="etiquetas" font-family="${FUENTE}" font-size="28" font-weight="700" text-anchor="middle">` +
      `<g class="halos" fill="#fff" stroke="#fff" stroke-width="6" stroke-linejoin="round">${halos.join('')}</g>` +
      `<g class="letras" fill="#111">${letras.join('')}</g></g>`,
    `<rect class="marco" x="0" y="0" width="${ancho}" height="${alto}" fill="none" stroke="#111" stroke-width="2"/>`,
    interactiva
      ? `<g class="zonas" fill="none" stroke="#000" stroke-opacity="0" stroke-width="22" pointer-events="stroke">` +
        `${zonas.join('')}</g>`
      : '',
    `</svg>`,
  ].join('');

  return { svg, etiquetas: colocadas, flechas: datosDeFlechas, avisos };
}

// ───────────────────────── Contornos ─────────────────────────

// Un MultiPolygon por unidad visible, convertido a trayectoria SVG.
function contornosPorUnidad({ columnas, filas, paso, valores }) {
  const indices = [...new Set(valores)].filter((i) => i !== AIRE).sort((a, b) => a - b);
  const generador = contours().size([columnas, filas]).thresholds([0.5]);
  const binario = new Float64Array(valores.length);
  return indices.map((indice) => {
    for (let n = 0; n < valores.length; n++) {
      binario[n] = valores[n] === indice ? 1 : 0;
    }
    const [multipoligono] = generador(binario);
    return { indice, d: trayectoria(multipoligono.coordinates, paso) };
  });
}

// Las coordenadas de d3-contour van de 0 a columnas/filas; se escalan por el paso.
function trayectoria(poligonos, escala) {
  let d = '';
  for (const poligono of poligonos) {
    for (const anillo of poligono) {
      d += 'M' + anillo.map(([x, y]) => `${redondear(x * escala)},${redondear(y * escala)}`).join('L') + 'Z';
    }
  }
  return d;
}

// ───────────────────────── Discordancias onduladas ─────────────────────────

// Desplaza cada punto a lo largo de la normal según una onda senoidal medida sobre la línea.
function ondular(puntos, { amplitud, longitud } = ONDA) {
  let recorrido = 0;
  return puntos.map((p, i) => {
    if (i > 0) recorrido += Math.hypot(p.x - puntos[i - 1].x, p.y - puntos[i - 1].y);
    const a = puntos[Math.max(0, i - 1)];
    const b = puntos[Math.min(puntos.length - 1, i + 1)];
    const largo = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const normal = { x: -(b.y - a.y) / largo, y: (b.x - a.x) / largo };
    const onda = amplitud * Math.sin((2 * Math.PI * recorrido) / longitud);
    return { x: p.x + onda * normal.x, y: p.y + onda * normal.y };
  });
}

// ───────────────────────── Medias flechas ─────────────────────────

/**
 * Par de medias flechas a ambos lados de una falla, paralelas a ella: la del bloque de techo apunta en
 * el sentido de su movimiento (abajo si es normal, arriba si es inversa) y la del bloque de piso al revés.
 * El sentido se toma del modelo (el vector de deslizamiento llevado al presente), así sale bien aunque la
 * falla se haya basculado después. Se busca un lugar del tramo más largo donde no toquen otras líneas.
 */
function mediasFlechas(modelo, { k, evento, tramos }, otrasLineas) {
  const tramo = tramos.reduce((a, b) => (b.muestrasCompletas.length > a.muestrasCompletas.length ? b : a));
  const { normal, abajo } = planoDe(evento);
  const sentido = evento.tipoFalla === 'normal' ? 1 : -1;
  const eps = 10;
  for (const fraccion of [0.5, 0.38, 0.62, 0.28, 0.72, 0.2, 0.8]) {
    const m = tramo.muestrasCompletas[Math.round((tramo.muestrasCompletas.length - 1) * fraccion)];
    const enPresente = (v) => {
      const q = modelo.alPresente(k, { x: m.original.x + eps * v.x, z: m.original.z + eps * v.z });
      return unitario({ x: q.x - m.presente.x, y: -(q.z - m.presente.z) });
    };
    const lado = enPresente(normal); // hacia el bloque de techo (coordenadas SVG)
    const movimiento = enPresente({ x: sentido * abajo.x, z: sentido * abajo.z }); // del bloque de techo
    const centro = { x: m.presente.x, y: VENTANA.alto - m.presente.z };
    const techo = flecha(desplazar(centro, lado, FLECHA.separacion), movimiento, lado);
    const piso = flecha(desplazar(centro, lado, -FLECHA.separacion), escalar(movimiento, -1), escalar(lado, -1));
    const segmentos = [...techo.segmentos, ...piso.segmentos];
    const dentro = segmentos.flat().every((p) => p.x > 4 && p.x < VENTANA.ancho - 4 && p.y > 4 && p.y < VENTANA.alto - 4);
    if (!dentro) continue;
    const caja = cajaDe(segmentos.flat(), 4);
    if (otrasLineas.some(([a, b]) => segmentoTocaCaja(a, b, caja))) continue;
    return {
      svg: `<path class="flecha" data-id="${escapar(evento.id)}" d="${techo.d}${piso.d}"/>`,
      segmentos,
      datos: { centro, lado, movimiento, techo: techo.datos, piso: piso.datos },
    };
  }
  return null;
}

// Media flecha centrada en `centro`, en la dirección `dir`, con su única barba hacia `afuera`.
function flecha(centro, dir, afuera) {
  const mitad = FLECHA.largo / 2;
  const cola = desplazar(centro, dir, -mitad);
  const punta = desplazar(centro, dir, mitad);
  const barba = desplazar(desplazar(punta, dir, -FLECHA.punta), afuera, FLECHA.abertura);
  const r = redondear;
  return {
    d: `M${r(cola.x)},${r(cola.y)}L${r(punta.x)},${r(punta.y)}L${r(barba.x)},${r(barba.y)}`,
    segmentos: [
      [cola, punta],
      [punta, barba],
    ],
    datos: { centro, direccion: dir },
  };
}

// ───────────────────────── Etiquetas ─────────────────────────

// Unidades: una letra obligatoria en su trozo más grande y otra en cada trozo grande adicional.
function objetosDeUnidades(cuadricula, eventos) {
  const distancia = distanciaAlBorde(cuadricula);
  const porUnidad = new Map();
  for (const trozo of trozosConCeldas(cuadricula)) {
    if (!porUnidad.has(trozo.indice)) porUnidad.set(trozo.indice, []);
    porUnidad.get(trozo.indice).push(trozo);
  }
  const objetos = [];
  for (const [indice, trozos] of porUnidad) {
    trozos.sort((a, b) => b.area - a.area);
    trozos.forEach((trozo, i) => {
      if (i > 0 && trozo.area < AREA_PARA_ETIQUETA_EXTRA) return;
      objetos.push({
        id: eventos[indice].id,
        tipo: 'unidad',
        obligatoria: i === 0,
        caja: CAJA_LETRA,
        candidatos: candidatosEnRegion(cuadricula, distancia, trozo.celdas),
      });
    });
  }
  return objetos;
}

// Fallas y discordancias: candidatos a ambos lados de la línea, a lo largo de sus tramos.
function objetosDeLineas(trazas) {
  return trazas.map(({ evento, tramos }) => {
    const masLargo = Math.max(...tramos.map(({ puntos }) => largo(puntos)));
    const separacion = CAJA_LETRA.ancho / 2 + 10 + (evento.tipo === 'erosion' ? ONDA.amplitud : 0);
    const candidatos = [];
    for (const { puntos } of tramos) {
      const peso = largo(puntos) / masLargo;
      for (const fraccion of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.12, 0.88]) {
        const { punto, normal } = puntoYNormal(puntos, fraccion);
        for (const signo of [1, -1]) {
          const n = escalar(normal, signo);
          // Preferencia suave: a la derecha de las fallas y arriba de las discordancias.
          const preferido = evento.tipo === 'falla' ? n.x > 0 : n.y < 0;
          candidatos.push({
            ...desplazar(punto, n, separacion),
            puntaje: 1 - Math.abs(fraccion - 0.5) + (preferido ? 0.15 : 0) + 0.3 * peso,
          });
        }
      }
    }
    return { id: evento.id, tipo: 'linea', obligatoria: true, caja: CAJA_LETRA, candidatos };
  });
}

// Basculamientos: el símbolo va sobre las unidades anteriores a él (las que quedaron basculadas).
function objetosDeBasculamientos(cuadricula, eventos) {
  const objetos = [];
  eventos.forEach((evento, t) => {
    if (evento.tipo !== 'basculamiento') return;
    const { valores, distancia } = distanciaEnRegion(cuadricula, (v) => v < t);
    const celdas = [];
    for (let k = 0; k < valores.length; k++) if (valores[k] === 1) celdas.push(k);
    if (celdas.length === 0) return;
    objetos.push({
      id: evento.id,
      tipo: 'simbolo',
      obligatoria: true,
      caja: CAJA_SIMBOLO,
      candidatos: candidatosEnRegion(cuadricula, distancia, celdas, 40),
    });
  });
  return objetos;
}

// Flecha de giro alrededor de la letra: horaria si las capas quedaron buzando a la derecha.
function simboloDeBasculamiento(evento, { x, y }, lineaBaseFija = false) {
  const radio = 19;
  const inicio = (120 * Math.PI) / 180;
  const fin = inicio + (270 * Math.PI) / 180;
  const punto = (angulo) => ({ x: radio * Math.cos(angulo), y: radio * Math.sin(angulo) });
  const a = punto(inicio);
  const b = punto(fin);
  // Punta de flecha en el final del arco, en la dirección del giro (horaria en coordenadas SVG).
  const tangente = { x: -Math.sin(fin), y: Math.cos(fin) };
  const radial = { x: Math.cos(fin), y: Math.sin(fin) };
  const punta = { x: b.x + 9 * tangente.x, y: b.y + 9 * tangente.y };
  const base1 = { x: b.x + 6 * radial.x - 2 * tangente.x, y: b.y + 6 * radial.y - 2 * tangente.y };
  const base2 = { x: b.x - 6 * radial.x - 2 * tangente.x, y: b.y - 6 * radial.y - 2 * tangente.y };
  const r = redondear;
  const espejo = evento.sentido === 'izquierda' ? ' transform="scale(-1 1)"' : '';
  return (
    `<g class="simbolo" data-id="${escapar(evento.id)}" transform="translate(${r(x)} ${r(y)})">` +
    `<circle r="28" fill="#fff" fill-opacity="0.92" stroke="#111" stroke-width="1.5"/>` +
    `<g${espejo}>` +
    `<path d="M${r(a.x)},${r(a.y)} A${radio},${radio} 0 1 1 ${r(b.x)},${r(b.y)}" fill="none" stroke="#111" ` +
    `stroke-width="2.5"/>` +
    `<path d="M${r(punta.x)},${r(punta.y)} L${r(base1.x)},${r(base1.y)} L${r(base2.x)},${r(base2.y)} Z" fill="#111"/>` +
    `</g>` +
    (lineaBaseFija
      ? `<text fill="#111" y="8">${escapar(evento.id)}</text>`
      : `<text fill="#111" dy="0.35em">${escapar(evento.id)}</text>`) +
    `</g>`
  );
}

// ───────────────────────── Utilidades ─────────────────────────

// Punto a una fracción del largo de una polilínea y su normal unitaria (coordenadas SVG).
function puntoYNormal(puntos, fraccion) {
  const objetivo = largo(puntos) * fraccion;
  let recorrido = 0;
  for (let i = 1; i < puntos.length; i++) {
    const a = puntos[i - 1];
    const b = puntos[i];
    const tramo = Math.hypot(b.x - a.x, b.y - a.y);
    if (recorrido + tramo >= objetivo || i === puntos.length - 1) {
      const t = tramo > 0 ? Math.min(1, (objetivo - recorrido) / tramo) : 0;
      const direccion = unitario({ x: b.x - a.x, y: b.y - a.y });
      return {
        punto: { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) },
        normal: { x: -direccion.y, y: direccion.x },
      };
    }
    recorrido += tramo;
  }
  return { punto: puntos[0], normal: { x: 0, y: -1 } };
}

function largo(puntos) {
  let total = 0;
  for (let i = 1; i < puntos.length; i++) total += Math.hypot(puntos[i].x - puntos[i - 1].x, puntos[i].y - puntos[i - 1].y);
  return total;
}

function cajaDe(puntos, margen) {
  const xs = puntos.map((p) => p.x);
  const ys = puntos.map((p) => p.y);
  return {
    x0: Math.min(...xs) - margen,
    y0: Math.min(...ys) - margen,
    x1: Math.max(...xs) + margen,
    y1: Math.max(...ys) + margen,
  };
}

const desplazar = (p, v, d) => ({ x: p.x + d * v.x, y: p.y + d * v.y });
const escalar = (v, f) => ({ x: v.x * f, y: v.y * f });
function unitario(v) {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
}

function puntosSVG(puntos) {
  return puntos.map(({ x, y }) => `${redondear(x)},${redondear(y)}`).join(' ');
}

// Recuadro blanco detrás de una letra (alternativa al halo de trazo, para el PDF).
function recuadroSVG(id, x, y) {
  const ancho = 26;
  const alto = 32;
  return (
    `<rect data-id="${escapar(id)}" x="${redondear(x - ancho / 2)}" y="${redondear(y - alto / 2)}" ` +
    `width="${ancho}" height="${alto}" rx="6" fill="#fff" fill-opacity="0.88" stroke="none"/>`
  );
}

// Las etiquetas llevan data-id para poder resaltarlas junto con su unidad. La letra se centra en (x, y)
// con dy="0.35em"; con `lineaBaseFija` (para el PDF: svg2pdf no interpreta bien ese dy) la línea base se
// calcula con el tamaño de letra de escritorio (28 → 0.35 × 28 ≈ 10).
function textoSVG(texto, x, y, lineaBaseFija = false) {
  const vertical = lineaBaseFija ? `y="${redondear(y + 10)}"` : `y="${redondear(y)}" dy="0.35em"`;
  return `<text data-id="${escapar(texto)}" x="${redondear(x)}" ${vertical}>${escapar(texto)}</text>`;
}

function redondear(valor) {
  return Math.round(valor * 10) / 10;
}

function escapar(texto) {
  return String(texto)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
