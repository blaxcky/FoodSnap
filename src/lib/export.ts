import type { SessionEntry } from './types';
import {
  formatNumber,
  isAfterWeightPending,
  isBeforeWeightPending,
  isEntryDeleted
} from './utils';

function appendNote(base: string, note: string) {
  return note.trim() ? `${base} (${note.trim()})` : base;
}

function formatSimpleEntry(entry: SessionEntry) {
  if (isBeforeWeightPending(entry)) {
    return appendNote(
      `${entry.foodName} after ${formatNumber(entry.afterWeight ?? 0)}g (before pending)`,
      entry.note
    );
  }

  if (isAfterWeightPending(entry)) {
    return appendNote(
      `${entry.foodName} before ${formatNumber(entry.beforeWeight ?? entry.amount)}g (after pending)`,
      entry.note
    );
  }

  if (entry.unit === 'g') {
    return appendNote(`${formatNumber(entry.amount)}g ${entry.foodName}`, entry.note);
  }

  return appendNote(`${formatNumber(entry.amount)} ${entry.foodName}`, entry.note);
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
