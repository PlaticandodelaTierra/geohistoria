import { describe, it, expect } from 'vitest';
import { PRINCIPIOS_GEOLOGICOS } from '../src/principios.js';
import { detectarEvidencias } from '../src/motor/evidencias.js';
import { crearModelo, AIRE } from '../src/motor/modelo.js';
import { muestrear, trozosConCeldas } from '../src/motor/visibilidad.js';
import { PRINCIPIOS } from '../src/i18n.js';

// Evidencias del esquema que ilustran el principio (igual que la página).
function ilustran(principio) {
  return detectarEvidencias(principio.historia).aristas.filter(
    (a) =>
      principio.principiosQueSeVen.includes(a.principio) &&
      (!principio.soloEvidencias || principio.soloEvidencias.includes(a.evidencia)),
  );
}

const porId = (id) => PRINCIPIOS_GEOLOGICOS.find((p) => p.id === id);

describe('página de principios', () => {
  it('incluye los cinco principios acordados, con título, autor y texto en español e inglés', () => {
    expect(PRINCIPIOS_GEOLOGICOS.map((p) => p.id)).toEqual([
      'superposicion',
      'horizontalidad-original',
      'continuidad-lateral',
      'relaciones-de-corte',
      'discordancias',
    ]);
    for (const p of PRINCIPIOS_GEOLOGICOS) {
      for (const idioma of ['es', 'en']) {
        expect(p.titulo[idioma].length, `${p.id} ${idioma}`).toBeGreaterThan(5);
        expect(p.autor[idioma].length, `${p.id} ${idioma}`).toBeGreaterThan(5);
        expect(p.texto[idioma].length, `${p.id} ${idioma}`).toBeGreaterThan(50);
      }
    }
  });

  it('los principios que usa el motor tienen su página (para los enlaces desde la revisión)', () => {
    const ids = new Set(PRINCIPIOS_GEOLOGICOS.map((p) => p.id));
    for (const clave of Object.keys(PRINCIPIOS)) expect(ids.has(clave), clave).toBe(true);
  });

  it('ningún esquema muestra aire', () => {
    for (const p of PRINCIPIOS_GEOLOGICOS) {
      expect(muestrear(crearModelo(p.historia), 4).valores.includes(AIRE), p.id).toBe(false);
    }
  });
});

describe('cada esquema muestra lo que ilustra', () => {
  it('superposición: aristas de superposición entre capas en contacto', () => {
    const aristas = ilustran(porId('superposicion'));
    expect(aristas.map((a) => `${a.desde}→${a.hacia}`)).toEqual(['A→B', 'B→C']);
    expect(aristas.every((a) => a.evidencia === 'superposicion')).toBe(true);
  });

  it('horizontalidad original: todas las capas se ven inclinadas', () => {
    const aristas = ilustran(porId('horizontalidad-original'));
    expect(aristas.map((a) => a.desde).sort()).toEqual(['A', 'B', 'C', 'D']);
    expect(aristas.every((a) => a.evidencia === 'capa-inclinada' && a.hacia === 'E')).toBe(true);
  });

  it('continuidad lateral: cada capa aparece en dos trozos, a ambos lados del dique', () => {
    const p = porId('continuidad-lateral');
    const modelo = crearModelo(p.historia);
    const trozos = trozosConCeldas(muestrear(modelo, 2));
    const cuantos = (id) => trozos.filter((t) => modelo.eventos[t.indice].id === id).length;
    expect(['A', 'B', 'C'].map(cuantos)).toEqual([2, 2, 2]);
    expect(p.nota.es).toContain('dique D');
    expect(p.nota.en).toContain('dike D');
  });

  it('relaciones de corte: el dique y la falla cortan las capas, y la falla corta al dique', () => {
    const aristas = ilustran(porId('relaciones-de-corte'));
    expect(aristas.every((a) => a.principio === 'relaciones-de-corte')).toBe(true);
    expect(aristas.some((a) => a.desde === 'E' && a.hacia === 'F')).toBe(true);
  });

  it('discordancias: truncamiento, discordancia angular y capa depositada sobre la erosión', () => {
    const evidencias = new Set(ilustran(porId('discordancias')).map((a) => a.evidencia));
    expect([...evidencias].sort()).toEqual(['discordancia-angular', 'sobre-erosion', 'truncamiento']);
  });
});
