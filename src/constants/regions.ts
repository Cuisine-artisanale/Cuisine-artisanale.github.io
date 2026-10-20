import { getDepartementName } from '@/constants/departements';

/**
 * Régions françaises et leurs départements (codes identiques au champ `position` des recettes).
 * Les départements d'outre-mer sont regroupés sur une seule page.
 */
export interface Region {
	slug: string;
	nom: string;
	/** Forme utilisée dans les phrases : « Les recettes d'Occitanie », « de Bretagne »… */
	de: string;
	departements: string[];
	/** Texte d'introduction de la page (spécialités et produits du terroir) */
	description: string;
}

export const REGIONS: Region[] = [
	{
		slug: 'auvergne-rhone-alpes',
		nom: 'Auvergne-Rhône-Alpes',
		de: "d'Auvergne-Rhône-Alpes",
		departements: ['01', '03', '07', '15', '26', '38', '42', '43', '63', '69', '73', '74'],
		description:
			"Des bouchons lyonnais aux alpages de Savoie, la région mêle cuisine de montagne et tables généreuses : gratin dauphinois, tartiflette, quenelles, truffade, aligot et fromages d'Auvergne.",
	},
	{
		slug: 'bourgogne-franche-comte',
		nom: 'Bourgogne-Franche-Comté',
		de: 'de Bourgogne-Franche-Comté',
		departements: ['21', '25', '39', '58', '70', '71', '89', '90'],
		description:
			"Terre de vignobles et de fruitières : bœuf bourguignon, œufs en meurette, gougères, moutarde de Dijon, comté, saucisse de Morteau et poulet au vin jaune.",
	},
	{
		slug: 'bretagne',
		nom: 'Bretagne',
		de: 'de Bretagne',
		departements: ['22', '29', '35', '56'],
		description:
			"Beurre salé, sarrasin et produits de la mer : galettes et crêpes, kouign-amann, far breton, kig ha farz, cotriade et caramel au beurre salé.",
	},
	{
		slug: 'centre-val-de-loire',
		nom: 'Centre-Val de Loire',
		de: 'du Centre-Val de Loire',
		departements: ['18', '28', '36', '37', '41', '45'],
		description:
			"Le jardin de la France : tarte Tatin, rillettes et rillons de Tours, fromages de chèvre, gibier de Sologne et pithiviers.",
	},
	{
		slug: 'corse',
		nom: 'Corse',
		de: 'de Corse',
		departements: ['2A', '2B'],
		description:
			"Une cuisine d'île et de maquis : charcuteries, brocciu, fiadone, civet de sanglier, châtaigne et canistrelli.",
	},
	{
		slug: 'grand-est',
		nom: 'Grand Est',
		de: 'du Grand Est',
		departements: ['08', '10', '51', '52', '54', '55', '57', '67', '68', '88'],
		description:
			"D'Alsace en Champagne en passant par la Lorraine : choucroute, flammekueche, baeckeoffe, quiche lorraine, kouglof, madeleines et mirabelles.",
	},
	{
		slug: 'hauts-de-france',
		nom: 'Hauts-de-France',
		de: 'des Hauts-de-France',
		departements: ['02', '59', '60', '62', '80'],
		description:
			"La cuisine chaleureuse du Nord : carbonade flamande, welsh, potjevleesch, ficelle picarde, maroilles et gaufres fourrées.",
	},
	{
		slug: 'ile-de-france',
		nom: 'Île-de-France',
		de: "d'Île-de-France",
		departements: ['75', '77', '78', '91', '92', '93', '94', '95'],
		description:
			"Les classiques des bistrots et des pâtisseries parisiennes : croque-monsieur, soupe à l'oignon, Paris-Brest, opéra, brie de Meaux et macarons.",
	},
	{
		slug: 'normandie',
		nom: 'Normandie',
		de: 'de Normandie',
		departements: ['14', '27', '50', '61', '76'],
		description:
			"Pommes, crème et fromages : tarte normande, teurgoule, poulet vallée d'Auge, moules à la crème, camembert et cidre.",
	},
	{
		slug: 'nouvelle-aquitaine',
		nom: 'Nouvelle-Aquitaine',
		de: 'de Nouvelle-Aquitaine',
		departements: ['16', '17', '19', '23', '24', '33', '40', '47', '64', '79', '86', '87'],
		description:
			"Du Pays basque au Limousin : canelés, poulet basquaise, axoa, gâteau basque, confit de canard, huîtres, piment d'Espelette et pruneaux d'Agen.",
	},
	{
		slug: 'occitanie',
		nom: 'Occitanie',
		de: "d'Occitanie",
		departements: ['09', '11', '12', '30', '31', '32', '34', '46', '48', '65', '66', '81', '82'],
		description:
			"Entre Méditerranée, Pyrénées et Massif central : cassoulet, aligot, brandade de Nîmes, tielle sétoise, roquefort et crème catalane.",
	},
	{
		slug: 'pays-de-la-loire',
		nom: 'Pays de la Loire',
		de: 'des Pays de la Loire',
		departements: ['44', '49', '53', '72', '85'],
		description:
			"Entre Loire et Atlantique : rillettes du Mans, beurre blanc, gâteau nantais, brioche vendéenne, mogettes et fleur de sel de Guérande.",
	},
	{
		slug: 'provence-alpes-cote-d-azur',
		nom: "Provence-Alpes-Côte d'Azur",
		de: "de Provence-Alpes-Côte d'Azur",
		departements: ['04', '05', '06', '13', '83', '84'],
		description:
			"Huile d'olive, herbes et légumes du soleil : ratatouille, bouillabaisse, socca, pissaladière, tapenade, daube provençale et tarte tropézienne.",
	},
	{
		slug: 'outre-mer',
		nom: 'Outre-mer',
		de: "d'Outre-mer",
		departements: ['971', '972', '973', '974', '976'],
		description:
			"Les saveurs créoles des Antilles, de la Guyane, de La Réunion et de Mayotte : colombo, accras, rougail saucisse, cari et blanc-manger coco.",
	},
];

/** Nom des départements précédé de sa préposition : « Spécialités de l'Aveyron », « du Finistère »… */
const DEPARTEMENT_DE: Record<string, string> = {
	'01': "de l'Ain", '02': "de l'Aisne", '03': "de l'Allier", '04': 'des Alpes-de-Haute-Provence',
	'05': 'des Hautes-Alpes', '06': 'des Alpes-Maritimes', '07': "de l'Ardèche", '08': 'des Ardennes',
	'09': "de l'Ariège", '10': "de l'Aube", '11': "de l'Aude", '12': "de l'Aveyron",
	'13': 'des Bouches-du-Rhône', '14': 'du Calvados', '15': 'du Cantal', '16': 'de la Charente',
	'17': 'de la Charente-Maritime', '18': 'du Cher', '19': 'de la Corrèze', '2A': 'de la Corse-du-Sud',
	'2B': 'de la Haute-Corse', '21': "de la Côte-d'Or", '22': "des Côtes-d'Armor", '23': 'de la Creuse',
	'24': 'de la Dordogne', '25': 'du Doubs', '26': 'de la Drôme', '27': "de l'Eure",
	'28': "d'Eure-et-Loir", '29': 'du Finistère', '30': 'du Gard', '31': 'de la Haute-Garonne',
	'32': 'du Gers', '33': 'de la Gironde', '34': "de l'Hérault", '35': "d'Ille-et-Vilaine",
	'36': "de l'Indre", '37': "d'Indre-et-Loire", '38': "de l'Isère", '39': 'du Jura',
	'40': 'des Landes', '41': 'du Loir-et-Cher', '42': 'de la Loire', '43': 'de la Haute-Loire',
	'44': 'de la Loire-Atlantique', '45': 'du Loiret', '46': 'du Lot', '47': 'du Lot-et-Garonne',
	'48': 'de la Lozère', '49': 'du Maine-et-Loire', '50': 'de la Manche', '51': 'de la Marne',
	'52': 'de la Haute-Marne', '53': 'de la Mayenne', '54': 'de Meurthe-et-Moselle', '55': 'de la Meuse',
	'56': 'du Morbihan', '57': 'de la Moselle', '58': 'de la Nièvre', '59': 'du Nord',
	'60': "de l'Oise", '61': "de l'Orne", '62': 'du Pas-de-Calais', '63': 'du Puy-de-Dôme',
	'64': 'des Pyrénées-Atlantiques', '65': 'des Hautes-Pyrénées', '66': 'des Pyrénées-Orientales', '67': 'du Bas-Rhin',
	'68': 'du Haut-Rhin', '69': 'du Rhône', '70': 'de la Haute-Saône', '71': 'de Saône-et-Loire',
	'72': 'de la Sarthe', '73': 'de la Savoie', '74': 'de la Haute-Savoie', '75': 'de Paris',
	'76': 'de la Seine-Maritime', '77': 'de Seine-et-Marne', '78': 'des Yvelines', '79': 'des Deux-Sèvres',
	'80': 'de la Somme', '81': 'du Tarn', '82': 'du Tarn-et-Garonne', '83': 'du Var',
	'84': 'du Vaucluse', '85': 'de la Vendée', '86': 'de la Vienne', '87': 'de la Haute-Vienne',
	'88': 'des Vosges', '89': "de l'Yonne", '90': 'du Territoire de Belfort', '91': "de l'Essonne",
	'92': 'des Hauts-de-Seine', '93': 'de la Seine-Saint-Denis', '94': 'du Val-de-Marne', '95': "du Val-d'Oise",
	'971': 'de la Guadeloupe', '972': 'de la Martinique', '973': 'de la Guyane', '974': 'de La Réunion',
	'976': 'de Mayotte',
};

export interface RegionDepartement {
	code: string;
	nom: string;
	/** Segment d'URL : /regions/{région}/{slug} */
	slug: string;
	/** « de l'Aveyron », « du Finistère »… */
	de: string;
}

/** "Côtes-d'Armor" → "cotes-d-armor" */
function toSlug(nom: string): string {
	return nom
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

/** Départements d'une région, avec leur slug et leur forme « de … ». */
export function getRegionDepartements(region: Region): RegionDepartement[] {
	return region.departements.map((code) => {
		const nom = getDepartementName(code) ?? code;
		return { code, nom, slug: toSlug(nom), de: DEPARTEMENT_DE[code] ?? `de ${nom}` };
	});
}

/** Chemin de la page d'un département ("29" → "/regions/bretagne/finistere"). */
export function getDepartementPath(code: string | undefined | null): string | undefined {
	const region = getRegionByDepartement(code);
	const departement = region && getRegionDepartements(region).find((d) => d.code === code);
	return departement ? `/regions/${region.slug}/${departement.slug}` : undefined;
}

const REGION_BY_SLUG: ReadonlyMap<string, Region> = new Map(REGIONS.map((r) => [r.slug, r]));

const REGION_BY_DEPARTEMENT: ReadonlyMap<string, Region> = new Map(
	REGIONS.flatMap((r) => r.departements.map((code) => [code, r] as const))
);

export function getRegionBySlug(slug: string): Region | undefined {
	return REGION_BY_SLUG.get(slug);
}

/** Région d'un département à partir de son code ("69" → Auvergne-Rhône-Alpes). */
export function getRegionByDepartement(code: string | undefined | null): Region | undefined {
	return code ? REGION_BY_DEPARTEMENT.get(code) : undefined;
}
