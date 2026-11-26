// Evidencias observables → aristas del grafo de relaciones ("A → B": A es más antiguo que B).
//
// Solo se crea una arista cuando la relación SE VE en la sección dibujada: todo se calcula sobre la
// cuadrícula muestreada y sobre las trazas visibles (motor/visibilidad.js), las mismas que dibuja el
// render. Una relación cuenta solo si se ve a lo largo de al menos LARGO_MINIMO unidades.
//
// El modelo se usa para saber QUÉ es cada línea que se ve (contacto de depósito, borde de dique,
// plano de falla, superficie de erosión), igual que el estudiante lo distingue en la figura.
//
// Regla acordada (fase 2): un dique o una falla que terminan en la base de una capa más joven, sin
// superficie de erosión de por medio, NO son evidencia: un dique puede detenerse en un contacto y una
// falla puede ser ciega, así que "no la corta" no prueba que la capa sea más joven.
//
// Módulo puro: sin DOM y sin Math.random.

import { crearModelo, AIRE, inclinacionActual } from './modelo.js';
import { aplicar, invertir, alturaErosion, dentroDelDique, ladoDeFalla } from './eventos.js';
import { muestrear, centroDeCelda, dentroDeVentana, trazaVisible, PASO } from './visibilidad.js';
import { explicar } from '../i18n.js';

/** Longitud mínima (en unidades de la sección) para que una relación cuente como observable. */
export const LARGO_MINIMO = 20;

/** Inclinación mínima (grados) para que una capa se vea inclinada. */
export const INCLINACION_MINIMA = 5;

/** Principio que demuestra cada tipo de evidencia. */
export const PRINCIPIO_DE = Object.freeze({
  superposicion: 'superposicion',
  'sobre-erosion': 'superposicion',
  corte: 'relaciones-de-corte',
  truncamiento: 'relaciones-de-corte',
  desplazamiento: 'relaciones-de-corte',
  'capa-inclinada': 'horizontalidad-original',
  'discordancia-angular': 'horizontalidad-original',
});

/**
 * Detecta las evidencias observables de una sección.
 * @param {object[]} historia eventos del más antiguo al más joven
 * @returns {{ids: string[], aristas: object[]}} cada arista:
 *   {desde, hacia, principio, evidencia, largo, punto: {x, z}, explicacion: {es, en}}
 */
export function detectarEvidencias(historia, { paso = PASO } = {}) {
  const modelo = crearModelo(historia);
  return evidenciasDeModelo(modelo, muestrear(modelo, paso));
}

/**
 * Igual que detectarEvidencias, pero con un modelo y una cuadrícula ya calculados
 * (el generador los reutiliza para revisar sus otras reglas).
 */
export function evidenciasDeModelo(modelo, cuadricula) {
  const { paso } = cuadricula;
  const observaciones = [];
  const observar = (antiguo, joven, evidencia, largo, punto) =>
    observaciones.push({ antiguo, joven, evidencia, largo, punto });

  const contactos = clasificarContactos(modelo, cuadricula);
  evidenciasDeContactos(modelo, contactos, observar);
  for (let k = 0; k < modelo.eventos.length; k++) {
    const tipo = modelo.eventos[k].tipo;
    if (tipo === 'falla' || tipo === 'erosion') {
      evidenciasDeTraza(modelo, k, paso, observar);
    }
  }
  evidenciasDeBasculamientos(modelo, contactos, observar);

  return { ids: modelo.eventos.map((e) => e.id), aristas: reunir(modelo, observaciones) };
}

// ───────────────────────── Contactos entre unidades ─────────────────────────

/**
 * Recorre los pares de celdas vecinas con unidades distintas y clasifica cada contacto.
 * Devuelve los contactos agrupados por tipo y unidades, con su longitud aproximada.
 */
function clasificarContactos(modelo, cuadricula) {
  const { columnas, filas, paso, valores } = cuadricula;
  const grupos = new Map();
  for (let j = 0; j < filas; j++) {
    for (let i = 0; i < columnas; i++) {
      const u = valores[j * columnas + i];
      for (const [di, dj] of [[1, 0], [0, 1]]) {
        if (i + di >= columnas || j + dj >= filas) continue;
        const v = valores[(j + dj) * columnas + i + di];
        if (u === v) continue;
        const p = centroDeCelda(i, j, paso);
        const q = centroDeCelda(i + di, j + dj, paso);
        const contacto = clasificar(modelo, p, q, u, v);
        if (!contacto) continue;
        const clave = JSON.stringify(contacto);
        const grupo = grupos.get(clave) ?? { ...contacto, largo: 0, puntos: [] };
        grupo.largo += paso;
        grupo.puntos.push({ x: (p.x + q.x) / 2, z: (p.z + q.z) / 2 });
        grupos.set(clave, grupo);
      }
    }
  }
  return [...grupos.values()].map(({ puntos, ...grupo }) => ({
    ...grupo,
    punto: puntos[Math.floor(puntos.length / 2)],
  }));
}

/**
 * Tipo de contacto entre dos puntos vecinos p y q (unidades u y v en el presente).
 * Se siguen ambos puntos hacia atrás en el tiempo hasta el evento que los separa:
 * - 'deposicional': la base de un depósito sobre una unidad más antigua;
 * - 'intrusivo': el borde de un dique;
 * - 'erosion': una superficie de erosión (una unidad abajo, otra o aire arriba);
 * - 'falla': un plano de falla (sus relaciones se toman de la traza).
 * Devuelve null si el contacto no relaciona dos unidades (p. ej. el techo de la última capa).
 */
function clasificar(modelo, p, q, u, v) {
  const { eventos } = modelo;
  let a = p;
  let b = q;
  for (let m = eventos.length - 1; m >= 0; m--) {
    const evento = eventos[m];
    switch (evento.tipo) {
      case 'deposito':
        if (u === m || v === m) {
          const antigua = u === m ? v : u;
          if (antigua === AIRE) return null;
          // La base del depósito puede ser una superficie de erosión: se busca la erosión más joven,
          // entre la unidad antigua y el depósito, que deje un punto arriba y el otro abajo.
          const erosion = erosionEntre(modelo, antigua, m, a, b);
          return erosion >= 0
            ? { tipo: 'erosion', abajo: antigua, arriba: m, erosion }
            : { tipo: 'deposicional', antigua, joven: m };
        }
        break;
      case 'dique':
        if (u === m || v === m) {
          const cortada = u === m ? v : u;
          return cortada === AIRE ? null : { tipo: 'intrusivo', cortada, dique: m };
        }
        break;
      case 'erosion': {
        const arribaA = a.z > alturaErosion(evento, a.x);
        const arribaB = b.z > alturaErosion(evento, b.x);
        if (arribaA !== arribaB) {
          const abajo = arribaA ? v : u;
          const arriba = arribaA ? u : v;
          return abajo === AIRE ? null : { tipo: 'erosion', abajo, arriba, erosion: m };
        }
        break;
      }
      case 'falla':
        if (ladoDeFalla(evento, a) !== ladoDeFalla(evento, b)) {
          return { tipo: 'falla', falla: m };
        }
        a = invertir(evento, a);
        b = invertir(evento, b);
        break;
      case 'basculamiento':
        a = invertir(evento, a);
        b = invertir(evento, b);
        break;
      default:
        throw new RangeError(`Tipo de evento desconocido: ${evento.tipo}`);
    }
  }
  return null;
}

// Índice de la erosión más joven entre los eventos `desde` y `hasta` (exclusivos) que separa a los
// puntos a y b (dados en el marco de justo antes de `hasta`), o −1. Las fallas y basculamientos
// intermedios se deshacen; una falla intermedia no cuenta como contacto porque el depósito la cubrió.
function erosionEntre(modelo, desde, hasta, a, b) {
  const { eventos } = modelo;
  let pa = a;
  let pb = b;
  for (let e = hasta - 1; e > desde; e--) {
    const evento = eventos[e];
    if (evento.tipo === 'erosion') {
      const arribaA = pa.z > alturaErosion(evento, pa.x);
      const arribaB = pb.z > alturaErosion(evento, pb.x);
      if (arribaA !== arribaB) return e;
    } else if (evento.tipo === 'falla' || evento.tipo === 'basculamiento') {
      pa = invertir(evento, pa);
      pb = invertir(evento, pb);
    }
  }
  return -1;
}

function evidenciasDeContactos(modelo, contactos, observar) {
  const { eventos } = modelo;
  for (const c of contactos) {
    switch (c.tipo) {
      case 'deposicional':
        // Regla acordada: una capa que solo descansa sobre un dique no prueba nada (el dique pudo
        // detenerse en ese contacto).
        if (eventos[c.antigua].tipo === 'dique') break;
        observar(c.antigua, c.joven, 'superposicion', c.largo, c.punto);
        break;
      case 'intrusivo':
        observar(c.cortada, c.dique, 'corte', c.largo, c.punto);
        break;
      case 'erosion':
        observar(c.abajo, c.erosion, 'truncamiento', c.largo, c.punto);
        if (c.arriba !== AIRE) {
          observar(c.erosion, c.arriba, 'sobre-erosion', c.largo, c.punto);
        }
        break;
      default:
        // 'falla': las unidades cortadas se toman de la traza de la falla.
        break;
    }
  }
}

// ───────────────────────── Trazas de fallas y erosiones ─────────────────────────

/**
 * Para una falla: las unidades a ambos lados de su traza visible son cortadas por ella.
 * Para fallas y erosiones: lo que interrumpe la traza visible es más joven que ella
 * (una erosión que la trunca, un dique que la corta o una falla que la desplaza).
 */
function evidenciasDeTraza(modelo, k, paso, observar) {
  const evento = modelo.eventos[k];
  for (const tramo of trazaVisible(modelo, k, paso)) {
    if (evento.tipo === 'falla') {
      unidadesCortadasPorFalla(modelo, k, tramo, paso, observar);
    }
    const extremos = [
      { borde: tramo.muestras[0], fuera: tramo.previa, falla: tramo.fallaAlInicio },
      { borde: tramo.muestras[tramo.muestras.length - 1], fuera: tramo.siguiente, falla: tramo.fallaAlFinal },
    ];
    for (const { borde, fuera, falla } of extremos) {
      const causa = causaDeInterrupcion(modelo, k, fuera, falla);
      if (causa) {
        observar(k, causa.indice, causa.evidencia, tramo.largo, borde.presente);
      }
    }
  }
}

function unidadesCortadasPorFalla(modelo, k, tramo, paso, observar) {
  const primera = tramo.muestras[0].presente;
  const ultima = tramo.muestras[tramo.muestras.length - 1].presente;
  const largo = Math.hypot(ultima.x - primera.x, ultima.z - primera.z) || 1;
  const normal = { x: -(ultima.z - primera.z) / largo, z: (ultima.x - primera.x) / largo };
  const separacion = 2 * paso;
  for (const { presente } of tramo.muestras) {
    for (const lado of [1, -1]) {
      const s = { x: presente.x + lado * separacion * normal.x, z: presente.z + lado * separacion * normal.z };
      if (!dentroDeVentana(s)) continue;
      const u = modelo.indiceEn(s.x, s.z);
      if (u !== AIRE && u < k) {
        // Cada muestra cubre medio paso a lo largo de la traza.
        observar(u, k, 'corte', paso / 2, presente);
      }
    }
  }
}

/**
 * Por qué deja de verse la traza del rasgo k en la muestra `fuera` (la primera que ya no pertenece al tramo).
 * Devuelve {indice, evidencia} del evento más joven responsable, o null si no hay relación observable:
 * borde de la ventana, fin del muestreo, o el rasgo no existía ahí (p. ej. la falla llegaba a la superficie
 * de su época y luego la cubrió una capa sin erosión: regla acordada, no es evidencia).
 */
function causaDeInterrupcion(modelo, k, fuera, fallaQueCorta) {
  if (fallaQueCorta >= 0) {
    return { indice: fallaQueCorta, evidencia: 'desplazamiento' };
  }
  if (!fuera || !dentroDeVentana(fuera.presente)) return null;
  // ¿Había roca en ese punto del rasgo en su momento?
  if (modelo.indiceEnMomento(k, fuera.sonda) === AIRE) return null;
  // El primer evento posterior que quitó o reemplazó esa roca.
  const { eventos } = modelo;
  let p = fuera.sonda;
  for (let m = k + 1; m < eventos.length; m++) {
    const evento = eventos[m];
    if (evento.tipo === 'erosion' && p.z > alturaErosion(evento, p.x)) {
      return { indice: m, evidencia: 'truncamiento' };
    }
    if (evento.tipo === 'dique' && dentroDelDique(evento, p)) {
      return { indice: m, evidencia: 'corte' };
    }
    p = aplicar(evento, p);
  }
  return null;
}

// ───────────────────────── Basculamientos ─────────────────────────

/**
 * Horizontalidad original (una sola fase de basculamiento por ciclo, niveles 1–3):
 * - capas anteriores al basculamiento cuyo contacto entre capas se ve inclinado → basculamiento;
 * - basculamiento → la primera erosión posterior que trunca esas capas inclinadas.
 */
function evidenciasDeBasculamientos(modelo, contactos, observar) {
  const { eventos } = modelo;
  let anterior = -1;
  eventos.forEach((evento, t) => {
    if (evento.tipo !== 'basculamiento') return;

    // Contactos visibles entre capas anteriores al basculamiento (y posteriores al basculamiento previo).
    const largoPorCapa = new Map();
    const puntoPorCapa = new Map();
    for (const c of contactos) {
      if (c.tipo !== 'deposicional' || c.joven >= t || c.antigua <= anterior) continue;
      if (eventos[c.antigua].tipo !== 'deposito') continue;
      for (const capa of [c.antigua, c.joven]) {
        largoPorCapa.set(capa, (largoPorCapa.get(capa) ?? 0) + c.largo);
        if (!puntoPorCapa.has(capa)) puntoPorCapa.set(capa, c.punto);
      }
    }
    for (const [capa, largo] of largoPorCapa) {
      if (Math.abs(inclinacionActual(eventos, capa)) >= INCLINACION_MINIMA) {
        observar(capa, t, 'capa-inclinada', largo, puntoPorCapa.get(capa));
      }
    }

    // La primera erosión posterior (sin otro basculamiento en medio) que trunca capas inclinadas.
    for (let e = t + 1; e < eventos.length; e++) {
      if (eventos[e].tipo === 'basculamiento') break;
      if (eventos[e].tipo !== 'erosion') continue;
      const truncadas = contactos.filter(
        (c) => c.tipo === 'erosion' && c.erosion === e && c.abajo < t && largoPorCapa.has(c.abajo),
      );
      const largo = truncadas.reduce((suma, c) => suma + c.largo, 0);
      if (largo > 0) {
        observar(t, e, 'discordancia-angular', largo, truncadas[0].punto);
        break;
      }
    }
    anterior = t;
  });
}

// ───────────────────────── Aristas ─────────────────────────

/**
 * Reúne las observaciones en una arista por par de eventos. La longitud se suma; la explicación y el
 * punto son los de la observación más larga. Se descartan las relaciones que se ven menos de LARGO_MINIMO.
 */
function reunir(modelo, observaciones) {
  const { eventos } = modelo;
  const pares = new Map();
  for (const o of observaciones) {
    const clave = `${o.antiguo}>${o.joven}`;
    const par = pares.get(clave) ?? { antiguo: o.antiguo, joven: o.joven, largo: 0, mejor: o };
    par.largo += o.largo;
    if (o.largo > par.mejor.largo) par.mejor = o;
    pares.set(clave, par);
  }
  return [...pares.values()]
    .filter((par) => par.largo >= LARGO_MINIMO)
    .sort((a, b) => a.antiguo - b.antiguo || a.joven - b.joven)
    .map(({ antiguo, joven, largo, mejor }) => {
      const principio = PRINCIPIO_DE[mejor.evidencia];
      return Object.freeze({
        desde: eventos[antiguo].id,
        hacia: eventos[joven].id,
        principio,
        evidencia: mejor.evidencia,
        largo: Math.round(largo),
        punto: Object.freeze({ x: Math.round(mejor.punto.x), z: Math.round(mejor.punto.z) }),
        explicacion: explicar(mejor.evidencia, principio, eventos[antiguo], eventos[joven]),
      });
    });
}
