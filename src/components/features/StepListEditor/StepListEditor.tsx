"use client";
import React, { useRef } from 'react';
import './StepListEditor.css';

interface StepListEditorProps {
	steps: string[];
	onChange: (steps: string[]) => void;
	/** Nombre maximum d'étapes */
	max?: number;
}

/** Étapes de préparation modifiables : texte, ordre, ajout et suppression. */
const StepListEditor: React.FC<StepListEditorProps> = ({ steps, onChange, max = 30 }) => {
	const listRef = useRef<HTMLOListElement>(null);

	const move = (index: number, delta: number) => {
		const target = index + delta;
		if (target < 0 || target >= steps.length) return;
		const next = [...steps];
		[next[index], next[target]] = [next[target], next[index]];
		onChange(next);
	};

	const add = () => {
		if (steps.length >= max) return;
		onChange([...steps, '']);
		// Après le rendu de la nouvelle étape
		setTimeout(() => listRef.current?.querySelector<HTMLTextAreaElement>(':scope > li:last-child textarea')?.focus(), 0);
	};

	return (
		<div className="step-editor">
			<ol className="step-editor-list" ref={listRef}>
				{steps.map((step, index) => (
					<li key={index}>
						<span className="step-editor-number" aria-hidden="true">{index + 1}</span>
						<textarea
							value={step}
							rows={2}
							maxLength={1000}
							placeholder="Décrire cette étape"
							aria-label={`Étape ${index + 1}`}
							onChange={(e) => onChange(steps.map((current, i) => (i === index ? e.target.value : current)))}
						/>
						<div className="step-editor-actions">
							<button type="button" className="step-editor-icon" aria-label={`Monter l'étape ${index + 1}`} onClick={() => move(index, -1)} disabled={index === 0}>
								<span className="pi pi-arrow-up" aria-hidden="true"></span>
							</button>
							<button type="button" className="step-editor-icon" aria-label={`Descendre l'étape ${index + 1}`} onClick={() => move(index, 1)} disabled={index === steps.length - 1}>
								<span className="pi pi-arrow-down" aria-hidden="true"></span>
							</button>
							<button type="button" className="step-editor-icon" aria-label={`Supprimer l'étape ${index + 1}`} onClick={() => onChange(steps.filter((_, i) => i !== index))}>
								<span className="pi pi-trash" aria-hidden="true"></span>
							</button>
						</div>
					</li>
				))}
			</ol>
			<button type="button" className="step-editor-add" onClick={add} disabled={steps.length >= max}>
				<span className="pi pi-plus" aria-hidden="true"></span> Ajouter une étape
			</button>
		</div>
	);
};

export default StepListEditor;
