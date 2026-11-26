// Modo práctica (#practica): elegir nivel → sección + tarjetas → Revisar → explicaciones → Otro ejercicio.
// El nivel y la semilla van en la URL (#practica?n=2&s=48213) para compartir un ejercicio exacto.

import { generarSeccion, NIVELES } from '../motor/generador.js';
import { TEXTOS as T } from '../i18n.js';
import { leerParametros, rutaDePractica } from './logica.js';
import { crearEjercicio } from './ejercicio.js';
import { elemento, boton, encabezado, semillaAlAzar, copiar } from './comun.js';
import { descargarSVG, descargarPNG } from '../export.js';

/**
 * @param {HTMLElement} contenedor
 * @param {URLSearchParams} parametros
 */
export function paginaPractica(contenedor, parametros) {
  const { nivel, semilla } = leerParametros(parametros);
  if (nivel === null) {
    eleccionDeNivel(contenedor);
    return;
  }
  if (semilla === null) {
    // Sin semilla: se sortea una y se escribe en la URL sin crear otra entrada en el historial.
    const nueva = semillaAlAzar();
    history.replaceState(null, '', `#${rutaDePractica(nivel, nueva)}`);
    paginaPractica(contenedor, new URLSearchParams(`n=${nivel}&s=${nueva}`));
    return;
  }
  const seccion = generarSeccion(semilla, nivel);
  if (import.meta.env.DEV && seccion.avisos.length > 0) console.warn(...seccion.avisos);
  const { zona, revision, svg } = crearEjercicio(seccion);
  contenedor.append(
    encabezado('practica'),
    elemento('h2', 'solo-lectores', `${T.ejercicio} · ${T.niveles[nivel].nombre}`),
    barra(nivel, semilla, svg),
    zona,
    revision,
  );
}

function eleccionDeNivel(contenedor) {
  const lista = elemento('ul', 'niveles');
  for (const n of NIVELES) {
    const enlace = elemento('a', 'nivel');
    enlace.href = `#practica?n=${n}`;
    enlace.append(elemento('strong', null, T.niveles[n].nombre), elemento('span', null, T.niveles[n].descripcion));
    const item = elemento('li');
    item.append(enlace);
    lista.append(item);
  }
  contenedor.append(encabezado('practica'), elemento('h2', null, T.elegirNivel), lista);
}

// Nivel, semilla, copiar enlace, otro ejercicio y descargar la sección.
function barra(nivel, semilla, svg) {
  const contenedor = elemento('div', 'barra');

  const selector = elemento('select');
  for (const n of NIVELES) {
    const opcion = elemento('option', null, T.niveles[n].nombre);
    opcion.value = String(n);
    opcion.selected = n === nivel;
    selector.append(opcion);
  }
  selector.addEventListener('change', () => {
    location.hash = rutaDePractica(Number(selector.value), semillaAlAzar());
  });
  const etiqueta = elemento('label', null, `${T.nivel} `);
  etiqueta.append(selector);

  const aviso = elemento('span', 'aviso-enlace');
  aviso.setAttribute('aria-live', 'polite');
  const botonCopiar = boton(T.copiarEnlace);
  botonCopiar.addEventListener('click', async () => {
    aviso.textContent = (await copiar(location.href)) ? T.enlaceCopiado : T.enlaceNoCopiado(location.href);
  });

  const otro = boton(T.otroEjercicio);
  otro.addEventListener('click', () => {
    let nueva = semillaAlAzar();
    while (nueva === semilla) nueva = semillaAlAzar();
    location.hash = rutaDePractica(nivel, nueva);
  });

  const nombre = `geohistoria-nivel${nivel}-semilla${semilla}`;
  const botonSVG = boton(T.descargarSVG);
  botonSVG.addEventListener('click', () => descargarSVG(svg, nombre));
  const botonPNG = boton(T.descargarPNG);
  botonPNG.addEventListener('click', () => descargarPNG(svg, nombre));

  contenedor.append(
    etiqueta,
    elemento('span', 'semilla', T.semilla(semilla)),
    botonCopiar,
    otro,
    botonSVG,
    botonPNG,
    aviso,
  );
  return contenedor;
}
