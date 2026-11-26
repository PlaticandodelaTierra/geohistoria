// Prueba masiva del generador: 2,000 semillas por nivel (CLAUDE.md).
// Cada sección se verifica de forma independiente (tests/ayudas/verificar.js) y al final se escribe un
// informe con los intentos, las semillas agotadas, la variedad de eventos y el tiempo, en
// informes/prueba-masiva-nivel-N.txt (Vitest no muestra la consola de las pruebas que pasan).
// Se corre con `npm run test:masiva` (un archivo por nivel, en paralelo).

import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, it, expect, afterAll } from 'vitest';
import { generarSeccion } from '../../src/motor/generador.js';
import { verificarSeccion } from '../ayudas/verificar.js';

export const SEMILLAS = 2000;

export function probarNivel(nivel, cantidad = SEMILLAS) {
  const datos = {
    intentos: [],
    semillasAgotadas: 0,
    eventos: {},
    tipos: { deposito: 0, basculamiento: 0, erosion: 0, falla: 0, dique: 0 },
    fallas: { normal: 0, inversa: 0 },
    diques: { basalto: 0, granito: 0 },
    rechazos: {},
    milisegundos: 0,
  };

  describe(`Nivel ${nivel}: ${cantidad} semillas`, () => {
    it('cada sección generada cumple todas las reglas', () => {
      const fallas = [];
      const inicio = performance.now();
      for (let semilla = 1; semilla <= cantidad; semilla++) {
        const r = generarSeccion(semilla, nivel);
        const problemas = verificarSeccion(r);
        if (problemas.length > 0) fallas.push({ semilla, problemas });
        registrar(datos, r);
      }
      datos.milisegundos = performance.now() - inicio;
      expect(fallas).toEqual([]);
    });
  });

  afterAll(() => {
    const texto = informe(nivel, cantidad, datos);
    mkdirSync('informes', { recursive: true });
    writeFileSync(`informes/prueba-masiva-nivel-${nivel}.txt`, `${texto.trim()}\n`);
    console.log(texto);
  });
}

function registrar(datos, r) {
  datos.intentos.push(r.intentos);
  datos.semillasAgotadas += r.avisos.length;
  datos.eventos[r.historia.length] = (datos.eventos[r.historia.length] ?? 0) + 1;
  for (const e of r.historia) {
    datos.tipos[e.tipo] += 1;
    if (e.tipo === 'falla') datos.fallas[e.tipoFalla] += 1;
    if (e.tipo === 'dique') datos.diques[e.litologia] += 1;
  }
  for (const [motivo, veces] of Object.entries(r.rechazos)) {
    datos.rechazos[motivo] = (datos.rechazos[motivo] ?? 0) + veces;
  }
}

function informe(nivel, cantidad, datos) {
  const intentos = [...datos.intentos].sort((a, b) => a - b);
  const percentil = (p) => intentos[Math.min(intentos.length - 1, Math.floor(intentos.length * p))];
  const promedio = intentos.reduce((a, b) => a + b, 0) / intentos.length;
  const totalRechazos = Object.values(datos.rechazos).reduce((a, b) => a + b, 0);
  const rechazos = Object.entries(datos.rechazos)
    .sort((a, b) => b[1] - a[1])
    .map(([motivo, veces]) => `${motivo} ${veces} (${((100 * veces) / totalRechazos).toFixed(0)} %)`)
    .join(', ');
  const eventos = Object.entries(datos.eventos)
    .map(([n, veces]) => `${n}: ${veces}`)
    .join(', ');
  return [
    `\n═══ Informe de la prueba masiva: nivel ${nivel} (${cantidad} semillas) ═══`,
    `Intentos por sección: promedio ${promedio.toFixed(2)}, mediana ${percentil(0.5)}, ` +
      `p95 ${percentil(0.95)}, p99 ${percentil(0.99)}, máximo ${intentos[intentos.length - 1]}`,
    `Semillas que agotaron ${200} intentos: ${datos.semillasAgotadas}`,
    `Secciones por número de eventos: ${eventos}`,
    `Eventos por tipo: ${Object.entries(datos.tipos).map(([t, n]) => `${t} ${n}`).join(', ')}`,
    `Fallas: normales ${datos.fallas.normal}, inversas ${datos.fallas.inversa} · ` +
      `Diques: basalto ${datos.diques.basalto}, granito ${datos.diques.granito}`,
    `Intentos rechazados: ${totalRechazos}${totalRechazos ? ` — ${rechazos}` : ''}`,
    `Tiempo: ${(datos.milisegundos / 1000).toFixed(1)} s (${(datos.milisegundos / cantidad).toFixed(1)} ms por sección, ` +
      'incluida la verificación independiente)',
  ].join('\n');
}
