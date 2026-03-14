import type { ExportFormat, SessionEntry } from './types';
import { formatNumber } from './utils';

function appendNote(base: string, note: string) {
  return note.trim() ? `${base} (${note.trim()})` : base;
}

function formatSimpleEntry(entry: SessionEntry) {
  if (entry.needsAfterWeight && entry.afterWeight == null) {
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

function formatRawEntry(entry: SessionEntry) {
  if (entry.needsAfterWeight && entry.afterWeight == null) {
    return appendNote(
      `${entry.foodName} before ${formatNumber(entry.beforeWeight ?? entry.amount)}g -> after pending`,
      entry.note
    );
  }

  if (entry.mode === 'difference') {
    return appendNote(
      `${entry.foodName} ${formatNumber(entry.beforeWeight ?? 0)}g -> ${formatNumber(entry.afterWeight ?? 0)}g = ${formatNumber(entry.amount)}g`,
      entry.note
    );
  }

  return formatSimpleEntry(entry);
}

export function formatExport(entries: SessionEntry[], format: ExportFormat) {
  return entries
    .map((entry) => (format === 'raw' ? formatRawEntry(entry) : formatSimpleEntry(entry)))
    .join('\n');
}
