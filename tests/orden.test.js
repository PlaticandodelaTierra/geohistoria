import { describe, it, expect } from 'vitest';
import {
  crearGrafo,
  ordenTopologico,
  tieneCiclo,
  esOrdenUnico,
  contarOrdenes,
  listarOrdenes,
  validarRespuesta,
} from '../src/motor/orden.js';
import { detectarEvidencias } from '../src/motor/evidencias.js';
import { EJEMPLOS } from '../src/ejemplos.js';

// Grafo a partir de pares "AB" (A → B).
function grafo(ids, pares) {
  return crearGrafo(
    ids.split(''),
    pares.map(([desde, hacia]) => ({ desde, hacia, principio: 'superposicion' })),
  );
}

// Todas las permutaciones de una lista.
function permutaciones(lista) {
  if (lista.length <= 1) return [lista];
  return lista.flatMap((x, i) => permutaciones([...lista.slice(0, i), ...lista.slice(i + 1)]).map((p) => [x, ...p]));
}

const CADENA = grafo('ABCD', ['AB', 'BC', 'CD']);
const ROMBO = grafo('ABCD', ['AB', 'AC', 'BD', 'CD']);
const CICLO = grafo('ABC', ['AB', 'BC', 'CA']);
const SUELTOS = grafo('ABCD', []);

describe('crearGrafo', () => {
  it('rechaza ids repetidos, aristas con eventos desconocidos y aristas de un evento consigo mismo', () => {
    expect(() => crearGrafo(['A', 'A'], [])).toThrow(TypeError);
    expect(() => grafo('AB', ['AX'])).toThrow(RangeError);
    expect(() => grafo('AB', ['AA'])).toThrow(RangeError);
  });

  it('conserva los datos de cada arista', () => {
    const g = crearGrafo(['A', 'B'], [{ desde: 'A', hacia: 'B', principio: 'superposicion', explicacion: 'x' }]);
    expect(g.sucesores.get('A')[0].explicacion).toBe('x');
  });
});

describe('ordenTopologico', () => {
  it('ordena una cadena', () => {
    expect(ordenTopologico(CADENA)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('decide los empates según el orden de los ids', () => {
    expect(ordenTopologico(ROMBO)).toEqual(['A', 'B', 'C', 'D']);
    expect(ordenTopologico(grafo('DCBA', []))).toEqual(['D', 'C', 'B', 'A']);
  });

  it('el resultado respeta todas las aristas', () => {
    const g = grafo('EDCBA', ['AB', 'AC', 'CE', 'BD', 'DE']);
    const orden = ordenTopologico(g);
    for (const arista of g.aristas) {
      expect(orden.indexOf(arista.desde)).toBeLessThan(orden.indexOf(arista.hacia));
    }
  });

  it('lanza un error si hay un ciclo', () => {
    expect(() => ordenTopologico(CICLO)).toThrow(RangeError);
    expect(tieneCiclo(CICLO)).toBe(true);
    expect(tieneCiclo(ROMBO)).toBe(false);
  });
});

describe('unicidad y conteo', () => {
  it('esOrdenUnico', () => {
    expect(esOrdenUnico(CADENA)).toBe(true);
    expect(esOrdenUnico(ROMBO)).toBe(false);
    expect(esOrdenUnico(SUELTOS)).toBe(false);
    expect(esOrdenUnico(CICLO)).toBe(false);
    // Aristas transitivas o repetidas no cambian nada.
    expect(esOrdenUnico(grafo('ABC', ['AB', 'BC', 'AC', 'AB']))).toBe(true);
  });

  it('contarOrdenes', () => {
    expect(contarOrdenes(CADENA)).toBe(1);
    expect(contarOrdenes(ROMBO)).toBe(2);
    expect(contarOrdenes(SUELTOS)).toBe(24);
    expect(contarOrdenes(CICLO)).toBe(0);
  });

  it('listarOrdenes devuelve todos los órdenes válidos (hasta el límite)', () => {
    expect(listarOrdenes(ROMBO)).toEqual([
      ['A', 'B', 'C', 'D'],
      ['A', 'C', 'B', 'D'],
    ]);
    expect(listarOrdenes(SUELTOS, 5)).toHaveLength(5);
    expect(listarOrdenes(CICLO)).toEqual([]);
  });

  it('el conteo coincide con la enumeración completa', () => {
    const g = grafo('ABCDE', ['AB', 'AC', 'CD']);
    const validos = permutaciones(g.ids).filter((p) => validarRespuesta(g, p).valida);
    expect(contarOrdenes(g)).toBe(validos.length);
    expect(listarOrdenes(g, 1000)).toHaveLength(validos.length);
  });
});

describe('validarRespuesta', () => {
  it('acepta exactamente los órdenes válidos (todas las permutaciones de un grafo pequeño)', () => {
    const aceptadas = permutaciones(['A', 'B', 'C', 'D'])
      .filter((p) => validarRespuesta(ROMBO, p).valida)
      .map((p) => p.join(''));
    expect(aceptadas.sort()).toEqual(['ABCD', 'ACBD']);
  });

  it('señala cada par mal ordenado con la cadena de evidencias que lo contradice', () => {
    const g = grafo('ABC', ['AB', 'BC']);
    const { valida, errores } = validarRespuesta(g, ['C', 'B', 'A']);
    expect(valida).toBe(false);
    const pares = Object.fromEntries(
      errores.map((e) => [`${e.antiguo}${e.joven}`, e.cadena.map((a) => `${a.desde}${a.hacia}`)]),
    );
    expect(pares).toEqual({
      AB: ['AB'],
      AC: ['AB', 'BC'], // relación indirecta: A → B → C
      BC: ['BC'],
    });
  });

  it('solo señala los pares que están mal', () => {
    const g = grafo('ABC', ['AB', 'BC']);
    const { errores } = validarRespuesta(g, ['B', 'A', 'C']);
    expect(errores.map((e) => `${e.antiguo}${e.joven}`)).toEqual(['AB']);
  });

  it('los eventos sin relación pueden ir en cualquier posición', () => {
    expect(validarRespuesta(SUELTOS, ['D', 'B', 'A', 'C']).valida).toBe(true);
  });

  it('rechaza respuestas incompletas, con repetidos o con eventos desconocidos', () => {
    expect(() => validarRespuesta(CADENA, ['A', 'B', 'C'])).toThrow(RangeError);
    expect(() => validarRespuesta(CADENA, ['A', 'B', 'C', 'C'])).toThrow(RangeError);
    expect(() => validarRespuesta(CADENA, ['A', 'B', 'C', 'X'])).toThrow(RangeError);
    expect(() => validarRespuesta(CADENA, 'ABCD')).toThrow(TypeError);
  });
});

describe('secciones hechas a mano', () => {
  const grafos = Object.fromEntries(
    EJEMPLOS.map(({ id, historia }) => {
      const { ids, aristas } = detectarEvidencias(historia);
      return [id, crearGrafo(ids, aristas)];
    }),
  );

  it('la historia real es siempre un orden válido y no hay ciclos', () => {
    for (const g of Object.values(grafos)) {
      expect(tieneCiclo(g)).toBe(false);
      expect(validarRespuesta(g, [...g.ids]).valida).toBe(true);
    }
  });

  it('las secciones 1 a 3 tienen orden único', () => {
    expect(ordenTopologico(grafos['capas-y-dique'])).toEqual(['A', 'B', 'C', 'D']);
    expect(esOrdenUnico(grafos['falla-corta-dique'])).toBe(true);
    expect(esOrdenUnico(grafos['discordancia-angular'])).toBe(true);
  });

  it('en la combinación, el basculamiento F puede ir antes del dique D, entre D y E, o después de E', () => {
    expect(listarOrdenes(grafos.combinacion).map((o) => o.join(''))).toEqual([
      'ABCDEFGHIJ',
      'ABCDFEGHIJ',
      'ABCFDEGHIJ',
    ]);
  });

  it('una respuesta equivocada se explica con las evidencias reales', () => {
    // Poner el dique D antes de la capa C contradice "El dique D corta a la capa C".
    const { valida, errores } = validarRespuesta(grafos['capas-y-dique'], ['A', 'B', 'D', 'C']);
    expect(valida).toBe(false);
    expect(errores).toHaveLength(1);
    expect(errores[0].cadena[0].explicacion.es).toBe(
      'El dique D corta a la capa C, así que D es más joven que C (principio de relaciones de corte).',
    );
  });
});
