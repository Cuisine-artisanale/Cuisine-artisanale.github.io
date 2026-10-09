import { useEffect, useMemo, useState } from 'react';
import { loadUnits } from '@/lib/services/units.service';
import { buildUnitIndex, mergeUnits, type UnitDef } from '@/lib/utils/units';

/**
 * Catalogue d'unités pour les composants client.
 * `initialUnits` (fourni par le serveur) évite un affichage différent avant chargement.
 */
export function useUnits(initialUnits?: UnitDef[]) {
  const [units, setUnits] = useState<UnitDef[]>(() => initialUnits ?? mergeUnits([]));

  useEffect(() => {
    let cancelled = false;
    if (!initialUnits) {
      loadUnits().then((u) => { if (!cancelled) setUnits(u); });
    }
    return () => { cancelled = true; };
  }, [initialUnits]);

  const index = useMemo(() => buildUnitIndex(units), [units]);

  const reload = async () => {
    const u = await loadUnits(true);
    setUnits(u);
    return u;
  };

  return { units, index, reload };
}
