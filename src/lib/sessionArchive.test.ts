import { describe, expect, it } from 'vitest';
import { getAggregatedSessionListItems } from './sessionAggregation';
import {
  archiveEntriesAsExport,
  archiveEntriesManually,
  groupHistoryEntries,
  restoreEntries
} from './sessionArchive';
import type { SessionEntry } from './types';

function makeEntry(id: string, amount = 100): SessionEntry {
  return {
    id,
    foodId: 'food-1',
    foodName: 'Apple',
    mode: 'direct',
    amount,
    unit: 'g',
    note: '',
    createdAt: '2026-07-30T10:00:00.000Z',
    updatedAt: '2026-07-30T10:00:00.000Z'
  };
}

describe('session archive', () => {
  it('archives a successful export as one batch with a shared timestamp', () => {
    const timestamp = '2026-07-30T12:32:00.000Z';
    const entries = archiveEntriesAsExport(
      [makeEntry('one'), makeEntry('two')],
      ['one', 'two'],
      timestamp,
      'batch-1'
    );

    expect(entries).toEqual([
      expect.objectContaining({
        id: 'one',
        deletedAt: timestamp,
        updatedAt: timestamp,
        archiveSource: 'export',
        exportBatchId: 'batch-1'
      }),
      expect.objectContaining({
        id: 'two',
        deletedAt: timestamp,
        updatedAt: timestamp,
        archiveSource: 'export',
        exportBatchId: 'batch-1'
      })
    ]);
  });

  it('does not create export metadata when there are no food entries', () => {
    const entries = [makeEntry('one')];
    expect(archiveEntriesAsExport(entries, [], '2026-07-30T12:32:00.000Z', 'batch-1')).toBe(
      entries
    );
  });

  it('orders export batches newest first and keeps manual and active entries separate', () => {
    const active = makeEntry('active');
    const oldest = archiveEntriesAsExport(
      [makeEntry('oldest')],
      ['oldest'],
      '2026-07-30T10:00:00.000Z',
      'batch-oldest'
    )[0];
    const middle = archiveEntriesAsExport(
      [makeEntry('middle')],
      ['middle'],
      '2026-07-30T11:00:00.000Z',
      'batch-middle'
    )[0];
    const newest = archiveEntriesAsExport(
      [makeEntry('newest')],
      ['newest'],
      '2026-07-30T12:00:00.000Z',
      'batch-newest'
    )[0];
    const manual = archiveEntriesManually(
      [makeEntry('manual')],
      ['manual'],
      '2026-07-30T12:30:00.000Z'
    )[0];

    const groups = groupHistoryEntries([oldest, active, newest, manual, middle]);

    expect(groups.active.map((entry) => entry.id)).toEqual(['active']);
    expect(groups.exports.map((group) => group.batchId)).toEqual([
      'batch-newest',
      'batch-middle',
      'batch-oldest'
    ]);
    expect(groups.manual.map((entry) => entry.id)).toEqual(['manual']);
  });

  it('clears archive metadata on restore and assigns a new batch on re-export', () => {
    const exported = archiveEntriesAsExport(
      [makeEntry('one')],
      ['one'],
      '2026-07-30T10:00:00.000Z',
      'old-batch'
    );
    const restored = restoreEntries(exported, ['one'], '2026-07-30T11:00:00.000Z');

    expect(restored[0]).toEqual(
      expect.objectContaining({
        deletedAt: undefined,
        archiveSource: undefined,
        exportBatchId: undefined
      })
    );

    const reExported = archiveEntriesAsExport(
      restored,
      ['one'],
      '2026-07-30T12:00:00.000Z',
      'new-batch'
    );
    expect(reExported[0].exportBatchId).toBe('new-batch');
  });

  it('aggregates matching foods inside each export without crossing batch boundaries', () => {
    const firstBatch = archiveEntriesAsExport(
      [makeEntry('one', 100), makeEntry('two', 50)],
      ['one', 'two'],
      '2026-07-30T10:00:00.000Z',
      'batch-1'
    );
    const secondBatch = archiveEntriesAsExport(
      [makeEntry('three', 25), makeEntry('four', 75)],
      ['three', 'four'],
      '2026-07-30T11:00:00.000Z',
      'batch-2'
    );
    const groups = groupHistoryEntries([...firstBatch, ...secondBatch]);

    const amounts = groups.exports.map((group) => {
      const item = getAggregatedSessionListItems(group.entries, { includeDeleted: true })[0];
      return item.type === 'aggregate' ? item.group.amount : null;
    });

    expect(amounts).toEqual([100, 150]);
  });
});
