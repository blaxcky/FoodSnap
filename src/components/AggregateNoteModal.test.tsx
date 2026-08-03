// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AggregateNoteModal } from './AggregateNoteModal';

afterEach(cleanup);

describe('AggregateNoteModal', () => {
  it('starts with the combined note and submits edits', () => {
    const onSave = vi.fn();
    render(
      <AggregateNoteModal
        foodName="Joghurt"
        initialNote="Notiz A, Notiz B"
        onCancel={vi.fn()}
        onSave={onSave}
      />
    );

    const input = screen.getByRole('textbox', { name: 'Note' });
    expect(input).toHaveValue('Notiz A, Notiz B');
    fireEvent.change(input, { target: { value: 'Gemeinsam' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
    expect(onSave).toHaveBeenCalledWith('Gemeinsam');
  });

  it('cancels without saving', () => {
    const onCancel = vi.fn();
    const onSave = vi.fn();
    render(
      <AggregateNoteModal
        foodName="Joghurt"
        initialNote="Unverändert"
        onCancel={onCancel}
        onSave={onSave}
      />
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Note' }), {
      target: { value: 'Nicht speichern' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
  });
});
