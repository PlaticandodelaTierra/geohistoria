// Tipos de evento geológico y sus transformaciones.
//
// Coordenadas 2D: x horizontal, z vertical (positivo hacia arriba).
// Todos los parámetros de un evento están en las coordenadas del MOMENTO del evento:
// un basculamiento posterior inclina también las fallas, diques y erosiones anteriores.
//
// Cada evento tiene una transformación hacia adelante (`aplicar`) y su inversa (`invertir`).
// Solo la falla y el basculamiento mueven la roca existente; depósito, dique y erosión
// añaden o quitan roca sin moverla, así que su transformación es la identidad.
//
// Módulo puro: sin DOM y sin Math.random.

export const LITOLOGIAS_SEDIMENTARIAS = Object.freeze(['arenisca', 'caliza', 'lutita', 'conglomerado']);
export const LITOLOGIAS_IGNEAS = Object.freeze(['basalto', 'granito']);
export const SENTIDOS = Object.freeze(['derecha', 'izquierda']);
export const TIPOS_FALLA = Object.freeze(['normal', 'inversa']);
export const TIPOS_EVENTO = Object.freeze(['deposito', 'basculamiento', 'falla', 'dique', 'erosion']);

// Rangos permitidos (inclusivos), según la tabla de eventos del CLAUDE.md.
export const RANGOS = Object.freeze({
  anguloBasculamiento: Object.freeze([10, 60]),
  echadoFalla: Object.freeze([45, 80]),
  echadoDique: Object.freeze([60, 90]),
  amplitudErosion: Object.freeze([0, 20]),
});

// Altura a la que se mide la "posición" de fallas y diques: la mitad de la ventana (500 / 2).
export const Z_REFERENCIA = 250;

const RAD = Math.PI / 180;

// ───────────────────────── Constructores ─────────────────────────
// Cada constructor revisa sus parámetros y devuelve un objeto congelado.

/** Capa sedimentaria horizontal que rellena lo que haya debajo de su techo. */
export function deposito({ id, espesor, litologia }) {
  validarId(id);
  validarPositivo(espesor, 'espesor', id);
  validarOpcion(litologia, LITOLOGIAS_SEDIMENTARIAS, 'litología', id);
  return Object.freeze({ tipo: 'deposito', id, espesor, litologia });
}

/**
 * Rotación rígida de todo lo anterior alrededor de un pivote.
 * `sentido`: hacia dónde quedan buzando las capas ('derecha' = giro horario).
 */
export function basculamiento({ id, angulo, sentido, pivote }) {
  validarId(id);
  validarRango(angulo, RANGOS.anguloBasculamiento, 'ángulo', id);
  validarOpcion(sentido, SENTIDOS, 'sentido', id);
  validarPunto(pivote, 'pivote', id);
  return Object.freeze({
    tipo: 'basculamiento',
    id,
    angulo,
    sentido,
    pivote: Object.freeze({ x: pivote.x, z: pivote.z }),
  });
}

/**
 * Falla plana. El plano pasa por (posicion, Z_REFERENCIA) y buza `echado` grados hacia `sentidoEchado`.
 * El bloque de techo (arriba del plano) se traslada paralelo al plano una distancia `desplazamiento`
 * (salto neto): hacia abajo si es normal, hacia arriba si es inversa. El bloque de piso no se mueve.
 */
export function falla({ id, posicion, echado, sentidoEchado, tipoFalla, desplazamiento }) {
  validarId(id);
  validarNumero(posicion, 'posición', id);
  validarRango(echado, RANGOS.echadoFalla, 'echado', id);
  validarOpcion(sentidoEchado, SENTIDOS, 'sentido del echado', id);
  validarOpcion(tipoFalla, TIPOS_FALLA, 'tipo de falla', id);
  validarPositivo(desplazamiento, 'desplazamiento', id);
  return Object.freeze({ tipo: 'falla', id, posicion, echado, sentidoEchado, tipoFalla, desplazamiento });
}

/**
 * Dique: franja de roca ígnea de `espesor` centrada en un plano que pasa por (posicion, Z_REFERENCIA)
 * y buza `echado` grados hacia `sentidoEchado`. Reemplaza la roca existente, sin dilatación.
 */
export function dique({ id, posicion, echado, sentidoEchado, espesor, litologia }) {
  validarId(id);
  validarNumero(posicion, 'posición', id);
  validarRango(echado, RANGOS.echadoDique, 'echado', id);
  validarOpcion(sentidoEchado, SENTIDOS, 'sentido del echado', id);
  validarPositivo(espesor, 'espesor', id);
  validarOpcion(litologia, LITOLOGIAS_IGNEAS, 'litología', id);
  return Object.freeze({ tipo: 'dique', id, posicion, echado, sentidoEchado, espesor, litologia });
}

/**
 * Erosión: todo lo que queda arriba de la superficie z = nivel + amplitud·sen(2πx/longitudOnda + fase)
 * se elimina. Con amplitud 0 la superficie es plana.
 */
export function erosion({ id, nivel, amplitud = 0, longitudOnda = 400, fase = 0 }) {
  validarId(id);
  validarNumero(nivel, 'nivel', id);
  validarRango(amplitud, RANGOS.amplitudErosion, 'amplitud', id);
  validarPositivo(longitudOnda, 'longitud de onda', id);
  validarNumero(fase, 'fase', id);
  return Object.freeze({ tipo: 'erosion', id, nivel, amplitud, longitudOnda, fase });
}

const CONSTRUCTORES = { deposito, basculamiento, falla, dique, erosion };

/** Crea (y valida) un evento a partir de un objeto con `tipo`. */
export function crearEvento(datos) {
  if (datos === null || typeof datos !== 'object') {
    throw new TypeError('Cada evento debe ser un objeto');
  }
  const constructor = CONSTRUCTORES[datos.tipo];
  if (!constructor) {
    throw new RangeError(`Tipo de evento desconocido: ${datos.tipo}`);
  }
  return constructor(datos);
}

/** ¿El evento crea un cuerpo de roca (y por lo tanto una unidad visible)? */
export function esUnidad(evento) {
  return evento.tipo === 'deposito' || evento.tipo === 'dique';
}

// ───────────────────────── Geometría ─────────────────────────

/**
 * Geometría del plano de una falla o un dique.
 * - `abajo`: vector unitario a lo largo del echado, hacia abajo.
 * - `normal`: vector unitario perpendicular, hacia el bloque de techo (arriba del plano).
 */
export function planoDe(evento) {
  const s = evento.sentidoEchado === 'derecha' ? 1 : -1;
  const d = evento.echado * RAD;
  return {
    x0: evento.posicion,
    z0: Z_REFERENCIA,
    abajo: { x: s * Math.cos(d), z: -Math.sin(d) },
    normal: { x: s * Math.sin(d), z: Math.cos(d) },
  };
}

/** Distancia con signo de un punto al plano: positiva del lado del bloque de techo. */
export function distanciaAlPlano(evento, punto) {
  const { x0, z0, normal } = planoDe(evento);
  return (punto.x - x0) * normal.x + (punto.z - z0) * normal.z;
}

/** 'techo' si el punto está arriba del plano de la falla; 'piso' si está abajo o sobre él. */
export function ladoDeFalla(evento, punto) {
  return distanciaAlPlano(evento, punto) > 0 ? 'techo' : 'piso';
}

/** ¿El punto cae dentro de la franja del dique? */
export function dentroDelDique(evento, punto) {
  return Math.abs(distanciaAlPlano(evento, punto)) <= evento.espesor / 2;
}

/** Altura de la superficie de erosión en x. */
export function alturaErosion(evento, x) {
  return evento.nivel + evento.amplitud * Math.sin((2 * Math.PI * x) / evento.longitudOnda + evento.fase);
}

// ───────────────────────── Transformaciones ─────────────────────────

/** Lleva un punto de roca existente desde antes del evento hasta después del evento. */
export function aplicar(evento, punto) {
  switch (evento.tipo) {
    case 'basculamiento':
      return rotar(punto, evento.pivote, anguloDeGiro(evento));
    case 'falla':
      return trasladarBloqueDeTecho(evento, punto, +1);
    case 'deposito':
    case 'dique':
    case 'erosion':
      return { x: punto.x, z: punto.z };
    default:
      throw new RangeError(`Tipo de evento desconocido: ${evento.tipo}`);
  }
}

/** Transformación inversa: lleva un punto desde después del evento hasta antes del evento. */
export function invertir(evento, punto) {
  switch (evento.tipo) {
    case 'basculamiento':
      return rotar(punto, evento.pivote, -anguloDeGiro(evento));
    case 'falla':
      return trasladarBloqueDeTecho(evento, punto, -1);
    case 'deposito':
    case 'dique':
    case 'erosion':
      return { x: punto.x, z: punto.z };
    default:
      throw new RangeError(`Tipo de evento desconocido: ${evento.tipo}`);
  }
}

// Ángulo de giro en radianes, positivo en sentido antihorario.
// Capas que buzan a la derecha = giro horario = ángulo negativo.
function anguloDeGiro(evento) {
  return (evento.sentido === 'derecha' ? -1 : 1) * evento.angulo * RAD;
}

function rotar(punto, pivote, angulo) {
  const cos = Math.cos(angulo);
  const sen = Math.sin(angulo);
  const dx = punto.x - pivote.x;
  const dz = punto.z - pivote.z;
  return { x: pivote.x + dx * cos - dz * sen, z: pivote.z + dx * sen + dz * cos };
}

// Mueve el bloque de techo a lo largo del plano. `direccion` = +1 hacia adelante, −1 para invertir.
// Como el movimiento es paralelo al plano, el punto no cambia de lado: la inversa es exacta.
function trasladarBloqueDeTecho(evento, punto, direccion) {
  if (ladoDeFalla(evento, punto) === 'piso') {
    return { x: punto.x, z: punto.z };
  }
  const { abajo } = planoDe(evento);
  const sentido = evento.tipoFalla === 'normal' ? 1 : -1;
  const d = direccion * sentido * evento.desplazamiento;
  return { x: punto.x + d * abajo.x, z: punto.z + d * abajo.z };
}

// ───────────────────────── Validación ─────────────────────────

function validarId(id) {
  if (typeof id !== 'string' || id.trim() === '') {
    throw new TypeError(`Cada evento necesita un id de texto, no ${id}`);
  }
}

function validarNumero(valor, nombre, id) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    throw new TypeError(`Evento ${id}: ${nombre} debe ser un número finito, no ${valor}`);
  }
}

function validarPositivo(valor, nombre, id) {
  validarNumero(valor, nombre, id);
  if (valor <= 0) {
    throw new RangeError(`Evento ${id}: ${nombre} debe ser mayor que 0, no ${valor}`);
  }
}

function validarRango(valor, [min, max], nombre, id) {
  validarNumero(valor, nombre, id);
  if (valor < min || valor > max) {
    throw new RangeError(`Evento ${id}: ${nombre} debe estar entre ${min} y ${max}, no ${valor}`);
  }
}

function validarOpcion(valor, opciones, nombre, id) {
  if (!opciones.includes(valor)) {
    throw new RangeError(`Evento ${id}: ${nombre} debe ser ${opciones.join(', ')}; no ${valor}`);
  }
}

function validarPunto(punto, nombre, id) {
  if (punto === null || typeof punto !== 'object') {
    throw new TypeError(`Evento ${id}: ${nombre} debe ser un punto {x, z}`);
  }
  validarNumero(punto.x, `${nombre}.x`, id);
  validarNumero(punto.z, `${nombre}.z`, id);
}
