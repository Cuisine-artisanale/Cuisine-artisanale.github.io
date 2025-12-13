import { useState, useEffect, useCallback } from 'react';

type SetValue<T> = T | ((val: T) => T);

/**
 * Hook personnalisé pour gérer le localStorage avec synchronisation React
 * @param key - Clé du localStorage
 * @param initialValue - Valeur initiale
 * @returns [valeur, setter, remove]
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: SetValue<T>) => void, () => void] {
  // État pour stocker la valeur
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Erreur lors de la lecture du localStorage pour la clé "${key}":`, error);
      return initialValue;
    }
  });

  // Fonction pour mettre à jour la valeur
  const setValue = useCallback(
    (value: SetValue<T>) => {
      try {
        // Permettre à la valeur d'être une fonction pour avoir la même API que useState
        const valueToStore = value instanceof Function ? value(storedValue) : value;

        setStoredValue(valueToStore);

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (error) {
        console.error(`Erreur lors de l'écriture dans le localStorage pour la clé "${key}":`, error);
      }
    },
    [key, storedValue]
  );

  // Fonction pour supprimer la valeur
  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      console.error(`Erreur lors de la suppression du localStorage pour la clé "${key}":`, error);
    }
  }, [key, initialValue]);

  // Écouter les changements du localStorage depuis d'autres onglets
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        try {
          setStoredValue(JSON.parse(e.newValue));
        } catch (error) {
          console.error(`Erreur lors de la synchronisation du localStorage pour la clé "${key}":`, error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [storedValue, setValue, removeValue];
}

