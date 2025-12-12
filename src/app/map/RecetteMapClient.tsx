"use client";
import React, { useState, useEffect, useMemo } from "react";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { useRouter } from 'next/navigation';
import './RecetteMapClient.css';
import 'leaflet/dist/leaflet.css';
import { getRecipeUrl } from '@/lib/utils/recipe-url';

// Types pour les composants Leaflet
type LeafletComponents = {
	MapContainer: any;
	Marker: any;
	Polygon: any;
	Popup: any;
	TileLayer: any;
	Polyline: any;
	useMap: any;
	L: any;
};

interface Recette {
	recetteId: string;
	title: string;
	type: string;
	position: string;
	images?: string[];
	description?: string;
	url?: string;
}

interface DepartementFeature {
	properties: {
		nom: string;
		code: string;
	};
	geometry: {
		coordinates: number[][][];
	};
}

// Configuration du Spiderifier
const SPIDERIFIER_CONFIG = {
	radius: 0.1, // Distance en degrés depuis le centre (~10km)
};

export default function RecetteMapClient() {
	const [recettes, setRecettes] = useState<Recette[]>([]);
	const [hoveredRecette, setHoveredRecette] = useState<string | null>(null);
	const [searchTerm, setSearchTerm] = useState("");
	const [selectedType, setSelectedType] = useState<string | null>(null);
	const [selectedDepartement, setSelectedDepartement] = useState<string | null>(null);
	const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());
	const [geojsonData, setGeojsonData] = useState<any>(null);
	const [departementsCoordinates, setDepartementsCoordinates] = useState<any>(null);
	const [dataLoaded, setDataLoaded] = useState(false);
	const [leafletComponents, setLeafletComponents] = useState<LeafletComponents | null>(null);

	const db = getFirestore();
	const router = useRouter();

	const recetteTypes = useMemo(() => [
		{ label: 'Tous les types', value: null },
		{ label: 'Entrée', value: 'Entrée' },
		{ label: 'Plat', value: 'Plat' },
		{ label: 'Dessert', value: 'Dessert' },
		{ label: 'Boisson', value: 'Boisson' },
	], []);

	// Charger Leaflet et les données JSON uniquement côté client
	useEffect(() => {
		const loadData = async () => {
			if (typeof window === 'undefined') return;

			try {
				const [reactLeaflet, leaflet, geojson, coords] = await Promise.all([
					import('react-leaflet'),
					import('leaflet'),
					import('@/assets/departementsGeoJson.json'),
					import('@/assets/departementsCoord.json')
				]);

				setLeafletComponents({
					MapContainer: reactLeaflet.MapContainer,
					Marker: reactLeaflet.Marker,
					Polygon: reactLeaflet.Polygon,
					Popup: reactLeaflet.Popup,
					TileLayer: reactLeaflet.TileLayer,
					Polyline: reactLeaflet.Polyline,
					useMap: reactLeaflet.useMap,
					L: leaflet.default
				});

				setGeojsonData(geojson.default);
				setDepartementsCoordinates(coords.default);
				setDataLoaded(true);
			} catch (error) {
				console.error('Error loading data:', error);
			}
		};
		loadData();
	}, []);

	const departements = useMemo(() => {
		if (!geojsonData) return [{ label: 'Tous les départements', value: null }];
		const depts = geojsonData.features.map((feature: any) => ({
			label: feature.properties.nom,
			value: feature.properties.code
		}));
		return [{ label: 'Tous les départements', value: null }, ...depts];
	}, [geojsonData]);

	useEffect(() => {
		if (dataLoaded) {
			fetchRecettes();
		}
	}, [dataLoaded]);

	const fetchRecettes = async () => {
		try {
			const querySnapshot = await getDocs(collection(db, "recipes"));
			const recettesData: Recette[] = querySnapshot.docs.map((doc) => ({
				title: doc.data().title,
				description: doc.data().description,
				position: doc.data().position,
				recetteId: doc.id,
				type: doc.data().type,
				images: doc.data().images ?? [],
				url: doc.data().url,
			}));
			setRecettes(recettesData);
		} catch (error) {
			console.error("Error getting recettes:", error);
		}
	};

	function levenshtein(a: string, b: string): number {
		const matrix: number[][] = [];
		for (let i = 0; i <= b.length; i++) matrix[i] = [i];
		for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

		for (let i = 1; i <= b.length; i++) {
			for (let j = 1; j <= a.length; j++) {
				if (b.charAt(i - 1) === a.charAt(j - 1)) {
					matrix[i][j] = matrix[i - 1][j - 1];
				} else {
					matrix[i][j] = Math.min(
						matrix[i - 1][j - 1] + 1, // substitution
						matrix[i][j - 1] + 1,     // insertion
						matrix[i - 1][j] + 1      // suppression
					);
				}
			}
		}
		return matrix[b.length][a.length];
	}

	function correctKeyword(word: string, allTitles: string[]): string {
		let bestMatch = word;
		let bestScore = Infinity; // plus petit = plus proche

		for (const title of allTitles) {
			const titleWords = title.toLowerCase().split(" ");
			for (const tWord of titleWords) {
				const distance = levenshtein(word, tWord);
				if (distance < bestScore) {
					bestScore = distance;
					bestMatch = tWord;
				}
			}
		}

		// Si la distance est petite (1 ou 2 lettres d'écart), on corrige
		if (bestScore <= 2) {
			return bestMatch;
		}
		return word;
	}

	const filteredRecettes = useMemo(() => {
		if (!recettes.length) return [];

		const allTitles = recettes.map(r => r.title);
		const searchWords = searchTerm.toLowerCase().split(" ").filter(Boolean);

		// 🧠 Correction automatique des fautes
		const correctedWords = searchWords.map(w => correctKeyword(w, allTitles));
		const correctedSearch = correctedWords.join(" ");

		return recettes.filter(recette => {
			const title = recette.title.toLowerCase();
			const matchesSearch =
				correctedSearch === "" ||
				correctedWords.some(w => title.includes(w));

			const matchesType =
				!selectedType || selectedType === "" || recette.type === selectedType;

			const matchesDepartement =
				!selectedDepartement || selectedDepartement === "" || recette.position === selectedDepartement;

			return matchesSearch && matchesType && matchesDepartement;
		});
	}, [recettes, searchTerm, selectedType, selectedDepartement]);

	const getDepartementPolygon = (departementName: string): [number, number][] => {
		if (!geojsonData) return [];
		const departement = geojsonData.features.find(
			(feature: any) => feature.properties.nom === departementName
		) as DepartementFeature | undefined;

		return departement
			? departement.geometry.coordinates[0].map((coord) => [coord[1], coord[0]])
			: [];
	};

	const createMarkerIcon = (isHovered: boolean) => {
		if (!leafletComponents?.L) return null;
		const radius = isHovered ? 20 : 8;
		return leafletComponents.L.divIcon({
			html: `
				<div class="custom-marker ${isHovered ? 'hovered' : ''}"
					 style="width: ${radius * 2}px; height: ${radius * 2}px;">
				</div>
			`,
			className: '',
			iconSize: [radius * 2, radius * 2],
			iconAnchor: [radius, radius],
		});
	};

	// Group recettes by their position (département)
	const groupedRecettes = useMemo(() => {
		const groups: { [key: string]: Recette[] } = {};
		filteredRecettes.forEach((recette) => {
			if (!groups[recette.position]) {
				groups[recette.position] = [];
			}
			groups[recette.position].push(recette);
		});
		return groups;
	}, [filteredRecettes]);

	// Calculate spiderfy positions for markers at the same location
	const getSpiderfyPositions = (count: number, index: number, centerLat: number, centerLng: number) => {
		if (count === 1) return [centerLat, centerLng];

		const radius = SPIDERIFIER_CONFIG.radius;
		const angle = (index * 360) / count;
		const radians = (angle * Math.PI) / 180;

		// Calcul du décalage en coordonnées lat/lng
		const latOffset = radius * Math.cos(radians);
		const lngOffset = radius * Math.sin(radians) / Math.cos((centerLat * Math.PI) / 180);

		return [centerLat + latOffset, centerLng + lngOffset];
	};

	const toggleCluster = (position: string) => {
		const newExpanded = new Set(expandedClusters);
		if (newExpanded.has(position)) {
			newExpanded.delete(position);
		} else {
			newExpanded.add(position);
		}
		setExpandedClusters(newExpanded);
	};

	// Composant enfant pour gérer le zoom et le contenu de la map
	const MapContent = () => {
		if (!leafletComponents) return null;
		const map = leafletComponents.useMap();

		const handleClusterClick = (position: string, centerCoord: [number, number], recetteCount: number) => {
			if (recetteCount > 1) {
				// Zoom et centre sur le cluster
				map.flyTo(centerCoord, 10, {
					duration: 1,
				});
				toggleCluster(position);
			}
		};

		if (!geojsonData || !departementsCoordinates || !leafletComponents) {
			return null;
		}

		const { TileLayer: TL, Polygon: Poly, Popup: Pop, Marker: Mark, Polyline: PolyL, L } = leafletComponents;

		return (
			<>
				<TL url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

				{geojsonData.features.map((departement: any, index: number) => (
					<Poly
						key={index}
						positions={getDepartementPolygon(departement.properties.nom)}
						pathOptions={{
							color: selectedDepartement === departement.properties.code ? '#ff7800' : '#3388ff',
							weight: selectedDepartement === departement.properties.code ? 2 : 1,
							fillOpacity: 0.2
						}}
					>
						<Pop>{departement.properties.nom}</Pop>
					</Poly>
				))}

				{Object.entries(groupedRecettes).map(([position, positionRecettes]) => {
					const coordEntry = Object.entries(departementsCoordinates).find(
						([code]) => code === position
					);
					if (!coordEntry) return null;

					const centerCoord = coordEntry[1] as [number, number];
					if (!Array.isArray(centerCoord) || centerCoord.length !== 2) return null;

					const isExpanded = expandedClusters.has(position);
					const recetteCount = positionRecettes.length;

					// Show cluster marker if not expanded or single recette
					if (!isExpanded) {
						return (
							<Mark
								key={`cluster-${position}`}
								position={centerCoord}
								icon={L.divIcon({
									html: `
										<div class="cluster-marker" style="cursor: pointer;">
											<div class="cluster-marker-inner">
												${recetteCount > 1 ? recetteCount : ''}
											</div>
										</div>
									`,
									className: recetteCount > 1 ? 'cluster-group' : 'cluster-single',
									iconSize: recetteCount > 1 ? [50, 50] : [32, 32],
									iconAnchor: recetteCount > 1 ? [25, 25] : [16, 16],
								})}
								eventHandlers={{
									click: () => handleClusterClick(position, centerCoord, recetteCount),
								}}
							>
								{recetteCount === 1 && (
									<Pop
										closeButton={true}
										closeOnClick={false}
									>
										<div className="recipe-popup">
											{positionRecettes[0].images?.[0] && (
												<img src={positionRecettes[0].images[0]} alt={positionRecettes[0].title} />
											)}
											<h3>{positionRecettes[0].title}</h3>
											<p className="recipe-type">{positionRecettes[0].type}</p>
											{positionRecettes[0].description && (
												<p className="recipe-description">{positionRecettes[0].description}</p>
											)}
											<button
												className="recipe-popup-button"
												onClick={(e) => {
													e.stopPropagation();
													router.push(getRecipeUrl(positionRecettes[0]));
												}}
											>
												<i className="pi pi-eye"></i>
												Voir la recette
											</button>
										</div>
									</Pop>
								)}
							</Mark>
						);
					}

					// Show expanded spider legs with individual recettes
					return (
						<React.Fragment key={`expanded-${position}`}>
							{/* Center cluster marker */}
							<Mark
								position={centerCoord}
								icon={L.divIcon({
									html: `
										<div class="cluster-marker active" style="cursor: pointer;">
											<div class="cluster-marker-inner">
												${recetteCount}
											</div>
										</div>
									`,
									className: 'cluster-group active',
									iconSize: [50, 50],
									iconAnchor: [25, 25],
								})}
								eventHandlers={{
									click: () => handleClusterClick(position, centerCoord, recetteCount),
								}}
							/>

							{/* Spider leg lines and markers */}
							{positionRecettes.map((recette, index) => {
								const spiderfyCoord = getSpiderfyPositions(
									recetteCount,
									index,
									centerCoord[0],
									centerCoord[1]
								) as [number, number];

								return (
									<React.Fragment key={recette.recetteId}>
										{/* Spider leg line */}
										<PolyL
											positions={[centerCoord, spiderfyCoord]}
											pathOptions={{
												color: '#ff7800',
												weight: 2,
												opacity: 0.4,
											}}
										/>
										{/* Individual marker */}
										<Mark
											position={spiderfyCoord}
											icon={createMarkerIcon(hoveredRecette === recette.recetteId)}
											eventHandlers={{
												mouseover: () => setHoveredRecette(recette.recetteId),
											}}
										>
											<Pop
												closeButton={true}
												closeOnClick={false}
											>
												<div className="recipe-popup">
													{recette.images?.[0] && (
														<img src={recette.images[0]} alt={recette.title} />
													)}
													<h3>{recette.title}</h3>
													<p className="recipe-type">{recette.type}</p>
													{recette.description && (
														<p className="recipe-description">{recette.description}</p>
													)}
													<button
														className="recipe-popup-button"
														onClick={(e) => {
															e.stopPropagation();
															router.push(getRecipeUrl(recette));
														}}
													>
														<i className="pi pi-eye"></i>
														Voir la recette
													</button>
												</div>
											</Pop>
										</Mark>
									</React.Fragment>
								);
							})}
						</React.Fragment>
					);
				})}
			</>
		);
	};

	if (!dataLoaded || !geojsonData || !departementsCoordinates || !leafletComponents) {
		return (
			<div className="recipe-map-container">
				<div style={{ padding: '2rem', textAlign: 'center' }}>
					<p>Chargement de la carte...</p>
				</div>
			</div>
		);
	}

	const { MapContainer: MC } = leafletComponents;

	return (
		<div className="recipe-map-container">
			<aside className="recipe-sidebar">
				<header className="sidebar-header">
					<h2>Découvrez nos recettes</h2>
					<div className="search-filters">
						<div className="input-wrapper">
							<i className="pi pi-search input-icon"></i>
							<input
								type="text"
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								placeholder="Rechercher une recette..."
								className="search-input"
							/>
						</div>
						<select
							value={selectedType || ''}
							onChange={(e) => setSelectedType(e.target.value || null)}
							className="filter-select"
						>
							{recetteTypes.map((type) => (
								<option key={type.value || 'all'} value={type.value || ''}>
									{type.label}
								</option>
							))}
						</select>
						<select
							value={selectedDepartement || ''}
							onChange={(e) => setSelectedDepartement(e.target.value || null)}
							className="filter-select"
						>
							{departements.map((dept) => (
								<option key={dept.value || 'all'} value={dept.value || ''}>
									{dept.label}
								</option>
							))}
						</select>
					</div>
				</header>

				<div className="recipe-list">
					{filteredRecettes.length === 0 ? (
						<div className="no-results">
							<i className="pi pi-info-circle"></i>
							<p>Aucune recette ne correspond à votre recherche</p>
						</div>
					) : (
						<ul>
							{filteredRecettes.map((recette) => (
								<li
									key={recette.recetteId}
									className={`recipe-item ${hoveredRecette === recette.recetteId ? 'hovered' : ''}`}
									onMouseEnter={() => setHoveredRecette(recette.recetteId)}
									onMouseLeave={() => setHoveredRecette(null)}
									onClick={() => router.push(getRecipeUrl(recette))}
								>
									<div className="recipe-item-content">
										{recette.images?.[0] && (
											<div className="recipe-thumbnail">
												<img src={recette.images[0]} alt={recette.title} />
											</div>
										)}
										<div className="recipe-info">
											<h3>{recette.title}</h3>
											<span className="recipe-type">{recette.type}</span>
										</div>
									</div>
								</li>
							))}
						</ul>
					)}
				</div>
			</aside>

			<main className="map-section">
				<MC
					center={[46.603354, 1.888334]}
					zoom={6}
					scrollWheelZoom={true}
					className="map-container"
				>
					<MapContent />
				</MC>
			</main>
		</div>
	);
}

