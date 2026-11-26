import { describe, it, expect } from 'vitest';
import {
  fechaLocal,
  nivelDelDia,
  diaAnterior,
  fechaLegible,
  cuadros,
  textoParaCompartir,
  registrarResultado,
  rachaVigente,
  crearAlmacen,
} from '../src/ui/logicaReto.js';
import { generarSeccion } from '../src/motor/generador.js';

// Almacenamiento falso con la interfaz de localStorage.
function almacenamientoFalso() {
  const datos = new Map();
  return {
    getItem: (k) => (datos.has(k) ? datos.get(k) : null),
    setItem: (k, v) => datos.set(k, String(v)),
    removeItem: (k) => datos.delete(k),
  };
}

describe('fecha y nivel del reto', () => {
  it('la fecha es la local, en formato AAAA-MM-DD', () => {
    expect(fechaLocal(new Date(2026, 10, 26, 23, 59))).toBe('2026-11-26');
    expect(fechaLocal(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
  });

  it('el nivel rota según el día de la semana', () => {
    // 23 de noviembre de 2026 es lunes.
    const niveles = Array.from({ length: 7 }, (_, i) => nivelDelDia(new Date(2026, 10, 23 + i)));
    expect(niveles).toEqual([1, 1, 2, 2, 3, 3, 3]); // lunes a domingo
  });

  it('día anterior, incluidos fin de mes, de año y bisiestos', () => {
    expect(diaAnterior('2026-11-26')).toBe('2026-11-25');
    expect(diaAnterior('2026-03-01')).toBe('2026-02-28');
    expect(diaAnterior('2024-03-01')).toBe('2024-02-29');
    expect(diaAnterior('2026-01-01')).toBe('2025-12-31');
  });

  it('fecha legible en español', () => {
    expect(fechaLegible('2026-11-26')).toBe('26 nov 2026');
    expect(fechaLegible('2026-11-26', true)).toBe('26 de noviembre de 2026');
  });

  it('el mismo día da el mismo ejercicio; días distintos, ejercicios distintos', () => {
    expect(generarSeccion('2026-11-26', 2).historia).toEqual(generarSeccion('2026-11-26', 2).historia);
    expect(generarSeccion('2026-11-27', 2).historia).not.toEqual(generarSeccion('2026-11-26', 2).historia);
  });
});

describe('texto para compartir', () => {
  const base = { fecha: '2026-11-26', nivel: 2, enlace: 'https://x.github.io/geohistoria/#reto' };

  it('resume el resultado con cuadros por posición', () => {
    const texto = textoParaCompartir({
      ...base,
      intentos: [
        [false, true, false],
        [true, true, true],
      ],
      resuelto: true,
      racha: 5,
    });
    expect(texto).toBe(
      [
        'GeoHistoria · Reto del 26 nov 2026 (nivel 2)',
        'Resuelto en 2 intentos · racha: 5 días',
        '🟥🟩🟥',
        '🟩🟩🟩',
        'https://x.github.io/geohistoria/#reto',
      ].join('\n'),
    );
  });

  it('al primer intento, con racha de un día, o rindiéndose', () => {
    expect(textoParaCompartir({ ...base, intentos: [[true]], resuelto: true, racha: 1 })).toContain(
      'Resuelto al primer intento · racha: 1 día',
    );
    expect(textoParaCompartir({ ...base, intentos: [[false]], resuelto: false, racha: 0 })).toContain(
      'Vi la solución después de 1 intento',
    );
    expect(textoParaCompartir({ ...base, intentos: [], resuelto: false, racha: 0 })).toContain('Vi la solución\n');
  });

  it('no revela la respuesta: no contiene ninguna letra de evento suelta ni el orden', () => {
    const seccion = generarSeccion('2026-11-26', 2);
    const texto = textoParaCompartir({
      ...base,
      intentos: [seccion.orden.map(() => true)],
      resuelto: true,
      racha: 3,
    });
    expect(texto).not.toMatch(/\b[A-Z]\b/);
    expect(texto).not.toContain(seccion.orden.join(''));
    expect(texto).not.toContain(seccion.orden.join(', '));
  });

  it('cuadros', () => {
    expect(cuadros([true, false, true])).toBe('🟩🟥🟩');
  });
});

describe('racha', () => {
  const vacio = { racha: 0, ultimoResuelto: null, resultados: {} };
  const resuelto = { intentos: [[true]], resuelto: true, rendido: false };
  const rendido = { intentos: [[false]], resuelto: false, rendido: true };

  it('crece con días seguidos resueltos', () => {
    let datos = registrarResultado(vacio, '2026-11-24', resuelto);
    datos = registrarResultado(datos, '2026-11-25', resuelto);
    datos = registrarResultado(datos, '2026-11-26', resuelto);
    expect(datos.racha).toBe(3);
    expect(rachaVigente(datos, '2026-11-26')).toBe(3);
    expect(rachaVigente(datos, '2026-11-27')).toBe(3); // hoy todavía no juega: sigue viva
  });

  it('se reinicia si se salta un día, y se pierde si ayer no se resolvió', () => {
    let datos = registrarResultado(vacio, '2026-11-20', resuelto);
    datos = registrarResultado(datos, '2026-11-21', resuelto);
    expect(rachaVigente(datos, '2026-11-23')).toBe(0);
    datos = registrarResultado(datos, '2026-11-23', resuelto);
    expect(datos.racha).toBe(1);
  });

  it('rendirse no suma a la racha; resolver dos veces el mismo día tampoco', () => {
    let datos = registrarResultado(vacio, '2026-11-25', resuelto);
    datos = registrarResultado(datos, '2026-11-26', rendido);
    expect(datos.racha).toBe(1);
    expect(rachaVigente(datos, '2026-11-27')).toBe(0);
    datos = registrarResultado(vacio, '2026-11-26', resuelto);
    datos = registrarResultado(datos, '2026-11-26', resuelto);
    expect(datos.racha).toBe(1);
  });

  it('guarda solo los últimos 60 días de resultados', () => {
    let datos = vacio;
    for (let d = 0; d < 70; d++) {
      const fecha = new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10);
      datos = registrarResultado(datos, fecha, resuelto);
    }
    expect(Object.keys(datos.resultados)).toHaveLength(60);
    expect(datos.racha).toBe(70);
  });
});

describe('almacén', () => {
  it('guarda y lee', () => {
    const almacen = crearAlmacen(almacenamientoFalso());
    const datos = registrarResultado(almacen.leer(), '2026-11-26', { intentos: [[true]], resuelto: true, rendido: false });
    expect(almacen.guardar(datos)).toBe(true);
    expect(almacen.leer()).toEqual(datos);
    expect(almacen.disponible).toBe(true);
  });

  it('funciona sin localStorage o si falla (sin guardar nada)', () => {
    const sinAlmacen = crearAlmacen(null);
    expect(sinAlmacen.disponible).toBe(false);
    expect(sinAlmacen.leer()).toEqual({ racha: 0, ultimoResuelto: null, resultados: {} });
    expect(sinAlmacen.guardar({ racha: 1 })).toBe(false);

    const fallido = crearAlmacen({
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    });
    expect(fallido.leer()).toEqual({ racha: 0, ultimoResuelto: null, resultados: {} });
    expect(fallido.guardar({ racha: 1 })).toBe(false);
    expect(fallido.disponible).toBe(false);
  });

  it('ignora datos guardados que no son JSON válido', () => {
    const almacenamiento = almacenamientoFalso();
    almacenamiento.setItem('geohistoria-reto', '{roto');
    expect(crearAlmacen(almacenamiento).leer()).toEqual({ racha: 0, ultimoResuelto: null, resultados: {} });
  });
});
