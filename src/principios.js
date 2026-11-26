// Principios de la datación relativa para la página #principios: texto, autor y una historia hecha a mano
// para su esquema (el motor la dibuja y detecta lo que se ve, igual que en los ejercicios).
// En los esquemas, las letras siguen el orden cronológico (A es lo más antiguo) para que se lean fácil.
// Título, autor, texto y nota van en español e inglés.

import { deposito, basculamiento, dique } from './motor/eventos.js';
import { EJEMPLOS } from './ejemplos.js';

const ejemplo = (id) => EJEMPLOS.find((e) => e.id === id).historia;

export const PRINCIPIOS_GEOLOGICOS = Object.freeze([
  {
    id: 'superposicion',
    titulo: { es: 'Superposición', en: 'Superposition' },
    autor: { es: 'Nicolás Steno, 1669', en: 'Nicolas Steno, 1669' },
    texto: {
      es:
        'En una sucesión de capas que no ha sido volteada, cada capa es más joven que la que tiene debajo y más ' +
        'antigua que la que tiene encima: los sedimentos se acumulan de abajo hacia arriba.',
      en:
        'In a sequence of layers that has not been overturned, each layer is younger than the one below it and ' +
        'older than the one above it: sediments accumulate from the bottom up.',
    },
    historia: [
      deposito({ id: 'A', espesor: 160, litologia: 'lutita' }),
      deposito({ id: 'B', espesor: 160, litologia: 'arenisca' }),
      deposito({ id: 'C', espesor: 300, litologia: 'caliza' }),
    ],
    principiosQueSeVen: ['superposicion'],
    nivel: 1,
  },
  {
    id: 'horizontalidad-original',
    titulo: { es: 'Horizontalidad original', en: 'Original horizontality' },
    autor: { es: 'Nicolás Steno, 1669', en: 'Nicolas Steno, 1669' },
    texto: {
      es:
        'Los sedimentos se depositan en capas horizontales o casi horizontales. Si hoy las vemos inclinadas, ' +
        'algo las basculó después de que se depositaron.',
      en:
        'Sediments are deposited in horizontal or nearly horizontal layers. If we see them tilted today, ' +
        'something tilted them after they were deposited.',
    },
    historia: [
      deposito({ id: 'A', espesor: 150, litologia: 'caliza' }),
      deposito({ id: 'B', espesor: 150, litologia: 'lutita' }),
      deposito({ id: 'C', espesor: 150, litologia: 'arenisca' }),
      deposito({ id: 'D', espesor: 400, litologia: 'conglomerado' }),
      basculamiento({ id: 'E', angulo: 25, sentido: 'derecha', pivote: { x: 500, z: 250 } }),
    ],
    principiosQueSeVen: ['horizontalidad-original'],
    nivel: 3,
  },
  {
    id: 'continuidad-lateral',
    titulo: { es: 'Continuidad lateral', en: 'Lateral continuity' },
    autor: { es: 'Nicolás Steno, 1669', en: 'Nicolas Steno, 1669' },
    texto: {
      es:
        'Una capa se extiende hacia los lados hasta adelgazarse o llegar al borde de la cuenca. Si la vemos ' +
        'interrumpida —por un valle, una falla o un dique—, los trozos que quedan a cada lado fueron una sola ' +
        'capa continua.',
      en:
        'A layer extends sideways until it thins out or reaches the edge of the basin. If we see it interrupted ' +
        '—by a valley, a fault or a dike—, the pieces left on each side were once a single continuous layer.',
    },
    historia: [
      deposito({ id: 'A', espesor: 160, litologia: 'lutita' }),
      deposito({ id: 'B', espesor: 160, litologia: 'arenisca' }),
      deposito({ id: 'C', espesor: 300, litologia: 'caliza' }),
      dique({ id: 'D', posicion: 500, echado: 90, sentidoEchado: 'derecha', espesor: 70, litologia: 'basalto' }),
    ],
    // El motor no usa este principio como evidencia: se explica con una nota.
    principiosQueSeVen: [],
    nota: {
      es:
        'A la izquierda y a la derecha del dique D aparecen las mismas capas A, B y C, con el mismo espesor y en ' +
        'el mismo orden: antes de que el dique las cortara, cada una era una sola capa continua.',
      en:
        'On both sides of dike D we find the same layers A, B and C, with the same thickness and in the same ' +
        'order: before the dike cut them, each one was a single continuous layer.',
    },
    nivel: 1,
  },
  {
    id: 'relaciones-de-corte',
    titulo: { es: 'Relaciones de corte', en: 'Cross-cutting relationships' },
    autor: {
      es: 'James Hutton, finales del siglo XVIII; Charles Lyell lo formalizó en 1830',
      en: 'James Hutton, late 18th century; formalized by Charles Lyell in 1830',
    },
    texto: {
      es:
        'Lo que corta es más joven que lo que es cortado: un dique o una falla son más jóvenes que las capas que ' +
        'atraviesan, y una falla que desplaza a un dique es más joven que ese dique.',
      en:
        'Whatever cuts is younger than what it cuts: a dike or a fault is younger than the layers it crosses, and ' +
        'a fault that offsets a dike is younger than that dike.',
    },
    historia: ejemplo('falla-corta-dique'),
    principiosQueSeVen: ['relaciones-de-corte'],
    nivel: 2,
  },
  {
    id: 'discordancias',
    titulo: { es: 'Discordancias', en: 'Unconformities' },
    autor: { es: 'James Hutton, Siccar Point (Escocia), 1788', en: 'James Hutton, Siccar Point (Scotland), 1788' },
    texto: {
      es:
        'Una discordancia es una superficie de erosión entre rocas de edades muy distintas: representa un tiempo ' +
        'del que no quedó registro. En una discordancia angular, las capas de abajo se basculan y se erosionan ' +
        'antes de que se depositen las de arriba, que quedan horizontales.',
      en:
        'An unconformity is an erosion surface between rocks of very different ages: it represents a span of time ' +
        'that left no record. In an angular unconformity, the lower layers are tilted and eroded before the upper ' +
        'ones are deposited, and these stay horizontal.',
    },
    historia: ejemplo('discordancia-angular'),
    principiosQueSeVen: ['relaciones-de-corte', 'horizontalidad-original', 'superposicion'],
    soloEvidencias: ['truncamiento', 'discordancia-angular', 'sobre-erosion'],
    nivel: 3,
  },
]);
