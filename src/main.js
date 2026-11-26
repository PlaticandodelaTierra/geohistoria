// Punto de arranque de la aplicación: idioma y rutas simples con '#'.
// - #practica (y la página de inicio): modo práctica.
// - #reto: reto del día.
// - #profesor: hojas de ejercicios y de respuestas en PDF.
// - #principios: principios de la datación relativa con esquemas generados por el motor.
// - #ejemplos y #generador: páginas de desarrollo, solo con `npm run dev` (no se publican).
// El idioma es español por defecto; la elección del visitante se recuerda en este navegador.

import './estilos.css';
import { TEXTOS as T, cambiarIdioma, idiomaGuardado, guardarIdioma, idioma } from './i18n.js';
import { EVENTO_IDIOMA } from './ui/comun.js';
import { paginaPractica } from './ui/practica.js';
import { paginaReto } from './ui/reto.js';
import { paginaProfesor } from './ui/profesor.js';
import { paginaPrincipios } from './ui/principios.js';

const app = document.querySelector('#app');
cambiarIdioma(idiomaGuardado());

async function mostrar() {
  const [ruta, consulta = ''] = location.hash.replace(/^#/, '').split('?');
  const parametros = new URLSearchParams(consulta);
  document.documentElement.lang = idioma();
  document.title = T.tituloPagina;
  app.replaceChildren();
  window.scrollTo(0, 0);
  if (import.meta.env.DEV && ruta === 'generador') {
    const { paginaGenerador } = await import('./dev/generador.js');
    paginaGenerador(app, parametros);
  } else if (import.meta.env.DEV && ruta === 'ejemplos') {
    const { paginaEjemplos } = await import('./dev/ejemplos.js');
    paginaEjemplos(app);
  } else if (ruta === 'reto') {
    paginaReto(app);
  } else if (ruta === 'profesor') {
    paginaProfesor(app, parametros);
  } else if (ruta === 'principios') {
    paginaPrincipios(app, parametros);
  } else {
    paginaPractica(app, parametros);
  }
}

// Cambio de idioma: se guarda, se vuelve a dibujar la página y el foco vuelve al selector.
window.addEventListener(EVENTO_IDIOMA, async (evento) => {
  cambiarIdioma(evento.detail);
  guardarIdioma(evento.detail);
  await mostrar();
  app.querySelector(`.idiomas button[lang="${evento.detail}"]`)?.focus();
});

window.addEventListener('hashchange', mostrar);
mostrar();
