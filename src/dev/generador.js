// Página de desarrollo del generador: 12 secciones generadas a la vez, con su semilla.
// Ruta: #generador?nivel=2&semilla=1

import { generarSeccion, NIVELES } from '../motor/generador.js';
import { seccionSVG } from '../render/seccion.js';
import { crear, etiqueta, navegacion, listaDeEventos, listaDeEvidencias } from './comun.js';

const CANTIDAD = 12;

// Cada vez que se dibuja la página cambia este número; así se cancela un dibujo anterior a medias.
let dibujoActual = 0;

export function paginaGenerador(contenedor, parametros) {
  const nivel = NIVELES.includes(Number(parametros.get('nivel'))) ? Number(parametros.get('nivel')) : 1;
  const primera = Math.max(0, Math.floor(Number(parametros.get('semilla')) || 1));

  const encabezado = crear('header');
  encabezado.append(
    crear('h1', 'GeoHistoria'),
    navegacion('generador'),
    crear(
      'p',
      `Generador (vista de desarrollo): ${CANTIDAD} secciones seguidas a partir de una semilla. ` +
        'Las letras se asignan al azar; el orden correcto aparece debajo de cada sección.',
    ),
    controles(nivel, primera),
  );

  const galeria = crear('div');
  galeria.className = 'galeria generadas';
  contenedor.append(encabezado, galeria);

  // Se dibuja una sección por turno para que la página no se congele.
  const este = ++dibujoActual;
  let semilla = primera;
  const siguiente = () => {
    if (este !== dibujoActual || semilla >= primera + CANTIDAD) return;
    galeria.append(tarjeta(semilla, nivel));
    semilla += 1;
    setTimeout(siguiente, 0);
  };
  siguiente();
}

function controles(nivel, primera) {
  const formulario = crear('form');
  formulario.className = 'controles';

  const selector = crear('select');
  selector.name = 'nivel';
  for (const n of NIVELES) {
    const opcion = crear('option', `Nivel ${n}`);
    opcion.value = String(n);
    opcion.selected = n === nivel;
    selector.append(opcion);
  }
  const etiquetaNivel = crear('label', 'Nivel ');
  etiquetaNivel.append(selector);

  const entrada = crear('input');
  entrada.type = 'number';
  entrada.name = 'semilla';
  entrada.min = '0';
  entrada.step = '1';
  entrada.value = String(primera);
  const etiquetaSemilla = crear('label', 'Primera semilla ');
  etiquetaSemilla.append(entrada);

  const generar = crear('button', 'Generar');
  generar.type = 'submit';
  const siguientes = crear('button', `Siguientes ${CANTIDAD}`);
  siguientes.type = 'button';

  const ir = (semilla) => {
    location.hash = `generador?nivel=${selector.value}&semilla=${semilla}`;
  };
  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    ir(Math.max(0, Math.floor(Number(entrada.value) || 0)));
  });
  siguientes.addEventListener('click', () => ir(primera + CANTIDAD));
  selector.addEventListener('change', () => ir(primera));

  formulario.append(etiquetaNivel, etiquetaSemilla, generar, siguientes);
  return formulario;
}

function tarjeta(semilla, nivel) {
  const figura = crear('figure');
  const inicio = performance.now();
  const seccion = generarSeccion(semilla, nivel);
  const milisegundos = Math.round(performance.now() - inicio);
  const { historia, aristas, orden, intentos, avisos, semillaUsada } = seccion;

  const dibujo = crear('div');
  dibujo.className = 'dibujo';
  // El SVG lo genera nuestro propio código (con el texto escapado).
  dibujo.innerHTML = seccionSVG(historia, { titulo: `Sección generada, semilla ${semilla}, nivel ${nivel}` });

  const pie = crear('figcaption');
  const datos = crear(
    'p',
    `Semilla ${semilla} · nivel ${nivel} · ${historia.length} eventos · ` +
      `${intentos} ${intentos === 1 ? 'intento' : 'intentos'} · ${milisegundos} ms`,
  );
  datos.className = 'datos';
  pie.append(datos);

  if (avisos.length > 0) {
    if (import.meta.env.DEV) console.warn(...avisos);
    const alerta = crear('p', `${avisos.join(' ')} (semilla usada: ${semillaUsada})`);
    alerta.className = 'alerta';
    pie.append(alerta);
  }

  const respuesta = crear('p', `Orden correcto: ${orden.join(' → ')}`);
  respuesta.className = 'orden';
  respuesta.append(' ', etiqueta('orden único'));
  pie.append(respuesta);

  const detalles = crear('details');
  detalles.append(
    crear('summary', `Historia y evidencias (${aristas.length})`),
    crear('h3', 'Historia (del más antiguo al más joven)'),
    listaDeEventos(historia),
    crear('h3', `Evidencias que se ven (${aristas.length})`),
    listaDeEvidencias(aristas),
  );
  pie.append(detalles);

  figura.append(dibujo, pie);
  return figura;
}
