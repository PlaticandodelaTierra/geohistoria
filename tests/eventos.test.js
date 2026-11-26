import { describe, it, expect } from 'vitest';
import { crearRng } from '../src/rng.js';
import {
  deposito,
  basculamiento,
  falla,
  dique,
  erosion,
  crearEvento,
  esUnidad,
  aplicar,
  invertir,
  ladoDeFalla,
  dentroDelDique,
  distanciaAlPlano,
  alturaErosion,
  Z_REFERENCIA,
} from '../src/motor/eventos.js';
import { VENTANA } from '../src/motor/modelo.js';

const RAD = Math.PI / 180;

// Puntos repartidos más allá de la ventana, generados con semilla (reproducibles).
function puntosAlAzar(semilla, n = 1000) {
  const rng = crearRng(semilla);
  return Array.from({ length: n }, () => ({ x: rng.rango(-500, 1500), z: rng.rango(-500, 1000) }));
}

function esperarCerca(obtenido, esperado, digitos = 8) {
  expect(obtenido.x).toBeCloseTo(esperado.x, digitos);
  expect(obtenido.z).toBeCloseTo(esperado.z, digitos);
}

const MOVILES = [
  basculamiento({ id: 'b1', angulo: 10, sentido: 'derecha', pivote: { x: 500, z: 250 } }),
  basculamiento({ id: 'b2', angulo: 60, sentido: 'izquierda', pivote: { x: 120, z: -40 } }),
  basculamiento({ id: 'b3', angulo: 33.3, sentido: 'derecha', pivote: { x: 900, z: 480 } }),
  falla({ id: 'f1', posicion: 500, echado: 60, sentidoEchado: 'derecha', tipoFalla: 'normal', desplazamiento: 80 }),
  falla({ id: 'f2', posicion: 300, echado: 45, sentidoEchado: 'izquierda', tipoFalla: 'normal', desplazamiento: 150 }),
  falla({ id: 'f3', posicion: 700, echado: 80, sentidoEchado: 'derecha', tipoFalla: 'inversa', desplazamiento: 60 }),
  falla({ id: 'f4', posicion: 450, echado: 52, sentidoEchado: 'izquierda', tipoFalla: 'inversa', desplazamiento: 200 }),
];

const FIJOS = [
  deposito({ id: 'd', espesor: 100, litologia: 'arenisca' }),
  dique({ id: 'k', posicion: 500, echado: 75, sentidoEchado: 'derecha', espesor: 30, litologia: 'basalto' }),
  erosion({ id: 'e', nivel: 300, amplitud: 10, longitudOnda: 350, fase: 0.5 }),
];

describe('transformación seguida de su inversa', () => {
  for (const evento of MOVILES) {
    it(`${evento.tipo} ${evento.id}: invertir(aplicar(p)) = p y aplicar(invertir(p)) = p`, () => {
      for (const p of puntosAlAzar(evento.id)) {
        esperarCerca(invertir(evento, aplicar(evento, p)), p);
        esperarCerca(aplicar(evento, invertir(evento, p)), p);
      }
    });
  }

  for (const evento of FIJOS) {
    it(`${evento.tipo}: no mueve la roca existente (identidad)`, () => {
      for (const p of puntosAlAzar(evento.id, 100)) {
        expect(aplicar(evento, p)).toEqual(p);
        expect(invertir(evento, p)).toEqual(p);
      }
    });
  }

  it('no modifica el punto recibido', () => {
    const p = { x: 800, z: 400 };
    aplicar(MOVILES[3], p);
    invertir(MOVILES[0], p);
    expect(p).toEqual({ x: 800, z: 400 });
  });
});

describe('falla', () => {
  const normal = falla({ id: 'F', posicion: 500, echado: 60, sentidoEchado: 'derecha', tipoFalla: 'normal', desplazamiento: 100 });
  const inversa = falla({ id: 'R', posicion: 500, echado: 60, sentidoEchado: 'derecha', tipoFalla: 'inversa', desplazamiento: 100 });

  it('el plano pasa por (posición, Z_REFERENCIA) y buza hacia el sentido indicado', () => {
    expect(distanciaAlPlano(normal, { x: 500, z: Z_REFERENCIA })).toBeCloseTo(0, 10);
    // 100 unidades más abajo, el plano está 100/tan(60°) más a la derecha.
    const abajo = { x: 500 + 100 / Math.tan(60 * RAD), z: Z_REFERENCIA - 100 };
    expect(distanciaAlPlano(normal, abajo)).toBeCloseTo(0, 10);
    const izquierda = falla({ ...normal, sentidoEchado: 'izquierda' });
    expect(distanciaAlPlano(izquierda, { x: 500 - 100 / Math.tan(60 * RAD), z: Z_REFERENCIA - 100 })).toBeCloseTo(0, 10);
  });

  it('distingue bloque de techo (arriba del plano) y bloque de piso', () => {
    expect(ladoDeFalla(normal, { x: 900, z: 250 })).toBe('techo');
    expect(ladoDeFalla(normal, { x: 100, z: 250 })).toBe('piso');
    expect(ladoDeFalla(normal, { x: 500, z: 250 })).toBe('piso'); // sobre el plano cuenta como piso
  });

  it('normal: el bloque de techo baja a lo largo del echado; el de piso no se mueve', () => {
    esperarCerca(aplicar(normal, { x: 900, z: 250 }), {
      x: 900 + 100 * Math.cos(60 * RAD),
      z: 250 - 100 * Math.sin(60 * RAD),
    });
    expect(aplicar(normal, { x: 100, z: 250 })).toEqual({ x: 100, z: 250 });
  });

  it('inversa: el bloque de techo sube a lo largo del echado', () => {
    esperarCerca(aplicar(inversa, { x: 900, z: 250 }), {
      x: 900 - 100 * Math.cos(60 * RAD),
      z: 250 + 100 * Math.sin(60 * RAD),
    });
  });

  it('el movimiento es paralelo al plano: ningún punto cambia de lado', () => {
    for (const evento of MOVILES.filter((e) => e.tipo === 'falla')) {
      for (const p of puntosAlAzar(`lado-${evento.id}`, 300)) {
        expect(ladoDeFalla(evento, aplicar(evento, p))).toBe(ladoDeFalla(evento, p));
      }
    }
  });
});

describe('basculamiento', () => {
  const derecha = basculamiento({ id: 'T', angulo: 30, sentido: 'derecha', pivote: { x: 500, z: 250 } });
  const izquierda = basculamiento({ id: 'T', angulo: 30, sentido: 'izquierda', pivote: { x: 500, z: 250 } });

  it('deja fijo el pivote', () => {
    esperarCerca(aplicar(derecha, { x: 500, z: 250 }), { x: 500, z: 250 });
  });

  it("'derecha': una capa horizontal queda buzando hacia la derecha", () => {
    const a = aplicar(derecha, { x: 300, z: 250 });
    const b = aplicar(derecha, { x: 700, z: 250 });
    expect(b.z).toBeLessThan(a.z);
    expect(Math.atan2(a.z - b.z, b.x - a.x) / RAD).toBeCloseTo(30, 8);
  });

  it("'izquierda': una capa horizontal queda buzando hacia la izquierda", () => {
    const a = aplicar(izquierda, { x: 300, z: 250 });
    const b = aplicar(izquierda, { x: 700, z: 250 });
    expect(a.z).toBeLessThan(b.z);
    expect(Math.atan2(b.z - a.z, b.x - a.x) / RAD).toBeCloseTo(30, 8);
  });

  it('conserva las distancias (rotación rígida)', () => {
    const [p, q] = puntosAlAzar('rigidez', 2);
    const p2 = aplicar(derecha, p);
    const q2 = aplicar(derecha, q);
    expect(Math.hypot(p2.x - q2.x, p2.z - q2.z)).toBeCloseTo(Math.hypot(p.x - q.x, p.z - q.z), 8);
  });
});

describe('dique', () => {
  it('vertical: ocupa una franja de su espesor centrada en la posición', () => {
    const d = dique({ id: 'D', posicion: 400, echado: 90, sentidoEchado: 'derecha', espesor: 40, litologia: 'basalto' });
    expect(dentroDelDique(d, { x: 400, z: 0 })).toBe(true);
    expect(dentroDelDique(d, { x: 419.9, z: 480 })).toBe(true);
    expect(dentroDelDique(d, { x: 380.1, z: 100 })).toBe(true);
    expect(dentroDelDique(d, { x: 420.1, z: 250 })).toBe(false);
    expect(dentroDelDique(d, { x: 379.9, z: 250 })).toBe(false);
  });

  it('inclinado: la franja sigue el echado y su espesor se mide perpendicular al plano', () => {
    const d = dique({ id: 'D', posicion: 500, echado: 60, sentidoEchado: 'izquierda', espesor: 20, litologia: 'granito' });
    // 100 unidades más abajo, el centro está 100/tan(60°) más a la izquierda.
    expect(dentroDelDique(d, { x: 500 - 100 / Math.tan(60 * RAD), z: Z_REFERENCIA - 100 })).toBe(true);
    // A la altura de referencia, 10 unidades perpendiculares equivalen a 10/sen(60°) en horizontal.
    const mitadHorizontal = 10 / Math.sin(60 * RAD);
    expect(dentroDelDique(d, { x: 500 + mitadHorizontal - 0.1, z: Z_REFERENCIA })).toBe(true);
    expect(dentroDelDique(d, { x: 500 + mitadHorizontal + 0.1, z: Z_REFERENCIA })).toBe(false);
  });
});

describe('erosión', () => {
  it('con amplitud 0 la superficie es plana', () => {
    const e = erosion({ id: 'E', nivel: 320 });
    for (const x of [-200, 0, 137, 500, 999]) {
      expect(alturaErosion(e, x)).toBe(320);
    }
  });

  it('ondulada: sigue la senoide y no se aleja del nivel más que la amplitud', () => {
    const e = erosion({ id: 'E', nivel: 300, amplitud: 12, longitudOnda: 400, fase: 0 });
    expect(alturaErosion(e, 0)).toBeCloseTo(300, 10);
    expect(alturaErosion(e, 100)).toBeCloseTo(312, 10);
    expect(alturaErosion(e, 300)).toBeCloseTo(288, 10);
    for (let x = 0; x <= 1000; x += 7) {
      expect(Math.abs(alturaErosion(e, x) - 300)).toBeLessThanOrEqual(12 + 1e-9);
    }
  });
});

describe('constructores y validación', () => {
  it('la altura de referencia es la mitad de la ventana', () => {
    expect(Z_REFERENCIA).toBe(VENTANA.alto / 2);
  });

  it('los eventos son inmutables', () => {
    const d = deposito({ id: 'A', espesor: 100, litologia: 'caliza' });
    expect(Object.isFrozen(d)).toBe(true);
    expect(() => {
      d.espesor = 5;
    }).toThrow(TypeError);
  });

  it('crearEvento construye según el tipo y rechaza tipos desconocidos', () => {
    expect(crearEvento({ tipo: 'deposito', id: 'A', espesor: 50, litologia: 'lutita' })).toEqual(
      deposito({ id: 'A', espesor: 50, litologia: 'lutita' }),
    );
    expect(() => crearEvento({ tipo: 'pliegue', id: 'P' })).toThrow(RangeError);
    expect(() => crearEvento(null)).toThrow(TypeError);
  });

  it('esUnidad: solo depósitos y diques crean roca', () => {
    expect([...MOVILES, ...FIJOS].filter(esUnidad).map((e) => e.tipo).sort()).toEqual(['deposito', 'dique']);
  });

  it('rechaza ángulos y echados fuera de rango', () => {
    const pivote = { x: 0, z: 0 };
    expect(() => basculamiento({ id: 'T', angulo: 5, sentido: 'derecha', pivote })).toThrow(RangeError);
    expect(() => basculamiento({ id: 'T', angulo: 65, sentido: 'derecha', pivote })).toThrow(RangeError);
    const baseFalla = { id: 'F', posicion: 500, sentidoEchado: 'derecha', tipoFalla: 'normal', desplazamiento: 50 };
    expect(() => falla({ ...baseFalla, echado: 40 })).toThrow(RangeError);
    expect(() => falla({ ...baseFalla, echado: 85 })).toThrow(RangeError);
    const baseDique = { id: 'D', posicion: 500, sentidoEchado: 'derecha', espesor: 20, litologia: 'basalto' };
    expect(() => dique({ ...baseDique, echado: 55 })).toThrow(RangeError);
    expect(() => dique({ ...baseDique, echado: 95 })).toThrow(RangeError);
    expect(() => erosion({ id: 'E', nivel: 300, amplitud: 25 })).toThrow(RangeError);
  });

  it('rechaza espesores y desplazamientos no positivos', () => {
    expect(() => deposito({ id: 'A', espesor: 0, litologia: 'caliza' })).toThrow(RangeError);
    expect(() => deposito({ id: 'A', espesor: -10, litologia: 'caliza' })).toThrow(RangeError);
    expect(() =>
      falla({ id: 'F', posicion: 500, echado: 60, sentidoEchado: 'derecha', tipoFalla: 'normal', desplazamiento: 0 }),
    ).toThrow(RangeError);
  });

  it('rechaza litologías que no corresponden al tipo de evento', () => {
    expect(() => deposito({ id: 'A', espesor: 100, litologia: 'basalto' })).toThrow(RangeError);
    expect(() =>
      dique({ id: 'D', posicion: 500, echado: 80, sentidoEchado: 'derecha', espesor: 20, litologia: 'arenisca' }),
    ).toThrow(RangeError);
  });

  it('rechaza sentidos, tipos de falla, ids y números inválidos', () => {
    expect(() => basculamiento({ id: 'T', angulo: 20, sentido: 'este', pivote: { x: 0, z: 0 } })).toThrow(RangeError);
    expect(() =>
      falla({ id: 'F', posicion: 500, echado: 60, sentidoEchado: 'derecha', tipoFalla: 'lateral', desplazamiento: 50 }),
    ).toThrow(RangeError);
    expect(() => deposito({ id: '', espesor: 100, litologia: 'caliza' })).toThrow(TypeError);
    expect(() => deposito({ espesor: 100, litologia: 'caliza' })).toThrow(TypeError);
    expect(() => deposito({ id: 'A', espesor: NaN, litologia: 'caliza' })).toThrow(TypeError);
    expect(() => basculamiento({ id: 'T', angulo: 20, sentido: 'derecha', pivote: { x: 0 } })).toThrow(TypeError);
  });
});
