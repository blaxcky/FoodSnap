import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadAppState } from './storage';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('stored state migration', () => {
  it('migrates legacy deleted entries without a source to the manual archive', () => {
    const legacyState = {
      version: 3,
      foods: [],
      photoItems: [],
      exportLeadIn: '',
      isLogAggregated: false,
      currentSession: [
        {
          id: 'legacy-entry',
          foodId: 'food-1',
          foodName: 'Pear',
          mode: 'direct',
          amount: 80,
          unit: 'g',
          note: '',
          createdAt: '2026-07-29T10:00:00.000Z',
          updatedAt: '2026-07-29T11:00:00.000Z',
          deletedAt: '2026-07-29T11:00:00.000Z'
        }
      ]
    };

    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => JSON.stringify(legacyState)
      }
    });

    const migrated = loadAppState();

    expect(migrated.version).toBe(4);
    expect(migrated.currentSession[0]).toEqual(
      expect.objectContaining({
        archiveSource: 'manual',
        exportBatchId: undefined
      })
    );
  });
});
