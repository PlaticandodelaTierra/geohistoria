// Genera las figuras de ejemplo del README (docs/ejemplos/) con el mismo código de la app.
// Uso: npm run ejemplos   (o: node scripts/ejemplos.js)
//
// Cada figura es una sección generada con una semilla fija, así que siempre sale igual. Las letras son
// las de un ejercicio real: no siguen el orden de los eventos.

import { mkdirSync, writeFileSync } from 'node:fs';
import { generarSeccion } from '../src/motor/generador.js';
import { seccionSVG } from '../src/render/seccion.js';

const EJEMPLOS = [
  { archivo: 'nivel-1.svg', nivel: 1, semilla: 4 },
  { archivo: 'nivel-2.svg', nivel: 2, semilla: 2 },
  { archivo: 'nivel-3.svg', nivel: 3, semilla: 2 },
];

const carpeta = new URL('../docs/ejemplos/', import.meta.url);
mkdirSync(carpeta, { recursive: true });

for (const { archivo, nivel, semilla } of EJEMPLOS) {
  const { historia, orden } = generarSeccion(semilla, nivel);
  const svg = seccionSVG(historia, {
    interactiva: false,
    titulo: `GeoHistoria, level ${nivel}, seed ${semilla}`,
  });
  writeFileSync(new URL(archivo, carpeta), `${svg}\n`);
  console.log(`docs/ejemplos/${archivo}: nivel ${nivel}, semilla ${semilla}, orden ${orden.join(' ')}`);
}
