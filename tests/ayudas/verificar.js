// Verificación independiente de una sección generada (la usan la prueba rápida y la masiva).
// No reutiliza revisarSeccion del generador: recalcula todo desde la historia con la cuadrícula fina
// (la que se dibuja) y devuelve la lista de problemas encontrados (vacía si la sección es válida).

import { crearModelo, AIRE, VENTANA } from '../../src/motor/modelo.js';
import { muestrear, trazaVisible, trozosVisibles } from '../../src/motor/visibilidad.js';
import { detectarEvidencias } from '../../src/motor/evidencias.js';
import { crearGrafo, tieneCiclo, esOrdenUnico, ordenTopologico, validarRespuesta } from '../../src/motor/orden.js';
import { esUnidad, RANGOS } from '../../src/motor/eventos.js';
import { REGLAS } from '../../src/motor/generador.js';

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Composición de cada nivel como patrón: d = depósito, b = basculamiento, e = erosión, f = falla, k = dique.
const COMPOSICION = {
  1: { patron: /^d{2,4}k$/, eventos: [3, 5], fallas: [0, 0] },
  2: { patron: /^d{3,5}[fk]{2,3}$/, eventos: [5, 7], fallas: [1, 1] },
  3: { patron: /^d{2,4}bed{1,3}[fk]{0,2}$/, eventos: [6, 9], fallas: [0, 2] },
};
const CLAVE = { deposito: 'd', basculamiento: 'b', erosion: 'e', falla: 'f', dique: 'k' };

export function verificarSeccion({ nivel, historia, aristas, orden }) {
  const problemas = [];
  const problema = (texto) => problemas.push(texto);
  const ids = historia.map((e) => e.id);

  // Composición del nivel.
  const firma = historia.map((e) => CLAVE[e.tipo]).join('');
  const { patron, eventos, fallas } = COMPOSICION[nivel];
  const numeroDeFallas = [...firma].filter((c) => c === 'f').length;
  if (!patron.test(firma) || historia.length < eventos[0] || historia.length > eventos[1]) {
    problema(`composición inválida para el nivel ${nivel}: ${firma}`);
  }
  if (numeroDeFallas < fallas[0] || numeroDeFallas > fallas[1]) problema(`número de fallas: ${numeroDeFallas}`);

  // Letras: las primeras n del alfabeto, nunca en orden cronológico.
  if ([...ids].sort().join('') !== LETRAS.slice(0, ids.length)) problema(`letras inválidas: ${ids.join('')}`);
  if (ids.join('') === LETRAS.slice(0, ids.length)) problema('las letras siguen el orden cronológico');

  // Parámetros dentro de los rangos.
  const dentro = (valor, [min, max]) => valor >= min && valor <= max;
  for (const e of historia) {
    if (e.tipo === 'deposito' && e.espesor < 45) problema(`${e.id}: capa demasiado delgada (${e.espesor})`);
    if (e.tipo === 'dique' && !dentro(e.espesor, REGLAS.espesorDique)) problema(`${e.id}: espesor de dique`);
    if (e.tipo === 'dique' && !dentro(e.echado, RANGOS.echadoDique)) problema(`${e.id}: echado de dique`);
    if (e.tipo === 'falla' && !dentro(e.echado, RANGOS.echadoFalla)) problema(`${e.id}: echado de falla`);
    if (e.tipo === 'falla' && !dentro(e.desplazamiento, REGLAS.desplazamiento)) problema(`${e.id}: desplazamiento`);
    if (e.tipo === 'basculamiento' && !dentro(e.angulo, RANGOS.anguloBasculamiento)) problema(`${e.id}: ángulo`);
    if (e.tipo === 'erosion' && !dentro(e.amplitud, REGLAS.amplitudErosion)) problema(`${e.id}: amplitud`);
  }

  // Lo que se ve, con la cuadrícula fina.
  const modelo = crearModelo(historia);
  const cuadricula = muestrear(modelo, 2);
  const celdas = new Map();
  for (const v of cuadricula.valores) celdas.set(v, (celdas.get(v) ?? 0) + 1);
  if (celdas.has(AIRE)) problema('hay aire en la ventana');
  historia.forEach((e, k) => {
    if (!esUnidad(e)) return;
    const area = (celdas.get(k) ?? 0) * 4;
    if (area === 0) problema(`${e.id}: no se ve`);
    else if (area < REGLAS.areaMinimaUnidad) problema(`${e.id}: área visible ${area}`);
  });
  for (const t of trozosVisibles(cuadricula)) {
    if (t.area < REGLAS.areaMinimaTrozo || t.grosor < REGLAS.grosorMinimo) {
      problema(`${historia[t.indice].id}: astilla (área ${t.area}, grosor ${t.grosor})`);
    }
  }
  historia.forEach((e, k) => {
    if (e.tipo === 'erosion') {
      const cubierto = trazaVisible(modelo, k, 2).reduce((suma, { muestras }) => {
        const xs = muestras.map((m) => m.presente.x);
        return suma + Math.max(...xs) - Math.min(...xs);
      }, 0);
      if (cubierto < REGLAS.coberturaErosion * VENTANA.ancho) problema(`${e.id}: erosión poco visible`);
    }
    if (e.tipo === 'falla') {
      const largo = trazaVisible(modelo, k, 2).reduce((suma, t) => suma + t.largo, 0);
      if (largo < REGLAS.trazaMinimaFalla) problema(`${e.id}: falla poco visible (${Math.round(largo)})`);
    }
  });

  // Evidencias recalculadas y grafo.
  const evidencias = detectarEvidencias(historia, { paso: 2 });
  const resumen = (lista) => lista.map((a) => `${a.desde}>${a.hacia}:${a.evidencia}`).sort().join(' ');
  if (resumen(evidencias.aristas) !== resumen(aristas)) problema('las aristas no coinciden con las recalculadas');
  historia.forEach((e) => {
    if (e.tipo !== 'falla') return;
    const cortadas = evidencias.aristas.filter(
      (a) => a.hacia === e.id && a.evidencia === 'corte' && esUnidad(historia[ids.indexOf(a.desde)]),
    );
    if (cortadas.length < REGLAS.unidadesPorFalla) problema(`${e.id}: la falla no desplaza nada visible`);
  });
  const grafo = crearGrafo(evidencias.ids, evidencias.aristas);
  if (tieneCiclo(grafo)) {
    problema('el grafo tiene un ciclo');
  } else {
    if (!validarRespuesta(grafo, ids).valida) problema('la historia real contradice las evidencias');
    if (!esOrdenUnico(grafo)) problema('el orden no es único');
    // Si el orden es único y la historia real lo cumple, ese orden ES la historia real.
    if (ordenTopologico(grafo).join('') !== ids.join('')) problema('el orden deducido no es la historia real');
  }
  if (orden.join('') !== ids.join('')) problema('el orden informado no es la historia real');

  return problemas;
}
