/**
 * Lecture, mise à l'échelle et affichage des quantités d'ingrédients.
 * Les quantités sont saisies librement : "250", "1,5", "1.5", "1/2", "1 1/2", "2-3", "½",
 * ou du texte ("une pincée"), qui est alors laissé tel quel.
 */

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅕': 0.2, '⅛': 0.125,
};

/** Convertit un nombre écrit ("1,5", "1/2", "1 1/2", "½") en valeur ; null si ce n'en est pas un. */
function parseNumber(raw: string): number | null {
  let text = raw.trim();
  if (!text) return null;

  // "1½" → "1 ½"
  text = text.replace(/(\d)([½⅓⅔¼¾⅕⅛])/g, '$1 $2');

  const parts = text.split(/\s+/);
  let total = 0;
  for (const part of parts) {
    if (UNICODE_FRACTIONS[part] !== undefined) {
      total += UNICODE_FRACTIONS[part];
      continue;
    }
    const fraction = part.match(/^(\d+)\/(\d+)$/);
    if (fraction) {
      const denominator = Number(fraction[2]);
      if (!denominator) return null;
      total += Number(fraction[1]) / denominator;
      continue;
    }
    if (/^\d+(?:[.,]\d+)?$/.test(part)) {
      total += Number(part.replace(',', '.'));
      continue;
    }
    return null;
  }
  return total;
}

export type ParsedQuantity =
  | { kind: 'number'; value: number }
  | { kind: 'range'; min: number; max: number }
  | { kind: 'text'; text: string }
  | { kind: 'none' };

export function parseQuantity(quantity: string | number | null | undefined): ParsedQuantity {
  if (quantity === null || quantity === undefined) return { kind: 'none' };
  if (typeof quantity === 'number') {
    return Number.isFinite(quantity) && quantity > 0 ? { kind: 'number', value: quantity } : { kind: 'none' };
  }

  const text = quantity.trim();
  if (!text || text === '0') return { kind: 'none' };

  const range = text.match(/^(.+?)\s*(?:-|–|à)\s*(.+)$/);
  if (range) {
    const min = parseNumber(range[1]);
    const max = parseNumber(range[2]);
    if (min !== null && max !== null) return { kind: 'range', min, max };
  }

  const value = parseNumber(text);
  if (value !== null) return value > 0 ? { kind: 'number', value } : { kind: 'none' };

  return { kind: 'text', text };
}

/** Arrondi lisible en cuisine, avec virgule décimale : 0,25 · 1,5 · 12,5 · 250 */
export function formatNumber(value: number): string {
  let rounded: number;
  if (value >= 100) rounded = Math.round(value / 5) * 5;
  else if (value >= 10) rounded = Math.round(value * 2) / 2;
  else if (value >= 1) rounded = Math.round(value * 4) / 4;
  else rounded = Math.round(value * 100) / 100;

  if (rounded === 0) rounded = Math.round(value * 1000) / 1000;
  return rounded.toLocaleString('fr-FR', { maximumFractionDigits: 3 });
}

/**
 * Quantité multipliée par `factor`, prête à afficher.
 * Les textes libres ne sont pas modifiés ; une quantité vide ou "0" renvoie "".
 */
export function scaleQuantity(quantity: string | number | null | undefined, factor: number): string {
  const parsed = parseQuantity(quantity);
  // Sans ajustement, on affiche la saisie d'origine (pas d'arrondi)
  if (factor === 1 && parsed.kind !== 'none') return String(quantity).trim();
  switch (parsed.kind) {
    case 'none':
      return '';
    case 'text':
      return parsed.text;
    case 'range':
      return `${formatNumber(parsed.min * factor)}-${formatNumber(parsed.max * factor)}`;
    case 'number':
      return formatNumber(parsed.value * factor);
  }
}
