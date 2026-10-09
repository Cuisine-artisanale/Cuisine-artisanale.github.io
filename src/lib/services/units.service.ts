import { loadFirestore } from '@/lib/config/firestore-lazy';
import { mergeUnits, normalizeUnitKey, buildUnitIndex, resolveUnit, toUnitDef, type UnitDef, type UnitType } from '@/lib/utils/units';

let cache: Promise<UnitDef[]> | null = null;

/** Catalogue des unités (Firestore + unités par défaut), chargé une fois par session. */
export function loadUnits(force = false): Promise<UnitDef[]> {
  if (!cache || force) {
    cache = (async () => {
      try {
        const { db, collection, getDocs } = await loadFirestore();
        const snapshot = await getDocs(collection(db, 'units'));
        return mergeUnits(snapshot.docs.map((d) => toUnitDef(d.id, d.data())));
      } catch (error) {
        console.error('Impossible de charger les unités, utilisation des unités par défaut :', error);
        return mergeUnits([]);
      }
    })();
  }
  return cache;
}

export interface NewUnitInput {
  name: string;
  plural?: string;
  abbreviation?: string;
  type: UnitType;
  /** Équivalence en g (masse) ou ml (volume) */
  toBase?: number | null;
  createdBy?: string;
}

/**
 * Crée une unité, sauf si une unité équivalente existe déjà (même nom, pluriel ou abréviation) :
 * dans ce cas l'unité existante est renvoyée avec `existing: true`.
 */
export async function createUnit(input: NewUnitInput): Promise<{ unit: UnitDef; existing: boolean }> {
  const units = await loadUnits();
  const index = buildUnitIndex(units);
  for (const candidate of [input.name, input.plural, input.abbreviation]) {
    const found = candidate ? resolveUnit(index, null, candidate) : null;
    if (found) return { unit: found, existing: true };
  }

  const name = input.name.trim();
  const abbreviation = (input.abbreviation || '').trim();
  const data = {
    name,
    plural: (input.plural || '').trim() || name,
    abbreviation,
    type: input.type,
    ...((input.type === 'mass' || input.type === 'volume') && input.toBase && input.toBase > 0 ? { toBase: input.toBase } : {}),
    useAbbreviation: Boolean(abbreviation),
    aliases: [] as string[],
    isActive: true,
    createdAt: new Date(),
    ...(input.createdBy ? { createdBy: input.createdBy } : {}),
  };

  const { db, collection, addDoc } = await loadFirestore();
  const ref = await addDoc(collection(db, 'units'), data);
  await loadUnits(true);
  return { unit: toUnitDef(ref.id, data), existing: false };
}

export { normalizeUnitKey };
