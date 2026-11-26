// Lógica del reto diario sin DOM (se puede probar en Node): fecha, nivel del día, texto para compartir y
// racha guardada en localStorage (envuelto en try/catch: la app funciona aunque no se pueda guardar).

import { textosEn } from '../i18n.js';

/** Fecha local en formato AAAA-MM-DD: "el reto de hoy" cambia a la medianoche de cada quien. */
export function fechaLocal(fecha = new Date()) {
  const dos = (n) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

/** Nivel según el día de la semana: lunes y martes 1; miércoles y jueves 2; viernes a domingo 3. */
export function nivelDelDia(fecha = new Date()) {
  const dia = fecha.getDay(); // 0 = domingo
  if (dia === 1 || dia === 2) return 1;
  if (dia === 3 || dia === 4) return 2;
  return 3;
}

/** Día anterior a una fecha AAAA-MM-DD. */
export function diaAnterior(fecha) {
  const [a, m, d] = fecha.split('-').map(Number);
  const anterior = new Date(Date.UTC(a, m - 1, d - 1));
  return anterior.toISOString().slice(0, 10);
}

/** "26 nov 2026" / "Nov 26, 2026" (corta) o "26 de noviembre de 2026" / "November 26, 2026" (larga). */
export function fechaLegible(fecha, larga = false, idioma = 'es') {
  const [a, m, d] = fecha.split('-').map(Number);
  const formato = new Intl.DateTimeFormat(textosEn(idioma).formatoFecha, {
    day: 'numeric',
    month: larga ? 'long' : 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return formato.format(new Date(Date.UTC(a, m - 1, d))).replace('.', '');
}

/** Una fila de cuadros: verde si la tarjeta estaba en su lugar, rojo si no (de arriba abajo). */
export function cuadros(posiciones) {
  return posiciones.map((bien) => (bien ? '🟩' : '🟥')).join('');
}

/**
 * Texto para compartir el resultado sin revelar la respuesta: fecha, nivel, intentos (cuadros por
 * posición) y racha. No lleva ninguna letra de evento.
 */
export function textoParaCompartir({ fecha, nivel, intentos, resuelto, racha, enlace, idioma = 'es' }) {
  const C = textosEn(idioma).compartir;
  const lineas = [C.encabezado(fechaLegible(fecha, false, idioma), nivel)];
  if (resuelto) {
    const veces = intentos.length === 1 ? C.primerIntento : C.resueltoEn(intentos.length);
    lineas.push(racha > 0 ? `${veces} · ${C.racha(racha)}` : veces);
  } else {
    const n = intentos.length;
    lineas.push(n === 0 ? C.solucion : C.solucionDespues(n));
  }
  for (const intento of intentos) lineas.push(cuadros(intento));
  lineas.push(enlace);
  return lineas.join('\n');
}

const DATOS_VACIOS = Object.freeze({ racha: 0, ultimoResuelto: null, resultados: {} });

// Cuántos días de resultados se guardan.
const DIAS_GUARDADOS = 60;

/**
 * Registra el resultado del día y actualiza la racha (días seguidos resueltos).
 * @param {{racha, ultimoResuelto, resultados}} datos
 * @param {string} fecha AAAA-MM-DD
 * @param {{intentos: boolean[][], resuelto: boolean, rendido: boolean}} resultado
 */
export function registrarResultado(datos, fecha, resultado) {
  let { racha, ultimoResuelto } = datos;
  if (resultado.resuelto && ultimoResuelto !== fecha) {
    racha = ultimoResuelto === diaAnterior(fecha) ? racha + 1 : 1;
    ultimoResuelto = fecha;
  }
  const resultados = { ...datos.resultados, [fecha]: resultado };
  const fechas = Object.keys(resultados).sort();
  for (const vieja of fechas.slice(0, Math.max(0, fechas.length - DIAS_GUARDADOS))) delete resultados[vieja];
  return { racha, ultimoResuelto, resultados };
}

/** Racha que sigue viva hoy: se pierde si ayer no se resolvió (y hoy todavía no). */
export function rachaVigente(datos, hoy) {
  if (datos.ultimoResuelto === hoy || datos.ultimoResuelto === diaAnterior(hoy)) return datos.racha;
  return 0;
}

const CLAVE = 'geohistoria-reto';

/**
 * Almacén del reto sobre un `Storage` (localStorage). Si no hay o falla, funciona sin guardar.
 * @param {Storage|null} almacenamiento
 */
export function crearAlmacen(almacenamiento) {
  let disponible = Boolean(almacenamiento);
  return {
    get disponible() {
      return disponible;
    },
    leer() {
      try {
        const texto = almacenamiento?.getItem(CLAVE);
        if (!texto) return { ...DATOS_VACIOS, resultados: {} };
        const datos = JSON.parse(texto);
        return { ...DATOS_VACIOS, ...datos, resultados: { ...datos.resultados } };
      } catch {
        disponible = false;
        return { ...DATOS_VACIOS, resultados: {} };
      }
    },
    guardar(datos) {
      try {
        almacenamiento.setItem(CLAVE, JSON.stringify(datos));
        return true;
      } catch {
        disponible = false;
        return false;
      }
    },
  };
}
