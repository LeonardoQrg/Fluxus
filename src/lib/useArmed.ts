import { useEffect, useState } from 'react';

/**
 * Devuelve true recién después de `ms` milisegundos. Sirve para que un botón que
 * confirma algo importante (como eliminar) no se active con el mismo toque que lo abrió.
 */
export function useArmed(ms = 500) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setArmed(true), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return armed;
}
