import { describe, it, expect } from 'vitest';
import { componerSeccion, seccionSVG } from '../src/render/seccion.js';
import { colocarEtiquetas, seEnciman, segmentoTocaCaja, CAJA_LETRA } from '../src/render/etiquetas.js';
import { idDePatron, definicionDePatron, muestraDePatron, COLORES } from '../src/render/patrones.js';
import { generarSeccion, NIVELES } from '../src/motor/generador.js';
import { inclinacionActual, VENTANA } from '../src/motor/modelo.js';
import { EJEMPLOS } from '../src/ejemplos.js';

// 4 secciones hechas a mano y 30 generadas por nivel.
const SECCIONES = [
  ...EJEMPLOS.map((e) => ({ nombre: e.id, historia: e.historia })),
  ...NIVELES.flatMap((nivel) =>
    Array.from({ length: 30 }, (_, i) => ({
      nombre: `nivel ${nivel}, semilla ${i + 1}`,
      historia: generarSeccion(i + 1, nivel).historia,
    })),
  ),
];
const COMPUESTAS = SECCIONES.map((s) => ({ ...s, ...componerSeccion(s.historia) }));

describe('etiquetas', () => {
  it('ninguna etiqueta se encima con otra', () => {
    for (const { nombre, etiquetas } of COMPUESTAS) {
      for (let i = 0; i < etiquetas.length; i++) {
        for (let j = i + 1; j < etiquetas.length; j++) {
          expect(seEnciman(etiquetas[i], etiquetas[j]), `${nombre}: ${etiquetas[i].id} y ${etiquetas[j].id}`).toBe(
            false,
          );
        }
      }
    }
  }, 30_000);

  it('todas quedan dentro de la ventana', () => {
    for (const { nombre, etiquetas } of COMPUESTAS) {
      for (const e of etiquetas) {
        expect(e.x - e.caja.ancho / 2, `${nombre}: ${e.id}`).toBeGreaterThanOrEqual(0);
        expect(e.x + e.caja.ancho / 2, `${nombre}: ${e.id}`).toBeLessThanOrEqual(VENTANA.ancho);
        expect(e.y - e.caja.alto / 2, `${nombre}: ${e.id}`).toBeGreaterThanOrEqual(0);
        expect(e.y + e.caja.alto / 2, `${nombre}: ${e.id}`).toBeLessThanOrEqual(VENTANA.alto);
      }
    }
  });

  it('cada evento tiene al menos una etiqueta (el basculamiento, su símbolo)', () => {
    for (const { nombre, historia, etiquetas } of COMPUESTAS) {
      for (const evento of historia) {
        const suyas = etiquetas.filter((e) => e.id === evento.id);
        expect(suyas.length, `${nombre}: ${evento.id}`).toBeGreaterThan(0);
        if (evento.tipo === 'basculamiento') expect(suyas[0].tipo).toBe('simbolo');
      }
    }
  });

  it('una capa partida en trozos grandes lleva una letra en cada trozo', () => {
    // "Tres capas y un dique": el dique parte las tres capas en dos trozos grandes cada una.
    const { etiquetas } = COMPUESTAS.find((c) => c.nombre === 'capas-y-dique');
    for (const id of ['A', 'B', 'C']) {
      expect(etiquetas.filter((e) => e.id === id)).toHaveLength(2);
    }
  });

  it('colocarEtiquetas: si no hay lugar libre, la obligatoria va donde menos estorba y avisa', () => {
    const caja = CAJA_LETRA;
    const objetos = [
      { id: 'A', tipo: 'unidad', obligatoria: true, caja, candidatos: [{ x: 100, y: 100, puntaje: 1 }] },
      { id: 'B', tipo: 'unidad', obligatoria: true, caja, candidatos: [{ x: 110, y: 100, puntaje: 1 }] },
      { id: 'C', tipo: 'unidad', obligatoria: false, caja, candidatos: [{ x: 105, y: 100, puntaje: 1 }] },
    ];
    const { colocadas, avisos } = colocarEtiquetas({ objetos, obstaculos: [], ventana: VENTANA });
    expect(colocadas.map((e) => e.id).sort()).toEqual(['A', 'B']); // la opcional se omite
    expect(avisos).toHaveLength(1);
  });

  it('segmentoTocaCaja', () => {
    const caja = { x0: 0, y0: 0, x1: 10, y1: 10 };
    expect(segmentoTocaCaja({ x: -5, y: 5 }, { x: 15, y: 5 }, caja)).toBe(true); // la cruza
    expect(segmentoTocaCaja({ x: 2, y: 2 }, { x: 3, y: 3 }, caja)).toBe(true); // adentro
    expect(segmentoTocaCaja({ x: -5, y: -5 }, { x: -1, y: 20 }, caja)).toBe(false); // pasa al lado
    expect(segmentoTocaCaja({ x: -5, y: 8 }, { x: 8, y: -5 }, caja)).toBe(true); // corta una esquina
  });
});

describe('patrones', () => {
  it('cada litología presente tiene su patrón definido y cada unidad lo usa', () => {
    for (const { nombre, historia, svg } of COMPUESTAS) {
      historia.forEach((evento, i) => {
        if (!evento.litologia) return;
        const inclinacion = evento.tipo === 'deposito' ? inclinacionActual(historia, i) : 0;
        const id = idDePatron(evento.litologia, inclinacion);
        expect(svg, `${nombre}: patrón ${id}`).toContain(`<pattern id="${id}"`);
        expect(svg, `${nombre}: relleno de ${evento.id}`).toContain(`data-id="${evento.id}" fill="url(#${id})"`);
      });
    }
  });

  it('los patrones sedimentarios siguen la estratificación; los ígneos no tienen orientación', () => {
    expect(definicionDePatron('caliza', 30)).toContain('patternTransform="rotate(-30)"');
    expect(definicionDePatron('lutita', -20)).toContain('patternTransform="rotate(20)"');
    expect(definicionDePatron('arenisca', 0)).not.toContain('patternTransform');
    expect(idDePatron('granito', 30)).toBe('patron-granito-0');
    expect(definicionDePatron('basalto', 45)).not.toContain('patternTransform');
  });

  it('cada patrón lleva su color de fondo y la leyenda tiene una muestra', () => {
    for (const [litologia, color] of Object.entries(COLORES)) {
      expect(definicionDePatron(litologia)).toContain(`fill="${color}"`);
      expect(muestraDePatron(litologia)).toContain(`url(#muestra-${litologia})`);
    }
  });
});

describe('fallas y discordancias', () => {
  it('cada falla tiene su par de medias flechas, en sentidos opuestos a cada lado de la falla', () => {
    for (const { nombre, historia, flechas } of COMPUESTAS) {
      const fallas = historia.filter((e) => e.tipo === 'falla');
      expect(flechas.map((f) => f.id).sort(), nombre).toEqual(fallas.map((f) => f.id).sort());
      for (const f of flechas) {
        const producto = f.techo.direccion.x * f.piso.direccion.x + f.techo.direccion.y * f.piso.direccion.y;
        expect(producto, `${nombre}: ${f.id}`).toBeCloseTo(-1, 6);
        // Cada flecha está de su lado: la del techo hacia `lado`, la del piso al revés.
        const haciaTecho = (p) => (p.x - f.centro.x) * f.lado.x + (p.y - f.centro.y) * f.lado.y;
        expect(haciaTecho(f.techo.centro)).toBeGreaterThan(0);
        expect(haciaTecho(f.piso.centro)).toBeLessThan(0);
      }
    }
  });

  it('el bloque de techo baja en una falla normal y sube en una inversa', () => {
    for (const { nombre, historia, flechas } of COMPUESTAS) {
      for (const f of flechas) {
        const falla = historia.find((e) => e.id === f.id);
        // En coordenadas SVG la y crece hacia abajo; en los niveles 1 a 3 las fallas no se basculan.
        const baja = f.movimiento.y > 0;
        expect(baja, `${nombre}: falla ${f.id} (${falla.tipoFalla})`).toBe(falla.tipoFalla === 'normal');
      }
    }
  });

  it('las discordancias se dibujan onduladas', () => {
    const svg = seccionSVG(EJEMPLOS.find((e) => e.id === 'discordancia-angular').historia);
    const puntos = svg
      .match(/<polyline class="discordancia"[^>]*points="([^"]+)"/)[1]
      .split(' ')
      .map((p) => Number(p.split(',')[1]));
    // La erosión de esta sección es casi plana a gran escala; la onda del dibujo la hace subir y bajar
    // muchas veces: se cuentan los cambios de dirección.
    let cambios = 0;
    for (let i = 2; i < puntos.length; i++) {
      if (Math.sign(puntos[i] - puntos[i - 1]) !== Math.sign(puntos[i - 1] - puntos[i - 2])) cambios += 1;
    }
    expect(cambios).toBeGreaterThan(40);
  });
});
