// Exportación: SVG, PNG (vía canvas) y PDF (jsPDF + svg2pdf.js).
// Las bibliotecas de PDF se cargan solo cuando se necesitan (modo profesor), para no hacer más lenta la
// carga de los otros modos. Nada sale a internet: todo se genera en el navegador.

/** Descarga un texto como archivo. */
export function descargarArchivo(contenido, nombre, tipo) {
  const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Descarga una sección como SVG (sin las franjas invisibles para el cursor). */
export function descargarSVG(svg, nombre) {
  descargarArchivo(paraExportar(svg), `${nombre}.svg`, 'image/svg+xml');
}

/** Convierte un SVG (texto) en PNG con fondo blanco. `escala` = píxeles por unidad de la sección. */
export async function svgAPNG(svg, escala = 2) {
  const { ancho, alto } = tamanoDe(svg);
  const conTamano = paraExportar(svg).replace('<svg ', `<svg width="${ancho * escala}" height="${alto * escala}" `);
  const url = URL.createObjectURL(new Blob([conTamano], { type: 'image/svg+xml' }));
  try {
    const imagen = await cargarImagen(url);
    const lienzo = document.createElement('canvas');
    lienzo.width = ancho * escala;
    lienzo.height = alto * escala;
    const contexto = lienzo.getContext('2d');
    contexto.fillStyle = '#fff';
    contexto.fillRect(0, 0, lienzo.width, lienzo.height);
    contexto.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
    return await new Promise((resolver, rechazar) =>
      lienzo.toBlob((blob) => (blob ? resolver(blob) : rechazar(new Error('No se pudo crear el PNG'))), 'image/png'),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Descarga una sección como PNG (2 píxeles por unidad: 2000 × 1000). */
export async function descargarPNG(svg, nombre, escala = 2) {
  descargarArchivo(await svgAPNG(svg, escala), `${nombre}.png`, 'image/png');
}

/** Carga jsPDF y svg2pdf.js (solo la primera vez). */
export async function cargarPDF() {
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
  return { jsPDF, svg2pdf };
}

/**
 * Dibuja un SVG (texto) en una página de un documento jsPDF, en milímetros.
 * svg2pdf necesita el SVG dentro del documento: se agrega oculto, se dibuja y se quita.
 */
export async function dibujarSVGEnPDF(svg2pdf, documento, svg, { x, y, ancho, alto }) {
  const contenedor = document.createElement('div');
  contenedor.style.cssText = 'position:absolute;left:-10000px;top:0;width:1000px;visibility:hidden';
  contenedor.innerHTML = paraExportar(svg);
  document.body.append(contenedor);
  try {
    await svg2pdf(contenedor.querySelector('svg'), documento, { x, y, width: ancho, height: alto });
  } finally {
    contenedor.remove();
  }
}

// Quita del SVG lo que solo sirve en pantalla (franjas invisibles para el cursor).
function paraExportar(svg) {
  return svg.replace(/<g class="zonas"[\s\S]*?<\/g>/, '');
}

function tamanoDe(svg) {
  const [, , ancho, alto] = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  return { ancho, alto };
}

function cargarImagen(url) {
  return new Promise((resolver, rechazar) => {
    const imagen = new Image();
    imagen.onload = () => resolver(imagen);
    imagen.onerror = () => rechazar(new Error('No se pudo leer el SVG'));
    imagen.src = url;
  });
}
