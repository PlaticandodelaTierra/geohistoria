import { describe, it, expect } from 'vitest';
import { detectarEvidencias, LARGO_MINIMO, PRINCIPIO_DE } from '../src/motor/evidencias.js';
import { crearGrafo, contarOrdenes, esOrdenUnico, validarRespuesta } from '../src/motor/orden.js';
import { deposito, basculamiento, falla, dique, erosion } from '../src/motor/eventos.js';
import { VENTANA } from '../src/motor/modelo.js';
import { EJEMPLOS } from '../src/ejemplos.js';

// Aristas como texto "A→B evidencia", ordenadas, para comparar conjuntos exactos.
function resumen(aristas) {
  return aristas.map((a) => `${a.desde}→${a.hacia} ${a.evidencia}`).sort();
}

function historiaDe(id) {
  return EJEMPLOS.find((e) => e.id === id).historia;
}

// Toda arista debe ir del evento más antiguo al más joven según la historia real.
function esperarCoherente(historia, aristas) {
  const indice = new Map(historia.map((e, i) => [e.id, i]));
  for (const a of aristas) {
    expect(indice.get(a.desde), `${a.desde}→${a.hacia}`).toBeLessThan(indice.get(a.hacia));
  }
}

const capa = (id, espesor, litologia = 'caliza') => deposito({ id, espesor, litologia });

describe('secciones hechas a mano: se detectan exactamente las aristas esperadas', () => {
  it('Tres capas y un dique', () => {
    const { aristas } = detectarEvidencias(historiaDe('capas-y-dique'));
    expect(resumen(aristas)).toEqual(
      ['A→B superposicion', 'B→C superposicion', 'A→D corte', 'B→D corte', 'C→D corte'].sort(),
    );
  });

  it('Falla que corta un dique', () => {
    const { aristas } = detectarEvidencias(historiaDe('falla-corta-dique'));
    expect(resumen(aristas)).toEqual(
      [
        'A→B superposicion', 'B→C superposicion', 'C→D superposicion',
        'A→E corte', 'B→E corte', 'C→E corte', 'D→E corte',
        'A→F corte', 'B→F corte', 'C→F corte', 'D→F corte', 'E→F corte',
      ].sort(),
    );
  });

  it('Discordancia angular', () => {
    const { aristas } = detectarEvidencias(historiaDe('discordancia-angular'));
    expect(resumen(aristas)).toEqual(
      [
        'A→B superposicion', 'B→C superposicion', 'C→D superposicion', 'G→H superposicion',
        'A→E capa-inclinada', 'B→E capa-inclinada', 'C→E capa-inclinada', 'D→E capa-inclinada',
        'E→F discordancia-angular',
        'A→F truncamiento', 'B→F truncamiento', 'C→F truncamiento', 'D→F truncamiento',
        'F→G sobre-erosion',
      ].sort(),
    );
  });

  it('Combinación', () => {
    const { aristas } = detectarEvidencias(historiaDe('combinacion'));
    expect(resumen(aristas)).toEqual(
      [
        'A→B superposicion', 'B→C superposicion', 'H→I superposicion',
        // Dique D (basalto) y falla E.
        'A→D corte', 'B→D corte', 'C→D corte',
        'A→E corte', 'B→E corte', 'C→E corte', 'D→E corte',
        // Basculamiento F: las capas A–C están inclinadas y la erosión G las corta sin estar inclinada.
        'A→F capa-inclinada', 'B→F capa-inclinada', 'C→F capa-inclinada', 'F→G discordancia-angular',
        // Erosión G: trunca capas, el dique D y la falla E; H se depositó encima.
        // (A no llega a la discordancia: en el borde derecho queda B entre ambas.)
        'B→G truncamiento', 'C→G truncamiento', 'D→G truncamiento', 'E→G truncamiento',
        'G→H sobre-erosion',
        // Dique J (granito): corta capas de ambos lados de la discordancia y la discordancia misma.
        'A→J corte', 'B→J corte', 'G→J corte', 'H→J corte', 'I→J corte',
      ].sort(),
    );
  });

  it('cada arista lleva el principio que corresponde a su evidencia', () => {
    for (const { historia } of EJEMPLOS) {
      for (const a of detectarEvidencias(historia).aristas) {
        expect(a.principio).toBe(PRINCIPIO_DE[a.evidencia]);
      }
    }
  });

  it('toda arista va de lo más antiguo a lo más joven según la historia real', () => {
    for (const { historia } of EJEMPLOS) {
      esperarCoherente(historia, detectarEvidencias(historia).aristas);
    }
  });

  it('cada arista se ve al menos LARGO_MINIMO y su punto está dentro de la ventana', () => {
    for (const { historia } of EJEMPLOS) {
      for (const a of detectarEvidencias(historia).aristas) {
        expect(a.largo).toBeGreaterThanOrEqual(LARGO_MINIMO);
        expect(a.punto.x).toBeGreaterThanOrEqual(0);
        expect(a.punto.x).toBeLessThanOrEqual(VENTANA.ancho);
        expect(a.punto.z).toBeGreaterThanOrEqual(0);
        expect(a.punto.z).toBeLessThanOrEqual(VENTANA.alto);
      }
    }
  });

  it('las secciones 1 a 3 tienen orden único y la 4 tiene 3 órdenes válidos', () => {
    const ordenes = EJEMPLOS.map(({ historia }) => {
      const { ids, aristas } = detectarEvidencias(historia);
      return contarOrdenes(crearGrafo(ids, aristas));
    });
    expect(ordenes).toEqual([1, 1, 1, 3]);
  });
});

describe('explicaciones', () => {
  it('usan las letras reales del ejercicio, en español e inglés', () => {
    const { aristas } = detectarEvidencias(historiaDe('capas-y-dique'));
    const corte = aristas.find((a) => a.desde === 'B' && a.hacia === 'D');
    expect(corte.explicacion.es).toBe(
      'El dique D corta a la capa B, así que D es más joven que B (principio de relaciones de corte).',
    );
    expect(corte.explicacion.en).toBe(
      'Dike D cuts across layer B, so D is younger than B (principle of cross-cutting relationships).',
    );
    const superposicion = aristas.find((a) => a.desde === 'A' && a.hacia === 'B');
    expect(superposicion.explicacion.es).toBe(
      'La capa B descansa sobre la capa A, así que B es más joven que A (principio de superposición).',
    );
  });

  it('nombran bien el basculamiento y la discordancia', () => {
    const { aristas } = detectarEvidencias(historiaDe('discordancia-angular'));
    const angular = aristas.find((a) => a.evidencia === 'discordancia-angular');
    expect(angular.explicacion.es).toContain('La superficie de erosión F corta capas inclinadas');
    expect(angular.explicacion.es).toContain('F es más joven que E (principio de horizontalidad original)');
    expect(angular.explicacion.en).toContain('principle of original horizontality');
    const sobre = aristas.find((a) => a.evidencia === 'sobre-erosion');
    expect(sobre.explicacion.en).toBe(
      'Layer G was deposited on erosion surface F, so G is younger than F (principle of superposition).',
    );
  });
});

describe('casos pequeños', () => {
  it('un dique que corta a otro dique', () => {
    const historia = [
      capa('A', 250, 'lutita'),
      capa('B', 300, 'arenisca'),
      dique({ id: 'D', posicion: 400, echado: 90, sentidoEchado: 'derecha', espesor: 40, litologia: 'basalto' }),
      dique({ id: 'E', posicion: 400, echado: 60, sentidoEchado: 'izquierda', espesor: 30, litologia: 'granito' }),
    ];
    const { aristas } = detectarEvidencias(historia);
    expect(resumen(aristas)).toEqual(
      ['A→B superposicion', 'A→D corte', 'B→D corte', 'A→E corte', 'B→E corte', 'D→E corte'].sort(),
    );
    esperarCoherente(historia, aristas);
  });

  it('un dique que corta una falla', () => {
    // La falla (60° a la derecha) cruza el dique vertical en x = 450, z ≈ 337.
    const historia = [
      capa('A', 200, 'lutita'),
      capa('B', 400, 'arenisca'),
      falla({ id: 'F', posicion: 500, echado: 60, sentidoEchado: 'derecha', tipoFalla: 'normal', desplazamiento: 60 }),
      dique({ id: 'D', posicion: 450, echado: 90, sentidoEchado: 'derecha', espesor: 30, litologia: 'basalto' }),
    ];
    const { aristas } = detectarEvidencias(historia);
    expect(resumen(aristas)).toEqual(
      ['A→B superposicion', 'A→F corte', 'B→F corte', 'A→D corte', 'B→D corte', 'F→D corte'].sort(),
    );
    esperarCoherente(historia, aristas);
  });

  it('una falla que desplaza a otra falla', () => {
    // Las fallas se cruzan en (500, 77); la más joven (G) desplaza a la más antigua (F).
    const historia = [
      capa('A', 200, 'lutita'),
      capa('B', 500, 'arenisca'),
      falla({ id: 'F', posicion: 400, echado: 60, sentidoEchado: 'derecha', tipoFalla: 'normal', desplazamiento: 50 }),
      falla({ id: 'G', posicion: 600, echado: 60, sentidoEchado: 'izquierda', tipoFalla: 'normal', desplazamiento: 80 }),
    ];
    const { aristas } = detectarEvidencias(historia);
    expect(resumen(aristas)).toEqual(
      ['A→B superposicion', 'A→F corte', 'B→F corte', 'A→G corte', 'B→G corte', 'F→G desplazamiento'].sort(),
    );
    const desplazamiento = aristas.find((a) => a.evidencia === 'desplazamiento');
    expect(desplazamiento.explicacion.es).toBe(
      'La falla G desplaza a la falla F, así que G es más joven que F (principio de relaciones de corte).',
    );
    esperarCoherente(historia, aristas);
  });

  it('una erosión que trunca un dique y una falla, cubierta por una capa', () => {
    const historia = [
      capa('A', 300, 'lutita'),
      dique({ id: 'D', posicion: 300, echado: 90, sentidoEchado: 'derecha', espesor: 40, litologia: 'basalto' }),
      falla({ id: 'F', posicion: 600, echado: 60, sentidoEchado: 'derecha', tipoFalla: 'normal', desplazamiento: 60 }),
      erosion({ id: 'E', nivel: 200 }),
      capa('B', 100, 'arenisca'),
    ];
    const { ids, aristas } = detectarEvidencias(historia);
    expect(resumen(aristas)).toEqual(
      [
        'A→D corte', 'A→F corte',
        'A→E truncamiento', 'D→E truncamiento', 'F→E truncamiento',
        'E→B sobre-erosion',
      ].sort(),
    );
    // El dique y la falla no se tocan: su orden relativo no se puede deducir.
    expect(contarOrdenes(crearGrafo(ids, aristas))).toBe(2);
  });

  it('una erosión sin nada encima (la superficie actual) y un basculamiento', () => {
    // Capas basculadas 20° a la derecha; la erosión en z = 400 solo toca a B; arriba hay aire.
    const historia = [
      capa('A', 200, 'lutita'),
      capa('B', 400, 'arenisca'),
      basculamiento({ id: 'T', angulo: 20, sentido: 'derecha', pivote: { x: 500, z: 250 } }),
      erosion({ id: 'E', nivel: 400 }),
    ];
    const { ids, aristas } = detectarEvidencias(historia);
    expect(resumen(aristas)).toEqual(
      [
        'A→B superposicion',
        'A→T capa-inclinada', 'B→T capa-inclinada',
        'B→E truncamiento', 'T→E discordancia-angular',
      ].sort(),
    );
    expect(esOrdenUnico(crearGrafo(ids, aristas))).toBe(true);
  });

  it('un basculamiento sin erosión posterior', () => {
    const historia = [
      capa('A', 250, 'lutita'),
      capa('B', 400, 'arenisca'),
      basculamiento({ id: 'T', angulo: 30, sentido: 'izquierda', pivote: { x: 500, z: 250 } }),
    ];
    const { aristas } = detectarEvidencias(historia);
    expect(resumen(aristas)).toEqual(['A→B superposicion', 'A→T capa-inclinada', 'B→T capa-inclinada'].sort());
  });

  it('un contacto más corto que el mínimo no cuenta', () => {
    // Capas basculadas 10° a la derecha: el contacto A/B queda en z = 498 en x = 1000 y sale por el borde
    // superior en x ≈ 988.7. B solo asoma en esa esquina (un triángulo de ≈ 11 × 2 unidades), así que el
    // contacto A/B mide menos de LARGO_MINIMO.
    const historia = [
      capa('A', 581.06, 'lutita'),
      capa('B', 200, 'arenisca'),
      basculamiento({ id: 'T', angulo: 10, sentido: 'derecha', pivote: { x: 500, z: 250 } }),
    ];
    const { ids, aristas } = detectarEvidencias(historia);
    expect(aristas).toEqual([]);
    expect(contarOrdenes(crearGrafo(ids, aristas))).toBe(6);
  });
});

describe('regla acordada: terminar en la base de una capa sin erosión no es evidencia', () => {
  it('un dique cubierto por una capa sin erosión no queda relacionado con esa capa', () => {
    const historia = [
      capa('A', 300, 'lutita'),
      dique({ id: 'D', posicion: 500, echado: 90, sentidoEchado: 'derecha', espesor: 40, litologia: 'basalto' }),
      capa('B', 300, 'arenisca'),
    ];
    const { ids, aristas } = detectarEvidencias(historia);
    expect(resumen(aristas)).toEqual(['A→B superposicion', 'A→D corte'].sort());
    expect(contarOrdenes(crearGrafo(ids, aristas))).toBe(2);
  });

  it('una falla cuyo escarpe cubre una capa sin erosión no queda relacionada con esa capa', () => {
    const historia = [
      capa('A', 300, 'lutita'),
      falla({ id: 'F', posicion: 500, echado: 60, sentidoEchado: 'derecha', tipoFalla: 'normal', desplazamiento: 80 }),
      capa('B', 300, 'arenisca'),
    ];
    const { ids, aristas } = detectarEvidencias(historia);
    expect(resumen(aristas)).toEqual(['A→B superposicion', 'A→F corte'].sort());
    expect(contarOrdenes(crearGrafo(ids, aristas))).toBe(2);
  });

  it('con una erosión de por medio, sí hay relación', () => {
    const historia = [
      capa('A', 300, 'lutita'),
      dique({ id: 'D', posicion: 500, echado: 90, sentidoEchado: 'derecha', espesor: 40, litologia: 'basalto' }),
      erosion({ id: 'E', nivel: 250 }),
      capa('B', 300, 'arenisca'),
    ];
    const { ids, aristas } = detectarEvidencias(historia);
    expect(resumen(aristas)).toEqual(
      ['A→D corte', 'A→E truncamiento', 'D→E truncamiento', 'E→B sobre-erosion'].sort(),
    );
    const grafo = crearGrafo(ids, aristas);
    expect(esOrdenUnico(grafo)).toBe(true);
    expect(validarRespuesta(grafo, ids).valida).toBe(true);
  });
});
