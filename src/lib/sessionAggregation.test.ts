import { describe, expect, it } from 'vitest';
import type { SessionEntry } from './types';
import {
  getAggregatedSessionListItems,
  getCombinedSessionEntryNote,
  updateSessionEntryNotes
} from './sessionAggregation';

function makeEntry(id: string, overrides: Partial<SessionEntry> = {}): SessionEntry {
  return {
    id,
    foodId: 'food-1',
    foodName: 'Joghurt',
    mode: 'direct',
    amount: 100,
    unit: 'g',
    note: '',
    calories: 60,
    protein: 4,
    nutritionScope: 'per100g',
    createdAt: `2026-08-03T10:0${id}:00.000Z`,
    updatedAt: `2026-08-03T10:0${id}:00.000Z`,
    ...overrides
  };
}

describe('session aggregation notes', () => {
  it('aggregates matching entries with different notes in entry order', () => {
    const items = getAggregatedSessionListItems([
      makeEntry('1', { note: 'Notiz A' }),
      makeEntry('2', { note: 'Notiz B', amount: 75 })
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: 'aggregate',
      group: {
        amount: 175,
        details: ['Notiz A', 'Notiz B', '60 kcal je 100g', '4g Eiweiß je 100g']
      }
    });
  });

  it('does not repeat equal notes and ignores empty notes', () => {
    const entries = [
      makeEntry('1', { note: ' Gemeinsam ' }),
      makeEntry('2', { note: '' }),
      makeEntry('3', { note: 'Gemeinsam' })
    ];

    expect(getCombinedSessionEntryNote(entries)).toBe('Gemeinsam');
    const item = getAggregatedSessionListItems(entries)[0];
    expect(item.type === 'aggregate' ? item.group.details[0] : null).toBe('Gemeinsam');
  });

  it('keeps different nutrition values and scopes in separate groups', () => {
    const entries = [
      makeEntry('1'),
      makeEntry('2', { calories: 61 }),
      makeEntry('3', { nutritionScope: 'total' })
    ];

    expect(getAggregatedSessionListItems(entries).map((item) => item.type)).toEqual([
      'single',
      'single',
      'single'
    ]);
  });

  it('updates only notes and timestamps for all selected entries', () => {
    const entries = [
      makeEntry('1', { note: 'A', sourcePhotoId: 'photo-1' }),
      makeEntry('2', { note: 'B', amount: 75, deletedAt: undefined }),
      makeEntry('3', { note: 'untouched', amount: 50 })
    ];
    const timestamp = '2026-08-03T12:00:00.000Z';
    const updated = updateSessionEntryNotes(entries, ['1', '2'], '  Neu  ', timestamp);

    expect(updated[0]).toEqual({ ...entries[0], note: 'Neu', updatedAt: timestamp });
    expect(updated[1]).toEqual({ ...entries[1], note: 'Neu', updatedAt: timestamp });
    expect(updated[2]).toBe(entries[2]);
  });

  it('removes all selected notes when saved empty', () => {
    const updated = updateSessionEntryNotes(
      [makeEntry('1', { note: 'A' }), makeEntry('2', { note: 'B' })],
      ['1', '2'],
      '   ',
      '2026-08-03T12:00:00.000Z'
    );

    expect(updated.map((entry) => entry.note)).toEqual(['', '']);
  });
});
