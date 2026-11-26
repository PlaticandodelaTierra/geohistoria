// Reto del día (#reto): el mismo ejercicio para todos durante el día (semilla = fecha local).
// Se cuentan las revisiones hasta acertar; "Ver la solución" cuenta como rendirse. El resultado y la racha
// se guardan en localStorage (si el navegador lo permite) y se comparten sin revelar la respuesta.

import { generarSeccion } from '../motor/generador.js';
import { TEXTOS as T, idioma } from '../i18n.js';
import {
  fechaLocal,
  nivelDelDia,
  fechaLegible,
  textoParaCompartir,
  registrarResultado,
  rachaVigente,
  crearAlmacen,
} from './logicaReto.js';
import { crearEjercicio } from './ejercicio.js';
import { elemento, boton, encabezado, copiar } from './comun.js';

export function paginaReto(contenedor) {
  const R = T.reto;
  const hoy = new Date();
  const fecha = fechaLocal(hoy);
  const nivel = nivelDelDia(hoy);
  const almacen = crearAlmacen(almacenamientoLocal());
  let datos = almacen.leer();
  const previo = datos.resultados[fecha];
  let intentos = previo ? [...previo.intentos] : [];
  let terminado = Boolean(previo && (previo.resuelto || previo.rendido));

  const seccion = generarSeccion(fecha, nivel);
  const racha = elemento('p', 'racha');
  const resultado = elemento('section', 'resultado-reto');
  resultado.setAttribute('aria-live', 'polite');

  const mostrarRacha = () => {
    racha.textContent = R.racha(rachaVigente(datos, fecha));
  };

  const mostrarResultado = (yaJugado) => {
    resultado.replaceChildren();
    const actual = datos.resultados[fecha];
    if (!actual || !(actual.resuelto || actual.rendido)) return;
    if (yaJugado) resultado.append(elemento('p', 'aviso-reto', R.yaJugado));
    resultado.append(elemento('h2', null, actual.resuelto ? R.resuelto(actual.intentos.length) : R.rendido));
    const texto = textoParaCompartir({
      fecha,
      nivel,
      intentos: actual.intentos,
      resuelto: actual.resuelto,
      racha: rachaVigente(datos, fecha),
      enlace: `${location.origin}${location.pathname}#reto`,
      idioma: idioma(),
    });
    const aviso = elemento('p', 'aviso-enlace');
    const compartir = boton(R.compartir, 'principal');
    compartir.addEventListener('click', async () => {
      // En el celular se usa el menú de compartir del sistema; si no, se copia al portapapeles.
      if (navigator.share) {
        try {
          await navigator.share({ text: texto });
          return;
        } catch (error) {
          if (error?.name === 'AbortError') return;
        }
      }
      aviso.textContent = (await copiar(texto)) ? R.compartido : R.noCompartido;
    });
    resultado.append(compartir, aviso, elemento('p', 'vista-previa-titulo', R.vistaPrevia), elemento('pre', 'vista-previa', texto));
  };

  const terminar = (resuelto) => {
    terminado = true;
    datos = registrarResultado(datos, fecha, { intentos, resuelto, rendido: !resuelto });
    almacen.guardar(datos);
    mostrarRacha();
    mostrarResultado(false);
  };

  const { zona, revision } = crearEjercicio(seccion, {
    alRevisar(evaluacion, tarjetas) {
      if (terminado) return;
      // Cuadros por posición, de arriba abajo (como se ven las tarjetas).
      const enSuLugar = new Map(evaluacion.posiciones.map((p) => [p.id, p.correcta]));
      intentos = [...intentos, tarjetas.map((id) => enSuLugar.get(id))];
      if (evaluacion.correcta) {
        terminar(true);
      } else {
        datos = registrarResultado(datos, fecha, { intentos, resuelto: false, rendido: false });
        almacen.guardar(datos);
      }
    },
    alVerSolucion() {
      if (!terminado) terminar(false);
    },
  });

  const titulo = elemento('h2', null, R.titulo(fechaLegible(fecha, true, idioma()), nivel));
  contenedor.append(encabezado('reto'), titulo, elemento('p', 'explicacion', R.explicacion), racha);
  if (!almacen.disponible) contenedor.append(elemento('p', 'aviso-reto', R.sinGuardar));
  contenedor.append(resultado, zona, revision);
  mostrarRacha();
  if (terminado) mostrarResultado(true);
}

// localStorage puede no existir o lanzar un error (modo privado, permisos): entonces no se guarda nada.
function almacenamientoLocal() {
  try {
    const almacenamiento = window.localStorage;
    const prueba = '__geohistoria__';
    almacenamiento.setItem(prueba, '1');
    almacenamiento.removeItem(prueba);
    return almacenamiento;
  } catch {
    return null;
  }
}
