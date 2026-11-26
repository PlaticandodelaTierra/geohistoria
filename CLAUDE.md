# GeoHistoria — Rompecabezas de edad relativa

> Nombre provisional. Si cambia, actualizar aquí, en `package.json`, `vite.config.js` (base) y README.

## Qué es

Aplicación web **sin instalación** (sitio estático en GitHub Pages) donde el usuario ve una **sección geológica
generada al azar** (capas, fallas, diques, discordancias) y debe **ordenar los eventos del más antiguo al más joven**.
Al revisar, la app explica **qué principio geológico** demuestra cada relación (superposición, relaciones de corte, etc.).

Los ejercicios son **infinitos y reproducibles**: cada sección sale de una *semilla*, así que se comparten con un enlace
y el profesor puede generar hojas de ejercicios con su clave de respuestas.

## Público y principios

- Estudiantes de licenciatura (cursos introductorios de geología, estratigrafía y geología estructural), bachillerato,
  profesores y público general interesado.
- **Español primero**, inglés como segunda lengua.
- **Cero instalación, cero servidor**: todo corre en el navegador.
- **Rigor geológico**: cada sección debe ser geológicamente posible y cada respuesta debe poder deducirse **solo de lo que
  se ve** en la sección. Si una relación no es observable, no se puede exigir.
- **Aprender, no adivinar**: la retroalimentación explica el porqué, no solo dice "correcto" o "incorrecto".
- Diseño limpio con estilo de libro de texto: colores suaves **más patrones**, para que funcione en blanco y negro y para
  personas con daltonismo.

## Stack

- Vite + JavaScript (ES modules), sin framework.
- Render en **SVG**. `d3-contour` (marching squares) para convertir la cuadrícula del modelo en polígonos. No usar más
  partes de D3 sin justificarlo.
- Exportación: SVG; PNG vía canvas; PDF con `jspdf` + `svg2pdf.js` (modo profesor).
- Pruebas: Vitest.
- Despliegue: GitHub Actions → GitHub Pages.
- Mantener las dependencias al mínimo. Preguntar antes de añadir una nueva.

## Estructura de carpetas

```
/
├── CLAUDE.md
├── README.md / README.es.md
├── CITATION.cff
├── LICENSE                     # MIT
├── index.html
├── vite.config.js
├── src/
│   ├── main.js                 # arranque, rutas simples (#practica, #profesor, #reto, #principios)
│   ├── state.js                # estado único + suscripción
│   ├── rng.js                  # generador aleatorio con semilla (p. ej. mulberry32) — NUNCA usar Math.random en el motor
│   ├── motor/
│   │   ├── eventos.js          # definición de cada tipo de evento + su transformación inversa
│   │   ├── modelo.js           # historia (lista de eventos) → función unidadEn(x, z)
│   │   ├── evidencias.js       # deduce relaciones OBSERVABLES entre eventos → grafo (DAG) con el principio de cada arista
│   │   ├── orden.js            # orden topológico, unicidad, validación de respuestas
│   │   └── generador.js        # semilla + nivel → historia válida (reintenta hasta cumplir las reglas)
│   ├── render/
│   │   ├── seccion.js          # muestreo de la cuadrícula → contornos → SVG
│   │   ├── patrones.js         # patrones SVG por litología (dibujados por nosotros, sencillos)
│   │   └── etiquetas.js        # letras A, B, C… sobre cada unidad/evento, sin encimarse
│   ├── ui/
│   │   ├── tarjetas.js         # tarjetas de eventos arrastrables (+ alternativa con teclado)
│   │   ├── revision.js         # resultado y explicaciones
│   │   ├── profesor.js         # hojas de ejercicios y claves
│   │   └── principios.js       # página de los principios con esquemas sencillos
│   ├── i18n.js                 # textos ES/EN (incluye explicaciones)
│   └── export.js               # SVG / PNG / PDF
└── tests/
    ├── rng.test.js
    ├── eventos.test.js
    ├── evidencias.test.js
    ├── orden.test.js
    └── generador.test.js       # prueba masiva: miles de semillas por nivel
```

## El motor (lo más importante del proyecto)

### 1. Historia = lista de eventos

Una sección es una **lista ordenada de eventos** (del más antiguo al más joven). Coordenadas 2D: `x` horizontal,
`z` vertical (positivo hacia arriba), en unidades arbitrarias; la ventana de la sección es fija (p. ej. 1000 × 500).

| Tipo | Parámetros | Notas |
|---|---|---|
| `deposito` | espesor, litología | Capa horizontal sobre lo existente |
| `basculamiento` | ángulo (10–60°), sentido, punto de giro | Rota todo lo anterior |
| `falla` | posición, echado (45–80°), sentido de echado, tipo (normal/inversa), desplazamiento | Desplaza todo lo anterior a un lado del plano |
| `dique` | posición, echado (60–90°), espesor, litología ígnea | Corta todo lo anterior |
| `erosion` | altura de la superficie (plana o ligeramente ondulada) | Elimina todo lo que está arriba; deja una **discordancia** |

Más adelante (v2): `pliegue`, `sill`, `colada` (para distinguirla de un sill), `inclusiones`, `fosiles`, `aureola` de
metamorfismo de contacto.

### 2. Modelo implícito: `unidadEn(x, z)`

Para saber qué hay en un punto **hoy**, se recorren los eventos **del más joven al más antiguo**, aplicando la
**transformación inversa** de cada uno (deshacer la falla, deshacer el basculamiento, etc.):
- Si el punto cae dentro de un dique, la respuesta es ese dique.
- Si está arriba de la superficie de un depósito todavía no ocurrido, o arriba de una superficie de erosión, es "aire"
  (o la siguiente capa más joven).
- Al llegar al principio, se determina la capa por su altura.

Este diseño es el mismo que servirá después para un **bloque diagrama 3D** (otro proyecto). Mantener el motor puro, sin DOM.

### 3. Evidencias observables → grafo de relaciones

`evidencias.js` analiza la **sección renderizada** (no la lista de eventos) y crea una arista `A → B` ("A es más antiguo
que B") solo cuando la relación **se ve**:

| Evidencia visible | Arista | Principio |
|---|---|---|
| Capa B encima de capa A, en contacto | A → B | Superposición |
| El dique D corta la capa A | A → D | Relaciones de corte |
| La falla F desplaza al dique D o a la capa A | D → F, A → F | Relaciones de corte |
| Las capas están inclinadas y las de arriba de la discordancia no | capas inferiores → basculamiento → erosión | Horizontalidad original |
| La superficie de erosión trunca capas, diques o fallas | (truncados) → erosión | Relaciones de corte / discordancia |
| Capas depositadas sobre la superficie de erosión | erosión → capas superiores | Superposición |
| La falla o el dique se detiene en la discordancia | falla/dique → erosión | Relaciones de corte |

Cada arista guarda su **principio** y una **explicación** en ES y EN, con las letras reales del ejercicio:
"El dique C corta a la capa B, así que C es más joven que B (principio de relaciones de corte)."

### 4. Unicidad y validación

- La respuesta correcta es **cualquier orden compatible con el grafo** (cualquier ordenamiento topológico).
- El generador **prefiere** secciones con orden **único**: en cada paso del ordenamiento topológico hay exactamente un
  evento disponible. Si no es único, se **regenera** (para los niveles 1–3) o se acepta mostrando "hay más de un orden válido"
  (nivel 4).
- Al revisar, cada par mal ordenado se señala con la evidencia que lo contradice.

### 5. Reglas del generador (todas deben cumplirse; si no, se reintenta con la siguiente subsemilla)

- Todo evento de la respuesta debe ser **visible** en la ventana: ninguna capa totalmente erosionada, ningún dique fuera de
  cuadro, ninguna falla que no desplace nada visible.
- Áreas mínimas: ninguna unidad visible con área menor a un umbral (evita "astillas" imposibles de leer).
- Desplazamiento mínimo de fallas, para que sea evidente.
- Espesores, ángulos y echados dentro de rangos realistas (ver la tabla de eventos).
- Las letras de las etiquetas **no siguen el orden** de los eventos (se asignan al azar, pero con la semilla).
- Máximo de reintentos (p. ej. 200); si se agota, usar la siguiente semilla y registrar un aviso en modo desarrollo.

### 6. Niveles

| Nivel | Eventos | Tipos permitidos | Principios que entrena |
|---|---|---|---|
| 1 | 3–5 | depósitos + 1 dique | Superposición, relaciones de corte |
| 2 | 5–7 | + falla, hasta 2 diques | Corte entre estructuras |
| 3 | 6–9 | + basculamiento + erosión + nuevos depósitos | Horizontalidad original, discordancia angular |
| 4 | 8–12 | todo, con hasta 2 ciclos de erosión | Historias complejas |

## Interfaz

### Modos (rutas con `#`)

- **#practica**: elige nivel → sección + tarjetas → "Revisar" → explicaciones → "Otro ejercicio". La semilla y el nivel van
  en la URL (`#practica?n=2&s=48213`) para compartir un ejercicio exacto.
- **#reto**: un ejercicio diario igual para todos (semilla = fecha). Botón "Compartir resultado" que genera un texto
  corto sin revelar la respuesta (pensado para redes).
- **#profesor**: elegir nivel y cantidad (1–20) → genera la hoja de ejercicios (PDF/PNG) y una **hoja de respuestas separada**
  con las explicaciones. Permite fijar semillas para que todo el grupo tenga los mismos ejercicios.
- **#principios**: página con los principios de Steno, Hutton y otros, cada uno con un esquema sencillo generado por el motor.

### Interacción

- Tarjetas con la letra y el tipo de evento ("C · Dique", "F · Falla", "Erosión / discordancia", "Basculamiento").
  Basculamiento y erosión se marcan en la sección con un símbolo o una línea etiquetada.
- Arrastrar y soltar **y** alternativa con teclado o botones ↑ ↓ (accesibilidad; también funciona en celular).
- Al pasar el cursor por una tarjeta, se resalta su unidad en la sección (y al revés).
- Después de revisar: verde/rojo por posición, más la lista de evidencias con su principio.
- Opcional: puntaje y racha guardados en `localStorage` (envuelto en try/catch; la app debe funcionar sin él).

### Estilo visual

- Estilo de libro de texto: contornos negros finos, colores pastel por litología **más patrones SVG** (puntos para arenisca,
  ladrillos para caliza, líneas para lutita, cruces o "v" para ígneas). Dibujar nuestros propios patrones, sencillos.
- Fallas en línea gruesa con medias flechas de movimiento; discordancias en línea ondulada.
- Que funcione bien desde 360 px de ancho (celular) hasta escritorio.

## Funciones de la versión 1.0

- [ ] Motor: eventos 2D, modelo implícito, evidencias, orden, generador con semilla.
- [ ] Niveles 1–3 (el 4 puede salir en la 1.1).
- [ ] Modo práctica con retroalimentación explicada.
- [ ] Modo reto diario.
- [ ] Modo profesor con PDF de ejercicios y de respuestas.
- [ ] Página de principios.
- [ ] Bilingüe ES/EN.
- [ ] Exportar la sección actual como SVG/PNG (para que profesores la usen en sus presentaciones).

## Fuera del alcance de v1.0

Pliegues, sills vs coladas, inclusiones, fósiles y sucesión faunística, aureolas, modo "dibuja tu propia sección",
cuentas de usuario, servidor. (Todo eso es para v2+.)

## Reglas de código

- El motor (`src/motor/`) es **puro**: sin DOM, sin `Math.random`, determinista con la semilla.
- Comentarios en español. Nombres consistentes dentro de cada archivo.
- Nada de llamadas a internet desde la app publicada.
- Accesibilidad: controles con etiqueta, navegables con teclado, contraste AA, textos alternativos en las figuras.
- Antes de cada fase, mostrarme el plan y esperar mi aprobación. Al terminar, correr las pruebas y resumir qué cambió.
- **Si una regla geológica no está clara, preguntarme antes de inventarla.** Yo valido la geología.

## Pruebas mínimas (Vitest)

- **rng**: la misma semilla da siempre la misma secuencia.
- **eventos**: cada transformación seguida de su inversa regresa el punto original (tolerancia numérica).
- **modelo**: casos hechos a mano (p. ej. 3 capas + 1 dique) devuelven la unidad esperada en puntos de control.
- **evidencias**: en casos hechos a mano se detectan exactamente las aristas esperadas, con su principio.
- **orden**: el ordenamiento topológico es correcto; la detección de unicidad funciona; el validador acepta cualquier
  orden válido y rechaza los inválidos.
- **generador (prueba masiva)**: para 2,000 semillas por nivel → toda sección cumple las reglas del generador, todos los
  eventos son visibles, el grafo no tiene ciclos y (niveles 1–3) el orden es único. Reportar el promedio de reintentos.

## Despliegue

- `vite.config.js` con `base: '/<nombre-del-repo>/'`.
- Workflow `.github/workflows/deploy.yml`: build y publicación en GitHub Pages en cada push a `main`.

## README (cuando la app funcione)

- GIF corto resolviendo un ejercicio; botón "Jugar ahora"; captura de una hoja del modo profesor.
- Sección "Para profesores" (cómo generar hojas y compartir semillas).
- Sección "Cómo citar" (CITATION.cff + DOI de Zenodo).
- Sección "Otras herramientas del autor": GeoEscala y espacio para BIRDS.
- Topics: `geology`, `earth-science`, `education`, `stratigraphy`, `relative-dating`, `geoscience-education`, `spanish`, `educational-game`.

## Fases

0. **Arranque**: proyecto Vite, Vitest, rng con semilla.
1. **Motor I**: eventos 2D + modelo implícito + render de secciones **hechas a mano** (sin generador todavía).
2. **Motor II**: evidencias + orden + validación, probados con las secciones hechas a mano.
3. **Generador**: niveles 1–3, reglas, reintentos, prueba masiva.
4. **Práctica**: tarjetas, revisión, explicaciones, semilla en la URL.
5. **Estilo**: patrones, etiquetas, fallas y discordancias con estilo de libro, versión para celular.
6. **Profesor + reto + principios**: PDF de ejercicios y respuestas, reto diario, página de principios.
7. **Bilingüe y publicación**: i18n, accesibilidad, workflow de Pages, README, CITATION.cff, licencia.

## Comandos

- `npm install`: instalar dependencias
- `npm run dev`: servidor local
- `npm test`: pruebas
- `npm run build`: compilar a `dist/`
