import type { SessionEntry } from './types';
import {
  formatNumber,
  isAfterWeightPending,
  isBeforeWeightPending,
  isEntryDeleted,
  normalizeNutritionScope
} from './utils';

export interface AggregatedSessionEntry {
  id: string;
  amount: number;
  foodName: string;
  details: string[];
  entries: SessionEntry[];
}

export type AggregatedSessionListItem =
  | {
      type: 'single';
      entry: SessionEntry;
    }
  | {
      type: 'aggregate';
      group: AggregatedSessionEntry;
    };

interface SessionAggregationOptions {
  includeDeleted?: boolean;
}

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

export function getSessionEntryDetails(entry: SessionEntry) {
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

export function appendSessionEntryDetails(base: string, entry: SessionEntry) {
  const details = getSessionEntryDetails(entry);
  return details.length > 0 ? `${base} (${details.join(', ')})` : base;
}

export function canAggregateSessionEntry(entry: SessionEntry) {
  return entry.unit === 'g' && !isBeforeWeightPending(entry) && !isAfterWeightPending(entry);
}

export function getSessionEntryAggregationKey(
  entry: SessionEntry,
  details = getSessionEntryDetails(entry),
  options: SessionAggregationOptions = {}
) {
  const deletionState = options.includeDeleted ? `${isEntryDeleted(entry) ? 'deleted' : 'active'}\u0000` : '';
  return `${deletionState}${entry.foodName}\u0000${details.join('\u0001')}`;
}

export function aggregateSessionEntries(
  entries: SessionEntry[],
  options: SessionAggregationOptions = {}
) {
  const aggregatedEntries = new Map<string, AggregatedSessionEntry>();
  const orderedKeys: string[] = [];

  for (const entry of entries) {
    if ((!options.includeDeleted && isEntryDeleted(entry)) || !canAggregateSessionEntry(entry)) {
      continue;
    }

    const details = getSessionEntryDetails(entry);
    const aggregationKey = getSessionEntryAggregationKey(entry, details, options);
    const existingEntry = aggregatedEntries.get(aggregationKey);

    if (existingEntry) {
      existingEntry.amount += entry.amount;
      existingEntry.entries.push(entry);
      continue;
    }

    aggregatedEntries.set(aggregationKey, {
      id: aggregationKey,
      amount: entry.amount,
      foodName: entry.foodName,
      details,
      entries: [entry]
    });
    orderedKeys.push(aggregationKey);
  }

  return { aggregatedEntries, orderedKeys };
}

export function getAggregatedSessionListItems(
  entries: SessionEntry[],
  options: SessionAggregationOptions = {}
): AggregatedSessionListItem[] {
  const { aggregatedEntries } = aggregateSessionEntries(entries, options);
  const usedAggregationKeys = new Set<string>();
  const items: AggregatedSessionListItem[] = [];

  for (const entry of entries) {
    if ((!options.includeDeleted && isEntryDeleted(entry)) || !canAggregateSessionEntry(entry)) {
      items.push({ type: 'single', entry });
      continue;
    }

    const aggregationKey = getSessionEntryAggregationKey(entry, undefined, options);
    const aggregatedEntry = aggregatedEntries.get(aggregationKey);

    if (!aggregatedEntry || aggregatedEntry.entries.length < 2) {
      items.push({ type: 'single', entry });
      continue;
    }

    if (usedAggregationKeys.has(aggregationKey)) {
      continue;
    }

    usedAggregationKeys.add(aggregationKey);
    items.push({ type: 'aggregate', group: aggregatedEntry });
  }

  return items;
}
