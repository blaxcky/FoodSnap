import type { SessionEntry } from './types';
import {
  aggregateSessionEntries,
  appendSessionEntryDetails,
  canAggregateSessionEntry,
  getSessionEntryAggregationKey
} from './sessionAggregation';
import { formatNumber, isAfterWeightPending, isBeforeWeightPending, isEntryDeleted } from './utils';

function formatSimpleEntry(entry: SessionEntry) {
  if (isBeforeWeightPending(entry)) {
    return appendSessionEntryDetails(
      `${entry.foodName} after ${formatNumber(entry.afterWeight ?? 0)}g (before pending)`,
      entry
    );
  }

  if (isAfterWeightPending(entry)) {
    return appendSessionEntryDetails(
      `${entry.foodName} before ${formatNumber(entry.beforeWeight ?? entry.amount)}g (after pending)`,
      entry
    );
  }

  if (entry.unit === 'g') {
    return appendSessionEntryDetails(`${formatNumber(entry.amount)}g ${entry.foodName}`, entry);
  }

  return appendSessionEntryDetails(`${formatNumber(entry.amount)} ${entry.foodName}`, entry);
}

export function formatExport(entries: SessionEntry[]) {
  const { aggregatedEntries } = aggregateSessionEntries(entries);
  const lines: string[] = [];

  for (const entry of entries) {
    if (isEntryDeleted(entry)) {
      continue;
    }

    if (!canAggregateSessionEntry(entry)) {
      lines.push(formatSimpleEntry(entry));
      continue;
    }

    const aggregationKey = getSessionEntryAggregationKey(entry);
    const aggregatedEntry = aggregatedEntries.get(aggregationKey);

    if (!aggregatedEntry || aggregatedEntry.entries[0]?.id !== entry.id) {
      continue;
    }

    lines.push(aggregationKey);
  }

  return lines
    .map((line) => {
      const aggregatedLine = aggregatedEntries.get(line);

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
