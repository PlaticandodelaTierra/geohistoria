import { describe, it, expect } from 'vitest';
import { generarSeccion, revisarSeccion, componer, NIVELES } from '../src/motor/generador.js';
import { crearRng } from '../src/rng.js';
import { deposito, dique } from '../src/motor/eventos.js';
import { EJEMPLOS } from '../src/ejemplos.js';
import { verificarSeccion } from './ayudas/verificar.js';

// Prueba rápida (parte de `npm test`). La prueba masiva de 2,000 semillas por nivel está en
// tests/masiva/ y se corre con `npm run test:masiva`.
const SEMILLAS_RAPIDAS = 50;

describe('generarSeccion', () => {
  it('es determinista: la misma semilla y nivel dan la misma sección', () => {
    for (const nivel of NIVELES) {
      const a = generarSeccion(48213, nivel);
      const b = generarSeccion(48213, nivel);
      expect(b.historia).toEqual(a.historia);
      expect(b.aristas).toEqual(a.aristas);
      expect(b.orden).toEqual(a.orden);
      expect(b.intentos).toBe(a.intentos);
    }
  });

  it('una semilla de texto con solo dígitos equivale al número (semilla de la URL)', () => {
    expect(generarSeccion('48213', 2).historia).toEqual(generarSeccion(48213, 2).historia);
  });

  it('acepta textos como semilla (reto diario)', () => {
    const hoy = generarSeccion('2026-11-25', 3);
    expect(hoy.historia).toEqual(generarSeccion('2026-11-25', 3).historia);
    expect(generarSeccion('2026-11-26', 3).historia).not.toEqual(hoy.historia);
  });

  it('semillas distintas dan secciones distintas', () => {
    const firmas = new Set();
    for (let s = 1; s <= 20; s++) {
      firmas.add(JSON.stringify(generarSeccion(s, 2).historia));
    }
    expect(firmas.size).toBe(20);
  });

  it('rechaza niveles inválidos', () => {
    expect(() => generarSeccion(1, 0)).toThrow(RangeError);
    expect(() => generarSeccion(1, 4)).toThrow(RangeError);
    expect(() => generarSeccion(1, '2')).toThrow(RangeError);
  });

  it('informa los intentos y los motivos de rechazo', () => {
    const r = generarSeccion(7, 3);
    expect(r.intentos).toBeGreaterThanOrEqual(1);
    const rechazados = Object.values(r.rechazos).reduce((a, b) => a + b, 0);
    expect(rechazados).toBe(r.intentos - 1);
    expect(r.semillaUsada).toBe(7);
    expect(r.avisos).toEqual([]);
  });
});

describe(`muestra rápida: ${SEMILLAS_RAPIDAS} semillas por nivel cumplen todas las reglas`, () => {
  for (const nivel of NIVELES) {
    it(`nivel ${nivel}`, () => {
      const fallas = [];
      for (let semilla = 1; semilla <= SEMILLAS_RAPIDAS; semilla++) {
        const problemas = verificarSeccion(generarSeccion(semilla, nivel));
        if (problemas.length > 0) fallas.push({ semilla, problemas });
      }
      expect(fallas).toEqual([]);
    }, 30_000);
  }
});

describe('composición', () => {
  it('se sortea una vez por semilla: todos los intentos de una semilla comparten composición', () => {
    // Con la composición fija, el número de eventos y los tipos de falla no dependen de cuántos intentos
    // hicieron falta; por eso las composiciones difíciles no quedan subrepresentadas.
    const r = generarSeccion(3, 2);
    const firma = (historia) => historia.map((e) => (e.tipo === 'falla' ? `falla-${e.tipoFalla}` : e.tipo));
    expect(r.intentos).toBeGreaterThan(1);
    const composicion = componer(crearRng(r.semillaUsada), 2);
    expect(r.historia.length).toBe(composicion.capas + composicion.estructuras.length);
    expect(firma(r.historia).slice(composicion.capas)).toEqual(
      composicion.estructuras.map((e) => (e.tipo === 'falla' ? `falla-${e.tipoFalla}` : e.tipo)),
    );
  });

  it('reparte el número de eventos de forma pareja', () => {
    // 300 composiciones de nivel 2: cada total (5, 6 y 7) sale entre el 25 % y el 42 %.
    const conteo = { 5: 0, 6: 0, 7: 0 };
    for (let s = 1; s <= 300; s++) {
      const c = componer(crearRng(s), 2);
      conteo[c.capas + c.estructuras.length] += 1;
    }
    for (const veces of Object.values(conteo)) {
      expect(veces / 300).toBeGreaterThan(0.25);
      expect(veces / 300).toBeLessThan(0.42);
    }
  });
});

describe('revisarSeccion', () => {
  const ejemplo = (id) => EJEMPLOS.find((e) => e.id === id).historia;

  it('acepta las secciones hechas a mano con orden único', () => {
    expect(revisarSeccion(ejemplo('capas-y-dique'), 1).valida).toBe(true);
    expect(revisarSeccion(ejemplo('falla-corta-dique'), 2).valida).toBe(true);
    expect(revisarSeccion(ejemplo('discordancia-angular'), 3).valida).toBe(true);
  });

  it('rechaza la combinación hecha a mano', () => {
    // Tiene dos astillas de una celda (de A y de B) junto a la discordancia, en el borde derecho;
    // además su orden no es único (ver evidencias.test.js).
    expect(revisarSeccion(ejemplo('combinacion'), 3)).toEqual({ valida: false, motivo: 'astilla' });
  });

  it('rechaza un dique cubierto por una capa sin erosión (regla 4: su orden no se ve)', () => {
    const historia = [
      deposito({ id: 'A', espesor: 300, litologia: 'lutita' }),
      dique({ id: 'D', posicion: 500, echado: 90, sentidoEchado: 'derecha', espesor: 40, litologia: 'basalto' }),
      deposito({ id: 'B', espesor: 300, litologia: 'arenisca' }),
    ];
    expect(revisarSeccion(historia, 1).motivo).toBe('orden no único');
  });

  it('rechaza secciones con aire en la ventana', () => {
    const historia = [
      deposito({ id: 'A', espesor: 200, litologia: 'lutita' }),
      deposito({ id: 'B', espesor: 200, litologia: 'arenisca' }),
    ];
    expect(revisarSeccion(historia, 1).motivo).toBe('aire en la ventana');
  });

  it('rechaza astillas y unidades que no se ven', () => {
    const astilla = [
      deposito({ id: 'A', espesor: 5, litologia: 'lutita' }), // franja de 5 de alto en el borde inferior
      deposito({ id: 'B', espesor: 600, litologia: 'arenisca' }),
    ];
    expect(revisarSeccion(astilla, 1).motivo).toBe('astilla');
    const fuera = [
      deposito({ id: 'A', espesor: 300, litologia: 'lutita' }),
      deposito({ id: 'B', espesor: 300, litologia: 'arenisca' }),
      dique({ id: 'D', posicion: 2000, echado: 90, sentidoEchado: 'derecha', espesor: 30, litologia: 'basalto' }),
    ];
    expect(revisarSeccion(fuera, 1).motivo).toBe('unidad invisible');
  });
});
