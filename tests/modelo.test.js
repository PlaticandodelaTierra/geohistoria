import { describe, it, expect } from 'vitest';
import { crearModelo, VENTANA, AIRE } from '../src/motor/modelo.js';
import { deposito, basculamiento, falla, dique, erosion, esUnidad } from '../src/motor/eventos.js';
import { EJEMPLOS } from '../src/ejemplos.js';

const RAD = Math.PI / 180;

function ejemplo(id) {
  return crearModelo(EJEMPLOS.find((e) => e.id === id).historia);
}

// Revisa una lista de puntos de control [x, z, id esperado].
function revisarPuntos(modelo, puntos) {
  for (const [x, z, esperado] of puntos) {
    expect(modelo.unidadEn(x, z), `punto (${x}, ${z})`).toBe(esperado);
  }
}

describe('secciones hechas a mano: puntos de control', () => {
  it('Tres capas y un dique', () => {
    // Capas: A 0–160, B 160–320, C 320–620. Dique D: centro en x = 560 a z = 250, echado 80° a la izquierda,
    // espesor 36 (±18 perpendicular ≈ ±18.3 en horizontal).
    revisarPuntos(ejemplo('capas-y-dique'), [
      [200, 80, 'A'],
      [200, 240, 'B'],
      [200, 450, 'C'],
      [800, 80, 'A'],
      [800, 400, 'C'],
      [560, 250, 'D'],
      [575, 250, 'D'],
      [590, 250, 'B'], // 30 unidades en horizontal ≈ 29.5 perpendicular: fuera del dique
      [530, 80, 'D'], // a z = 80 el centro del dique está en x = 560 − 170/tan(80°) ≈ 530
      // Sobre el centro del dique (x = 560 + 400/tan(80°) ≈ 630.5), pero arriba del techo de C (620):
      // aire, porque el dique no entra en el aire de su época.
      [630.5, 650, null],
    ]);
  });

  it('Falla que corta un dique', () => {
    // Falla normal de 60° a la izquierda: el bloque de techo (izquierda) bajó 110 a lo largo del echado
    // (55 a la izquierda y 95.3 hacia abajo).
    revisarPuntos(ejemplo('falla-corta-dique'), [
      // Bloque de piso (derecha): contactos en 140, 280 y 420.
      [800, 70, 'A'],
      [800, 210, 'B'],
      [800, 350, 'C'],
      [800, 470, 'D'],
      // Bloque de techo (izquierda): contactos bajados ≈ 95 → 45, 185, 325.
      [100, 20, 'A'],
      [100, 100, 'B'],
      [100, 250, 'C'],
      [100, 400, 'D'],
      // El dique E (vertical en x = 380) quedó partido: arriba de la falla se movió a x ≈ 325.
      [325, 300, 'E'],
      [380, 60, 'E'],
      [380, 300, 'C'],
    ]);
  });

  it('Discordancia angular', () => {
    // Cuatro capas (A–D, de 150 cada una) basculadas 30° a la derecha alrededor de (500, 250),
    // erosión en z ≈ 300 ± 10, después G (techo 390) y H (techo 590).
    revisarPuntos(ejemplo('discordancia-angular'), [
      [100, 50, 'A'],
      [500, 200, 'B'],
      [900, 150, 'C'],
      [980, 270, 'D'],
      [500, 350, 'G'],
      [500, 450, 'H'],
      [500, 600, null],
    ]);
  });

  it('Combinación', () => {
    // Puntos calculados a mano siguiendo la historia hacia adelante:
    // falla E (normal, 60° a la izquierda, 80) y luego basculamiento F (20° a la izquierda, pivote (500, 250)).
    revisarPuntos(ejemplo('combinacion'), [
      [900, 100, 'A'], // bloque de piso; antes del basculamiento estaba en (825, −28)
      [100, 200, 'C'], // bloque de techo; antes de la falla estaba en (147, 409)
      [235, 239, 'D'], // dique D en el bloque de techo; antes de la falla, su centro en z = 400
      [367, 63, 'D'], // dique D en el bloque de piso; su centro en z = 120
      [175, 367, 'H'], // donde estaría el dique D (z = 540) la erosión lo quitó: ahora hay conglomerado H
      [500, 360, 'H'],
      [500, 450, 'I'],
      [760, 250, 'J'], // dique de granito: corta también las capas nuevas
      [813.6, 450, 'J'],
    ]);
  });

  it('todas las unidades de cada ejemplo se ven en la ventana', () => {
    for (const { id, historia } of EJEMPLOS) {
      const modelo = crearModelo(historia);
      const vistas = new Set();
      for (let x = 2.5; x < VENTANA.ancho; x += 5) {
        for (let z = 2.5; z < VENTANA.alto; z += 5) {
          vistas.add(modelo.unidadEn(x, z));
        }
      }
      const esperadas = modelo.eventos.filter(esUnidad).map((e) => e.id);
      expect([...vistas].filter(Boolean).sort(), id).toEqual(esperadas.sort());
      expect(vistas.has(null), `${id} no debe mostrar aire`).toBe(false);
    }
  });
});

describe('depósitos y techos', () => {
  it('el espesor se acumula desde el nivel base; arriba del último techo hay aire', () => {
    const modelo = crearModelo([
      deposito({ id: 'A', espesor: 100, litologia: 'caliza' }),
      deposito({ id: 'B', espesor: 50, litologia: 'lutita' }),
    ]);
    expect(modelo.techos).toEqual([100, 150]);
    revisarPuntos(modelo, [
      [500, 90, 'A'],
      [500, 120, 'B'],
      [500, 151, null],
      [500, -1000, 'A'], // la primera capa se extiende hacia abajo
    ]);
    expect(modelo.indiceEn(500, 151)).toBe(AIRE);
    expect(modelo.indiceEn(500, 120)).toBe(1);
  });

  it('después de una erosión, el espesor se mide desde el nivel de la erosión', () => {
    const modelo = crearModelo([
      deposito({ id: 'A', espesor: 300, litologia: 'caliza' }),
      erosion({ id: 'E', nivel: 200 }),
      deposito({ id: 'B', espesor: 50, litologia: 'arenisca' }),
    ]);
    expect(modelo.techos).toEqual([300, null, 250]);
    revisarPuntos(modelo, [
      [500, 190, 'A'],
      [500, 220, 'B'],
      [500, 260, null],
    ]);
  });

  it('una capa nueva rellena el escarpe de una falla y se acuña contra él', () => {
    // Falla normal de 60° a la derecha: el bloque de techo (derecha) baja 86.6 y su tope queda en 113.4.
    // B (techo 240) rellena ese bajo y cubre también el bloque de piso.
    const modelo = crearModelo([
      deposito({ id: 'A', espesor: 200, litologia: 'caliza' }),
      falla({ id: 'F', posicion: 500, echado: 60, sentidoEchado: 'derecha', tipoFalla: 'normal', desplazamiento: 100 }),
      deposito({ id: 'B', espesor: 40, litologia: 'arenisca' }),
    ]);
    revisarPuntos(modelo, [
      [800, 100, 'A'],
      [800, 150, 'B'], // en el bloque de techo, B ocupa el lugar que dejó A al bajar
      [200, 150, 'A'], // en el bloque de piso, A sigue hasta 200
      [200, 220, 'B'],
      [200, 250, null],
      [800, 250, null],
    ]);
  });

  it('falla inversa: el bloque de techo sube', () => {
    const modelo = crearModelo([
      deposito({ id: 'A', espesor: 100, litologia: 'caliza' }),
      deposito({ id: 'B', espesor: 100, litologia: 'lutita' }),
      deposito({ id: 'C', espesor: 400, litologia: 'arenisca' }),
      falla({ id: 'F', posicion: 500, echado: 60, sentidoEchado: 'derecha', tipoFalla: 'inversa', desplazamiento: 100 }),
    ]);
    // El contacto A/B sube de 100 a ≈ 186.6 en el bloque de techo (derecha).
    revisarPuntos(modelo, [
      [800, 150, 'A'],
      [200, 150, 'B'],
    ]);
  });
});

describe('diques y erosión', () => {
  it('un dique solo ocupa roca que ya existía: no entra en el aire de su época', () => {
    const modelo = crearModelo([
      deposito({ id: 'A', espesor: 200, litologia: 'caliza' }),
      dique({ id: 'D', posicion: 500, echado: 90, sentidoEchado: 'derecha', espesor: 40, litologia: 'basalto' }),
      deposito({ id: 'B', espesor: 100, litologia: 'lutita' }),
    ]);
    revisarPuntos(modelo, [
      [500, 100, 'D'],
      [500, 250, 'B'],
      [500, 350, null],
      [700, 100, 'A'],
    ]);
  });

  it('una erosión trunca un dique y lo que queda arriba lo ocupa la capa nueva', () => {
    const modelo = crearModelo([
      deposito({ id: 'A', espesor: 300, litologia: 'caliza' }),
      dique({ id: 'D', posicion: 500, echado: 90, sentidoEchado: 'derecha', espesor: 40, litologia: 'basalto' }),
      erosion({ id: 'E', nivel: 200 }),
      deposito({ id: 'B', espesor: 100, litologia: 'arenisca' }),
    ]);
    revisarPuntos(modelo, [
      [500, 150, 'D'],
      [500, 250, 'B'],
      [700, 150, 'A'],
      [700, 250, 'B'],
    ]);
  });

  it('un basculamiento inclina las capas alrededor del pivote', () => {
    // El contacto A/B pasaba por el pivote; después queda en z = 250 − (x − 500)·tan(30°).
    const modelo = crearModelo([
      deposito({ id: 'A', espesor: 250, litologia: 'caliza' }),
      deposito({ id: 'B', espesor: 250, litologia: 'lutita' }),
      basculamiento({ id: 'T', angulo: 30, sentido: 'derecha', pivote: { x: 500, z: 250 } }),
    ]);
    revisarPuntos(modelo, [
      [700, 150, 'B'],
      [700, 120, 'A'],
      [300, 340, 'A'],
      [300, 390, 'B'],
    ]);
  });
});

describe('alPresente', () => {
  it('lleva un punto desde el momento de un evento hasta hoy', () => {
    const modelo = ejemplo('falla-corta-dique');
    // Un punto del dique E (índice 4) en el bloque de techo: la falla F lo mueve 55 a la izquierda y 95.3 abajo.
    const hoy = modelo.alPresente(4, { x: 380, z: 300 + 110 * Math.sin(60 * RAD) });
    expect(hoy.x).toBeCloseTo(325, 8);
    expect(hoy.z).toBeCloseTo(300, 8);
    expect(modelo.unidadEn(hoy.x, hoy.z)).toBe('E');
  });

  it('desde el último evento, el punto no cambia', () => {
    const modelo = ejemplo('combinacion');
    expect(modelo.alPresente(modelo.eventos.length - 1, { x: 12, z: 34 })).toEqual({ x: 12, z: 34 });
  });
});

describe('validación de la historia', () => {
  it('acepta objetos simples con `tipo` y los valida', () => {
    const modelo = crearModelo([{ tipo: 'deposito', id: 'A', espesor: 100, litologia: 'caliza' }]);
    expect(modelo.unidadEn(500, 50)).toBe('A');
    expect(() => crearModelo([{ tipo: 'deposito', id: 'A', espesor: -1, litologia: 'caliza' }])).toThrow(RangeError);
  });

  it('rechaza historias vacías o que no son listas', () => {
    expect(() => crearModelo([])).toThrow(TypeError);
    expect(() => crearModelo(null)).toThrow(TypeError);
  });

  it('el primer evento debe ser un depósito', () => {
    expect(() =>
      crearModelo([dique({ id: 'D', posicion: 500, echado: 90, sentidoEchado: 'derecha', espesor: 30, litologia: 'basalto' })]),
    ).toThrow(RangeError);
  });

  it('rechaza ids repetidos y tipos desconocidos', () => {
    expect(() =>
      crearModelo([
        deposito({ id: 'A', espesor: 100, litologia: 'caliza' }),
        deposito({ id: 'A', espesor: 100, litologia: 'lutita' }),
      ]),
    ).toThrow(RangeError);
    expect(() =>
      crearModelo([deposito({ id: 'A', espesor: 100, litologia: 'caliza' }), { tipo: 'sill', id: 'S' }]),
    ).toThrow(RangeError);
  });

  it('el modelo es inmutable', () => {
    const modelo = ejemplo('capas-y-dique');
    expect(Object.isFrozen(modelo)).toBe(true);
    expect(Object.isFrozen(modelo.eventos)).toBe(true);
    expect(Object.isFrozen(modelo.techos)).toBe(true);
  });
});
