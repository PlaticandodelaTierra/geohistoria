// Resultado de "Revisar" y explicaciones: cuántos eventos están en su lugar, qué evidencias contradice la
// respuesta y, si se pide, la solución con todas las evidencias.

import { TEXTOS as T, PRINCIPIOS, nombreDeTarjeta, idioma } from '../i18n.js';

/**
 * @param {object} opciones
 * @param {(ids: string[]) => void} opciones.alResaltar resalta los dos eventos de una evidencia
 * @param {() => void} opciones.alVerSolucion
 */
export function crearRevision({ alResaltar, alVerSolucion }) {
  const raiz = elemento('section', 'revision');
  raiz.setAttribute('aria-live', 'polite');

  /**
   * @param {object} datos
   * @param {object|null} datos.evaluacion resultado de evaluarRespuesta (null si no se ha revisado)
   * @param {boolean} datos.solucionVisible
   * @param {object} datos.seccion sección generada (historia, aristas, orden)
   * @param {'resultado'|'solucion'|false} [datos.enfocar] a qué título mover el foco (tras Revisar o
   *   Ver la solución), para que el lector de pantalla y el teclado sigan desde ahí
   */
  function dibujar({ evaluacion, solucionVisible, seccion, enfocar = false }) {
    raiz.replaceChildren();
    const eventos = new Map(seccion.historia.map((e) => [e.id, e]));
    let titular = null;
    let tituloSolucion = null;

    if (evaluacion?.correcta) {
      titular = elemento('h2', 'resultado correcto', T.correcto);
      raiz.append(titular, elemento('p', null, T.correctoDetalle), listaDeEvidencias(seccion.aristas));
    } else if (evaluacion) {
      titular = elemento('h2', 'resultado', T.enSuLugar(evaluacion.enSuLugar, evaluacion.posiciones.length));
      raiz.append(titular);
      if (evaluacion.contradichas.length > 0) {
        raiz.append(elemento('p', null, T.contradichas), listaDeEvidencias(evaluacion.contradichas));
      }
      raiz.append(elemento('p', null, T.sigueIntentando));
    }

    if (evaluacion && !evaluacion.correcta && !solucionVisible) {
      const boton = elemento('button', 'secundario', T.verSolucion);
      boton.type = 'button';
      boton.addEventListener('click', alVerSolucion);
      raiz.append(boton);
    }

    if (solucionVisible && !evaluacion?.correcta) {
      tituloSolucion = elemento('h2', 'resultado', T.solucion);
      const orden = elemento('ol', 'solucion');
      for (const id of [...seccion.orden].reverse()) {
        orden.append(elemento('li', null, `${id} · ${nombreDeTarjeta(eventos.get(id))}`));
      }
      raiz.append(tituloSolucion, orden, elemento('p', null, T.todasLasEvidencias), listaDeEvidencias(seccion.aristas));
    }

    const destino = enfocar === 'solucion' ? tituloSolucion : enfocar ? (titular ?? tituloSolucion) : null;
    if (destino) {
      destino.tabIndex = -1;
      destino.focus();
    }
  }

  function listaDeEvidencias(aristas) {
    const lista = elemento('ul', 'evidencias');
    for (const arista of aristas) {
      const item = elemento('li');
      // Cada principio enlaza a su explicación en la página de principios.
      const principio = elemento('a', `principio ${arista.principio}`, PRINCIPIOS[arista.principio][idioma()]);
      principio.href = `#principios?p=${arista.principio}`;
      item.append(
        elemento('strong', null, `${arista.desde} → ${arista.hacia}`),
        ' ',
        principio,
        ' ',
        arista.explicacion[idioma()],
      );
      // Al pasar el cursor por una evidencia se resaltan sus dos eventos en la sección.
      item.addEventListener('pointerenter', () => alResaltar([arista.desde, arista.hacia]));
      item.addEventListener('pointerleave', () => alResaltar([]));
      lista.append(item);
    }
    return lista;
  }

  return { elemento: raiz, dibujar };
}

function elemento(etiqueta, clase, texto) {
  const e = document.createElement(etiqueta);
  if (clase) e.className = clase;
  if (texto !== undefined) e.textContent = texto;
  return e;
}
