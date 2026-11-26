// Lista de tarjetas ordenable: arrastrar y soltar (Pointer Events: ratón, dedo o lápiz), botones ↑ ↓ y
// teclado (Alt + ↑ / ↓ con la tarjeta enfocada). Una región "en vivo" anuncia cada movimiento.
// En pantalla, lo más joven va arriba y lo más antiguo abajo.

import { TEXTOS as T, nombreDeTarjeta } from '../i18n.js';
import { mover } from './logica.js';

// Distancia (px) que hay que mover el puntero para que empiece el arrastre (antes es solo un toque).
const UMBRAL_DE_ARRASTRE = 5;

/**
 * @param {object} opciones
 * @param {Map<string, object>} opciones.eventos id → evento
 * @param {(tarjetas: string[]) => void} opciones.alMover recibe el nuevo orden (de arriba abajo)
 * @param {(ids: string[]) => void} opciones.alResaltar ids a resaltar (vacío para quitar el resaltado)
 */
export function crearTarjetas({ eventos, alMover, alResaltar }) {
  const raiz = elemento('div', 'tarjetas');
  const lista = elemento('ol', 'lista-tarjetas');
  lista.setAttribute('aria-label', T.listaTarjetas);
  const anuncio = elemento('p', 'solo-lectores');
  anuncio.setAttribute('aria-live', 'polite');
  raiz.append(elemento('p', 'extremo', T.masJoven), lista, elemento('p', 'extremo', T.masAntiguo), anuncio);

  let actuales = [];
  let marcas = null;
  let porEnfocar = null; // {id, parte} que debe recibir el foco después de volver a dibujar
  let arrastre = null;

  function nombre(id) {
    return `${id} · ${nombreDeTarjeta(eventos.get(id))}`;
  }

  // Mueve la tarjeta `id` a la posición `hasta`, lo anuncia y avisa a la página.
  function moverA(id, hasta, parte) {
    const desde = actuales.indexOf(id);
    if (hasta < 0 || hasta >= actuales.length || hasta === desde) return;
    const nuevo = mover(actuales, desde, hasta);
    anuncio.textContent = T.movida(nombre(id), hasta + 1, nuevo.length);
    porEnfocar = { id, parte };
    alMover(nuevo);
  }

  /**
   * Dibuja las tarjetas en el orden dado (de arriba abajo).
   * @param {string[]} tarjetas
   * @param {Map<string, boolean>|null} nuevasMarcas id → en su lugar (después de revisar), o null
   */
  function dibujar(tarjetas, nuevasMarcas = null) {
    actuales = [...tarjetas];
    marcas = nuevasMarcas;
    lista.replaceChildren(...actuales.map((id, i) => tarjeta(id, i)));
    if (porEnfocar) {
      const { id, parte } = porEnfocar;
      porEnfocar = null;
      const li = lista.querySelector(`[data-id="${id}"]`);
      const boton = parte ? li?.querySelector(`.${parte}`) : null;
      (boton && !boton.disabled ? boton : li)?.focus();
    }
  }

  function tarjeta(id, posicion) {
    const total = actuales.length;
    const li = elemento('li', 'tarjeta');
    li.dataset.id = id;
    li.tabIndex = 0;
    let etiqueta = T.posicion(nombre(id), posicion + 1, total);
    const asa = elemento('span', 'asa', '⠿');
    asa.setAttribute('aria-hidden', 'true');
    const letra = elemento('span', 'letra', id);
    letra.setAttribute('aria-hidden', 'true');
    const texto = elemento('span', 'nombre', nombreDeTarjeta(eventos.get(id)));
    texto.setAttribute('aria-hidden', 'true');
    li.append(asa, letra, texto);

    if (marcas) {
      const bien = marcas.get(id);
      li.classList.add(bien ? 'bien' : 'mal');
      const marca = elemento('span', 'marca', bien ? '✓' : '✗');
      marca.setAttribute('aria-hidden', 'true');
      li.append(marca);
      etiqueta += `, ${bien ? T.bien : T.mal}`;
    }
    li.setAttribute('aria-label', etiqueta);

    const subir = boton('subir', '↑', T.subir(id), posicion === 0);
    const bajar = boton('bajar', '↓', T.bajar(id), posicion === total - 1);
    subir.addEventListener('click', () => moverA(id, actuales.indexOf(id) - 1, 'subir'));
    bajar.addEventListener('click', () => moverA(id, actuales.indexOf(id) + 1, 'bajar'));
    li.append(subir, bajar);

    li.addEventListener('keydown', (evento) => {
      if (evento.target !== li || !evento.altKey) return;
      if (evento.key === 'ArrowUp' || evento.key === 'ArrowDown') {
        evento.preventDefault();
        moverA(id, actuales.indexOf(id) + (evento.key === 'ArrowUp' ? -1 : 1), null);
      }
    });

    // Resaltado de la unidad correspondiente en la sección.
    li.addEventListener('pointerenter', () => !arrastre?.activo && alResaltar([id]));
    li.addEventListener('pointerleave', () => !arrastre?.activo && alResaltar([]));
    // focusin/focusout también cubren los botones ↑ ↓ de la tarjeta.
    li.addEventListener('focusin', () => alResaltar([id]));
    li.addEventListener('focusout', (evento) => {
      if (!li.contains(evento.relatedTarget)) alResaltar([]);
    });

    li.addEventListener('pointerdown', (evento) => empezarArrastre(evento, li));
    li.addEventListener('pointermove', (evento) => seguirArrastre(evento));
    li.addEventListener('pointerup', (evento) => terminarArrastre(evento, false));
    li.addEventListener('pointercancel', (evento) => terminarArrastre(evento, true));
    // Si el navegador quita la captura por otra razón, el arrastre termina donde iba (no queda colgado).
    li.addEventListener('lostpointercapture', (evento) => terminarArrastre(evento, false));
    return li;
  }

  // ───── Arrastrar y soltar ─────
  // Mientras se arrastra, la tarjeta se mueve dentro de la lista (el DOM se reordena) y sigue al puntero.
  // Con el dedo solo se arrastra desde el asa (⠿), para que el resto de la tarjeta deje desplazar la página.

  // La tarjeta arrastrada NO se mueve en el DOM mientras se arrastra (sacarla y volver a insertarla le
  // quitaría la captura del puntero y nunca llegaría el evento de soltar): solo se desplaza con una
  // transformación, las demás se apartan para dejarle hueco y el orden nuevo se calcula al soltar.

  function empezarArrastre(evento, li) {
    if (evento.button !== 0 || evento.target.closest('button')) return;
    if (evento.pointerType === 'touch' && !evento.target.closest('.asa')) return;
    arrastre = {
      li,
      id: li.dataset.id,
      puntero: evento.pointerId,
      inicioY: evento.clientY,
      activo: false,
      destino: actuales.indexOf(li.dataset.id),
    };
    li.setPointerCapture(evento.pointerId);
  }

  function seguirArrastre(evento) {
    if (!arrastre || evento.pointerId !== arrastre.puntero) return;
    const { li } = arrastre;
    const dy = evento.clientY - arrastre.inicioY;
    if (!arrastre.activo) {
      if (Math.abs(dy) < UMBRAL_DE_ARRASTRE) return;
      arrastre.activo = true;
      // Posiciones de todas las tarjetas al empezar (la lista no cambia hasta soltar).
      arrastre.cajas = [...lista.children].map((x) => x.getBoundingClientRect());
      arrastre.origen = [...lista.children].indexOf(li);
      const cajas = arrastre.cajas;
      // Hueco que ocupa una tarjeta: su alto más la separación con la siguiente.
      arrastre.hueco = cajas.length > 1 ? cajas[1].top - cajas[0].top : cajas[0].height;
      li.classList.add('arrastrando');
      lista.classList.add('ordenando');
      alResaltar([arrastre.id]);
    }
    evento.preventDefault();
    const { cajas, origen, hueco } = arrastre;
    // La tarjeta sigue al puntero.
    li.style.transform = `translateY(${dy}px)`;
    // Destino: cuántas de las otras tarjetas tienen su centro por encima del centro de la arrastrada.
    const centro = cajas[origen].top + cajas[origen].height / 2 + dy;
    let destino = 0;
    cajas.forEach((caja, i) => {
      if (i !== origen && caja.top + caja.height / 2 < centro) destino += 1;
    });
    arrastre.destino = destino;
    // Las tarjetas entre el origen y el destino se apartan un hueco.
    [...lista.children].forEach((otra, i) => {
      if (otra === li) return;
      let desplazamiento = 0;
      if (destino > origen && i > origen && i <= destino) desplazamiento = -hueco;
      if (destino < origen && i < origen && i >= destino) desplazamiento = hueco;
      otra.style.transform = desplazamiento ? `translateY(${desplazamiento}px)` : '';
    });
  }

  function terminarArrastre(evento, cancelado) {
    if (!arrastre || evento.pointerId !== arrastre.puntero) return;
    const { li, id, activo, origen, destino } = arrastre;
    arrastre = null;
    if (li.hasPointerCapture(evento.pointerId)) li.releasePointerCapture(evento.pointerId);
    for (const x of lista.children) x.style.transform = '';
    li.classList.remove('arrastrando');
    lista.classList.remove('ordenando');
    if (!activo) return; // fue un toque o un clic, no un arrastre
    if (cancelado || destino === origen) {
      dibujar(actuales, marcas);
      return;
    }
    const nuevo = mover(actuales, origen, destino);
    anuncio.textContent = T.movida(nombre(id), destino + 1, nuevo.length);
    porEnfocar = { id, parte: null };
    alMover(nuevo);
  }

  /** Resalta las tarjetas de los ids dados sin volver a dibujar la lista. */
  function resaltar(ids) {
    for (const li of lista.children) {
      li.classList.toggle('resaltada', ids.includes(li.dataset.id));
    }
  }

  return { elemento: raiz, dibujar, resaltar };
}

function boton(clase, texto, etiqueta, deshabilitado) {
  const b = elemento('button', `mover ${clase}`, texto);
  b.type = 'button';
  b.setAttribute('aria-label', etiqueta);
  b.title = etiqueta;
  b.disabled = deshabilitado;
  return b;
}

function elemento(etiqueta, clase, texto) {
  const e = document.createElement(etiqueta);
  if (clase) e.className = clase;
  if (texto !== undefined) e.textContent = texto;
  return e;
}
