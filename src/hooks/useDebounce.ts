import { useState, useEffect } from 'react';

/**
 * Hook personnalisé pour debouncer une valeur
 * @param value - Valeur à debouncer
 * @param delay - Délai en millisecondes (défaut: 500ms)
 * @returns Valeur debouncée
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Créer un timer pour mettre à jour la valeur debouncée
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Nettoyer le timer si la valeur change avant la fin du délai
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

