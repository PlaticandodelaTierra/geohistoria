// Modo profesor (#profesor?n=2&c=10&s=48213&p=carta): hoja de ejercicios y hoja de respuestas en PDF.
// Las semillas son consecutivas a partir de la primera: con el mismo enlace, todo el grupo tiene
// exactamente los mismos ejercicios.

import { generarSeccion, NIVELES } from '../motor/generador.js';
import { seccionSVG } from '../render/seccion.js';
import { leyendaSVG } from '../render/patrones.js';
import { TEXTOS as T, nombreDeTarjeta, idioma } from '../i18n.js';
import {
  leerParametrosProfesor,
  rutaDeProfesor,
  semillasDeLaHoja,
  listaDeEventos,
  enlaceDePractica,
  claveDeRespuestas,
  CANTIDAD_MAXIMA,
  PAPELES,
} from './logicaProfesor.js';
import { elemento, boton, encabezado, semillaAlAzar, copiar, describirSeccion } from './comun.js';
import { descargarArchivo, descargarSVG, descargarPNG, cargarPDF, dibujarSVGEnPDF } from '../export.js';

// Cada vez que se dibuja la página cambia este número; así se cancela una vista previa anterior a medias.
let dibujoActual = 0;

export function paginaProfesor(contenedor, parametros) {
  const P = T.profesor;
  const hoja = leerParametrosProfesor(parametros);
  contenedor.append(encabezado('profesor'), elemento('h2', null, P.titulo), elemento('p', 'explicacion', P.explicacion));
  contenedor.append(formulario(hoja));
  if (hoja.nivel === null || hoja.cantidad === null) return;
  if (hoja.semilla === null) {
    hoja.semilla = semillaAlAzar();
    history.replaceState(null, '', `#${rutaDeProfesor(hoja)}`);
    contenedor.querySelector('input[name=semilla]').value = String(hoja.semilla);
  }

  const semillas = semillasDeLaHoja(hoja.semilla, hoja.cantidad);
  const ejercicios = [];
  const estado = elemento('p', 'estado-pdf');
  estado.setAttribute('aria-live', 'polite');
  const botonEjercicios = boton(P.pdfEjercicios, 'principal');
  const botonRespuestas = boton(P.pdfRespuestas, 'principal');
  const botonCopiar = boton(P.copiarEnlace);
  for (const b of [botonEjercicios, botonRespuestas]) b.disabled = true;

  const generar = async (tipo) => {
    for (const b of [botonEjercicios, botonRespuestas]) b.disabled = true;
    try {
      const pdf = await crearPDF(tipo, ejercicios, hoja, (n, total) => {
        estado.textContent = P.generando(n, total);
      });
      const nombre = `geohistoria-${P.archivos[tipo]}-${hoja.nivel}-${hoja.semilla}.pdf`;
      descargarArchivo(pdf, nombre, 'application/pdf');
      estado.textContent = P.listo(nombre);
    } catch (error) {
      console.error(error);
      estado.textContent = P.error;
    } finally {
      for (const b of [botonEjercicios, botonRespuestas]) b.disabled = false;
    }
  };
  botonEjercicios.addEventListener('click', () => generar('ejercicios'));
  botonRespuestas.addEventListener('click', () => generar('respuestas'));
  botonCopiar.addEventListener('click', async () => {
    estado.textContent = (await copiar(location.href)) ? T.enlaceCopiado : T.enlaceNoCopiado(location.href);
  });

  const acciones = elemento('div', 'barra');
  acciones.append(botonEjercicios, botonRespuestas, botonCopiar);
  const resumen = elemento('p', 'resumen-hoja', P.resumen(hoja.cantidad, hoja.nivel, semillas[0], semillas.at(-1)));
  const galeria = elemento('div', 'galeria hoja');
  contenedor.append(resumen, acciones, estado, galeria);

  // Vista previa: un ejercicio por turno, para que la página no se congele.
  const este = ++dibujoActual;
  let i = 0;
  const siguiente = () => {
    if (este !== dibujoActual) return;
    if (i >= semillas.length) {
      for (const b of [botonEjercicios, botonRespuestas]) b.disabled = false;
      return;
    }
    const semilla = semillas[i];
    const seccion = generarSeccion(semilla, hoja.nivel);
    const ejercicio = { numero: i + 1, semilla, seccion };
    ejercicios.push(ejercicio);
    galeria.append(tarjetaDeEjercicio(ejercicio, hoja.nivel));
    i += 1;
    setTimeout(siguiente, 0);
  };
  siguiente();
}

function formulario(hoja) {
  const P = T.profesor;
  const form = elemento('form', 'controles');

  const nivel = elemento('select');
  nivel.name = 'nivel';
  for (const n of NIVELES) {
    const opcion = elemento('option', null, T.niveles[n].nombre);
    opcion.value = String(n);
    opcion.selected = n === (hoja.nivel ?? 1);
    nivel.append(opcion);
  }

  const cantidad = elemento('input');
  Object.assign(cantidad, { type: 'number', name: 'cantidad', min: '1', max: String(CANTIDAD_MAXIMA), step: '1' });
  cantidad.value = String(hoja.cantidad ?? 6);

  const semilla = elemento('input');
  Object.assign(semilla, { type: 'number', name: 'semilla', min: '0', step: '1', placeholder: P.semillaAlAzar });
  if (hoja.semilla !== null) semilla.value = String(hoja.semilla);

  const papel = elemento('select');
  papel.name = 'papel';
  for (const [clave, nombre] of Object.entries(P.papeles)) {
    const opcion = elemento('option', null, nombre);
    opcion.value = clave;
    opcion.selected = clave === hoja.papel;
    papel.append(opcion);
  }

  const etiquetado = (texto, control) => {
    const etiqueta = elemento('label', null, `${texto} `);
    etiqueta.append(control);
    return etiqueta;
  };
  const enviar = elemento('button', 'principal', P.generar);
  enviar.type = 'submit';
  form.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const n = Math.min(CANTIDAD_MAXIMA, Math.max(1, Math.floor(Number(cantidad.value) || 1)));
    const s = semilla.value.trim() === '' ? semillaAlAzar() : Math.max(0, Math.floor(Number(semilla.value)));
    location.hash = rutaDeProfesor({ nivel: Number(nivel.value), cantidad: n, semilla: s, papel: papel.value });
  });

  form.append(
    etiquetado(T.nivel, nivel),
    etiquetado(P.cantidad, cantidad),
    etiquetado(P.primeraSemilla, semilla),
    etiquetado(P.papel, papel),
    enviar,
  );
  return form;
}

// Vista previa de un ejercicio con su respuesta (plegada) y botones para descargar la sección.
function tarjetaDeEjercicio({ numero, semilla, seccion }, nivel) {
  const P = T.profesor;
  const figura = elemento('figure');
  const dibujo = elemento('div', 'dibujo');
  const svg = seccionSVG(seccion.historia, { titulo: describirSeccion(seccion.historia) });
  dibujo.innerHTML = svg; // SVG generado por nuestro propio código, con el texto escapado
  const pie = elemento('figcaption');
  pie.append(
    elemento('h3', null, P.ejercicio(numero, semilla)),
    elemento('p', 'eventos', listaDeEventos(seccion.historia, idioma())),
  );

  const respuesta = elemento('details');
  const eventos = new Map(seccion.historia.map((e) => [e.id, e]));
  const orden = elemento('ol', 'solucion');
  for (const id of seccion.orden) orden.append(elemento('li', null, `${id} · ${nombreDeTarjeta(eventos.get(id))}`));
  const evidencias = elemento('ul', 'evidencias');
  for (const a of seccion.aristas) evidencias.append(elemento('li', null, a.explicacion[idioma()]));
  respuesta.append(elemento('summary', null, P.respuesta), elemento('p', null, P.ordenCorrecto), orden, evidencias);

  const nombre = `geohistoria-nivel${nivel}-semilla${semilla}`;
  const descargas = elemento('div', 'barra');
  const botonSVG = boton(T.descargarSVG);
  botonSVG.addEventListener('click', () => descargarSVG(svg, nombre));
  const botonPNG = boton(T.descargarPNG);
  botonPNG.addEventListener('click', () => descargarPNG(svg, nombre));
  descargas.append(botonSVG, botonPNG);

  pie.append(respuesta, descargas);
  figura.append(dibujo, pie);
  return figura;
}

// ───────────────────────── PDF ─────────────────────────

const MARGEN = 15; // mm
const PIE = 10; // espacio para el número de página

/**
 * Crea el PDF de la hoja de ejercicios o de la hoja de respuestas.
 * @param {'ejercicios'|'respuestas'} tipo
 * @returns {Promise<Blob>}
 */
async function crearPDF(tipo, ejercicios, hoja, alProgreso) {
  const P = T.profesor;
  const cual = idioma();
  const { jsPDF, svg2pdf } = await cargarPDF();
  const papel = PAPELES[hoja.papel];
  const documento = new jsPDF({ unit: 'mm', format: papel.formato });
  const anchoUtil = papel.ancho - 2 * MARGEN;
  const limite = papel.alto - MARGEN - PIE;
  let y = MARGEN;

  const texto = (contenido, { tamano = 10, negrita = false, color = 20, sangria = 0 } = {}) => {
    documento.setFont('helvetica', negrita ? 'bold' : 'normal');
    documento.setFontSize(tamano);
    documento.setTextColor(color);
    const lineas = documento.splitTextToSize(contenido, anchoUtil - sangria);
    const alto = lineas.length * tamano * 0.42;
    documento.text(lineas, MARGEN + sangria, y + tamano * 0.35);
    y += alto + 1.2;
  };
  const espacioPara = (alto) => {
    if (y + alto > limite) {
      documento.addPage();
      y = MARGEN;
    }
  };

  // Encabezado.
  const semillas = ejercicios.map((e) => e.semilla);
  texto(tipo === 'ejercicios' ? P.pdf.tituloEjercicios : P.pdf.tituloRespuestas, { tamano: 15, negrita: true });
  texto(P.resumen(ejercicios.length, hoja.nivel, semillas[0], semillas.at(-1)), { color: 70 });
  y += 2;
  if (tipo === 'ejercicios') {
    texto(P.pdf.datosAlumno, { tamano: 10.5 });
    y += 1;
    texto(P.pdf.instrucciones, { tamano: 10 });
  }
  y += 3;

  const base = `${location.origin}${location.pathname}`;
  const clave = claveDeRespuestas(ejercicios, cual);
  for (const [i, { numero, semilla, seccion }] of ejercicios.entries()) {
    if (tipo === 'ejercicios') {
      // 140 mm de ancho: caben dos ejercicios por página (en la primera, uno, por el encabezado).
      const anchoSeccion = Math.min(anchoUtil, 140);
      const altoSeccion = anchoSeccion / 2;
      const leyenda = leyendaSVG(seccion.historia, T.simbolos, T.litologias);
      const altoLeyenda = (anchoSeccion * leyenda.alto) / leyenda.ancho;
      espacioPara(7 + altoSeccion + altoLeyenda + 26);
      texto(P.ejercicio(numero, semilla), { tamano: 11.5, negrita: true });
      const x = MARGEN + (anchoUtil - anchoSeccion) / 2;
      const svg = seccionSVG(seccion.historia, { interactiva: false, fondoDeLetras: true });
      await dibujarSVGEnPDF(svg2pdf, documento, svg, { x, y, ancho: anchoSeccion, alto: altoSeccion });
      y += altoSeccion + 2;
      await dibujarSVGEnPDF(svg2pdf, documento, leyenda.svg, { x, y, ancho: anchoSeccion, alto: altoLeyenda });
      y += altoLeyenda + 2.5;
      texto(`${P.pdf.eventos} ${listaDeEventos(seccion.historia, cual)}`, { tamano: 10 });
      y += 1.5;
      texto(`${P.pdf.lineaRespuesta}______________________________________________`, { tamano: 10.5 });
      texto(P.pdf.enLinea(enlaceDePractica(base, hoja.nivel, semilla)), { tamano: 8, color: 110 });
      y += 6;
    } else {
      const { orden, evidencias } = clave[i];
      const anchoMiniatura = 80;
      const altoMiniatura = anchoMiniatura / 2;
      espacioPara(7 + altoMiniatura + 12);
      texto(P.ejercicio(numero, semilla), { tamano: 11.5, negrita: true });
      const arriba = y;
      const svg = seccionSVG(seccion.historia, { interactiva: false, fondoDeLetras: true });
      await dibujarSVGEnPDF(svg2pdf, documento, svg, { x: MARGEN, y, ancho: anchoMiniatura, alto: altoMiniatura });
      // A la derecha de la miniatura: el orden correcto.
      documento.setFont('helvetica', 'normal');
      documento.setFontSize(10);
      documento.setTextColor(70);
      documento.text(P.ordenCorrecto, MARGEN + anchoMiniatura + 6, arriba + 5);
      documento.setFont('helvetica', 'bold');
      documento.setFontSize(14);
      documento.setTextColor(20);
      documento.text(documento.splitTextToSize(orden, anchoUtil - anchoMiniatura - 6), MARGEN + anchoMiniatura + 6, arriba + 12);
      y = arriba + altoMiniatura + 3;
      texto(P.pdf.evidencias, { tamano: 9.5, negrita: true });
      for (const evidencia of evidencias) {
        espacioPara(9);
        texto(`• ${evidencia}`, { tamano: 9, sangria: 2 });
      }
      y += 5;
    }
    alProgreso(i + 1, ejercicios.length);
  }

  // Número de página.
  const paginas = documento.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    documento.setPage(p);
    documento.setFont('helvetica', 'normal');
    documento.setFontSize(8.5);
    documento.setTextColor(120);
    documento.text(P.pdf.pagina(p, paginas), papel.ancho / 2, papel.alto - 8, { align: 'center' });
  }
  return documento.output('blob');
}
