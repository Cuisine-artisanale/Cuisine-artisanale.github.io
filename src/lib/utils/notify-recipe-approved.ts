import { auth } from '@/lib/config/firebase-app';

export type RecipeApprovedNotification = 'sent' | 'skipped' | 'failed';

/**
 * Envoie à l'auteur d'une recette tout juste publiée un email avec le lien vers sa fiche.
 * `modified` : la demande a été retouchée par l'admin avant publication (mentionné dans l'email).
 * Ne lève jamais d'erreur : la publication est déjà faite, l'email n'est qu'un plus.
 */
export async function notifyRecipeApproved(recipeId: string, modified: boolean): Promise<RecipeApprovedNotification> {
	const user = auth.currentUser;
	if (!user) return 'failed';

	try {
		const idToken = await user.getIdToken();
		const response = await fetch('/api/recipes/notify-approved', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
			body: JSON.stringify({ recipeId, modified }),
		});
		const result = await response.json().catch(() => ({}));
		if (!response.ok || !result.success) return 'failed';
		return result.sent ? 'sent' : 'skipped';
	} catch {
		return 'failed';
	}
}
