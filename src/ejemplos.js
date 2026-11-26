// Secciones hechas a mano para desarrollar y probar el motor (fases 1 y 2).
// En estas secciones las letras siguen el orden cronológico (A = lo más antiguo) para
// facilitar la revisión; en los ejercicios, el generador las asignará al azar.

import { deposito, basculamiento, falla, dique, erosion } from './motor/eventos.js';

export const EJEMPLOS = Object.freeze([
  {
    id: 'capas-y-dique',
    titulo: 'Tres capas y un dique',
    descripcion: 'Tres capas horizontales cortadas por un dique de basalto casi vertical.',
    historia: [
      deposito({ id: 'A', espesor: 160, litologia: 'lutita' }),
      deposito({ id: 'B', espesor: 160, litologia: 'arenisca' }),
      deposito({ id: 'C', espesor: 300, litologia: 'caliza' }),
      dique({ id: 'D', posicion: 560, echado: 80, sentidoEchado: 'izquierda', espesor: 36, litologia: 'basalto' }),
    ],
  },
  {
    id: 'falla-corta-dique',
    titulo: 'Falla que corta un dique',
    descripcion: 'Cuatro capas y un dique vertical, desplazados por una falla normal de 60°.',
    historia: [
      deposito({ id: 'A', espesor: 140, litologia: 'lutita' }),
      deposito({ id: 'B', espesor: 140, litologia: 'arenisca' }),
      deposito({ id: 'C', espesor: 140, litologia: 'caliza' }),
      deposito({ id: 'D', espesor: 280, litologia: 'conglomerado' }),
      dique({ id: 'E', posicion: 380, echado: 90, sentidoEchado: 'derecha', espesor: 30, litologia: 'basalto' }),
      falla({
        id: 'F',
        posicion: 440,
        echado: 60,
        sentidoEchado: 'izquierda',
        tipoFalla: 'normal',
        desplazamiento: 110,
      }),
    ],
  },
  {
    id: 'discordancia-angular',
    titulo: 'Discordancia angular',
    descripcion: 'Cuatro capas basculadas 30°, erosionadas y cubiertas por dos capas horizontales.',
    historia: [
      deposito({ id: 'A', espesor: 150, litologia: 'caliza' }),
      deposito({ id: 'B', espesor: 150, litologia: 'lutita' }),
      deposito({ id: 'C', espesor: 150, litologia: 'arenisca' }),
      deposito({ id: 'D', espesor: 150, litologia: 'caliza' }),
      basculamiento({ id: 'E', angulo: 30, sentido: 'derecha', pivote: { x: 500, z: 250 } }),
      erosion({ id: 'F', nivel: 300, amplitud: 10, longitudOnda: 350, fase: 0 }),
      deposito({ id: 'G', espesor: 90, litologia: 'conglomerado' }),
      deposito({ id: 'H', espesor: 200, litologia: 'lutita' }),
    ],
  },
  {
    id: 'combinacion',
    titulo: 'Combinación',
    descripcion:
      'Capas cortadas por un dique y una falla, basculadas, erosionadas, cubiertas por capas nuevas ' +
      'y cortadas al final por un dique de granito.',
    historia: [
      deposito({ id: 'A', espesor: 140, litologia: 'caliza' }),
      deposito({ id: 'B', espesor: 130, litologia: 'lutita' }),
      deposito({ id: 'C', espesor: 320, litologia: 'arenisca' }),
      dique({ id: 'D', posicion: 300, echado: 85, sentidoEchado: 'derecha', espesor: 30, litologia: 'basalto' }),
      falla({
        id: 'E',
        posicion: 335,
        echado: 60,
        sentidoEchado: 'izquierda',
        tipoFalla: 'normal',
        desplazamiento: 80,
      }),
      basculamiento({ id: 'F', angulo: 20, sentido: 'izquierda', pivote: { x: 500, z: 250 } }),
      erosion({ id: 'G', nivel: 320, amplitud: 8, longitudOnda: 300, fase: 1 }),
      deposito({ id: 'H', espesor: 70, litologia: 'conglomerado' }),
      deposito({ id: 'I', espesor: 200, litologia: 'lutita' }),
      dique({ id: 'J', posicion: 760, echado: 75, sentidoEchado: 'izquierda', espesor: 28, litologia: 'granito' }),
    ],
  },
]);
