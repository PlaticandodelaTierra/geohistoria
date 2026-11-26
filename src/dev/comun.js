// Piezas compartidas por las páginas de desarrollo (secciones hechas a mano y generador).

import { COLORES } from '../render/seccion.js';
import { crearGrafo, esOrdenUnico, contarOrdenes, listarOrdenes, validarRespuesta } from '../motor/orden.js';
import { PRINCIPIOS } from '../i18n.js';

export function crear(etiqueta, texto) {
  const elemento = document.createElement(etiqueta);
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

export function etiqueta(texto, clase = '') {
  const span = crear('span', texto);
  span.className = `etiqueta ${clase}`.trim();
  return span;
}

/** Barra de navegación entre las páginas de desarrollo. */
export function navegacion(actual) {
  const nav = crear('nav');
  nav.className = 'navegacion';
  nav.setAttribute('aria-label', 'Páginas de desarrollo');
  for (const [ruta, texto] of [
    ['ejemplos', 'Secciones hechas a mano'],
    ['generador', 'Generador'],
  ]) {
    const enlace = crear('a', texto);
    enlace.href = `#${ruta}`;
    if (ruta === actual) enlace.setAttribute('aria-current', 'page');
    nav.append(enlace);
  }
  return nav;
}

/** Lista de eventos del más antiguo al más joven, con su muestra de color o símbolo. */
export function listaDeEventos(historia) {
  const lista = crear('ol');
  lista.className = 'historia';
  for (const evento of historia) {
    const item = crear('li');
    item.append(muestra(evento), crear('strong', evento.id), ` · ${describir(evento)}`);
    lista.append(item);
  }
  return lista;
}

/** Lista de evidencias con su principio y su explicación. */
export function listaDeEvidencias(aristas) {
  const lista = crear('ul');
  lista.className = 'evidencias';
  for (const arista of aristas) {
    const item = crear('li');
    const principio = crear('span', PRINCIPIOS[arista.principio].es);
    principio.className = `principio ${arista.principio}`;
    item.append(crear('strong', `${arista.desde} → ${arista.hacia}`), ' ', principio, ' ', arista.explicacion.es);
    lista.append(item);
  }
  return lista;
}

/** Orden (u órdenes) que se deducen de las evidencias, y una alerta si contradicen la historia real. */
export function bloqueDeOrden(ids, aristas) {
  const grafo = crearGrafo(ids, aristas);
  const elementos = [];
  const total = contarOrdenes(grafo);
  if (total === 0) {
    elementos.push(crear('p', 'Las evidencias se contradicen (hay un ciclo): no existe un orden válido.'));
  } else if (esOrdenUnico(grafo)) {
    const p = crear('p', listarOrdenes(grafo, 1)[0].join(' → '));
    p.className = 'orden';
    p.append(' ', etiqueta('orden único'));
    elementos.push(p);
  } else {
    const p = crear('p', `Hay ${total} órdenes válidos; cualquiera se acepta como respuesta correcta:`);
    p.append(' ', etiqueta('más de un orden', 'aviso'));
    const ordenes = crear('ol');
    ordenes.className = 'orden';
    for (const orden of listarOrdenes(grafo, 6)) {
      ordenes.append(crear('li', orden.join(' → ')));
    }
    elementos.push(p, ordenes);
  }
  // Control del motor: la historia real tiene que ser uno de los órdenes válidos.
  const { valida, errores } = validarRespuesta(grafo, ids);
  if (!valida) {
    const alerta = crear(
      'p',
      `Error del motor: la historia real contradice ${errores.length} evidencia(s): ` +
        errores.map((e) => `${e.antiguo} → ${e.joven}`).join(', '),
    );
    alerta.className = 'alerta';
    elementos.push(alerta);
  }
  return elementos;
}

// Cuadro de color (unidades), línea (fallas y discordancias) o símbolo (basculamiento).
function muestra(evento) {
  const span = crear('span');
  span.className = 'muestra';
  span.setAttribute('aria-hidden', 'true');
  if (evento.tipo === 'deposito' || evento.tipo === 'dique') {
    span.style.background = COLORES[evento.litologia];
  } else if (evento.tipo === 'basculamiento') {
    span.classList.add('simbolo');
    span.textContent = '↻';
  } else {
    span.classList.add('linea', evento.tipo);
  }
  return span;
}

function describir(evento) {
  const r = Math.round;
  switch (evento.tipo) {
    case 'deposito':
      return `Depósito de ${evento.litologia} (espesor ${r(evento.espesor)})`;
    case 'dique':
      return `Dique de ${evento.litologia}, echado ${r(evento.echado)}° hacia la ${evento.sentidoEchado}`;
    case 'falla':
      return (
        `Falla ${evento.tipoFalla}, echado ${r(evento.echado)}° hacia la ${evento.sentidoEchado}, ` +
        `desplazamiento ${r(evento.desplazamiento)}`
      );
    case 'basculamiento':
      return `Basculamiento de ${r(evento.angulo)}°; las capas buzan hacia la ${evento.sentido}`;
    case 'erosion':
      return `Erosión / discordancia (superficie ${evento.amplitud > 0.5 ? 'ondulada' : 'plana'})`;
    default:
      return evento.tipo;
  }
}
