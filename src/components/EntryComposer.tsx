import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { SearchIcon } from './Icons';
import { getFoodSuggestions } from '../lib/search';
import type { EntryPayload, FoodProfile, SessionEntry } from '../lib/types';

interface EntryComposerProps {
  foods: FoodProfile[];
  editingEntry: SessionEntry | null;
  onSave: (payload: EntryPayload) => void;
  onCancelEdit: () => void;
}

interface ComposerState {
  foodName: string;
  beforeWeight: string;
  afterWeight: string;
}

const emptyState: ComposerState = {
  foodName: '',
  beforeWeight: '',
  afterWeight: ''
};

function mapEntryToState(entry: SessionEntry): ComposerState {
  return {
    foodName: entry.foodName,
    beforeWeight:
      entry.mode === 'difference'
        ? String(entry.beforeWeight ?? '')
        : String(entry.amount),
    afterWeight: entry.mode === 'difference' ? String(entry.afterWeight ?? '') : ''
  };
}

export function EntryComposer({
  foods,
  editingEntry,
  onSave,
  onCancelEdit
}: EntryComposerProps) {
  const [form, setForm] = useState<ComposerState>(emptyState);
  const [error, setError] = useState('');
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const foodInputRef = useRef<HTMLInputElement>(null);
  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);

  const deferredQuery = useDeferredValue(form.foodName);
  const suggestions = useMemo(
    () => getFoodSuggestions(foods, deferredQuery, 5),
    [foods, deferredQuery]
  );

  useEffect(() => {
    if (!editingEntry) {
      setForm(emptyState);
      return;
    }

    setForm(mapEntryToState(editingEntry));
    setError('');
    setSuggestionsOpen(false);
    window.requestAnimationFrame(() => {
      foodInputRef.current?.focus();
      foodInputRef.current?.select();
    });
  }, [editingEntry]);

  function focusWeightField() {
    window.requestAnimationFrame(() => {
      beforeInputRef.current?.focus();
    });
  }

  function resetForm() {
    setForm(emptyState);
    setError('');
    setSuggestionsOpen(false);
    setHighlightedIndex(0);
    window.requestAnimationFrame(() => {
      foodInputRef.current?.focus();
    });
  }

  function submitForm() {
    const foodName = form.foodName.trim();
    const beforeWeight = Number(form.beforeWeight);

    if (!foodName) {
      setError('Enter a food name.');
      return;
    }

    if (!Number.isFinite(beforeWeight) || beforeWeight <= 0) {
      setError('Enter a valid before value.');
      return;
    }

    if (form.afterWeight.trim() === '') {
      onSave({
        foodName,
        mode: 'direct',
        amount: beforeWeight,
        unit: 'g',
        note: ''
      });
      resetForm();
      return;
    }

    const afterWeight = Number(form.afterWeight);

    if (!Number.isFinite(afterWeight) || afterWeight < 0) {
      setError('Enter a valid after value.');
      return;
    }

    if (afterWeight > beforeWeight) {
      setError('After weight cannot be above before weight.');
      return;
    }

    const amount = beforeWeight - afterWeight;
    if (amount <= 0) {
      setError('Consumed amount must be above zero.');
      return;
    }

    onSave({
      foodName,
      mode: 'difference',
      amount,
      unit: 'g',
      beforeWeight,
      afterWeight,
      note: ''
    });
    resetForm();
  }

  function applyFood(food: FoodProfile) {
    setForm((current) => ({
      ...current,
      foodName: food.name
    }));
    setError('');
    setSuggestionsOpen(false);
    setHighlightedIndex(0);
    focusWeightField();
  }

  return (
    <section className="panel composer-panel">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Quick log food</p>
        </div>
        {editingEntry ? (
          <button
            className="ghost-button compact"
            type="button"
            onClick={() => {
              onCancelEdit();
              resetForm();
            }}
          >
            Cancel
          </button>
        ) : null}
      </div>

      <div className="field-stack">
        <label className="field">
          <div className="search-field">
            <input
              ref={foodInputRef}
              className="field-input field-input-lg"
              inputMode="text"
              placeholder="Enter food name..."
              value={form.foodName}
              onChange={(event) => {
                setForm((current) => ({ ...current, foodName: event.target.value }));
                setError('');
                setSuggestionsOpen(true);
                setHighlightedIndex(0);
              }}
              onFocus={() => setSuggestionsOpen(true)}
              onBlur={() => {
                window.setTimeout(() => setSuggestionsOpen(false), 120);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' && suggestions.length > 0) {
                  event.preventDefault();
                  setHighlightedIndex((current) => (current + 1) % suggestions.length);
                  return;
                }

                if (event.key === 'ArrowUp' && suggestions.length > 0) {
                  event.preventDefault();
                  setHighlightedIndex((current) =>
                    current === 0 ? suggestions.length - 1 : current - 1
                  );
                  return;
                }

                if (event.key === 'Enter') {
                  event.preventDefault();

                  if (suggestionsOpen && suggestions[highlightedIndex]) {
                    applyFood(suggestions[highlightedIndex]);
                    return;
                  }

                  focusWeightField();
                }

                if (event.key === 'Escape') {
                  setSuggestionsOpen(false);
                }
              }}
            />
            <span className="field-icon" aria-hidden="true">
              <SearchIcon className="ui-icon search-icon-strong" />
            </span>
          </div>
        </label>

        {suggestionsOpen && suggestions.length > 0 ? (
          <div className="suggestions" role="listbox" aria-label="Food suggestions">
            {suggestions.map((food, index) => (
              <button
                key={food.id}
                className={`suggestion-item${highlightedIndex === index ? ' active' : ''}`}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applyFood(food)}
              >
                <span>{food.name}</span>
                <small>{food.usageCount} saves</small>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="inline-fields screenshot-fields">
        <label className="field">
          <span className="field-label">Before (g)</span>
          <input
            ref={beforeInputRef}
            className="field-input number-field"
            inputMode="decimal"
            placeholder="0"
            value={form.beforeWeight}
            onChange={(event) => {
              setForm((current) => ({ ...current, beforeWeight: event.target.value }));
              setError('');
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                afterInputRef.current?.focus();
              }
            }}
          />
        </label>

        <label className="field">
          <span className="field-label">
            After (g) <span className="field-label-optional">(opt)</span>
          </span>
          <input
            ref={afterInputRef}
            className="field-input number-field"
            inputMode="decimal"
            placeholder="0"
            value={form.afterWeight}
            onChange={(event) => {
              setForm((current) => ({ ...current, afterWeight: event.target.value }));
              setError('');
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submitForm();
              }
            }}
          />
        </label>
      </div>

      <button className="primary-button screenshot-button" type="button" onClick={submitForm}>
        {editingEntry ? 'Update Item' : 'Add Item'}
      </button>

      {error ? <p className="error-copy">{error}</p> : null}
    </section>
  );
}
