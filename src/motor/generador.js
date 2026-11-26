// Generador: semilla + nivel → historia geológica válida (niveles 1 a 3).
//
// La COMPOSICIÓN (cuántas capas, qué estructuras y en qué orden, si cada falla es normal o inversa) se
// sortea una sola vez por semilla. Cada intento sortea solo la geometría (espesores, litologías, ángulos,
// posiciones) con la siguiente subsemilla y la revisa con todas las reglas. Así las composiciones difíciles
// no quedan subrepresentadas: si se sorteara todo en cada intento, las secciones más simples ganarían.
// Si se agotan MAXIMO_INTENTOS, se pasa a la semilla siguiente (con otra composición) y se deja un aviso.
//
// Composición acordada (fase 3):
// - Nivel 1 (3–5 eventos): 2–4 capas y, al final, 1 dique que las corta todas.
// - Nivel 2 (5–7 eventos): 3–5 capas y después 1 falla y 1–2 diques, en orden al azar, que se cruzan.
// - Nivel 3 (6–9 eventos): 2–4 capas → basculamiento → erosión → 1–3 capas nuevas → 0–2 estructuras
//   finales (diques o fallas) que lo cortan todo.
// Ninguna capa se deposita sobre un dique o una falla sin erosión de por medio, y no hay estructuras
// antes del basculamiento: en ambos casos su orden no se podría deducir de lo que se ve.
//
// Módulo puro: sin DOM y sin Math.random (todo sale de rng.js).

import { crearRng, subsemilla, normalizarSemilla } from '../rng.js';
import {
  deposito,
  basculamiento,
  falla,
  dique,
  erosion,
  esUnidad,
  LITOLOGIAS_SEDIMENTARIAS,
  LITOLOGIAS_IGNEAS,
  SENTIDOS,
  TIPOS_FALLA,
  RANGOS,
  Z_REFERENCIA,
} from './eventos.js';
import { crearModelo, VENTANA, AIRE, NIVEL_BASE } from './modelo.js';
import { muestrear, trazaVisible, trozosVisibles } from './visibilidad.js';
import { evidenciasDeModelo } from './evidencias.js';
import { crearGrafo, tieneCiclo, esOrdenUnico, ordenTopologico, validarRespuesta } from './orden.js';

export const NIVELES = Object.freeze([1, 2, 3]);

/** Intentos por semilla antes de pasar a la siguiente (CLAUDE.md: p. ej. 200). */
export const MAXIMO_INTENTOS = 200;

// Semillas seguidas que se prueban antes de rendirse (no debería pasar nunca).
const MAXIMO_SEMILLAS = 50;

/** Parámetros y umbrales del generador (unidades de la sección; la ventana mide 1000 × 500). */
export const REGLAS = Object.freeze({
  espesorCapa: Object.freeze([50, 150]), // espesor visible de las capas intermedias
  espesorDique: Object.freeze([20, 40]),
  desplazamiento: Object.freeze([50, 120]), // salto neto: con echado ≥ 45°, el salto vertical es ≥ 35
  amplitudErosion: Object.freeze([0, 15]),
  longitudOnda: Object.freeze([200, 500]),
  areaMinimaUnidad: 3000, // 0.6 % de la ventana
  areaMinimaTrozo: 600, // ningún trozo visible más chico ("astillas")
  grosorMinimo: 12, // en cada trozo debe caber un círculo de este diámetro
  trazaMinimaFalla: 100,
  unidadesPorFalla: 2, // la falla debe cortar al menos 2 unidades (si no, no se ve que desplace nada)
  coberturaErosion: 0.6, // fracción del ancho en que se ve la superficie de erosión
  anguloDeCruce: 20, // ángulo mínimo entre dos estructuras que se cruzan
  separacionEntreCruces: 60, // con tres estructuras, distancia mínima entre sus cruces
  separacionDeCruces: 40, // distancia mínima (vertical) entre un cruce y la discordancia
});

// Sorteos de planos por intento hasta encontrar estructuras que se crucen como piden las reglas.
const SORTEOS_DE_PLANOS = 400;

// La última capa sobrepasa el borde superior de la ventana por esta altura (no se ve aire).
const MARGEN_SUPERIOR = 300;

// Se revisa primero con una cuadrícula gruesa (rápido) y se confirma con la fina (la que se dibuja).
const PASO_RAPIDO = 4;
const PASO_FINAL = 2;

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/**
 * Genera una sección válida.
 * @param {number|string} semilla
 * @param {1|2|3} nivel
 * @returns {{semilla, semillaUsada: number, nivel: number, intentos: number, historia: object[],
 *   aristas: object[], orden: string[], rechazos: object, avisos: string[]}}
 */
export function generarSeccion(semilla, nivel) {
  validarNivel(nivel);
  const rechazos = {};
  const avisos = [];
  let intentos = 0;
  let actual = normalizarSemilla(semilla);
  for (let s = 0; s < MAXIMO_SEMILLAS; s++) {
    const composicion = componer(crearRng(actual), nivel);
    for (let intento = 0; intento < MAXIMO_INTENTOS; intento++) {
      intentos += 1;
      const rng = crearRng(subsemilla(actual, intento));
      const historia = construirHistoria(rng, composicion);
      if (!historia) {
        contar(rechazos, 'geometría');
        continue;
      }
      const rapida = revisarSeccion(historia, nivel, { paso: PASO_RAPIDO });
      if (!rapida.valida) {
        contar(rechazos, rapida.motivo);
        continue;
      }
      const final = revisarSeccion(historia, nivel, { paso: PASO_FINAL });
      if (!final.valida) {
        contar(rechazos, `${final.motivo} (cuadrícula fina)`);
        continue;
      }
      return Object.freeze({
        semilla,
        semillaUsada: actual,
        nivel,
        intentos,
        historia,
        aristas: final.aristas,
        orden: final.orden,
        rechazos: Object.freeze(rechazos),
        avisos: Object.freeze(avisos),
      });
    }
    const siguiente = (actual + 1) >>> 0;
    avisos.push(`La semilla ${actual} agotó ${MAXIMO_INTENTOS} intentos en el nivel ${nivel}; se usó la ${siguiente}.`);
    actual = siguiente;
  }
  throw new Error(`No se pudo generar una sección de nivel ${nivel} a partir de la semilla ${semilla}`);
}

/**
 * Revisa todas las reglas del generador sobre una historia.
 * @returns {{valida: boolean, motivo: string|null, aristas?: object[], orden?: string[]}}
 */
export function revisarSeccion(historia, nivel, { paso = PASO_FINAL } = {}) {
  validarNivel(nivel);
  const modelo = crearModelo(historia);
  const { eventos } = modelo;
  const cuadricula = muestrear(modelo, paso);
  const rechazo = (motivo) => ({ valida: false, motivo });

  // La ventana está llena de roca.
  if (cuadricula.valores.includes(AIRE)) return rechazo('aire en la ventana');

  // Cada unidad se ve, con área suficiente, y ninguno de sus trozos es una astilla.
  const areaPorUnidad = new Map();
  for (const trozo of trozosVisibles(cuadricula)) {
    if (trozo.area < REGLAS.areaMinimaTrozo || trozo.grosor < REGLAS.grosorMinimo) return rechazo('astilla');
    areaPorUnidad.set(trozo.indice, (areaPorUnidad.get(trozo.indice) ?? 0) + trozo.area);
  }
  for (let k = 0; k < eventos.length; k++) {
    if (!esUnidad(eventos[k])) continue;
    if (!areaPorUnidad.has(k)) return rechazo('unidad invisible');
    if (areaPorUnidad.get(k) < REGLAS.areaMinimaUnidad) return rechazo('unidad pequeña');
  }

  // La superficie de erosión se ve en buena parte del ancho.
  for (let k = 0; k < eventos.length; k++) {
    if (eventos[k].tipo !== 'erosion') continue;
    let cubierto = 0;
    for (const { muestras } of trazaVisible(modelo, k, paso)) {
      const xs = muestras.map((m) => m.presente.x);
      cubierto += Math.max(...xs) - Math.min(...xs);
    }
    if (cubierto < REGLAS.coberturaErosion * VENTANA.ancho) return rechazo('erosión poco visible');
  }

  const { ids, aristas } = evidenciasDeModelo(modelo, cuadricula);

  // Cada falla se ve y desplaza algo visible.
  for (let k = 0; k < eventos.length; k++) {
    if (eventos[k].tipo !== 'falla') continue;
    const largo = trazaVisible(modelo, k, paso).reduce((suma, tramo) => suma + tramo.largo, 0);
    if (largo < REGLAS.trazaMinimaFalla) return rechazo('falla poco visible');
    const cortadas = aristas.filter(
      (a) => a.hacia === eventos[k].id && a.evidencia === 'corte' && esUnidad(eventos[ids.indexOf(a.desde)]),
    );
    if (cortadas.length < REGLAS.unidadesPorFalla) return rechazo('falla que no desplaza nada visible');
  }

  // El grafo de evidencias: sin ciclos, coherente con la historia real y con orden único.
  const grafo = crearGrafo(ids, aristas);
  if (tieneCiclo(grafo)) return rechazo('ciclo');
  if (!validarRespuesta(grafo, ids).valida) return rechazo('evidencias incoherentes');
  if (!esOrdenUnico(grafo)) return rechazo('orden no único');

  return { valida: true, motivo: null, aristas, orden: ordenTopologico(grafo) };
}

// ───────────────────────── Construcción de la historia ─────────────────────────

/**
 * Composición de una sección (se sortea una vez por semilla): el número total de eventos es uniforme
 * dentro del rango del nivel, y cada estructura lleva ya su tipo (dique, falla normal o falla inversa).
 * @returns {{nivel, capas?, inferiores?, superiores?, estructuras: Array<{tipo, tipoFalla?}>}}
 */
export function componer(rng, nivel) {
  validarNivel(nivel);
  const estructura = (tipo) => (tipo === 'falla' ? { tipo, tipoFalla: rng.elegir(TIPOS_FALLA) } : { tipo });

  if (nivel === 1) {
    // 2–4 capas y al final un dique que las corta todas (3–5 eventos).
    return { nivel, capas: rng.entero(2, 4), estructuras: [estructura('dique')] };
  }

  if (nivel === 2) {
    // 3–5 capas, después 1 falla y 1–2 diques en orden al azar (5–7 eventos).
    const total = rng.entero(5, 7);
    const diques = total === 5 ? 1 : rng.entero(1, 2);
    const tipos = rng.barajar(['falla', ...Array(diques).fill('dique')]);
    return { nivel, capas: total - 1 - diques, estructuras: tipos.map(estructura) };
  }

  // Nivel 3: capas → basculamiento → erosión → capas nuevas → estructuras finales (6–9 eventos).
  const total = rng.entero(6, 9);
  const combinaciones = [];
  for (let inferiores = 2; inferiores <= 4; inferiores++) {
    for (let superiores = 1; superiores <= 3; superiores++) {
      for (let finales = 0; finales <= 2; finales++) {
        if (inferiores + superiores + finales + 2 === total) combinaciones.push([inferiores, superiores, finales]);
      }
    }
  }
  const [inferiores, superiores, finales] = rng.elegir(combinaciones);
  const estructuras = Array.from({ length: finales }, () => estructura(rng.elegir(['dique', 'falla'])));
  return { nivel, inferiores, superiores, estructuras };
}

// Una historia con la composición dada: en cada intento solo cambia la geometría.
function construirHistoria(rng, composicion) {
  const plan = composicion.nivel === 3 ? planBasculado(rng, composicion) : planHorizontal(rng, composicion);
  if (!plan) return null;
  const letras = letrasAlAzar(rng, plan.length);
  const constructores = { deposito, basculamiento, falla, dique, erosion };
  return plan.map((datos, i) => constructores[datos.tipo]({ ...datos, id: letras[i] }));
}

// Niveles 1 y 2: capas horizontales y, después, las estructuras (que se cruzan entre sí).
function planHorizontal(rng, { capas, estructuras }) {
  const depositos = capasHorizontales(rng, capas);
  const planos = estructurasQueSeCruzan(rng, estructuras);
  if (!depositos || !planos) return null;
  return [...depositos, ...planos];
}

// Nivel 3: capas → basculamiento → erosión → capas nuevas → estructuras finales.
function planBasculado(rng, { inferiores, superiores, estructuras }) {
  const giro = basculamientoAlAzar(rng);
  const corte = erosionAlAzar(rng, superiores);
  const capasInferiores = capasBasculadas(rng, inferiores, giro, corte);
  const capasNuevas = capasSobreErosion(rng, superiores, corte);
  // Si dos estructuras finales se cruzan, que no sea justo sobre la discordancia (sería ilegible).
  const banda = corte.amplitud + REGLAS.separacionDeCruces;
  const planos = estructurasQueSeCruzan(rng, estructuras, [corte.nivel - banda, corte.nivel + banda]);
  if (!capasInferiores || !capasNuevas || !planos) return null;
  return [...capasInferiores, giro, corte, ...capasNuevas, ...planos];
}

// Capas horizontales que llenan la ventana: n − 1 contactos visibles entre z = 60 y z = 440.
function capasHorizontales(rng, n) {
  const contactos = contactosAlAzar(rng, n - 1, 60, VENTANA.alto - 60, REGLAS.espesorCapa);
  if (!contactos) return null;
  return apilar(rng, contactos, NIVEL_BASE, VENTANA.alto + MARGEN_SUPERIOR, n);
}

function basculamientoAlAzar(rng) {
  return {
    tipo: 'basculamiento',
    angulo: rng.rango(...RANGOS.anguloBasculamiento),
    sentido: rng.elegir(SENTIDOS),
    pivote: { x: rng.rango(300, 700), z: rng.rango(150, 350) },
  };
}

// La erosión deja sitio arriba para las capas nuevas (al menos 60 de alto cada una).
function erosionAlAzar(rng, capasNuevas) {
  const maximo = VENTANA.alto - 60 * capasNuevas - 20;
  return {
    tipo: 'erosion',
    nivel: rng.rango(180, maximo),
    amplitud: rng.rango(...REGLAS.amplitudErosion),
    longitudOnda: rng.rango(...REGLAS.longitudOnda),
    fase: rng.rango(0, 2 * Math.PI),
  };
}

// Capas anteriores al basculamiento, en su marco original. Sus contactos se colocan dentro del rango de
// alturas originales que, tras el basculamiento, queda visible debajo de la erosión; la última capa es
// gruesa para que su techo quede siempre arriba de la erosión (así la erosión corta roca en todo el ancho).
function capasBasculadas(rng, n, giro, corte) {
  const alto = corte.nivel + corte.amplitud;
  const esquinas = [
    { x: 0, z: 0 },
    { x: VENTANA.ancho, z: 0 },
    { x: 0, z: alto },
    { x: VENTANA.ancho, z: alto },
  ];
  const signo = giro.sentido === 'derecha' ? 1 : -1;
  const angulo = (giro.angulo * Math.PI) / 180;
  // Altura original de un punto de hoy: se deshace el giro alrededor del pivote.
  const alturas = esquinas.map(
    ({ x, z }) =>
      giro.pivote.z + signo * (x - giro.pivote.x) * Math.sin(angulo) + (z - giro.pivote.z) * Math.cos(angulo),
  );
  const minima = Math.max(Math.min(...alturas), NIVEL_BASE) + 50;
  const maxima = Math.max(...alturas) - 40;
  const contactos = contactosAlAzar(rng, n - 1, minima, maxima, [REGLAS.espesorCapa[0], 200]);
  if (!contactos) return null;
  return apilar(rng, contactos, NIVEL_BASE, Math.max(...alturas) + 150, n);
}

// Capas nuevas sobre la erosión: la primera se mide desde el nivel de la erosión.
function capasSobreErosion(rng, n, corte) {
  const contactos = contactosAlAzar(rng, n - 1, corte.nivel + corte.amplitud + 45, VENTANA.alto - 45, [45, 150]);
  if (!contactos) return null;
  return apilar(rng, contactos, corte.nivel, VENTANA.alto + MARGEN_SUPERIOR, n);
}

// `cantidad` alturas crecientes en [desde, hasta], separadas entre min y max.
function contactosAlAzar(rng, cantidad, desde, hasta, [min, max]) {
  if (cantidad === 0) return [];
  for (let t = 0; t < 20; t++) {
    const separaciones = Array.from({ length: cantidad - 1 }, () => rng.rango(min, max));
    const ocupado = separaciones.reduce((a, b) => a + b, 0);
    if (ocupado > hasta - desde) continue;
    let altura = rng.rango(desde, hasta - ocupado);
    const contactos = [altura];
    for (const s of separaciones) {
      altura += s;
      contactos.push(altura);
    }
    return contactos;
  }
  return null;
}

// Convierte contactos (alturas) en depósitos con espesor, desde `base` hasta `techo`.
function apilar(rng, contactos, base, techo, n) {
  const litologias = litologiasSinRepetir(rng, n);
  const limites = [base, ...contactos, techo];
  return litologias.map((litologia, i) => ({
    tipo: 'deposito',
    espesor: limites[i + 1] - limites[i],
    litologia,
  }));
}

function litologiasSinRepetir(rng, n) {
  const litologias = [];
  for (let i = 0; i < n; i++) {
    const opciones = LITOLOGIAS_SEDIMENTARIAS.filter((l) => l !== litologias[i - 1]);
    litologias.push(rng.elegir(opciones));
  }
  return litologias;
}

/**
 * Fallas y diques que atraviesan la ventana. Si son varios, cada par se cruza dentro de la ventana con
 * un ángulo de al menos REGLAS.anguloDeCruce (si no, su orden relativo no se vería).
 * Cada plano se elige por un punto de paso y se convierte a `posicion` (x a la altura Z_REFERENCIA).
 * `estructuras`: lista de la composición ({tipo, tipoFalla?}), en orden cronológico.
 * `bandaProhibida` [zMin, zMax]: alturas donde no puede quedar un cruce (p. ej. la discordancia).
 */
function estructurasQueSeCruzan(rng, estructuras, bandaProhibida = null) {
  // Sortear planos es barato (no evalúa el modelo): se prueban muchos antes de gastar un intento.
  for (let t = 0; t < SORTEOS_DE_PLANOS; t++) {
    const planos = estructuras.map(({ tipo, tipoFalla }) => {
      const rango = tipo === 'falla' ? RANGOS.echadoFalla : RANGOS.echadoDique;
      return {
        tipo,
        tipoFalla,
        echado: rng.rango(...rango),
        sentidoEchado: rng.elegir(SENTIDOS),
        paso: { x: rng.rango(300, 700), z: rng.rango(120, 380) },
      };
    });
    if (!seCruzanBien(planos, bandaProhibida)) continue;
    return planos.map(({ tipo, tipoFalla, echado, sentidoEchado, paso }) => {
      const s = sentidoEchado === 'derecha' ? 1 : -1;
      const posicion = paso.x - (s * (Z_REFERENCIA - paso.z)) / Math.tan((echado * Math.PI) / 180);
      if (tipo === 'falla') {
        return {
          tipo,
          posicion,
          echado,
          sentidoEchado,
          tipoFalla,
          desplazamiento: rng.rango(...REGLAS.desplazamiento),
        };
      }
      return {
        tipo,
        posicion,
        echado,
        sentidoEchado,
        espesor: rng.rango(...REGLAS.espesorDique),
        litologia: rng.elegir(LITOLOGIAS_IGNEAS),
      };
    });
  }
  return null;
}

function seCruzanBien(planos, bandaProhibida) {
  const direccion = ({ echado, sentidoEchado }) => {
    const d = (echado * Math.PI) / 180;
    return { x: (sentidoEchado === 'derecha' ? 1 : -1) * Math.cos(d), z: -Math.sin(d) };
  };
  const cruces = [];
  for (let i = 0; i < planos.length; i++) {
    for (let j = i + 1; j < planos.length; j++) {
      const a = planos[i].paso;
      const b = planos[j].paso;
      const da = direccion(planos[i]);
      const db = direccion(planos[j]);
      const coseno = Math.abs(da.x * db.x + da.z * db.z);
      if ((Math.acos(Math.min(1, coseno)) * 180) / Math.PI < REGLAS.anguloDeCruce) return false;
      const det = da.x * db.z - da.z * db.x;
      const t = ((b.x - a.x) * db.z - (b.z - a.z) * db.x) / det;
      const cruce = { x: a.x + t * da.x, z: a.z + t * da.z };
      if (cruce.x < 100 || cruce.x > VENTANA.ancho - 100 || cruce.z < 60 || cruce.z > VENTANA.alto - 60) return false;
      if (bandaProhibida && cruce.z >= bandaProhibida[0] && cruce.z <= bandaProhibida[1]) return false;
      cruces.push(cruce);
    }
  }
  // Con tres estructuras, los cruces muy juntos dejan cuñas ilegibles entre ellas.
  for (let i = 0; i < cruces.length; i++) {
    for (let j = i + 1; j < cruces.length; j++) {
      const distancia = Math.hypot(cruces[i].x - cruces[j].x, cruces[i].z - cruces[j].z);
      if (distancia < REGLAS.separacionEntreCruces) return false;
    }
  }
  return true;
}

// Letras al azar (con la semilla) que nunca quedan en orden cronológico.
function letrasAlAzar(rng, n) {
  const enOrden = LETRAS.slice(0, n);
  let letras = rng.barajar(enOrden);
  while (letras.every((letra, i) => letra === enOrden[i])) {
    letras = rng.barajar(enOrden);
  }
  return letras;
}

function contar(registro, motivo) {
  registro[motivo] = (registro[motivo] ?? 0) + 1;
}

function validarNivel(nivel) {
  if (!NIVELES.includes(nivel)) {
    throw new RangeError(`Nivel inválido: ${nivel} (debe ser 1, 2 o 3)`);
  }
}
