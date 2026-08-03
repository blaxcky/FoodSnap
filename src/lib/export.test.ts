import { describe, expect, it } from 'vitest';
import type { SessionEntry } from './types';
import { formatExport } from './export';

function makeEntry(id: string, amount: number, note: string): SessionEntry {
  return {
    id,
    foodId: 'food-1',
    foodName: 'Joghurt',
    mode: 'direct',
    amount,
    unit: 'g',
    note,
    calories: 60,
    nutritionScope: 'per100g',
    createdAt: `2026-08-03T10:0${id}:00.000Z`,
    updatedAt: `2026-08-03T10:0${id}:00.000Z`
  };
}

describe('formatExport aggregation', () => {
  it('exports the total amount and merged notes once', () => {
    expect(
      formatExport([
        makeEntry('1', 100, 'Notiz A'),
        makeEntry('2', 75, 'Notiz B'),
        makeEntry('3', 25, 'Notiz A')
      ])
    ).toBe('200g Joghurt (Notiz A, Notiz B, 60 kcal je 100g)');
  });
});
