"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './CookingMode.css';

export interface CookingIngredient {
	name: string;
	/** Quantité + unité déjà ajustées au nombre de personnes ("375 g") */
	amount: string;
}

export interface CookingPart {
	title: string;
	ingredients: CookingIngredient[];
	steps: string[];
}

interface CookingModeProps {
	title: string;
	parts: CookingPart[];
	/** "4 personnes" ou "×1,5" */
	servingsLabel?: string;
	onClose: () => void;
}

interface WakeLockSentinelLike {
	release: () => Promise<void>;
}

/**
 * Mode cuisine : une étape à la fois, en grand et en plein écran, avec les ingrédients
 * à portée de main. L'écran reste allumé tant que le mode est ouvert (Wake Lock).
 * Navigation : boutons, flèches du clavier, balayage horizontal ; Échap pour quitter.
 */
const CookingMode: React.FC<CookingModeProps> = ({ title, parts, servingsLabel, onClose }) => {
	// Toutes les étapes à la suite, chacune rattachée à sa partie
	const steps = useMemo(
		() =>
			parts.flatMap((part, partIndex) =>
				part.steps.filter((text) => text && text.trim()).map((text) => ({ text, partIndex }))
			),
		[parts]
	);

	const [current, setCurrent] = useState(0);
	const [showIngredients, setShowIngredients] = useState(false);
	const [checked, setChecked] = useState<Set<string>>(new Set());
	const [wakeLockActive, setWakeLockActive] = useState(false);
	const dialogRef = useRef<HTMLDivElement>(null);
	const touchStart = useRef<{ x: number; y: number } | null>(null);

	const total = steps.length;
	const step = steps[current];
	const hasSeveralParts = parts.filter((p) => p.steps.length > 0).length > 1;
	const hasIngredients = parts.some((p) => p.ingredients.length > 0);

	const goTo = useCallback(
		(index: number) => setCurrent(Math.min(total - 1, Math.max(0, index))),
		[total]
	);

	// Écran allumé tant que le mode cuisine est ouvert (le verrou est libéré par le navigateur
	// quand l'onglet passe en arrière-plan : on le redemande au retour)
	useEffect(() => {
		const wakeLock = (navigator as Navigator & {
			wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
		}).wakeLock;
		if (!wakeLock) return;

		let sentinel: WakeLockSentinelLike | null = null;
		let cancelled = false;

		const acquire = async () => {
			try {
				const lock = await wakeLock.request('screen');
				if (cancelled) {
					lock.release().catch(() => undefined);
					return;
				}
				sentinel = lock;
				setWakeLockActive(true);
			} catch {
				// Refusé (économie d'énergie…) : le mode cuisine fonctionne sans
				setWakeLockActive(false);
			}
		};

		const onVisibilityChange = () => {
			if (document.visibilityState === 'visible') acquire();
		};

		acquire();
		document.addEventListener('visibilitychange', onVisibilityChange);

		return () => {
			cancelled = true;
			document.removeEventListener('visibilitychange', onVisibilityChange);
			sentinel?.release().catch(() => undefined);
		};
	}, []);

	// Page figée derrière le mode cuisine, focus rendu au bouton d'origine à la fermeture
	useEffect(() => {
		const previousOverflow = document.body.style.overflow;
		const previousFocus = document.activeElement as HTMLElement | null;
		document.body.style.overflow = 'hidden';
		dialogRef.current?.focus();
		return () => {
			document.body.style.overflow = previousOverflow;
			previousFocus?.focus?.();
		};
	}, []);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				if (showIngredients) setShowIngredients(false);
				else onClose();
			} else if (event.key === 'ArrowRight' || event.key === 'PageDown') {
				goTo(current + 1);
			} else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
				goTo(current - 1);
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [current, goTo, onClose, showIngredients]);

	const onTouchStart = (event: React.TouchEvent) => {
		const touch = event.touches[0];
		touchStart.current = { x: touch.clientX, y: touch.clientY };
	};

	const onTouchEnd = (event: React.TouchEvent) => {
		const start = touchStart.current;
		touchStart.current = null;
		if (!start) return;
		const touch = event.changedTouches[0];
		const dx = touch.clientX - start.x;
		const dy = touch.clientY - start.y;
		// Balayage franchement horizontal uniquement (le défilement vertical reste libre)
		if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
		goTo(current + (dx < 0 ? 1 : -1));
	};

	const toggleChecked = (key: string) => {
		setChecked((previous) => {
			const next = new Set(previous);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	};

	const isLast = current === total - 1;

	return (
		<div
			className="cooking-mode"
			role="dialog"
			aria-modal="true"
			aria-label={`Mode cuisine : ${title}`}
			ref={dialogRef}
			tabIndex={-1}
		>
			<header className="cooking-mode-header">
				<div className="cooking-mode-heading">
					<p className="cooking-mode-title">{title}</p>
					<p className="cooking-mode-meta">
						{servingsLabel && <span>{servingsLabel}</span>}
						{wakeLockActive && (
							<span className="cooking-mode-awake">
								<i className="pi pi-sun" aria-hidden="true"></i> Écran maintenu allumé
							</span>
						)}
					</p>
				</div>
				<button type="button" className="cooking-mode-icon-button" onClick={onClose} aria-label="Quitter le mode cuisine">
					<i className="pi pi-times" aria-hidden="true"></i>
				</button>
			</header>

			<div
				className="cooking-mode-progress"
				role="progressbar"
				aria-valuemin={1}
				aria-valuemax={total}
				aria-valuenow={current + 1}
				aria-label="Avancement de la recette"
			>
				<div className="cooking-mode-progress-bar" style={{ width: `${((current + 1) / total) * 100}%` }} />
			</div>

			<main className="cooking-mode-body" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
				<p className="cooking-mode-counter">
					Étape {current + 1} sur {total}
					{hasSeveralParts && step && parts[step.partIndex].title && (
						<span className="cooking-mode-part"> · {parts[step.partIndex].title}</span>
					)}
				</p>
				<p className="cooking-mode-step" aria-live="polite">{step?.text}</p>
				{isLast && <p className="cooking-mode-done">Dernière étape : bon appétit !</p>}
			</main>

			<footer className="cooking-mode-footer">
				<button
					type="button"
					className="cooking-mode-nav"
					onClick={() => goTo(current - 1)}
					disabled={current === 0}
				>
					<i className="pi pi-arrow-left" aria-hidden="true"></i>
					<span>Précédent</span>
				</button>

				{hasIngredients && (
					<button
						type="button"
						className="cooking-mode-nav cooking-mode-nav-secondary"
						onClick={() => setShowIngredients(true)}
						aria-haspopup="dialog"
					>
						<i className="pi pi-list" aria-hidden="true"></i>
						<span>Ingrédients</span>
					</button>
				)}

				{isLast ? (
					<button type="button" className="cooking-mode-nav cooking-mode-nav-primary" onClick={onClose}>
						<span>Terminer</span>
						<i className="pi pi-check" aria-hidden="true"></i>
					</button>
				) : (
					<button type="button" className="cooking-mode-nav cooking-mode-nav-primary" onClick={() => goTo(current + 1)}>
						<span>Suivant</span>
						<i className="pi pi-arrow-right" aria-hidden="true"></i>
					</button>
				)}
			</footer>

			{showIngredients && (
				<div className="cooking-mode-sheet-backdrop" onClick={() => setShowIngredients(false)}>
					<section
						className="cooking-mode-sheet"
						role="dialog"
						aria-label="Ingrédients"
						onClick={(event) => event.stopPropagation()}
					>
						<div className="cooking-mode-sheet-header">
							<h2>Ingrédients{servingsLabel ? ` · ${servingsLabel}` : ''}</h2>
							<button
								type="button"
								className="cooking-mode-icon-button"
								onClick={() => setShowIngredients(false)}
								aria-label="Fermer la liste des ingrédients"
								autoFocus
							>
								<i className="pi pi-times" aria-hidden="true"></i>
							</button>
						</div>
						<div className="cooking-mode-sheet-content">
							{parts.map((part, partIndex) =>
								part.ingredients.length === 0 ? null : (
									<div key={partIndex} className="cooking-mode-sheet-part">
										{hasSeveralParts && part.title && <h3>{part.title}</h3>}
										<ul>
											{part.ingredients.map((ingredient, index) => {
												const key = `${partIndex}-${index}`;
												return (
													<li key={key}>
														<label className={checked.has(key) ? 'is-checked' : undefined}>
															<input
																type="checkbox"
																checked={checked.has(key)}
																onChange={() => toggleChecked(key)}
															/>
															<span className="cooking-mode-ingredient-name">{ingredient.name}</span>
															{ingredient.amount && (
																<span className="cooking-mode-ingredient-amount">{ingredient.amount}</span>
															)}
														</label>
													</li>
												);
											})}
										</ul>
									</div>
								)
							)}
						</div>
					</section>
				</div>
			)}
		</div>
	);
};

export default CookingMode;
