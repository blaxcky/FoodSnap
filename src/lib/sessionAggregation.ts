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

function getUniqueNotes(entries: SessionEntry[]) {
  const notes: string[] = [];
  const usedNotes = new Set<string>();

  for (const entry of entries) {
    const note = entry.note.trim();

    if (note && !usedNotes.has(note)) {
      usedNotes.add(note);
      notes.push(note);
    }
  }

  return notes;
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
  return [...getUniqueNotes([entry]), ...getSessionEntryNutritionDetails(entry)];
}

export function getSessionEntryNutritionDetails(entry: SessionEntry) {
  const nutritionScope = entry.nutritionScope;
  return [
    formatNutritionDetail(entry.calories, 'kcal', '', nutritionScope),
    formatNutritionDetail(entry.carbs, 'Kohlenhydrate', 'g', nutritionScope),
    formatNutritionDetail(entry.fat, 'Fett', 'g', nutritionScope),
    formatNutritionDetail(entry.protein, 'Eiweiß', 'g', nutritionScope)
  ].filter((detail): detail is string => detail != null);
}

export function getCombinedSessionEntryNote(entries: SessionEntry[]) {
  return getUniqueNotes(entries).join(', ');
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
  options: SessionAggregationOptions = {}
) {
  const deletionState = options.includeDeleted ? `${isEntryDeleted(entry) ? 'deleted' : 'active'}\u0000` : '';
  const nutritionIdentity = JSON.stringify([
    entry.calories,
    entry.carbs,
    entry.fat,
    entry.protein,
    normalizeNutritionScope(entry.nutritionScope)
  ]);
  return `${deletionState}${entry.foodName}\u0000${nutritionIdentity}`;
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

    const nutritionDetails = getSessionEntryNutritionDetails(entry);
    const aggregationKey = getSessionEntryAggregationKey(entry, options);
    const existingEntry = aggregatedEntries.get(aggregationKey);

    if (existingEntry) {
      existingEntry.amount += entry.amount;
      existingEntry.entries.push(entry);
      existingEntry.details = [
        ...getUniqueNotes(existingEntry.entries),
        ...nutritionDetails
      ];
      continue;
    }

    aggregatedEntries.set(aggregationKey, {
      id: aggregationKey,
      amount: entry.amount,
      foodName: entry.foodName,
      details: [...getUniqueNotes([entry]), ...nutritionDetails],
      entries: [entry]
    });
    orderedKeys.push(aggregationKey);
  }

  return { aggregatedEntries, orderedKeys };
}

export function updateSessionEntryNotes(
  entries: SessionEntry[],
  entryIds: Iterable<string>,
  note: string,
  timestamp: string
) {
  const targetEntryIds = new Set(entryIds);
  const trimmedNote = note.trim();

  return entries.map((entry) =>
    targetEntryIds.has(entry.id)
      ? { ...entry, note: trimmedNote, updatedAt: timestamp }
      : entry
  );
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

    const aggregationKey = getSessionEntryAggregationKey(entry, options);
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
