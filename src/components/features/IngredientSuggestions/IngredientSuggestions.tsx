"use client";
import React, { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/config/firebase';
import { auth } from '@/lib/config/firebase-app';
import { useToast } from '@/contexts/ToastContext/ToastContext';
import { revalidateRecipe } from '@/lib/utils/revalidate-recipe';
import type { RecipePart } from '@/types';
import './IngredientSuggestions.css';

interface Suggestion {
	id: string;
	type: 'rename' | 'duplicate';
	source: 'format' | 'duplicate' | 'ai';
	ingredientId: string;
	currentName: string;
	suggestedName?: string;
	duplicates?: { id: string; name: string }[];
	reason: string;
}

const SOURCE_LABELS: Record<Suggestion['source'], string> = {
	format: 'Mise en forme',
	duplicate: 'Doublon',
	ai: 'Orthographe',
};

/**
 * Propositions de correction du catalogue d'ingrédients, issues de la vérification hebdomadaire
 * (/api/cron/ingredient-review). Rien n'est modifié tant que l'admin n'a pas cliqué « Appliquer ».
 */
const IngredientSuggestions: React.FC = () => {
	const { showToast } = useToast();
	const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
	const [busyId, setBusyId] = useState<string | null>(null);
	const [checking, setChecking] = useState(false);

	useEffect(() => {
		const pending = query(collection(db, 'ingredientSuggestions'), where('status', '==', 'pending'));
		return onSnapshot(
			pending,
			(snapshot) => setSuggestions(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Suggestion))),
			(error) => console.error('Propositions du catalogue indisponibles :', error)
		);
	}, []);

	const close = (suggestion: Suggestion, status: 'applied' | 'ignored') =>
		updateDoc(doc(db, 'ingredientSuggestions', suggestion.id), { status, resolvedAt: serverTimestamp() });

	/** Remplace les fiches en double par la fiche conservée dans toutes les recettes, puis supprime les doublons. */
	const mergeDuplicates = async (suggestion: Suggestion) => {
		const removed = new Set((suggestion.duplicates || []).map((d) => d.id));
		let updated = 0;

		for (const collectionName of ['recipes', 'recipesRequest']) {
			const snapshot = await getDocs(collection(db, collectionName));
			for (const recipe of snapshot.docs) {
				const parts: RecipePart[] = Array.isArray(recipe.data().recipeParts) ? recipe.data().recipeParts : [];
				if (!parts.some((part) => (part.ingredients || []).some((ingredient) => removed.has(ingredient.id)))) continue;

				await updateDoc(recipe.ref, {
					recipeParts: parts.map((part) => ({
						...part,
						ingredients: (part.ingredients || []).map((ingredient) =>
							removed.has(ingredient.id) ? { ...ingredient, id: suggestion.ingredientId, name: suggestion.currentName } : ingredient
						),
					})),
				});
				updated += 1;
				// La fiche publique de la recette est en cache
				if (collectionName === 'recipes') revalidateRecipe({ id: recipe.id, url: recipe.data().url });
			}
		}

		// Les fiches ne sont supprimées qu'une fois toutes les recettes mises à jour
		for (const id of removed) {
			await deleteDoc(doc(db, 'ingredients', id));
		}
		return updated;
	};

	const apply = async (suggestion: Suggestion) => {
		setBusyId(suggestion.id);
		try {
			if (suggestion.type === 'rename' && suggestion.suggestedName) {
				await updateDoc(doc(db, 'ingredients', suggestion.ingredientId), { name: suggestion.suggestedName, updatedAt: new Date() });
				showToast({ severity: 'success', summary: 'Ingrédient renommé', detail: `${suggestion.currentName} → ${suggestion.suggestedName}` });
			} else if (suggestion.type === 'duplicate') {
				const updated = await mergeDuplicates(suggestion);
				showToast({ severity: 'success', summary: 'Doublons fusionnés', detail: `${updated} recette(s) mise(s) à jour` });
			}
			await close(suggestion, 'applied');
		} catch (error) {
			console.error('Erreur application de la proposition :', error);
			showToast({ severity: 'error', summary: 'Erreur', detail: "La correction n'a pas pu être appliquée" });
		} finally {
			setBusyId(null);
		}
	};

	const ignore = async (suggestion: Suggestion) => {
		setBusyId(suggestion.id);
		try {
			await close(suggestion, 'ignored');
		} catch (error) {
			console.error('Erreur :', error);
			showToast({ severity: 'error', summary: 'Erreur', detail: "La proposition n'a pas pu être ignorée" });
		} finally {
			setBusyId(null);
		}
	};

	const checkNow = async () => {
		const user = auth.currentUser;
		if (!user) return;
		setChecking(true);
		try {
			const response = await fetch('/api/cron/ingredient-review', {
				method: 'POST',
				headers: { Authorization: `Bearer ${await user.getIdToken()}` },
			});
			const data = await response.json();
			if (!response.ok || !data?.success) throw new Error(data?.error || 'Erreur');
			showToast({
				severity: 'success',
				summary: 'Catalogue vérifié',
				detail: `${data.checked} ingrédients vérifiés, ${data.created} nouvelle(s) proposition(s).${data.aiAvailable ? '' : " Orthographe non vérifiée : IA indisponible."}`,
			});
		} catch (error) {
			console.error('Erreur vérification du catalogue :', error);
			showToast({ severity: 'error', summary: 'Erreur', detail: 'La vérification a échoué' });
		} finally {
			setChecking(false);
		}
	};

	return (
		<section className="ingredient-suggestions" aria-label="Corrections proposées pour le catalogue">
			<div className="ingredient-suggestions-header">
				<div>
					<h3>Corrections proposées {suggestions.length > 0 && <span className="ingredient-suggestions-count">{suggestions.length}</span>}</h3>
					<p>Vérification automatique chaque lundi : mise en forme, doublons et orthographe.</p>
				</div>
				<button type="button" className="ingredient-suggestions-check" onClick={checkNow} disabled={checking}>
					<span className={`pi ${checking ? 'pi-spin pi-spinner' : 'pi-refresh'}`} aria-hidden="true"></span>
					{checking ? 'Vérification…' : 'Vérifier maintenant'}
				</button>
			</div>

			{suggestions.length === 0 ? (
				<p className="ingredient-suggestions-empty">Aucune correction en attente.</p>
			) : (
				<ul className="ingredient-suggestions-list">
					{suggestions.map((suggestion) => (
						<li key={suggestion.id}>
							<div className="ingredient-suggestions-text">
								<span className={`ingredient-suggestions-tag is-${suggestion.source}`}>{SOURCE_LABELS[suggestion.source]}</span>
								{suggestion.type === 'rename' ? (
									<p>
										<span className="ingredient-suggestions-old">{suggestion.currentName}</span>
										<span className="pi pi-arrow-right" aria-hidden="true"></span>
										<strong>{suggestion.suggestedName}</strong>
									</p>
								) : (
									<p>
										Garder <strong>{suggestion.currentName}</strong> et y fusionner{' '}
										<span className="ingredient-suggestions-old">{(suggestion.duplicates || []).map((d) => d.name).join(', ')}</span>
									</p>
								)}
								<small>{suggestion.reason}</small>
							</div>
							<div className="ingredient-suggestions-actions">
								<button type="button" className="is-apply" onClick={() => apply(suggestion)} disabled={busyId !== null}>
									{busyId === suggestion.id ? 'En cours…' : suggestion.type === 'duplicate' ? 'Fusionner' : 'Appliquer'}
								</button>
								<button type="button" className="is-ignore" onClick={() => ignore(suggestion)} disabled={busyId !== null}>
									Ignorer
								</button>
							</div>
						</li>
					))}
				</ul>
			)}
		</section>
	);
};

export default IngredientSuggestions;
