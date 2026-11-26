import { describe, it, expect, afterEach } from 'vitest';
import {
  IDIOMAS,
  TEXTOS,
  textosEn,
  idioma,
  cambiarIdioma,
  idiomaGuardado,
  nombreDeTarjeta,
  PRINCIPIOS,
} from '../src/i18n.js';
import { generarSeccion, NIVELES } from '../src/motor/generador.js';
import { listaDeEventos, claveDeRespuestas, cabeEnHelvetica } from '../src/ui/logicaProfesor.js';
import { textoParaCompartir, fechaLegible } from '../src/ui/logicaReto.js';

// El idioma activo es estado del módulo: cada prueba lo deja en español.
afterEach(() => cambiarIdioma('es'));

/** Recorre un diccionario y devuelve [ruta, valor] de cada hoja (texto o función). */
function hojas(objeto, ruta = '') {
  return Object.entries(objeto).flatMap(([clave, valor]) =>
    valor && typeof valor === 'object' ? hojas(valor, `${ruta}${clave}.`) : [[`${ruta}${clave}`, valor]],
  );
}

describe('diccionarios', () => {
  const es = new Map(hojas(textosEn('es')));
  const en = new Map(hojas(textosEn('en')));

  it('español e inglés tienen exactamente las mismas claves', () => {
    expect([...en.keys()].sort()).toEqual([...es.keys()].sort());
  });

  it('cada texto tiene el mismo tipo en ambos idiomas y ninguno está vacío', () => {
    for (const [ruta, valor] of es) {
      const otro = en.get(ruta);
      expect(typeof otro, ruta).toBe(typeof valor);
      if (typeof valor === 'string') {
        expect(valor.trim(), `es: ${ruta}`).not.toBe('');
        expect(otro.trim(), `en: ${ruta}`).not.toBe('');
      }
    }
  });

  it('las funciones reciben los mismos argumentos y devuelven texto en ambos idiomas', () => {
    for (const [ruta, valor] of es) {
      if (typeof valor !== 'function') continue;
      const otro = en.get(ruta);
      expect(otro.length, ruta).toBe(valor.length);
      const argumentos = Array.from({ length: valor.length }, () => 'X');
      for (const [cual, funcion] of [['es', valor], ['en', otro]]) {
        const texto = funcion(...argumentos);
        expect(typeof texto, `${cual}: ${ruta}`).toBe('string');
        expect(texto.trim(), `${cual}: ${ruta}`).not.toBe('');
      }
    }
  });

  it('los textos en inglés no se quedaron en español', () => {
    for (const [ruta, valor] of en) {
      if (ruta.startsWith('nombresIdiomas.')) continue; // "Español" se escribe en español en ambos
      const texto = typeof valor === 'function' ? valor(...Array.from({ length: valor.length }, () => '1')) : valor;
      expect(texto, ruta).not.toMatch(/[áéíóúñ¿¡]/i);
    }
  });

  it('los nombres de los principios están en ambos idiomas', () => {
    for (const [clave, nombres] of Object.entries(PRINCIPIOS)) {
      for (const cual of IDIOMAS) expect(nombres[cual]?.length, `${clave} ${cual}`).toBeGreaterThan(3);
    }
  });
});

describe('idioma activo', () => {
  it('es español por defecto, también sin localStorage (Node no tiene window)', () => {
    expect(idioma()).toBe('es');
    expect(idiomaGuardado()).toBe('es');
  });

  it('TEXTOS sigue al idioma activo', () => {
    expect(TEXTOS.revisar).toBe(textosEn('es').revisar);
    cambiarIdioma('en');
    expect(idioma()).toBe('en');
    expect(TEXTOS.revisar).toBe(textosEn('en').revisar);
    expect(TEXTOS.profesor.titulo).toBe('Exercise sheets');
    expect(Object.keys(TEXTOS)).toEqual(Object.keys(textosEn('en')));
  });

  it('un idioma desconocido no cambia el activo', () => {
    cambiarIdioma('en');
    expect(cambiarIdioma('fr')).toBe('en');
    expect(idioma()).toBe('en');
  });
});

describe('tarjetas', () => {
  const capa = { tipo: 'deposito', litologia: 'arenisca' };
  const dique = { tipo: 'dique', litologia: 'basalto' };

  it('nombran cada evento en ambos idiomas', () => {
    expect(nombreDeTarjeta(capa, 'es')).toBe('Capa de arenisca');
    expect(nombreDeTarjeta(capa, 'en')).toBe('Sandstone layer');
    expect(nombreDeTarjeta(dique, 'es')).toBe('Dique de basalto');
    expect(nombreDeTarjeta(dique, 'en')).toBe('Basalt dike');
    expect(nombreDeTarjeta({ tipo: 'falla' }, 'en')).toBe('Fault');
    expect(nombreDeTarjeta({ tipo: 'erosion' }, 'en')).toBe('Erosion / unconformity');
    expect(nombreDeTarjeta({ tipo: 'basculamiento' }, 'en')).toBe('Tilting');
  });

  it('sin idioma explícito usan el activo', () => {
    cambiarIdioma('en');
    expect(nombreDeTarjeta(capa)).toBe('Sandstone layer');
  });

  it('todas las litologías tienen nombre en ambos idiomas', () => {
    expect(Object.keys(textosEn('en').litologias).sort()).toEqual(Object.keys(textosEn('es').litologias).sort());
  });
});

describe('explicaciones y PDF en inglés', () => {
  it('cada evidencia de 20 secciones por nivel tiene explicación en ambos idiomas, con sus letras', () => {
    for (const nivel of NIVELES) {
      for (let semilla = 1; semilla <= 20; semilla++) {
        for (const arista of generarSeccion(semilla, nivel).aristas) {
          for (const cual of IDIOMAS) {
            const texto = arista.explicacion[cual];
            expect(texto, `${nivel}/${semilla} ${cual}`).toContain(arista.desde);
            expect(texto, `${nivel}/${semilla} ${cual}`).toContain(arista.hacia);
          }
        }
      }
    }
  }, 30_000);

  it('todo lo que va al PDF en inglés se puede escribir con Helvetica', () => {
    const P = textosEn('en').profesor;
    const fijos = [
      P.pdf.tituloEjercicios,
      P.pdf.tituloRespuestas,
      P.pdf.datosAlumno,
      P.pdf.instrucciones,
      P.pdf.eventos,
      P.pdf.lineaRespuesta,
      P.pdf.evidencias,
      P.pdf.enLinea('https://x.github.io/geohistoria/#practica?n=2&s=7'),
      P.pdf.pagina(1, 3),
      P.ordenCorrecto,
      P.resumen(10, 2, 48213, 48222),
      P.ejercicio(3, 48215),
    ];
    for (const texto of fijos) expect(cabeEnHelvetica(texto), texto).toBe(true);
    const ejercicios = [1, 2, 3].map((semilla, i) => ({
      numero: i + 1,
      semilla,
      seccion: generarSeccion(semilla, 3),
    }));
    for (const { seccion } of ejercicios) {
      const lista = listaDeEventos(seccion.historia, 'en');
      expect(cabeEnHelvetica(lista), lista).toBe(true);
      expect(lista).toContain('Erosion / unconformity');
    }
    for (const c of claveDeRespuestas(ejercicios, 'en')) {
      for (const texto of c.evidencias) expect(cabeEnHelvetica(texto), texto).toBe(true);
    }
  });

  it('la clave de respuestas usa las explicaciones del idioma pedido', () => {
    const ejercicios = [{ numero: 1, semilla: 2, seccion: generarSeccion(2, 2) }];
    const [es] = claveDeRespuestas(ejercicios, 'es');
    const [en] = claveDeRespuestas(ejercicios, 'en');
    expect(en.orden).toBe(es.orden);
    expect(en.evidencias.join(' ')).toMatch(/\b(older|younger)\b/);
    expect(es.evidencias.join(' ')).toMatch(/más (antigu|joven)/);
  });
});

describe('reto en inglés', () => {
  it('la fecha y el texto para compartir salen en inglés', () => {
    expect(fechaLegible('2026-11-26', true, 'en')).toBe('November 26, 2026');
    const texto = textoParaCompartir({
      fecha: '2026-11-26',
      nivel: 2,
      intentos: [[true, false, true], [true, true, true]],
      resuelto: true,
      racha: 3,
      enlace: 'https://x.github.io/geohistoria/#reto',
      idioma: 'en',
    });
    const lineas = texto.split('\n');
    expect(lineas[0]).toMatch(/^GeoHistoria · Challenge of .+ \(level 2\)$/);
    expect(lineas[1]).toBe('Solved in 2 tries · streak: 3 days');
    expect(lineas.at(-1)).toBe('https://x.github.io/geohistoria/#reto');
    expect(texto).not.toMatch(/[A-H], [A-H]/); // no revela el orden
  });
});
