import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdminDb } from '@/lib/config/firebase-admin';

interface ImportUsageDelta {
	/** Vidéos analysées (chaque analyse appelle un service d'IA payant) */
	analyses?: number;
	/** Recettes réellement envoyées en modération */
	imports?: number;
}

/**
 * Compteur d'imports par utilisateur, dans "importUsage/{uid}" (écrit uniquement par le serveur) :
 * totaux depuis l'origine et détail par mois ("2026-10"), pour suivre l'usage et pouvoir
 * poser un quota plus tard.
 *
 * Le comptage ne doit jamais faire échouer un import : les erreurs sont seulement journalisées.
 */
export async function recordImportUsage(uid: string, { analyses = 0, imports = 0 }: ImportUsageDelta): Promise<void> {
	if (analyses <= 0 && imports <= 0) return;

	const month = new Date().toISOString().slice(0, 7);
	const counters = {
		...(analyses > 0 && { analyses: FieldValue.increment(analyses) }),
		...(imports > 0 && { imports: FieldValue.increment(imports) }),
	};

	try {
		await getFirebaseAdminDb()
			.doc(`importUsage/${uid}`)
			.set(
				{
					uid,
					...counters,
					months: { [month]: counters },
					...(imports > 0 && { lastImportAt: FieldValue.serverTimestamp() }),
					updatedAt: FieldValue.serverTimestamp(),
				},
				{ merge: true },
			);
	} catch (error) {
		console.error(`Compteur d'imports indisponible (${uid}) :`, error);
	}
}
