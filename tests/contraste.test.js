// Contraste de colores de la interfaz (WCAG 2.1, nivel AA).
// - Texto: al menos 4.5:1 con su fondo (1.4.3).
// - Bordes de controles, contorno de foco y el asa de las tarjetas: al menos 3:1 (1.4.11).
// Los colores se leen de src/estilos.css, así que la prueba falla si alguien cambia un color por otro con
// poco contraste.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/** Luminancia relativa de un color #rgb o #rrggbb. */
function luminancia(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lineal = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lineal(r) + 0.7152 * lineal(g) + 0.0722 * lineal(b);
}

/** Razón de contraste entre dos colores (de 1 a 21). */
function contraste(a, b) {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}

/**
 * Lee las reglas de la hoja de estilos (fuera de las @media) → Map selector → { propiedad: valor }.
 * Si un selector aparece en varias reglas, gana la última declaración, como en el navegador.
 */
function leerEstilos(css) {
  const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');
  // Quita los bloques @media (con sus reglas internas) contando llaves.
  let base = '';
  for (let i = 0; i < sinComentarios.length; i++) {
    if (sinComentarios.startsWith('@media', i)) {
      let j = sinComentarios.indexOf('{', i) + 1;
      for (let nivel = 1; nivel > 0; j++) {
        if (sinComentarios[j] === '{') nivel++;
        if (sinComentarios[j] === '}') nivel--;
      }
      i = j - 1;
    } else {
      base += sinComentarios[i];
    }
  }
  const reglas = new Map();
  for (const [, selectores, cuerpo] of base.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const selector of selectores.split(',').map((s) => s.trim())) {
      const declaraciones = reglas.get(selector) ?? {};
      for (const linea of cuerpo.split(';')) {
        const [propiedad, ...valor] = linea.split(':');
        if (valor.length) declaraciones[propiedad.trim()] = valor.join(':').trim();
      }
      reglas.set(selector, declaraciones);
    }
  }
  return reglas;
}

const REGLAS = leerEstilos(readFileSync(new URL('../src/estilos.css', import.meta.url), 'utf8'));

/** Color (#hex) que una regla declara en una propiedad (color, background, border, border-color…). */
function c(selector, propiedad) {
  const valor = REGLAS.get(selector)?.[propiedad];
  const hex = valor?.match(/#[0-9a-f]{3,6}\b/i)?.[0];
  if (!hex) throw new Error(`estilos.css no declara un color en «${selector} { ${propiedad} }»`);
  return hex;
}

const FONDO = c(':root', 'background');
const TEXTO = c(':root', 'color');
const BLANCO = '#fff';

describe('función de contraste', () => {
  it('da los valores de referencia de WCAG', () => {
    expect(contraste('#000', '#fff')).toBeCloseTo(21, 5);
    expect(contraste('#fff', '#fff')).toBeCloseTo(1, 5);
    expect(contraste('#777', '#fff')).toBeCloseTo(4.48, 2);
  });
});

describe('texto (AA: 4.5:1)', () => {
  const pares = [
    ['texto general', TEXTO, FONDO],
    ['texto sobre tarjetas, figuras y botones blancos', TEXTO, BLANCO],
    ['subtítulo del encabezado', c('header p', 'color'), FONDO],
    ['pie de figura', c('figcaption p', 'color'), c('figure', 'background')],
    ['subtítulo', c('.subtitulo', 'color'), FONDO],
    ['enlaces de navegación', c('.navegacion a', 'color'), FONDO],
    ['modos', c('.modos a', 'color'), FONDO],
    ['modo actual', c(".modos a[aria-current='page']", 'color'), FONDO],
    ['summary', c('summary', 'color'), FONDO],
    ['datos', c('.datos', 'color'), FONDO],
    ['semilla', c('.semilla', 'color'), FONDO],
    ['aviso de enlace copiado', c('.aviso-enlace', 'color'), FONDO],
    ['extremos de la lista', c('.extremo', 'color'), FONDO],
    ['explicación de cada modo', c('.explicacion', 'color'), FONDO],
    ['estado del PDF', c('.estado-pdf', 'color'), FONDO],
    ['título "correcto"', c('.revision h2.correcto', 'color'), FONDO],
    ['etiqueta', c('.etiqueta', 'color'), c('.etiqueta', 'background')],
    ['etiqueta de aviso', c('.etiqueta.aviso', 'color'), c('.etiqueta.aviso', 'background')],
    ['alerta', c('.alerta', 'color'), c('.alerta', 'background')],
    ['botón principal', c('button.principal', 'color'), c('button.principal', 'background')],
    ['botón secundario', c('button.secundario', 'color'), c('button.secundario', 'background')],
    ['nivel', c('.niveles a.nivel strong', 'color'), c('.niveles a.nivel', 'background')],
    ['tarjeta resaltada', TEXTO, c('.tarjeta.resaltada', 'background')],
    ['tarjeta bien', TEXTO, c('.tarjeta.bien', 'background')],
    ['tarjeta mal', TEXTO, c('.tarjeta.mal', 'background')],
    ['marca de tarjeta bien', c('.tarjeta.bien .marca', 'color'), c('.tarjeta.bien', 'background')],
    ['marca de tarjeta mal', c('.tarjeta.mal .marca', 'color'), c('.tarjeta.mal', 'background')],
    ['botones ↑ ↓', c('.tarjeta button.mover', 'color'), c('.tarjeta button.mover', 'background')],
    ['principio: superposición', TEXTO, c('.principio.superposicion', 'background')],
    ['principio: relaciones de corte', TEXTO, c('.principio.relaciones-de-corte', 'background')],
    ['principio: horizontalidad original', TEXTO, c('.principio.horizontalidad-original', 'background')],
    ['lista de eventos de la hoja', c('.galeria.hoja .eventos', 'color'), BLANCO],
    ['aviso del reto', c('.aviso-reto', 'color'), c('.aviso-reto', 'background')],
    ['título de la vista previa', c('.vista-previa-titulo', 'color'), c('.resultado-reto', 'background')],
    ['vista previa del texto', TEXTO, c('pre.vista-previa', 'background')],
    ['autor del principio', c('.texto-principio .autor', 'color'), c('.principio-tarjeta', 'background')],
    ['enlace para practicar', c('.enlace-practicar', 'color'), c('.principio-tarjeta', 'background')],
    ['enlace para saltar al contenido', c('.saltar', 'color'), c('.saltar', 'background')],
    ['selector de idioma', c('button.idioma', 'color'), c('button.idioma', 'background')],
    [
      'idioma elegido',
      c("button.idioma[aria-pressed='true']", 'color'),
      c("button.idioma[aria-pressed='true']", 'background'),
    ],
  ];

  it.each(pares)('%s', (_, texto, fondo) => {
    expect(contraste(texto, fondo)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('bordes de controles y elementos gráficos (AA: 3:1)', () => {
  const pares = [
    ['borde de las tarjetas', c('.tarjeta', 'border'), FONDO],
    ['borde de la tarjeta resaltada', c('.tarjeta.resaltada', 'border-color'), FONDO],
    ['borde de la tarjeta bien', c('.tarjeta.bien', 'border-color'), FONDO],
    ['borde de la tarjeta mal', c('.tarjeta.mal', 'border-color'), FONDO],
    ['borde de los botones ↑ ↓', c('.tarjeta button.mover', 'border'), c('.tarjeta', 'background')],
    ['asa para arrastrar', c('.tarjeta .asa', 'color'), c('.tarjeta', 'background')],
    ['asa en una tarjeta mal', c('.tarjeta .asa', 'color'), c('.tarjeta.mal', 'background')],
    ['borde del botón secundario', c('button.secundario', 'border'), FONDO],
    ['borde del selector de idioma', c('button.idioma', 'border'), FONDO],
    ['contorno de foco sobre el fondo', c(':focus-visible', 'outline'), FONDO],
    ['contorno de foco sobre blanco', c(':focus-visible', 'outline'), BLANCO],
  ];

  it.each(pares)('%s', (_, color, fondo) => {
    expect(contraste(color, fondo)).toBeGreaterThanOrEqual(3);
  });
});
