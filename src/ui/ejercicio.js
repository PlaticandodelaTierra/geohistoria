// Ejercicio interactivo: sección + tarjetas + Revisar + explicaciones. Lo usan el modo práctica y el reto.

import { seccionSVG } from '../render/seccion.js';
import { crearEstado } from '../state.js';
import { TEXTOS as T } from '../i18n.js';
import {
  respuestaInicial,
  tarjetasDesdeRespuesta,
  respuestaDesdeTarjetas,
  evaluarRespuesta,
} from './logica.js';
import { crearTarjetas } from './tarjetas.js';
import { crearRevision } from './revision.js';
import { elemento, boton, leyenda, describirSeccion, resaltarEnSeccion } from './comun.js';

/**
 * @param {object} seccion sección generada (historia, aristas, orden)
 * @param {object} [ganchos]
 * @param {(evaluacion: object, tarjetas: string[]) => void} [ganchos.alRevisar] después de cada revisión
 * @param {() => void} [ganchos.alVerSolucion]
 * @returns {{zona: HTMLElement, revision: HTMLElement, svg: string}}
 *   zona: sección y tarjetas; revision: resultado y explicaciones; svg: la sección (para exportarla)
 */
export function crearEjercicio(seccion, { alRevisar = () => {}, alVerSolucion = () => {} } = {}) {
  const eventos = new Map(seccion.historia.map((e) => [e.id, e]));
  const estado = crearEstado({
    tarjetas: tarjetasDesdeRespuesta(respuestaInicial(seccion.historia)),
    evaluacion: null,
    solucionVisible: false,
    enfocarRevision: false,
    resaltados: [],
  });
  const resaltar = (ids) => {
    if (ids.join() !== estado.obtener().resaltados.join()) estado.actualizar({ resaltados: ids });
  };

  // Sección (SVG generado por nuestro propio código, con el texto escapado).
  const svgTexto = seccionSVG(seccion.historia, { titulo: describirSeccion(seccion.historia) });
  const figura = elemento('figure', 'seccion-practica');
  figura.innerHTML = svgTexto;
  const svg = figura.querySelector('svg');
  svg.addEventListener('pointerover', (evento) => {
    const id = evento.target.closest('[data-id]')?.dataset.id;
    resaltar(id ? [id] : []);
  });
  svg.addEventListener('pointerleave', () => resaltar([]));
  figura.append(leyenda(seccion.historia));

  const tarjetas = crearTarjetas({
    eventos,
    alMover: (nuevas) => estado.actualizar({ tarjetas: nuevas, evaluacion: null }),
    alResaltar: resaltar,
  });
  const revision = crearRevision({
    alResaltar: resaltar,
    alVerSolucion: () => {
      estado.actualizar({ solucionVisible: true, enfocarRevision: 'solucion' });
      alVerSolucion();
    },
  });

  const revisar = boton(T.revisar, 'principal');
  revisar.addEventListener('click', () => {
    const { tarjetas: actuales } = estado.obtener();
    const evaluacion = evaluarRespuesta(seccion, respuestaDesdeTarjetas(actuales));
    estado.actualizar({ evaluacion, enfocarRevision: 'resultado' });
    alRevisar(evaluacion, actuales);
  });

  const panel = elemento('div', 'panel');
  panel.append(elemento('p', 'instrucciones', T.instrucciones), tarjetas.elemento, revisar);
  const zona = elemento('div', 'zona-ejercicio');
  zona.append(figura, panel);

  estado.suscribir((nuevo, anterior) => {
    if (nuevo.tarjetas !== anterior.tarjetas || nuevo.evaluacion !== anterior.evaluacion) {
      tarjetas.dibujar(nuevo.tarjetas, marcas(nuevo.evaluacion));
      tarjetas.resaltar(nuevo.resaltados);
    }
    if (nuevo.evaluacion !== anterior.evaluacion || nuevo.solucionVisible !== anterior.solucionVisible) {
      revision.dibujar({ ...nuevo, seccion, enfocar: nuevo.enfocarRevision });
      if (nuevo.enfocarRevision) estado.actualizar({ enfocarRevision: false });
    }
    if (nuevo.resaltados !== anterior.resaltados) {
      resaltarEnSeccion(svg, nuevo.resaltados);
      tarjetas.resaltar(nuevo.resaltados);
    }
  });
  tarjetas.dibujar(estado.obtener().tarjetas);

  return { zona, revision: revision.elemento, svg: svgTexto };
}

// id → en su lugar, a partir de la evaluación (o null si no se ha revisado).
function marcas(evaluacion) {
  return evaluacion ? new Map(evaluacion.posiciones.map((p) => [p.id, p.correcta])) : null;
}
