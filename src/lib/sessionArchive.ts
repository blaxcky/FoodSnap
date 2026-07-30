import type { SessionEntry } from './types';

export interface ExportArchiveGroup {
  batchId: string;
  archivedAt: string;
  entries: SessionEntry[];
}

export interface HistoryEntryGroups {
  active: SessionEntry[];
  exports: ExportArchiveGroup[];
  manual: SessionEntry[];
}

export function archiveEntriesManually(
  entries: SessionEntry[],
  entryIds: Iterable<string>,
  timestamp: string
) {
  const targetIds = new Set(entryIds);

  return entries.map((entry) =>
    targetIds.has(entry.id)
      ? {
          ...entry,
          deletedAt: timestamp,
          updatedAt: timestamp,
          undoExpiresAt: undefined,
          archiveSource: 'manual' as const,
          exportBatchId: undefined
        }
      : entry
  );
}

export function archiveEntriesAsExport(
  entries: SessionEntry[],
  entryIds: Iterable<string>,
  timestamp: string,
  exportBatchId: string
) {
  const targetIds = new Set(entryIds);

  if (targetIds.size === 0) {
    return entries;
  }

  return entries.map((entry) =>
    targetIds.has(entry.id)
      ? {
          ...entry,
          deletedAt: timestamp,
          updatedAt: timestamp,
          undoExpiresAt: undefined,
          archiveSource: 'export' as const,
          exportBatchId
        }
      : entry
  );
}

export function restoreEntries(entries: SessionEntry[], entryIds: Iterable<string>, timestamp: string) {
  const targetIds = new Set(entryIds);

  return entries.map((entry) =>
    targetIds.has(entry.id)
      ? {
          ...entry,
          deletedAt: undefined,
          updatedAt: timestamp,
          undoExpiresAt: undefined,
          archiveSource: undefined,
          exportBatchId: undefined
        }
      : entry
  );
}

export function groupHistoryEntries(entries: SessionEntry[]): HistoryEntryGroups {
  const active: SessionEntry[] = [];
  const manual: SessionEntry[] = [];
  const exportGroups = new Map<string, ExportArchiveGroup>();

  for (const entry of entries) {
    if (!entry.deletedAt) {
      active.push(entry);
      continue;
    }

    if (entry.archiveSource !== 'export' || !entry.exportBatchId) {
      manual.push(entry);
      continue;
    }

    const existing = exportGroups.get(entry.exportBatchId);
    if (existing) {
      existing.entries.push(entry);
      if (entry.deletedAt > existing.archivedAt) {
        existing.archivedAt = entry.deletedAt;
      }
      continue;
    }

    exportGroups.set(entry.exportBatchId, {
      batchId: entry.exportBatchId,
      archivedAt: entry.deletedAt,
      entries: [entry]
    });
  }

  return {
    active,
    exports: [...exportGroups.values()].sort((left, right) =>
      right.archivedAt.localeCompare(left.archivedAt)
    ),
    manual
  };
}
