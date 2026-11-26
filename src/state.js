// Estado único con suscripción.
// El estado es un objeto congelado; `actualizar` crea uno nuevo con los cambios y avisa a los suscriptores.

export function crearEstado(inicial = {}) {
  let estado = Object.freeze({ ...inicial });
  const oyentes = new Set();
  return Object.freeze({
    obtener: () => estado,
    actualizar(cambios) {
      const anterior = estado;
      estado = Object.freeze({ ...estado, ...cambios });
      for (const oyente of oyentes) oyente(estado, anterior);
    },
    /** Registra una función que se llama en cada cambio; devuelve la función para darse de baja. */
    suscribir(oyente) {
      oyentes.add(oyente);
      return () => oyentes.delete(oyente);
    },
  });
}
