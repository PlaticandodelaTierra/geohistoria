import { describe, it, expect } from 'vitest';
import { crearRng, normalizarSemilla, subsemilla } from '../src/rng.js';

// Toma los primeros `n` valores de siguiente() de un generador nuevo.
function secuencia(semilla, n) {
  const rng = crearRng(semilla);
  return Array.from({ length: n }, () => rng.siguiente());
}

describe('crearRng: reproducibilidad', () => {
  it('la misma semilla da siempre la misma secuencia', () => {
    expect(secuencia(48213, 1000)).toEqual(secuencia(48213, 1000));
  });

  it('semillas distintas dan secuencias distintas', () => {
    expect(secuencia(48213, 20)).not.toEqual(secuencia(48214, 20));
    expect(secuencia(0, 20)).not.toEqual(secuencia(1, 20));
  });

  it('los primeros valores de la semilla 48213 no cambian (candado contra cambios del algoritmo)', () => {
    // Valores de mulberry32, comprobados contra la implementación publicada de referencia.
    // Si esta prueba falla, todos los enlaces y hojas ya compartidos darían otros ejercicios.
    expect(secuencia(48213, 5)).toEqual([
      0.3345542727038264, 0.7650775038637221, 0.6061894989106804, 0.060561505146324635,
      0.8907273875083774,
    ]);
  });

  it('dos generadores con la misma semilla son independientes entre sí', () => {
    const a = crearRng(7);
    const b = crearRng(7);
    a.siguiente();
    a.siguiente();
    expect(b.siguiente()).toBe(secuencia(7, 1)[0]);
  });
});

describe('siguiente()', () => {
  it('siempre devuelve un real en [0, 1)', () => {
    for (const valor of secuencia(12345, 10000)) {
      expect(valor).toBeGreaterThanOrEqual(0);
      expect(valor).toBeLessThan(1);
    }
  });

  it('el promedio de 10,000 valores queda cerca de 0.5', () => {
    const valores = secuencia(2026, 10000);
    const promedio = valores.reduce((suma, v) => suma + v, 0) / valores.length;
    expect(promedio).toBeGreaterThan(0.49);
    expect(promedio).toBeLessThan(0.51);
  });
});

describe('entero(min, max)', () => {
  it('queda dentro del rango y alcanza ambos extremos', () => {
    const rng = crearRng(99);
    const vistos = new Set();
    for (let i = 0; i < 2000; i++) {
      const n = rng.entero(1, 6);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(6);
      vistos.add(n);
    }
    expect([...vistos].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('con min = max devuelve ese valor', () => {
    expect(crearRng(1).entero(4, 4)).toBe(4);
  });

  it('rechaza argumentos inválidos', () => {
    const rng = crearRng(1);
    expect(() => rng.entero(5, 1)).toThrow(RangeError);
    expect(() => rng.entero(1.5, 3)).toThrow(TypeError);
  });
});

describe('rango(min, max)', () => {
  it('queda dentro de [min, max)', () => {
    const rng = crearRng(7);
    for (let i = 0; i < 2000; i++) {
      const angulo = rng.rango(10, 60);
      expect(angulo).toBeGreaterThanOrEqual(10);
      expect(angulo).toBeLessThan(60);
    }
  });

  it('rechaza argumentos inválidos', () => {
    const rng = crearRng(1);
    expect(() => rng.rango(60, 10)).toThrow(RangeError);
    expect(() => rng.rango(0, Infinity)).toThrow(TypeError);
  });
});

describe('elegir(lista)', () => {
  it('devuelve un elemento de la lista y puede devolver cualquiera', () => {
    const litologias = ['arenisca', 'caliza', 'lutita'];
    const rng = crearRng(3);
    const vistas = new Set();
    for (let i = 0; i < 300; i++) {
      const elegida = rng.elegir(litologias);
      expect(litologias).toContain(elegida);
      vistas.add(elegida);
    }
    expect(vistas.size).toBe(litologias.length);
  });

  it('rechaza una lista vacía', () => {
    expect(() => crearRng(1).elegir([])).toThrow(RangeError);
  });
});

describe('barajar(lista)', () => {
  const letras = ['A', 'B', 'C', 'D', 'E', 'F'];

  it('devuelve una permutación de la lista sin modificar la original', () => {
    const original = [...letras];
    const revuelta = crearRng(48213).barajar(letras);
    expect(letras).toEqual(original);
    expect(revuelta).not.toBe(letras);
    expect([...revuelta].sort()).toEqual(original);
  });

  it('es determinista con la semilla', () => {
    expect(crearRng(48213).barajar(letras)).toEqual(['E', 'B', 'A', 'F', 'D', 'C']);
  });

  it('con semillas distintas produce órdenes distintos', () => {
    const ordenes = new Set();
    for (let s = 0; s < 50; s++) {
      ordenes.add(crearRng(s).barajar(letras).join(''));
    }
    expect(ordenes.size).toBeGreaterThan(40);
  });

  it('funciona con listas vacías o de un elemento', () => {
    expect(crearRng(1).barajar([])).toEqual([]);
    expect(crearRng(1).barajar(['A'])).toEqual(['A']);
  });
});

describe('normalizarSemilla', () => {
  it('un texto de solo dígitos equivale al número (semilla de la URL)', () => {
    expect(normalizarSemilla('48213')).toBe(48213);
    expect(secuencia('48213', 10)).toEqual(secuencia(48213, 10));
    expect(normalizarSemilla(' 48213 ')).toBe(48213);
  });

  it('los textos son reproducibles y fechas distintas dan secuencias distintas', () => {
    expect(normalizarSemilla('2026-11-25')).toBe(18412542);
    expect(secuencia('2026-11-25', 10)).toEqual(secuencia('2026-11-25', 10));
    expect(secuencia('2026-11-25', 10)).not.toEqual(secuencia('2026-11-26', 10));
  });

  it('los números se truncan y se envuelven a 32 bits', () => {
    expect(normalizarSemilla(48213.9)).toBe(48213);
    expect(normalizarSemilla(2 ** 32)).toBe(0);
    expect(normalizarSemilla(-1)).toBe(2 ** 32 - 1);
  });

  it('rechaza semillas inválidas', () => {
    for (const mala of [NaN, Infinity, undefined, null, {}, [], '', '   ']) {
      expect(() => normalizarSemilla(mala)).toThrow(TypeError);
      expect(() => crearRng(mala)).toThrow(TypeError);
    }
  });
});

describe('subsemilla(semilla, indice)', () => {
  it('es determinista y no cambia (candado)', () => {
    expect([0, 1, 2].map((i) => subsemilla(48213, i))).toEqual([3539121538, 1950528619, 440523406]);
  });

  it('índices distintos dan subsemillas distintas', () => {
    const subs = new Set();
    for (let i = 0; i < 1000; i++) {
      subs.add(subsemilla(48213, i));
    }
    expect(subs.size).toBe(1000);
  });

  it('acepta la semilla como texto, igual que crearRng', () => {
    expect(subsemilla('48213', 5)).toBe(subsemilla(48213, 5));
  });

  it('rechaza índices inválidos', () => {
    expect(() => subsemilla(1, -1)).toThrow(TypeError);
    expect(() => subsemilla(1, 1.5)).toThrow(TypeError);
  });
});
