import type { SessionEntry } from './types';
import {
  formatNumber,
  isAfterWeightPending,
  isBeforeWeightPending,
  isEntryDeleted
} from './utils';

function appendDetails(base: string, entry: SessionEntry) {
  const details: string[] = [];

  if (entry.note.trim()) {
    details.push(entry.note.trim());
  }

  if (entry.calories != null) {
    details.push(`${formatNumber(entry.calories)} kcal`);
  }

  if (entry.carbs != null) {
    details.push(`${formatNumber(entry.carbs)}g Kohlenhydrate`);
  }

  if (entry.fat != null) {
    details.push(`${formatNumber(entry.fat)}g Fett`);
  }

  if (entry.protein != null) {
    details.push(`${formatNumber(entry.protein)}g Eiweiß`);
  }

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
  return entries
    .filter((entry) => !isEntryDeleted(entry))
    .map((entry) => formatSimpleEntry(entry))
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
