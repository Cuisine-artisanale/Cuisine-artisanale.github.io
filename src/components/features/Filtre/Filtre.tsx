"use client";
import React, { useState } from 'react';
import { DEPARTEMENTS } from '@/constants/departements';
import { RadioButton } from 'primereact/radiobutton';
import { Dropdown, DropdownChangeEvent } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { useRouter } from 'next/navigation';
import { InputText } from 'primereact/inputtext';
import type { Department } from '@/types';

const Filtre: React.FC = () => {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [position, setPosition] = useState<Department | null>(null);
  const departements = DEPARTEMENTS;
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Téléphone : seuls le champ de recherche et ce bouton sont visibles tant que le panneau est replié
  const [open, setOpen] = useState(false);
  const activeFilters = (selectedType ? 1 : 0) + (position?.code ? 1 : 0);

  const router = useRouter();

  const typeRecette = [
	{ id: 1, name: 'Entrée' },
	{ id: 2, name: 'Plat' },
	{ id: 3, name: 'Dessert' },
	{ id: 4, name: 'Boisson' },
  ];

  const applyFilter = () => {
	setIsLoading(true);
	const queryParams = new URLSearchParams();

	if (name) {
	  queryParams.append('keywords', name);
	}
	if (selectedType) {
	  queryParams.append('type', selectedType);
	}
	if (position?.code) {
	  queryParams.append('position', position.code);
	}

	const query = queryParams.toString();
	router.push(query ? `/recettes?${query}` : '/recettes');
	setIsLoading(false);
  };

  const resetFilter = () => {
	setName('');
	setSelectedType(null);
	setPosition(null);
	router.push('/recettes');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
	if (e.key === 'Enter') {
	  applyFilter();
	}
  };

  return (
	<div className={`Filtre${open ? ' is-open' : ''}`}>
	  	<h2>Filtrer les recettes</h2>

		<section className='filtre_input'>
			<div>
				<h3>Nom de la recette</h3>
				<InputText
					placeholder="Rechercher une recette..."
					value={name}
					onChange={(e) => setName(e.target.value)}
					onKeyDown={handleKeyPress}
					enterKeyHint="search"
				/>
				<button
					type="button"
					className="filtre-toggle"
					aria-expanded={open}
					onClick={() => setOpen((value) => !value)}
				>
					<span className="pi pi-sliders-h" aria-hidden="true"></span>
					{open ? 'Masquer les filtres' : 'Type et département'}
					{activeFilters > 0 && <span className="filtre-toggle-count">{activeFilters}</span>}
					<span className={`pi ${open ? 'pi-chevron-up' : 'pi-chevron-down'}`} aria-hidden="true"></span>
				</button>
			</div>

			<div>
				<h3>Type de recette</h3>
				<div className="Filtre_type">
					{typeRecette.map((type) => (
					<div key={type.id}>
						<RadioButton
						inputId={type.id.toString()}
						name="type"
						value={type.name}
						onChange={(e) => setSelectedType(e.value)}
						checked={selectedType === type.name}
						/>
						<label htmlFor={type.id.toString()}>{type.name}</label>
					</div>
					))}
				</div>
			</div>

			<div className='formRecette_region'>
				<h3>Département</h3>
				<Dropdown
					id='position'
					value={position}
					options={[
					{ nom: "Tous les départements", code: '' },
					...departements
					]}
					onChange={(e: DropdownChangeEvent) => setPosition(e.value)}
					optionLabel="nom"
					placeholder="Sélectionner un département"
					className="w-full"
				/>
			</div>
		</section>

			<div className="filtre_buttons">
				<Button
					label='Filtrer'
					icon="pi pi-filter"
					loading={isLoading}
					onClick={applyFilter}
				/>
				<Button
					label='Réinitialiser'
					icon="pi pi-refresh"
					className="p-button-secondary"
					onClick={resetFilter}
					disabled={isLoading}
				/>
			</div>
	</div>
  );
};

export default Filtre;
