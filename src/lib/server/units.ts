import { unstable_cache } from 'next/cache';
import { getFirebaseAdminDb } from '@/lib/config/firebase-admin';
import { mergeUnits, toUnitDef, type UnitDef } from '@/lib/utils/units';

/** Catalogue des unités côté serveur (mis en cache 1 h). */
export const getUnits = unstable_cache(
  async (): Promise<UnitDef[]> => {
    try {
      const snapshot = await getFirebaseAdminDb().collection('units').get();
      return mergeUnits(snapshot.docs.map((d) => toUnitDef(d.id, d.data())));
    } catch (error) {
      console.error('Unités indisponibles côté serveur :', error);
      return mergeUnits([]);
    }
  },
  ['units-catalog'],
  { revalidate: 3600 }
);
