// Configuración de la prueba masiva del generador (`npm run test:masiva`).
// Un archivo por nivel: Vitest los corre en paralelo.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/masiva/**/*.test.js'],
    testTimeout: 30 * 60 * 1000,
  },
});
