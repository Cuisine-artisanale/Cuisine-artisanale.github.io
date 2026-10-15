/**
 * Texte d'introduction des pages département (/regions/{région}/{département}) : spécialités et
 * produits du terroir. Un département sans texte reprend celui de sa région.
 * Rédigés pour les départements qui ont des recettes : à compléter quand de nouveaux départements en reçoivent.
 */
export const DEPARTEMENT_TEXTES: Record<string, string> = {
  '06':
    "La cuisine niçoise vit au rythme du marché du cours Saleya : salade niçoise, socca dorée au four à bois, pissaladière aux oignons confits, pan bagnat, farcis et tourte de blettes. L'olive de Nice et son huile parfument presque chaque plat.",
  '12':
    "Sur les plateaux de l'Aubrac, l'aligot file entre purée et tome fraîche. L'Aveyron, c'est aussi le roquefort affiné dans les caves de Roquefort-sur-Soulzon, les farçous, les tripoux, la fouace et le gâteau à la broche des grandes fêtes.",
  '13':
    "À Marseille, la bouillabaisse se mange en deux services, le bouillon puis les poissons de roche. Les Bouches-du-Rhône, ce sont aussi l'aïoli du vendredi, les pieds paquets, les navettes à la fleur d'oranger, le riz de Camargue et les calissons d'Aix.",
  '14':
    "Le Calvados a le goût du Pays d'Auge : camembert, pont-l'évêque et livarot, cidre et calvados, tripes à la mode de Caen et teurgoule au four. Sur la côte, les ports de pêche fournissent soles, coquilles Saint-Jacques et maquereaux.",
  '17':
    "Entre La Rochelle et l'île d'Oléron, la Charente-Maritime vit de la mer : moules de bouchot en mouclade ou en éclade, huîtres de Marennes-Oléron. À l'intérieur des terres, le beurre Charentes-Poitou, le cognac et le pineau signent les desserts et les sauces.",
  '19':
    "Le clafoutis est né en Limousin, avec des cerises noires non dénoyautées. La Corrèze, c'est aussi le veau élevé sous la mère, les pommes du Limousin, les noix, la farcidure et la moutarde violette de Brive.",
  '21':
    "En Côte-d'Or, le vin de Bourgogne entre dans la cuisine : coq au vin, bœuf mijoté, œufs en meurette. Dijon a donné son nom à la moutarde et au pain d'épices, le cassis au kir, et l'époisses est l'un des fromages les plus puissants de France.",
  '26':
    "Montélimar a fait la réputation de son nougat au miel et aux amandes. La Drôme, ce sont aussi les ravioles du Dauphiné, la pogne de Romans, le picodon, les caillettes et les olives noires de Nyons.",
  '29':
    "Le Finistère est le pays du far breton aux pruneaux, du kouign-amann de Douarnenez et des crêpes de froment. Dans le Léon, on cuisine le kig ha farz, l'oignon rosé de Roscoff et les artichauts, et les ports livrent poissons et crustacés.",
  '31':
    "À Toulouse, le cassoulet réunit haricots lingots, confit de canard et saucisse de Toulouse, longuement mijotés. La Haute-Garonne cultive aussi l'ail violet de Cadours, et la violette de Toulouse se retrouve en bonbons et en liqueur.",
  '33':
    "Bordeaux a inventé le canelé, caramélisé dehors et moelleux au cœur, parfumé au rhum et à la vanille. La Gironde, c'est aussi l'entrecôte à la bordelaise, la lamproie, l'agneau de Pauillac et les huîtres du bassin d'Arcachon.",
  '35':
    "En Ille-et-Vilaine, la galette de blé noir se garnit de jambon, d'œuf et de fromage, ou s'enroule autour d'une saucisse à Rennes. Le département a aussi ses huîtres de Cancale et sa volaille, le coucou de Rennes.",
  '38':
    "Le gratin dauphinois se fait sans fromage, avec des pommes de terre, du lait et de la crème. L'Isère, c'est aussi la noix de Grenoble, le saint-marcellin, les ravioles et la chartreuse, élaborée par les moines du massif du même nom.",
  '41':
    "La tarte Tatin est née à Lamotte-Beuvron, chez les sœurs Tatin, en Sologne. Le Loir-et-Cher a aussi son gibier, ses asperges de Sologne, le selles-sur-cher cendré et les vins de Cheverny.",
  '54':
    "La quiche lorraine se fait avec des œufs, de la crème et des lardons, sans fromage dans la recette d'origine. La Meurthe-et-Moselle, c'est aussi la mirabelle, les macarons et les bergamotes de Nancy, la potée et le pâté lorrain.",
  '59':
    "La carbonade flamande mijote dans la bière avec du pain d'épices et de la cassonade. Le Nord, c'est aussi le potjevleesch, le waterzoï, le maroilles de l'Avesnois, les gaufres fourrées de Lille et la chicorée.",
  '64':
    "Le poulet basquaise mijote dans une piperade de tomates et de poivrons, relevée au piment d'Espelette. Les Pyrénées-Atlantiques, ce sont aussi le jambon de Bayonne, l'axoa, le gâteau basque, l'ossau-iraty et le chocolat de Bayonne.",
  '67':
    "La flammekueche, ou tarte flambée, se cuisait autrefois dans le four à pain encore brûlant. Le Bas-Rhin, c'est aussi la choucroute, le baeckeoffe, le kouglof, les bretzels et les bredele de Noël à Strasbourg.",
  '69':
    "Lyon se dit capitale de la gastronomie : quenelles, saucisson brioché, cervelle de canut et tarte aux pralines roses servis dans les bouchons. Au nord du département, le Beaujolais fournit le vin qui les accompagne.",
  '71':
    "Le bœuf bourguignon trouve en Saône-et-Loire sa meilleure viande, le charolais, élevé autour de Charolles. Le département, c'est aussi la volaille de Bresse, les escargots de Bourgogne et les vins du Mâconnais.",
  '74':
    "La tartiflette est née autour du reblochon, le fromage des Aravis. La Haute-Savoie, ce sont aussi la fondue, la raclette, les diots au vin blanc, le berthoud, l'abondance et la féra du lac Léman.",
  '75':
    "Paris a ses classiques de bistrot et de pâtisserie : soupe à l'oignon des Halles, pot-au-feu, croissant au beurre, crème brûlée, Paris-Brest et macarons. Une cuisine de tradition, revisitée à chaque génération.",
  '83':
    "Le Var cuisine à l'huile d'olive et aux herbes de Provence : tapenade, anchoïade, aïoli et légumes du soleil. Saint-Tropez a donné son nom à la tarte tropézienne, et Solliès-Pont est réputé pour ses figues.",
  '89':
    "Les gougères, petits choux au fromage, accompagnent l'apéritif en Bourgogne. L'Yonne, c'est aussi le chablis, les cerises du Tonnerrois, les escargots et le soumaintrain, un fromage à croûte lavée.",
};
