// Página #principios: cada principio con su autor, una explicación corta y un esquema generado por el
// motor, con lo que se ve en él. #principios?p=superposicion lleva directo a ese principio.

import { PRINCIPIOS_GEOLOGICOS } from '../principios.js';
import { seccionSVG } from '../render/seccion.js';
import { detectarEvidencias } from '../motor/evidencias.js';
import { TEXTOS as T, PRINCIPIOS, idioma } from '../i18n.js';
import { elemento, encabezado, leyenda, describirSeccion } from './comun.js';

/** Evidencias de un esquema que ilustran su principio. */
export function evidenciasDelPrincipio(principio) {
  const { aristas } = detectarEvidencias(principio.historia);
  return aristas.filter(
    (a) =>
      principio.principiosQueSeVen.includes(a.principio) &&
      (!principio.soloEvidencias || principio.soloEvidencias.includes(a.evidencia)),
  );
}

export function paginaPrincipios(contenedor, parametros) {
  const TP = T.principios;
  contenedor.append(encabezado('principios'), elemento('h2', null, TP.titulo), elemento('p', 'explicacion', TP.explicacion));
  const indice = elemento('nav', 'indice-principios');
  indice.setAttribute('aria-label', TP.titulo);
  const lista = elemento('div', 'principios');
  for (const principio of PRINCIPIOS_GEOLOGICOS) {
    const enlace = elemento('a', null, principio.titulo[idioma()]);
    enlace.href = `#principios?p=${principio.id}`;
    indice.append(enlace);
    lista.append(articulo(principio));
  }
  contenedor.append(indice, lista);

  const pedido = parametros.get('p');
  if (pedido) {
    // Después de dibujar, se lleva la vista (y el foco) al principio pedido.
    requestAnimationFrame(() => {
      const destino = document.getElementById(`principio-${pedido}`);
      if (destino) {
        destino.scrollIntoView({ block: 'start' });
        destino.querySelector('h3')?.focus({ preventScroll: true });
      }
    });
  }
}

function articulo(principio) {
  const TP = T.principios;
  const cual = idioma();
  const seccion = elemento('article', 'principio-tarjeta');
  seccion.id = `principio-${principio.id}`;
  const titulo = elemento('h3', null, principio.titulo[cual]);
  titulo.tabIndex = -1;
  const figura = elemento('figure', 'seccion-practica');
  // SVG generado por nuestro propio código a partir de datos fijos (con el texto escapado).
  figura.innerHTML = seccionSVG(principio.historia, {
    titulo: `${principio.titulo[cual]}. ${describirSeccion(principio.historia)}`,
    interactiva: false,
  });
  figura.append(leyenda(principio.historia));

  const texto = elemento('div', 'texto-principio');
  texto.append(elemento('p', 'autor', principio.autor[cual]), elemento('p', null, principio.texto[cual]));
  const evidencias = evidenciasDelPrincipio(principio);
  if (evidencias.length > 0 || principio.nota) {
    texto.append(elemento('h4', null, TP.loQueSeVe));
    if (principio.nota) texto.append(elemento('p', null, principio.nota[cual]));
    const lista = elemento('ul', 'evidencias');
    for (const a of evidencias) {
      const item = elemento('li');
      const etiqueta = elemento('span', `principio ${a.principio}`, PRINCIPIOS[a.principio][cual]);
      item.append(etiqueta, ' ', a.explicacion[cual]);
      lista.append(item);
    }
    if (evidencias.length > 0) texto.append(lista);
  }
  const practicar = elemento('a', 'enlace-practicar', `${TP.practicar} (${T.niveles[principio.nivel].nombre})`);
  practicar.href = `#practica?n=${principio.nivel}`;
  texto.append(practicar);

  seccion.append(titulo, figura, texto);
  return seccion;
}
