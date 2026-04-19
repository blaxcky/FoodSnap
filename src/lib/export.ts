import type { SessionEntry } from './types';
import {
  formatNumber,
  isAfterWeightPending,
  isBeforeWeightPending,
  isEntryDeleted,
  normalizeNutritionScope
} from './utils';

function formatNutritionDetail(
  value: number | undefined,
  label: string,
  unitSuffix: string,
  nutritionScope: SessionEntry['nutritionScope']
) {
  if (value == null) {
    return null;
  }

  const formattedScope =
    normalizeNutritionScope(nutritionScope) === 'total' ? 'gesamt' : 'je 100g';
  return `${formatNumber(value)}${unitSuffix} ${label} ${formattedScope}`;
}

function getDetails(entry: SessionEntry) {
  const details: string[] = [];

  if (entry.note.trim()) {
    details.push(entry.note.trim());
  }

  const nutritionScope = entry.nutritionScope;
  const nutritionDetails = [
    formatNutritionDetail(entry.calories, 'kcal', '', nutritionScope),
    formatNutritionDetail(entry.carbs, 'Kohlenhydrate', 'g', nutritionScope),
    formatNutritionDetail(entry.fat, 'Fett', 'g', nutritionScope),
    formatNutritionDetail(entry.protein, 'Eiweiß', 'g', nutritionScope)
  ].filter((detail): detail is string => detail != null);

  details.push(...nutritionDetails);

  return details;
}

function appendDetails(base: string, entry: SessionEntry) {
  const details = getDetails(entry);
  return details.length > 0 ? `${base} (${details.join(', ')})` : base;
}

function formatSimpleEntry(entry: SessionEntry) {
  if (isBeforeWeightPending(entry)) {
    return appendDetails(
      `${entry.foodName} after ${formatNumber(entry.afterWeight ?? 0)}g (before pending)`,
      entry
    );
  }

  if (isAfterWeightPending(entry)) {
    return appendDetails(
      `${entry.foodName} before ${formatNumber(entry.beforeWeight ?? entry.amount)}g (after pending)`,
      entry
    );
  }

  if (entry.unit === 'g') {
    return appendDetails(`${formatNumber(entry.amount)}g ${entry.foodName}`, entry);
  }

  return appendDetails(`${formatNumber(entry.amount)} ${entry.foodName}`, entry);
}

export function formatExport(entries: SessionEntry[]) {
  const aggregatedLines = new Map<
    string,
    {
      amount: number;
      foodName: string;
      details: string[];
    }
  >();
  const lines: string[] = [];

  for (const entry of entries) {
    if (isEntryDeleted(entry)) {
      continue;
    }

    const canAggregate =
      entry.unit === 'g' && !isBeforeWeightPending(entry) && !isAfterWeightPending(entry);

    if (!canAggregate) {
      lines.push(formatSimpleEntry(entry));
      continue;
    }

    const details = getDetails(entry);
    const aggregationKey = `${entry.foodName}\u0000${details.join('\u0001')}`;
    const existingLine = aggregatedLines.get(aggregationKey);

    if (existingLine) {
      existingLine.amount += entry.amount;
      continue;
    }

    const nextLine = {
      amount: entry.amount,
      foodName: entry.foodName,
      details
    };
    aggregatedLines.set(aggregationKey, nextLine);
    lines.push(aggregationKey);
  }

  return lines
    .map((line) => {
      const aggregatedLine = aggregatedLines.get(line);

      if (!aggregatedLine) {
        return line;
      }

      const base = `${formatNumber(aggregatedLine.amount)}g ${aggregatedLine.foodName}`;
      return aggregatedLine.details.length > 0
        ? `${base} (${aggregatedLine.details.join(', ')})`
        : base;
    })
    .join('\n');
}

export function formatExportWithLeadIn(exportLeadIn: string, body: string) {
  const trimmedLeadIn = exportLeadIn.trim();
  const trimmedBody = body.trim();

  if (trimmedLeadIn && trimmedBody) {
    return `${trimmedLeadIn}\n\n${trimmedBody}`;
  }

  return trimmedLeadIn || trimmedBody;
}
