"use client";
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Filtre, Recette, AddRecette } from '@/components/features';
import { SkeletonLoader } from '@/components/ui';
import { db } from '@/lib/config/firebase';
import { collection, getDocs, query, where, limit, startAfter, orderBy, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { useSearchParams } from 'next/navigation';


interface RecetteData {
	recetteId: string;
	title: string;
	type: string;
	images?: string[];
	position: string;
	score?: number;
}

const Recettes: React.FC = () => {

	const [displayedRecettes, setDisplayedRecettes] = useState<RecetteData[]>([]);
	const searchParams = useSearchParams();
	const [departements, setDepartements] = useState<Map<string, string>>(new Map());
	const [itemsPerPage] = useState(12);
	const observerTarget = useRef<HTMLDivElement>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [hasMore, setHasMore] = useState(true);
	const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
	const [currentFilters, setCurrentFilters] = useState({ type: '', position: '', keywords: '' });

	useEffect(() => {
		setDisplayedRecettes([]);
		setLastVisible(null);
		setHasMore(true);
		const type = searchParams.get("type") || '';
		const position = searchParams.get("position") || '';
		const keywords = searchParams.get("keywords") || '';
		setCurrentFilters({ type, position, keywords });
		fetchRecettes(null, { type, position, keywords });
	}, [searchParams.toString()]);


	function generateWordVariants(word: string): string[] {
		const base = word.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // supprime les accents
		const variants = new Set<string>([base]);

		// Gérer pluriels simples
		if (base.endsWith("s")) variants.add(base.slice(0, -1));
		else variants.add(base + "s");

		// Gérer quelques formes simples de fautes
		if (base.endsWith("ie")) variants.add(base.slice(0, -2) + "y");
		if (base.endsWith("y")) variants.add(base.slice(0, -1) + "ie");

		return Array.from(variants);
	}

	function levenshtein(a: string, b: string): number {
		const m = a.length;
		const n = b.length;
		const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

		for (let i = 0; i <= m; i++) dp[i][0] = i;
		for (let j = 0; j <= n; j++) dp[0][j] = j;

		for (let i = 1; i <= m; i++) {
			for (let j = 1; j <= n; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			dp[i][j] = Math.min(
				dp[i - 1][j] + 1, // suppression
				dp[i][j - 1] + 1, // insertion
				dp[i - 1][j - 1] + cost // remplacement
			);
			}
		}
		return dp[m][n];
	}

	function similarity(a: string, b: string): number {
		const maxLen = Math.max(a.length, b.length);
		return 1 - levenshtein(a.toLowerCase(), b.toLowerCase()) / maxLen;
	}


	const fetchRecettes = async (cursorDoc: QueryDocumentSnapshot<DocumentData> | null, filters: { type: string; position: string; keywords: string }) => {
		try {
			setIsLoading(true);
			const recettesCollection = collection(db, "recipes");
			const { keywords, type, position } = filters;

			if (keywords || type || position) {
				let allRecettesMap = new Map<string, RecetteData>();

				if (keywords) {
					// Chercher par mots-clés - charger plus de données pour la similarité
					const words = keywords.split(" ");
					let foundByKeywords = false;

					for (const word of words) {
						const variants = generateWordVariants(word);
						if (variants.length === 0) continue;

						const wordQuery = query(
							recettesCollection,
							where("titleKeywords", "array-contains-any", variants),
							orderBy("title"),
							limit(itemsPerPage * 4) // Charge 4x plus pour avoir plus de résultats à filtrer
						);

						const querySnapshot = await getDocs(wordQuery);
						if (querySnapshot.size > 0) {
							foundByKeywords = true;
						}
						querySnapshot.forEach((doc) => {
							const data = doc.data();
							allRecettesMap.set(doc.id, {
								title: data.title,
								type: data.type,
								position: data.position,
								recetteId: doc.id,
								images: data.images ?? [],
							});
						});
					}

					// Si rien trouvé par keywords, charger un lot général pour faire de la similarité
					if (!foundByKeywords || allRecettesMap.size < itemsPerPage) {
						const generalQuery = query(
							recettesCollection,
							orderBy("title"),
							limit(itemsPerPage * 3)
						);
						const generalSnapshot = await getDocs(generalQuery);
						generalSnapshot.forEach((doc) => {
							const data = doc.data();
							allRecettesMap.set(doc.id, {
								title: data.title,
								type: data.type,
								position: data.position,
								recetteId: doc.id,
								images: data.images ?? [],
							});
						});
					}
				} else {
					const constraints = [
						...(type ? [where("type", "==", type)] : []),
						...(position ? [where("position", "==", position)] : []),
						orderBy("title"),
						limit(itemsPerPage * 2)
					];

					const baseQuery = query(recettesCollection, ...constraints);
					const querySnapshot = await getDocs(baseQuery);
					querySnapshot.forEach((doc) => {
						const data = doc.data();
						allRecettesMap.set(doc.id, {
							title: data.title,
							type: data.type,
							position: data.position,
							recetteId: doc.id,
							images: data.images ?? [],
						});
					});
				}

				let recettesData = Array.from(allRecettesMap.values());

				// Appliquer la similarité si mots-clés présents
				if (keywords) {
					const cleanedKeywords = keywords.toLowerCase().split(" ");
					const SIMILARITY_THRESHOLD = 0.5;

					recettesData = recettesData
						.map((r) => {
							const title = r.title.toLowerCase();
							// Calculer le meilleur score de similarité pour chaque mot-clé
							const maxScore = Math.max(
								...cleanedKeywords.map((k) => {
									const levScore = similarity(k, title);
									const containsBonus = title.includes(k) ? 1.0 : 0;
									const startsWithBonus = title.split(" ").some(word => word.startsWith(k)) ? 0.8 : 0;
									return Math.max(levScore, containsBonus, startsWithBonus);
								})
							);
							return { ...r, score: maxScore };
						})
						.filter((r) => r.score >= SIMILARITY_THRESHOLD)
						.sort((a, b) => (b.score || 0) - (a.score || 0))
						.slice(0, itemsPerPage);
				}

				// Filtrer selon le type et la position (si pas déjà filtré par requête)
				if (type && keywords) {
					recettesData = recettesData.filter((r) => r.type === type);
				}
				if (position && keywords) {
					recettesData = recettesData.filter((r) => r.position === position);
				}

				setDisplayedRecettes(recettesData);
				setHasMore(false); // Pas de pagination infini avec filtres pour l'instant
			} else {
				// Pas de filtres: utiliser la pagination Firebase optimisée
				const firestoreQuery = query(
					recettesCollection,
					orderBy("title"),
					...(cursorDoc ? [startAfter(cursorDoc)] : []),
					limit(itemsPerPage + 1) // +1 pour vérifier s'il y a plus d'éléments
				);

				const querySnapshot = await getDocs(firestoreQuery);
				const allRecettesMap = new Map<string, RecetteData>();

				querySnapshot.forEach((doc) => {
					const data = doc.data();
					allRecettesMap.set(doc.id, {
						title: data.title,
						type: data.type,
						position: data.position,
						recetteId: doc.id,
						images: data.images ?? [],
					});
				});

				let recettesData = Array.from(allRecettesMap.values());

				// Vérifier s'il y a plus d'éléments
				if (querySnapshot.docs.length > itemsPerPage) {
					setLastVisible(querySnapshot.docs[itemsPerPage - 1]);
					setHasMore(true);
					recettesData = recettesData.slice(0, itemsPerPage);
				} else {
					setHasMore(false);
				}

				if (cursorDoc) {
					// Ajouter aux résultats existants
					setDisplayedRecettes((prev) => [...prev, ...recettesData]);
				} else {
					// Première page
					setDisplayedRecettes(recettesData);
				}
			}
		} catch (error) {
			console.error("Error getting recettes: ", error);
		} finally {
			setIsLoading(false);
		}
	};

	// Charger plus de recettes au scroll
	const loadMoreRecettes = useCallback(() => {
		if (isLoading || !hasMore || !lastVisible) return;
		fetchRecettes(lastVisible, currentFilters);
	}, [isLoading, hasMore, lastVisible, currentFilters]);

	// Intersection Observer pour le infinite scroll
	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && !isLoading && hasMore) {
					loadMoreRecettes();
				}
			},
			{ threshold: 0.1 }
		);

		if (observerTarget.current) {
			observer.observe(observerTarget.current);
		}

		return () => {
			if (observerTarget.current) {
				observer.unobserve(observerTarget.current);
			}
		};
	}, [loadMoreRecettes, isLoading, hasMore]);

	useEffect(() => {
		fetch("https://geo.api.gouv.fr/departements")
		.then(res => res.json())
		.then(data => {
			const departementMap: Map<string, string> = new Map(data.map((dep: { code: string; nom: string }) => [dep.code, dep.nom]));
			setDepartements(departementMap);
		});
	}, []);


	return (
		<div className="Recettes">
			<section className='filter_section'>
				<Filtre />
				<AddRecette />
			</section>
			<section className='recettes_section'>
				{displayedRecettes.length === 0 && !isLoading && (
					Array.from({ length: 6 }).map((_, i) => (
						<SkeletonLoader key={i} type="recipe-card" />
					))
				)}

				{displayedRecettes.map((recette, index) => (
					<Recette
						key={index}
						recetteId={recette.recetteId}
						title={recette.title}
						type={recette.type}
						images={recette.images}
						position={departements.get(recette.position) || "Inconnu"}
					/>
				))}

				{isLoading && (
					Array.from({ length: 3 }).map((_, i) => (
						<SkeletonLoader key={`loading-${i}`} type="recipe-card" />
					))
				)}

				{/* Observer target pour infinite scroll */}
				<div ref={observerTarget} style={{ height: '50px', marginTop: '20px' }} />
			</section>
		</div>
	);
};

export default Recettes;
