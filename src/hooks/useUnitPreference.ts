import { useCallback, useEffect, useState } from 'react';

/** 'recipe' : unités saisies dans la recette ; 'metric' : cuillères, tasses, verres… convertis en g / ml */
export type UnitPreference = 'recipe' | 'metric';

const STORAGE_KEY = 'unitPreference';
const CHANGE_EVENT = 'unit-preference-change';

function readPreference(): UnitPreference {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'metric' ? 'metric' : 'recipe';
  } catch {
    return 'recipe';
  }
}

/**
 * Préférence d'affichage des unités, mémorisée sur l'appareil (localStorage, sans compte).
 * Le premier rendu utilise toujours 'recipe' (identique au rendu serveur), puis la préférence
 * enregistrée est appliquée.
 */
export function useUnitPreference() {
  const [preference, setPreferenceState] = useState<UnitPreference>('recipe');

  useEffect(() => {
    const sync = () => setPreferenceState(readPreference());
    sync();
    // Autres composants de la page, et autres onglets
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setPreference = useCallback((value: UnitPreference) => {
    setPreferenceState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Stockage indisponible (navigation privée…) : la préférence vaut pour la page en cours
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { preference, setPreference };
}
