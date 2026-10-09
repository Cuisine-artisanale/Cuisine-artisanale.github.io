/**
 * Unités de mesure : modèle, résolution des écritures libres, affichage et conversions.
 *
 * Le catalogue vit dans Firestore (collection "units", initialisée par scripts/seed-units.mjs
 * à partir de src/constants/default-units.json). Ce module est pur : il sert côté serveur
 * comme dans le navigateur.
 */
import DEFAULT_UNITS_JSON from '@/constants/default-units.json';
import { formatNumber, parseQuantity } from '@/lib/utils/quantity';

export type UnitType = 'mass' | 'volume' | 'count' | 'other';

export const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  mass: 'Masse',
  volume: 'Volume',
  count: 'Pièce / quantité',
  other: 'Autre',
};

/** Unité de référence de chaque type (pour les équivalences). */
export const UNIT_TYPE_BASE: Partial<Record<UnitType, string>> = { mass: 'g', volume: 'ml' };

export interface UnitDef {
  id: string;
  /** Nom au singulier : "gramme", "cuillère à soupe", "gousse" */
  name: string;
  /** Nom au pluriel : "grammes", "cuillères à soupe", "gousses" */
  plural: string;
  /** Abréviation : "g", "c. à s." ; vide si aucune */
  abbreviation: string;
  type: UnitType;
  /** Équivalence dans l'unité de référence du type (g pour une masse, ml pour un volume) */
  toBase?: number;
  /** Afficher l'abréviation (g, kg, c. à s.) plutôt que le nom accordé (gousse / gousses) */
  useAbbreviation: boolean;
  /** Autres écritures reconnues ("gr", "cas", "c.à.s"…) */
  aliases: string[];
  isActive?: boolean;
  /** Unité remplacée par une autre (doublon fusionné) */
  replacedBy?: string;
  createdBy?: string;
}

export const DEFAULT_UNITS: UnitDef[] = (DEFAULT_UNITS_JSON as Omit<UnitDef, 'isActive'>[]).map((u) => ({
  ...u,
  type: u.type as UnitType,
  isActive: true,
}));

/** Clé de comparaison : minuscules, sans accents, espaces, points ni apostrophes. */
export function normalizeUnitKey(value: string | undefined | null): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s.'’]/g, '');
}

/** Convertit un document Firestore "units" (ancien ou nouveau format) en UnitDef. */
export function toUnitDef(id: string, data: Record<string, unknown>): UnitDef {
  const name = String(data.name || data.abbreviation || id).trim();
  const abbreviation = String(data.abbreviation || '').trim();
  const type = (['mass', 'volume', 'count', 'other'] as const).includes(data.type as UnitType)
    ? (data.type as UnitType)
    : 'other';
  const toBase = Number(data.toBase);
  return {
    id,
    name,
    plural: String(data.plural || '').trim() || name,
    abbreviation,
    type,
    toBase: Number.isFinite(toBase) && toBase > 0 ? toBase : undefined,
    useAbbreviation: typeof data.useAbbreviation === 'boolean' ? data.useAbbreviation : Boolean(abbreviation),
    aliases: Array.isArray(data.aliases) ? (data.aliases as unknown[]).map(String) : [],
    isActive: data.isActive !== false,
    replacedBy: data.replacedBy ? String(data.replacedBy) : undefined,
    createdBy: data.createdBy ? String(data.createdBy) : undefined,
  };
}

/** Catalogue complet : unités par défaut, complétées / remplacées par celles de Firestore. */
export function mergeUnits(fromFirestore: UnitDef[]): UnitDef[] {
  const byId = new Map<string, UnitDef>(DEFAULT_UNITS.map((u) => [u.id, u]));
  for (const unit of fromFirestore) byId.set(unit.id, unit);
  return Array.from(byId.values());
}

/** Unités proposées dans les listes de choix (actives, sans doublons fusionnés), triées. */
export function selectableUnits(units: UnitDef[]): UnitDef[] {
  const order: UnitType[] = ['mass', 'volume', 'count', 'other'];
  return units
    .filter((u) => u.isActive !== false && !u.replacedBy)
    .sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type) || (a.toBase ?? 0) - (b.toBase ?? 0) || a.name.localeCompare(b.name, 'fr'));
}

export interface UnitIndex {
  byId: Map<string, UnitDef>;
  byKey: Map<string, UnitDef>;
}

export function buildUnitIndex(units: UnitDef[]): UnitIndex {
  const byId = new Map(units.map((u) => [u.id, u]));
  const byKey = new Map<string, UnitDef>();
  // Les unités actives ont la priorité ; un doublon fusionné pointe vers sa remplaçante
  const ordered = [...units].sort((a, b) => Number(a.isActive === false || !!a.replacedBy) - Number(b.isActive === false || !!b.replacedBy));
  for (const unit of ordered) {
    const target = unit.replacedBy ? byId.get(unit.replacedBy) || unit : unit;
    for (const key of [unit.id, unit.name, unit.plural, unit.abbreviation, ...unit.aliases]) {
      const k = normalizeUnitKey(key);
      if (k && !byKey.has(k)) byKey.set(k, target);
    }
  }
  return { byId, byKey };
}

/** Retrouve l'unité d'un ingrédient (id d'unité ou écriture libre). */
export function resolveUnit(index: UnitIndex, unitId?: string | null, rawUnit?: string | null): UnitDef | null {
  if (unitId) {
    const byId = index.byId.get(unitId);
    if (byId) return byId.replacedBy ? index.byId.get(byId.replacedBy) || byId : byId;
  }
  const key = normalizeUnitKey(rawUnit);
  return key ? index.byKey.get(key) || null : null;
}

/** Libellé d'une unité pour une valeur donnée : abréviation, ou nom accordé. */
export function unitLabel(unit: UnitDef, value: number | null): string {
  if (unit.useAbbreviation && unit.abbreviation) return unit.abbreviation;
  return value !== null && value >= 2 ? unit.plural : unit.name;
}

/** Libellé court d'une unité dans une liste de choix : "Gramme (g)", "Gousse". */
export function unitOptionLabel(unit: UnitDef): string {
  const name = unit.name.charAt(0).toUpperCase() + unit.name.slice(1);
  return unit.abbreviation ? `${name} (${unit.abbreviation})` : name;
}

const METRIC_LADDERS: Record<string, string[]> = {
  mass: ['mg', 'g', 'kg'],
  volume: ['ml', 'cl', 'dl', 'l'],
};

/**
 * Pour une unité métrique (g, kg, ml, cl, l…), choisit l'unité la plus lisible
 * pour une valeur exprimée en unité de base : 1 500 g → kg, 0,5 l → 50 cl.
 * Les unités non métriques (cuillères, tasses…) sont conservées.
 */
function bestMetricUnit(unit: UnitDef, baseValue: number, index: UnitIndex): UnitDef {
  const ladder = METRIC_LADDERS[unit.type];
  if (!ladder || !ladder.includes(unit.id)) return unit;
  let targetId: string;
  if (unit.type === 'mass') {
    targetId = baseValue >= 1000 ? 'kg' : unit.id === 'mg' && baseValue < 1 ? 'mg' : 'g';
  } else if (baseValue >= 1000) {
    targetId = 'l';
  } else if (unit.id === 'cl' || unit.id === 'l') {
    targetId = baseValue >= 10 ? 'cl' : 'ml';
  } else {
    targetId = 'ml';
  }
  return index.byId.get(targetId) || unit;
}

/** Vrai si l'unité peut être convertie en g / ml sans en être déjà une (cuillère, tasse, verre…). */
export function isConvertibleToMetric(unit: UnitDef | null | undefined): boolean {
  if (!unit || !unit.toBase) return false;
  const ladder = METRIC_LADDERS[unit.type];
  return Boolean(ladder) && !ladder.includes(unit.id);
}

export interface FormattedAmount {
  /** "375", "1,5", "2-3", "une pincée" ; vide si pas de quantité */
  quantity: string;
  /** "g", "kg", "gousses" ; vide si pas d'unité */
  unit: string;
  /** Texte complet : "375 g", "2 gousses", "une pincée" */
  text: string;
  /** Unité affichée (après conversion éventuelle), si reconnue */
  unitId?: string;
}

/**
 * Quantité + unité d'un ingrédient, multipliées par `factor` et prêtes à afficher.
 * Les unités métriques sont converties si besoin (1 500 g → 1,5 kg).
 * Avec `metric`, les unités à équivalence connue (cuillères, tasses…) sont affichées en g / ml.
 */
export function formatAmount(
  quantity: string | number | null | undefined,
  index: UnitIndex,
  opts: { unitId?: string | null; unit?: string | null; factor?: number; metric?: boolean } = {}
): FormattedAmount {
  const factor = opts.factor ?? 1;
  const unit = resolveUnit(index, opts.unitId, opts.unit);
  const rawUnit = (opts.unit || '').trim();
  const parsed = parseQuantity(quantity);

  const build = (q: string, u: string, id?: string): FormattedAmount => ({
    quantity: q,
    unit: u,
    text: [q, u].filter(Boolean).join(' '),
    ...(id ? { unitId: id } : {}),
  });

  if (parsed.kind === 'none') {
    // Pas de quantité : on n'affiche pas d'unité orpheline ("g"), sauf texte ("une pincée" stocké en unité)
    return build('', unit && !unit.useAbbreviation ? unit.name : '', unit && !unit.useAbbreviation ? unit.id : undefined);
  }
  if (parsed.kind === 'text') {
    return build(parsed.text, unit ? unitLabel(unit, null) : rawUnit, unit?.id);
  }

  const min = (parsed.kind === 'range' ? parsed.min : parsed.value) * factor;
  const max = (parsed.kind === 'range' ? parsed.max : parsed.value) * factor;

  if (!unit) {
    const q = factor === 1 ? String(quantity).trim() : parsed.kind === 'range' ? `${formatNumber(min)}-${formatNumber(max)}` : formatNumber(min);
    return build(q, rawUnit);
  }

  let displayUnit = unit;
  const baseUnit = opts.metric && isConvertibleToMetric(unit) ? index.byId.get(UNIT_TYPE_BASE[unit.type] || '') : undefined;
  if (baseUnit && unit.toBase) {
    // 2 c. à s. → 30 ml ; 6 tasses → 1,5 l
    displayUnit = bestMetricUnit(baseUnit, max * unit.toBase, index);
  } else if (unit.toBase && factor !== 1) {
    displayUnit = bestMetricUnit(unit, max * unit.toBase, index);
  }
  const ratio = unit.toBase && displayUnit.toBase ? unit.toBase / displayUnit.toBase : 1;

  const q =
    factor === 1 && displayUnit === unit
      ? String(quantity).trim()
      : parsed.kind === 'range'
        ? `${formatNumber(min * ratio)}-${formatNumber(max * ratio)}`
        : formatNumber(min * ratio);

  return build(q, unitLabel(displayUnit, max * ratio), displayUnit.id);
}

/**
 * Additionne deux quantités si leurs unités sont compatibles (même type, équivalences connues,
 * ou même unité). Renvoie null sinon. Utilisé par la liste de courses.
 */
export function addAmounts(
  a: { quantity?: string; unit?: string; unitId?: string },
  b: { quantity?: string; unit?: string; unitId?: string },
  index: UnitIndex
): { quantity: string; unit: string; unitId?: string } | null {
  const qa = parseQuantity(a.quantity);
  const qb = parseQuantity(b.quantity);
  if (qa.kind !== 'number' || qb.kind !== 'number') return null;

  const ua = resolveUnit(index, a.unitId, a.unit);
  const ub = resolveUnit(index, b.unitId, b.unit);

  if (!ua && !ub) {
    return normalizeUnitKey(a.unit) === normalizeUnitKey(b.unit)
      ? { quantity: formatNumber(qa.value + qb.value), unit: a.unit || '' }
      : null;
  }
  if (!ua || !ub) return null;

  if (ua.id === ub.id) {
    return { quantity: formatNumber(qa.value + qb.value), unit: unitLabel(ua, qa.value + qb.value), unitId: ua.id };
  }
  if (ua.type === ub.type && ua.toBase && ub.toBase) {
    const base = qa.value * ua.toBase + qb.value * ub.toBase;
    const metric = METRIC_LADDERS[ua.type]?.includes(ua.id) ? ua : METRIC_LADDERS[ub.type]?.includes(ub.id) ? ub : null;
    const target = metric ? bestMetricUnit(metric, base, index) : ua;
    const value = base / (target.toBase || 1);
    return { quantity: formatNumber(value), unit: unitLabel(target, value), unitId: target.id };
  }
  return null;
}
