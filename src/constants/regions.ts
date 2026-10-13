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
