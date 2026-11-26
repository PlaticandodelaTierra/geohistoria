// Piezas de interfaz compartidas por las páginas: encabezado (con "Saltar al contenido", navegación y
// selector de idioma), leyenda, descripción accesible de una sección, resaltado y semillas al azar.
// Los textos se leen al dibujar, así que siguen el idioma activo.

import { TEXTOS as T, nombreDeTarjeta, idioma, IDIOMAS } from '../i18n.js';
import { muestraDePatron, muestraDeSimbolo, ORDEN_LITOLOGIAS } from '../render/patrones.js';
import { SEMILLA_MAXIMA } from './logica.js';

/** Evento que se dispara en `window` cuando el visitante elige otro idioma. */
export const EVENTO_IDIOMA = 'geohistoria:idioma';

export function elemento(etiqueta, clase, texto) {
  const e = document.createElement(etiqueta);
  if (clase) e.className = clase;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

export function boton(texto, clase = 'secundario') {
  const b = elemento('button', clase, texto);
  b.type = 'button';
  return b;
}

/** Encabezado: enlace para saltar al contenido, título, navegación entre modos y selector de idioma. */
export function encabezado(rutaActual) {
  const cabecera = elemento('header', 'cabecera');

  // Las rutas usan '#', así que "Saltar al contenido" mueve el foco con JavaScript (sin cambiar la URL).
  const saltar = elemento('a', 'saltar', T.saltar);
  saltar.href = '#';
  saltar.addEventListener('click', (evento) => {
    evento.preventDefault();
    const destino = cabecera.nextElementSibling;
    if (destino) {
      if (!destino.hasAttribute('tabindex')) destino.tabIndex = -1;
      destino.focus();
    }
  });

  const nav = elemento('nav', 'modos');
  nav.setAttribute('aria-label', T.navegacion);
  for (const [ruta, texto] of Object.entries(T.modos)) {
    const enlace = elemento('a', null, texto);
    enlace.href = `#${ruta}`;
    if (ruta === rutaActual) enlace.setAttribute('aria-current', 'page');
    nav.append(enlace);
  }

  const idiomas = elemento('div', 'idiomas');
  idiomas.setAttribute('role', 'group');
  idiomas.setAttribute('aria-label', T.idiomaSelector);
  for (const cual of IDIOMAS) {
    const b = boton(T.nombresIdiomas[cual], 'idioma');
    b.lang = cual;
    b.setAttribute('aria-pressed', String(cual === idioma()));
    b.addEventListener('click', () => {
      if (cual !== idioma()) window.dispatchEvent(new CustomEvent(EVENTO_IDIOMA, { detail: cual }));
    });
    idiomas.append(b);
  }

  const fila = elemento('div', 'fila-titulo');
  fila.append(elemento('h1', null, T.titulo), idiomas);
  cabecera.append(saltar, fila, elemento('p', 'subtitulo', T.subtitulo), nav);
  return cabecera;
}

/** Leyenda: patrón de cada litología presente y los símbolos que aparecen (falla, discordancia, giro). */
export function leyenda(historia) {
  const pie = elemento('figcaption', 'leyenda');
  pie.append(elemento('h2', 'solo-lectores', T.leyenda));
  const lista = elemento('ul');
  const litologias = new Set(historia.map((e) => e.litologia).filter(Boolean));
  for (const litologia of ORDEN_LITOLOGIAS.filter((l) => litologias.has(l))) {
    lista.append(entradaDeLeyenda(muestraDePatron(litologia), T.litologias[litologia]));
  }
  const tipos = new Set(historia.map((e) => e.tipo));
  for (const tipo of ['falla', 'erosion', 'basculamiento']) {
    if (tipos.has(tipo)) lista.append(entradaDeLeyenda(muestraDeSimbolo(tipo), T.simbolos[tipo]));
  }
  pie.append(lista);
  return pie;
}

// Las muestras son SVG generados por nuestro propio código a partir de datos fijos.
function entradaDeLeyenda(muestraSVG, texto) {
  const item = elemento('li');
  const muestra = elemento('span', 'muestra-leyenda');
  muestra.innerHTML = muestraSVG;
  item.append(muestra, elemento('span', null, texto));
  return item;
}

/** Texto alternativo de una sección: qué hay y con qué letra (sin revelar el orden). */
export function describirSeccion(historia) {
  const partes = historia.map((e) =>
    e.tipo === 'basculamiento'
      ? `${e.id}: ${nombreDeTarjeta(e).toLowerCase()}, ${T.marcadoConFlecha}`
      : `${e.id}: ${nombreDeTarjeta(e).toLowerCase()}`,
  );
  partes.sort();
  return T.descripcionSeccion(partes.join('; '));
}

/** Resalta en el SVG los elementos de los ids dados (y atenúa el resto). */
export function resaltarEnSeccion(svg, ids) {
  svg.classList.toggle('resaltando', ids.length > 0);
  for (const nodo of svg.querySelectorAll('[data-id]')) {
    nodo.classList.toggle('activo', ids.includes(nodo.dataset.id));
  }
}

/** La interfaz (no el motor) sortea las semillas de los ejercicios nuevos. */
export function semillaAlAzar() {
  return (crypto.getRandomValues(new Uint32Array(1))[0] % SEMILLA_MAXIMA) + 1;
}

/** Copia un texto al portapapeles; si no se puede, devuelve false. */
export async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}
