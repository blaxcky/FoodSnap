// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SessionEntry } from '../lib/types';
import { SessionList } from './SessionList';

afterEach(cleanup);

function makeEntry(id: string, overrides: Partial<SessionEntry> = {}): SessionEntry {
  return {
    id,
    foodId: 'food-1',
    foodName: 'Joghurt',
    mode: 'direct',
    amount: 100,
    unit: 'g',
    note: '',
    createdAt: `2026-08-03T10:0${id}:00.000Z`,
    updatedAt: `2026-08-03T10:0${id}:00.000Z`,
    ...overrides
  };
}

describe('SessionList aggregate editing', () => {
  it('edits active history groups while archived groups stay immutable', () => {
    const onEditMany = vi.fn();
    const entries = [
      makeEntry('1', { note: 'A' }),
      makeEntry('2', { note: 'B' }),
      makeEntry('3', {
        note: 'Archiv A',
        deletedAt: '2026-08-03T11:00:00.000Z',
        archiveSource: 'manual'
      }),
      makeEntry('4', {
        note: 'Archiv B',
        deletedAt: '2026-08-03T11:00:00.000Z',
        archiveSource: 'manual'
      })
    ];

    render(
      <SessionList
        mode="history"
        entries={entries}
        isAggregated
        editingEntryId={null}
        onEdit={vi.fn()}
        onEditMany={onEditMany}
        onDelete={vi.fn()}
        onDeleteMany={vi.fn()}
        onRestore={vi.fn()}
        onRestoreMany={vi.fn()}
        onOpenPhoto={vi.fn()}
      />
    );

    const editButtons = screen.getAllByRole('button', {
      name: 'Edit note for added entry Joghurt'
    });
    expect(editButtons).toHaveLength(1);
    fireEvent.click(editButtons[0]);
    expect(onEditMany).toHaveBeenCalledWith(['1', '2']);
    expect(screen.getByRole('button', { name: 'Restore' })).toBeInTheDocument();
  });
});
