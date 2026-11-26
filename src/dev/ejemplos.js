// Página de desarrollo: secciones hechas a mano con sus evidencias y su orden (fases 1 y 2).

import { EJEMPLOS } from '../ejemplos.js';
import { seccionSVG } from '../render/seccion.js';
import { detectarEvidencias } from '../motor/evidencias.js';
import { crear, navegacion, listaDeEventos, listaDeEvidencias, bloqueDeOrden } from './comun.js';

export function paginaEjemplos(contenedor) {
  const encabezado = crear('header');
  encabezado.append(
    crear('h1', 'GeoHistoria'),
    navegacion('ejemplos'),
    crear(
      'p',
      'Secciones hechas a mano, con las evidencias que se ven y el orden que se deduce (vista de desarrollo). ' +
        'Aquí las letras siguen el orden cronológico: A es lo más antiguo.',
    ),
  );

  const galeria = crear('div');
  galeria.className = 'galeria';
  for (const ejemplo of EJEMPLOS) {
    const figura = crear('figure');
    const dibujo = crear('div');
    dibujo.className = 'dibujo';
    // El SVG lo genera nuestro propio código a partir de datos fijos (con el texto escapado).
    dibujo.innerHTML = seccionSVG(ejemplo.historia, { titulo: `${ejemplo.titulo}. ${ejemplo.descripcion}` });

    const { ids, aristas } = detectarEvidencias(ejemplo.historia);
    const pie = crear('figcaption');
    pie.append(
      crear('h2', ejemplo.titulo),
      crear('p', ejemplo.descripcion),
      crear('h3', 'Historia (del más antiguo al más joven)'),
      listaDeEventos(ejemplo.historia),
      crear('h3', `Evidencias que se ven (${aristas.length})`),
      listaDeEvidencias(aristas),
      crear('h3', 'Orden que se deduce'),
      ...bloqueDeOrden(ids, aristas),
    );
    figura.append(dibujo, pie);
    galeria.append(figura);
  }
  contenedor.append(encabezado, galeria);
}
