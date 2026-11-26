import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  // Ruta del sitio para el servidor local (npm run dev / preview). En GitHub Pages, el workflow
  // (.github/workflows/deploy.yml) compila con --base /<nombre-del-repositorio>/.
  base: '/geohistoria/',
  test: {
    // El motor es puro (sin DOM), así que basta el entorno de Node.
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // Varias pruebas generan decenas de secciones (unos segundos en un Mac). Los servidores de GitHub
    // Actions son más lentos: con el límite por defecto (5 s) podrían fallar y el sitio no se publicaría.
    testTimeout: 60_000,
    // La prueba masiva del generador tarda minutos: se corre aparte con `npm run test:masiva`.
    exclude: [...configDefaults.exclude, 'tests/masiva/**'],
  },
});
