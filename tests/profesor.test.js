import { describe, it, expect } from 'vitest';
import {
  leerParametrosProfesor,
  rutaDeProfesor,
  semillasDeLaHoja,
  listaDeEventos,
  enlaceDePractica,
  claveDeRespuestas,
  cabeEnHelvetica,
  PAPELES,
} from '../src/ui/logicaProfesor.js';
import { generarSeccion, NIVELES } from '../src/motor/generador.js';
import { TEXTOS } from '../src/i18n.js';
import { seccionSVG } from '../src/render/seccion.js';
import { leyendaSVG } from '../src/render/patrones.js';

describe('parámetros de la hoja', () => {
  it('lee nivel, cantidad, semilla y papel', () => {
    expect(leerParametrosProfesor('n=2&c=10&s=48213&p=a4')).toEqual({
      nivel: 2,
      cantidad: 10,
      semilla: 48213,
      papel: 'a4',
    });
  });

  it('marca como null lo inválido; el papel por defecto es carta', () => {
    expect(leerParametrosProfesor('n=5&c=21&s=abc')).toEqual({
      nivel: null,
      cantidad: null,
      semilla: null,
      papel: 'carta',
    });
    expect(leerParametrosProfesor('n=1&c=0&s=3&p=oficio').cantidad).toBeNull();
    expect(leerParametrosProfesor('n=1&c=2.5&s=3').cantidad).toBeNull();
    expect(leerParametrosProfesor('n=1&c=20&s=3').cantidad).toBe(20);
  });

  it('la ruta se puede volver a leer', () => {
    const hoja = { nivel: 3, cantidad: 6, semilla: 12, papel: 'carta' };
    expect(rutaDeProfesor(hoja)).toBe('profesor?n=3&c=6&s=12&p=carta');
    expect(leerParametrosProfesor(rutaDeProfesor(hoja).split('?')[1])).toEqual(hoja);
  });

  it('los papeles tienen sus medidas en milímetros', () => {
    expect(PAPELES.carta).toMatchObject({ ancho: 215.9, alto: 279.4, formato: 'letter' });
    expect(PAPELES.a4).toMatchObject({ ancho: 210, alto: 297, formato: 'a4' });
  });
});

describe('ejercicios de la hoja', () => {
  it('las semillas son consecutivas a partir de la primera', () => {
    expect(semillasDeLaHoja(48213, 4)).toEqual([48213, 48214, 48215, 48216]);
    expect(semillasDeLaHoja(0xffffffff, 2)).toEqual([0xffffffff, 0]);
  });

  it('la misma hoja da siempre los mismos ejercicios', () => {
    const hoja = () => semillasDeLaHoja(100, 3).map((s) => generarSeccion(s, 2).historia);
    expect(hoja()).toEqual(hoja());
  });

  it('la lista de eventos va en orden alfabético y no revela el orden de la historia', () => {
    const { historia } = generarSeccion(48213, 3);
    const lista = listaDeEventos(historia);
    const letras = lista.split('; ').map((e) => e[0]);
    expect(letras).toEqual([...letras].sort());
    expect(lista).toContain('Erosión / discordancia');
  });

  it('el enlace para practicar lleva nivel y semilla', () => {
    expect(enlaceDePractica('https://x.github.io/geohistoria/', 2, 7)).toBe(
      'https://x.github.io/geohistoria/#practica?n=2&s=7',
    );
  });

  it('la clave tiene el orden correcto y todas las evidencias explicadas', () => {
    const ejercicios = semillasDeLaHoja(1, 3).map((semilla, i) => ({
      numero: i + 1,
      semilla,
      seccion: generarSeccion(semilla, 2),
    }));
    const clave = claveDeRespuestas(ejercicios);
    clave.forEach((c, i) => {
      expect(c.numero).toBe(i + 1);
      expect(c.orden).toBe(ejercicios[i].seccion.orden.join(', '));
      expect(c.evidencias).toHaveLength(ejercicios[i].seccion.aristas.length);
    });
  });
});

describe('texto del PDF', () => {
  it('cabeEnHelvetica reconoce acentos, ñ y signos del español, y rechaza la flecha', () => {
    expect(cabeEnHelvetica('¿Qué capa es más joven? Año · 30° — “sí”')).toBe(true);
    expect(cabeEnHelvetica('A → B')).toBe(false);
    expect(cabeEnHelvetica('✓')).toBe(false);
  });

  it('todo lo que va al PDF se puede escribir con Helvetica (sin incrustar fuentes)', () => {
    const P = TEXTOS.profesor;
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
    // Contenido de 20 ejercicios por nivel: lista de eventos, orden y explicaciones.
    for (const nivel of NIVELES) {
      for (let semilla = 1; semilla <= 20; semilla++) {
        const seccion = generarSeccion(semilla, nivel);
        const textos = [
          listaDeEventos(seccion.historia),
          seccion.orden.join(', '),
          ...seccion.aristas.map((a) => `• ${a.explicacion.es}`),
        ];
        for (const texto of textos) expect(cabeEnHelvetica(texto), texto).toBe(true);
      }
    }
  }, 30_000);

  it('las secciones del PDF llevan recuadros detrás de las letras y no llevan franjas para el cursor', () => {
    const { historia } = generarSeccion(5, 3);
    const svg = seccionSVG(historia, { interactiva: false, fondoDeLetras: true });
    expect(svg).not.toContain('class="zona"');
    expect(svg).toMatch(/<g class="halos"[^>]*><rect /);
    expect(svg).not.toContain('dy="0.35em"');
  });

  it('la leyenda del PDF incluye las litologías y los símbolos presentes', () => {
    const { historia } = generarSeccion(2, 3);
    const { svg, alto } = leyendaSVG(historia, TEXTOS.simbolos, TEXTOS.litologias);
    for (const litologia of new Set(historia.map((e) => e.litologia).filter(Boolean))) {
      expect(svg).toContain(`url(#patron-${litologia}-0)`);
    }
    expect(svg).toContain(TEXTOS.simbolos.erosion);
    expect(alto).toBeGreaterThan(30);
  });
});
