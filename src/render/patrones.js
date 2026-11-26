// Patrones SVG por litología, dibujados a mano y sencillos: colores pastel MÁS patrones, para que la
// sección se lea también en blanco y negro y por personas con daltonismo.
//
// Los patrones de las rocas sedimentarias siguen la estratificación: en una capa basculada 30°, los
// ladrillos y las líneas también quedan a 30°. Los patrones ígneos no tienen orientación.

/** Colores pastel de fondo por litología. */
export const COLORES = Object.freeze({
  arenisca: '#f5e6a8',
  caliza: '#bdd8ec',
  lutita: '#cfd8c3',
  conglomerado: '#f2c7a2',
  basalto: '#a9afb7',
  granito: '#f1b9c8',
});

const TINTA = '#4a4a4a';

// Dibujo de cada patrón: tamaño de la celda y trazos dentro de ella (en unidades de la sección).
const DIBUJOS = {
  // Puntos.
  arenisca: {
    ancho: 16,
    alto: 16,
    trazos: `<circle cx="4" cy="4" r="1.5" fill="${TINTA}"/><circle cx="12" cy="12" r="1.5" fill="${TINTA}"/>`,
  },
  // Ladrillos.
  caliza: {
    ancho: 32,
    alto: 20,
    trazos: `<path d="M0,0.5H32M0,10.5H32M0.5,0.5V10.5M16.5,10.5V20.5" fill="none" stroke="${TINTA}" stroke-width="1.3"/>`,
  },
  // Líneas cortas paralelas a la estratificación.
  lutita: {
    ancho: 24,
    alto: 10,
    trazos: `<path d="M1,3H13M13,8H23" fill="none" stroke="${TINTA}" stroke-width="1.3"/>`,
  },
  // Cantos redondeados.
  conglomerado: {
    ancho: 28,
    alto: 24,
    trazos:
      `<g fill="none" stroke="${TINTA}" stroke-width="1.3">` +
      `<ellipse cx="7" cy="6" rx="4" ry="3"/><ellipse cx="20" cy="15" rx="3.5" ry="3"/>` +
      `<circle cx="9" cy="19" r="2"/></g>`,
  },
  // "v" de roca volcánica.
  basalto: {
    ancho: 24,
    alto: 20,
    trazos: `<path d="M3,3L6.5,9L10,3M15,13L18.5,19L22,13" fill="none" stroke="#2f3338" stroke-width="1.4"/>`,
  },
  // Cruces de roca plutónica.
  granito: {
    ancho: 24,
    alto: 20,
    trazos: `<path d="M3,5H9M6,2V8M15,15H21M18,12V18" fill="none" stroke="${TINTA}" stroke-width="1.4"/>`,
  },
};

const SEDIMENTARIAS = new Set(['arenisca', 'caliza', 'lutita', 'conglomerado']);

/**
 * Id del patrón de una litología con una inclinación dada (grados, positiva = buza a la izquierda).
 * Las ígneas no tienen orientación.
 */
export function idDePatron(litologia, inclinacion = 0) {
  const angulo = SEDIMENTARIAS.has(litologia) ? Math.round(inclinacion) : 0;
  return `patron-${litologia}-${angulo < 0 ? 'm' : ''}${Math.abs(angulo)}`;
}

/**
 * Definición <pattern> de una litología con su inclinación. En coordenadas SVG (y hacia abajo), unas capas
 * que buzan a la izquierda giran en sentido antihorario: rotate(−inclinación).
 */
export function definicionDePatron(litologia, inclinacion = 0) {
  const { ancho, alto, trazos } = DIBUJOS[litologia];
  const angulo = SEDIMENTARIAS.has(litologia) ? Math.round(inclinacion) : 0;
  const giro = angulo !== 0 ? ` patternTransform="rotate(${-angulo})"` : '';
  return (
    `<pattern id="${idDePatron(litologia, inclinacion)}" patternUnits="userSpaceOnUse" ` +
    `width="${ancho}" height="${alto}"${giro}>` +
    `<rect width="${ancho}" height="${alto}" fill="${COLORES[litologia]}"/>${trazos}</pattern>`
  );
}

/** Orden de las litologías en la leyenda: sedimentarias y luego ígneas. */
export const ORDEN_LITOLOGIAS = Object.freeze(['arenisca', 'caliza', 'lutita', 'conglomerado', 'basalto', 'granito']);

// Dibujo de un símbolo de la sección en una caja de 48 × 30.
function dibujoDeSimbolo(tipo) {
  if (tipo === 'falla') {
    return (
      `<g fill="none" stroke="#111" stroke-linecap="round" stroke-linejoin="round">` +
      `<path d="M14,28L34,2" stroke-width="3"/>` +
      `<path d="M30,16L37,7L37,12M18,14L11,23L11,18" stroke-width="1.8"/></g>`
    );
  }
  if (tipo === 'erosion') {
    return `<path d="M2,15Q6,10 10,15T18,15T26,15T34,15T42,15T46,15" fill="none" stroke="#111" stroke-width="2.5"/>`;
  }
  return (
    `<circle cx="24" cy="15" r="13" fill="#fff" stroke="#111" stroke-width="1"/>` +
    `<path d="M18.5,23.7A10,10 0 1 1 33.4,18.4" fill="none" stroke="#111" stroke-width="1.8"/>` +
    `<path d="M30.3,21.7L33.4,18.4L35.9,22.6Z" fill="#111"/>`
  );
}

/** Muestra pequeña de un símbolo de la sección para la leyenda: 'falla', 'erosion' o 'basculamiento'. */
export function muestraDeSimbolo(tipo) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 30" width="48" height="30" aria-hidden="true">` +
    `${dibujoDeSimbolo(tipo)}</svg>`
  );
}

/**
 * Leyenda completa en un solo SVG (para el PDF y el PNG): las litologías presentes y los símbolos que
 * aparecen, en filas de hasta `ancho` unidades.
 * @param {object[]} historia
 * @param {{falla: string, erosion: string, basculamiento: string}} nombresDeSimbolos
 * @param {object} nombresDeLitologias litología → nombre en el idioma de la leyenda
 * @returns {{svg: string, ancho: number, alto: number}}
 */
export function leyendaSVG(historia, nombresDeSimbolos, nombresDeLitologias, ancho = 1000) {
  const litologias = ORDEN_LITOLOGIAS.filter((l) => historia.some((e) => e.litologia === l));
  const tipos = ['falla', 'erosion', 'basculamiento'].filter((t) => historia.some((e) => e.tipo === t));
  const entradas = [
    ...litologias.map((l) => ({
      dibujo: `<rect x="0.5" y="0.5" width="47" height="29" fill="url(#${idDePatron(l)})" stroke="#333"/>`,
      texto: nombresDeLitologias[l],
    })),
    ...tipos.map((t) => ({ dibujo: dibujoDeSimbolo(t), texto: nombresDeSimbolos[t] })),
  ];
  const ALTO_FILA = 40;
  let x = 0;
  let y = 0;
  const partes = entradas.map(({ dibujo, texto }) => {
    const anchoEntrada = 48 + 10 + texto.length * 10.5 + 28;
    if (x > 0 && x + anchoEntrada > ancho) {
      x = 0;
      y += ALTO_FILA;
    }
    const parte =
      `<g transform="translate(${x} ${y})">${dibujo}` +
      `<text x="58" y="22">${texto.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</text></g>`;
    x += anchoEntrada;
    return parte;
  });
  // Margen inferior generoso: algunos programas (svg2pdf) colocan el texto un poco más abajo.
  const alto = y + 40;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}">` +
    `<defs>${litologias.map((l) => definicionDePatron(l)).join('')}</defs>` +
    `<g font-family="Helvetica, Arial, sans-serif" font-size="20" fill="#222">${partes.join('')}</g></svg>`;
  return { svg, ancho, alto };
}

/** Muestra pequeña de un patrón para la leyenda (SVG independiente). */
export function muestraDePatron(litologia) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 30" width="48" height="30" aria-hidden="true">` +
    `<defs>${definicionDePatron(litologia).replace(/id="[^"]+"/, `id="muestra-${litologia}"`)}</defs>` +
    `<rect x="0.5" y="0.5" width="47" height="29" fill="url(#muestra-${litologia})" stroke="#333"/></svg>`
  );
}
