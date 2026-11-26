import { describe, it, expect } from 'vitest';
import {
  leerParametros,
  rutaDePractica,
  mover,
  respuestaInicial,
  tarjetasDesdeRespuesta,
  respuestaDesdeTarjetas,
  evaluarRespuesta,
} from '../src/ui/logica.js';
import { crearEstado } from '../src/state.js';
import { generarSeccion, NIVELES } from '../src/motor/generador.js';
import { detectarEvidencias } from '../src/motor/evidencias.js';
import { seccionSVG } from '../src/render/seccion.js';
import { EJEMPLOS } from '../src/ejemplos.js';

describe('parámetros de la URL', () => {
  it('lee nivel y semilla válidos', () => {
    expect(leerParametros('n=2&s=48213')).toEqual({ nivel: 2, semilla: 48213 });
    expect(leerParametros(new URLSearchParams('s=7&n=3'))).toEqual({ nivel: 3, semilla: 7 });
    expect(leerParametros('n=1&s=0')).toEqual({ nivel: 1, semilla: 0 });
  });

  it('devuelve null en lo que falte o sea inválido', () => {
    expect(leerParametros('')).toEqual({ nivel: null, semilla: null });
    expect(leerParametros('n=4&s=12')).toEqual({ nivel: null, semilla: 12 });
    expect(leerParametros('n=dos&s=12')).toEqual({ nivel: null, semilla: 12 });
    expect(leerParametros('n=2&s=-5')).toEqual({ nivel: 2, semilla: null });
    expect(leerParametros('n=2&s=12abc')).toEqual({ nivel: 2, semilla: null });
    expect(leerParametros('n=2&s=1.5')).toEqual({ nivel: 2, semilla: null });
    expect(leerParametros('n=2&s=99999999999')).toEqual({ nivel: 2, semilla: null });
  });

  it('escribe la ruta de un ejercicio y se puede volver a leer', () => {
    expect(rutaDePractica(2, 48213)).toBe('practica?n=2&s=48213');
    const consulta = rutaDePractica(3, 1).split('?')[1];
    expect(leerParametros(consulta)).toEqual({ nivel: 3, semilla: 1 });
  });
});

describe('mover tarjetas', () => {
  const lista = ['A', 'B', 'C', 'D'];

  it('mueve hacia arriba y hacia abajo sin modificar la lista original', () => {
    expect(mover(lista, 3, 0)).toEqual(['D', 'A', 'B', 'C']);
    expect(mover(lista, 0, 2)).toEqual(['B', 'C', 'A', 'D']);
    expect(mover(lista, 1, 2)).toEqual(['A', 'C', 'B', 'D']);
    expect(lista).toEqual(['A', 'B', 'C', 'D']);
  });

  it('ignora posiciones fuera de la lista', () => {
    expect(mover(lista, 0, -1)).toEqual(lista);
    expect(mover(lista, 3, 4)).toEqual(lista);
  });
});

describe('orden de las tarjetas', () => {
  it('en pantalla, lo más joven va arriba: las tarjetas son la respuesta al revés', () => {
    expect(tarjetasDesdeRespuesta(['A', 'B', 'C'])).toEqual(['C', 'B', 'A']);
    expect(respuestaDesdeTarjetas(['C', 'B', 'A'])).toEqual(['A', 'B', 'C']);
  });

  it('el orden inicial nunca es la solución (50 semillas por nivel)', () => {
    for (const nivel of NIVELES) {
      for (let semilla = 1; semilla <= 50; semilla++) {
        const seccion = generarSeccion(semilla, nivel);
        const inicial = respuestaInicial(seccion.historia);
        expect(inicial).toEqual([...inicial].sort());
        expect(inicial.join('')).not.toBe(seccion.orden.join(''));
      }
    }
  }, 30_000);
});

describe('evaluar una respuesta', () => {
  // Sección hecha a mano "Tres capas y un dique": orden A, B, C, D.
  const { historia } = EJEMPLOS.find((e) => e.id === 'capas-y-dique');
  const seccion = { historia, aristas: detectarEvidencias(historia).aristas, orden: ['A', 'B', 'C', 'D'] };

  it('una respuesta correcta: todo en su lugar y sin evidencias contradichas', () => {
    const r = evaluarRespuesta(seccion, ['A', 'B', 'C', 'D']);
    expect(r.correcta).toBe(true);
    expect(r.enSuLugar).toBe(4);
    expect(r.posiciones.every((p) => p.correcta)).toBe(true);
    expect(r.contradichas).toEqual([]);
  });

  it('un par intercambiado: esas dos posiciones fallan y se señala la evidencia que lo contradice', () => {
    const r = evaluarRespuesta(seccion, ['A', 'B', 'D', 'C']);
    expect(r.correcta).toBe(false);
    expect(r.enSuLugar).toBe(2);
    expect(r.posiciones.map((p) => p.correcta)).toEqual([true, true, false, false]);
    expect(r.contradichas.map((a) => `${a.desde}→${a.hacia}`)).toEqual(['C→D']);
    expect(r.contradichas[0].explicacion.es).toBe(
      'El dique D corta a la capa C, así que D es más joven que C (principio de relaciones de corte).',
    );
  });

  it('solo señala evidencias directas, sin repetir, en el orden de la sección', () => {
    // Todo al revés: se contradicen todas las aristas de la sección.
    const r = evaluarRespuesta(seccion, ['D', 'C', 'B', 'A']);
    expect(r.contradichas).toEqual(seccion.aristas);
    expect(new Set(r.contradichas).size).toBe(r.contradichas.length);
  });

  it('funciona con secciones generadas', () => {
    const generada = generarSeccion(48213, 3);
    expect(evaluarRespuesta(generada, generada.orden).correcta).toBe(true);
    const inicial = evaluarRespuesta(generada, respuestaInicial(generada.historia));
    expect(inicial.correcta).toBe(false);
    expect(inicial.contradichas.length).toBeGreaterThan(0);
  });
});

describe('estado con suscripción', () => {
  it('actualiza, avisa a los suscriptores y permite darse de baja', () => {
    const estado = crearEstado({ a: 1, b: 2 });
    const avisos = [];
    const baja = estado.suscribir((nuevo, anterior) => avisos.push([nuevo.a, anterior.a]));
    estado.actualizar({ a: 5 });
    expect(estado.obtener()).toEqual({ a: 5, b: 2 });
    expect(avisos).toEqual([[5, 1]]);
    baja();
    estado.actualizar({ a: 6 });
    expect(avisos).toHaveLength(1);
  });

  it('el estado es inmutable', () => {
    const estado = crearEstado({ lista: [1] });
    expect(Object.isFrozen(estado.obtener())).toBe(true);
    expect(() => {
      estado.obtener().lista = [];
    }).toThrow(TypeError);
  });
});

describe('la sección dibujada se puede resaltar', () => {
  it('cada evento tiene algo con su data-id en el SVG (unidad, línea o símbolo)', () => {
    const historias = [
      ...EJEMPLOS.map((e) => e.historia),
      ...NIVELES.flatMap((nivel) => [1, 2, 3].map((s) => generarSeccion(s, nivel).historia)),
    ];
    for (const historia of historias) {
      const svg = seccionSVG(historia);
      for (const { id } of historia) {
        expect(svg, `falta data-id="${id}"`).toContain(`data-id="${id}"`);
      }
    }
  });

  it('el basculamiento se marca con un símbolo con su letra', () => {
    const { historia } = EJEMPLOS.find((e) => e.id === 'discordancia-angular');
    expect(seccionSVG(historia)).toMatch(/<g class="simbolo" data-id="E"/);
  });
});
