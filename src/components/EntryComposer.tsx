import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react';
import { SearchIcon } from './Icons';
import { getFoodSuggestions } from '../lib/search';
import type { EntryPayload, FoodProfile } from '../lib/types';

interface EntryComposerProps {
  foods: FoodProfile[];
  onSave: (payload: EntryPayload) => void;
  variant?: 'panel' | 'modal';
  formId?: string;
}

interface ComposerState {
  foodName: string;
  beforeWeight: string;
  afterWeight: string;
  needsAfterWeight: boolean;
}

const emptyState: ComposerState = {
  foodName: '',
  beforeWeight: '',
  afterWeight: '',
  needsAfterWeight: false
};

export function EntryComposer({
  foods,
  onSave,
  variant = 'panel',
  formId
}: EntryComposerProps) {
  const [form, setForm] = useState<ComposerState>(emptyState);
  const [error, setError] = useState('');
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const generatedFormId = useId();
  const activeFormId = formId ?? generatedFormId;
  const beforeWeightInputId = useId();
  const afterWeightInputId = useId();
  const afterWeightRequiredId = useId();

  const foodInputRef = useRef<HTMLInputElement>(null);
  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);

  const deferredQuery = useDeferredValue(form.foodName);
  const suggestions = useMemo(
    () => getFoodSuggestions(foods, deferredQuery, 5),
    [foods, deferredQuery]
  );

  useEffect(() => {
    window.requestAnimationFrame(() => {
      foodInputRef.current?.focus();
    });
  }, []);

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
    const beforeWeightValue = form.beforeWeight.trim();
    const afterWeightValue = form.afterWeight.trim();
    const hasBeforeWeight = beforeWeightValue !== '';
    const hasAfterWeight = afterWeightValue !== '';

    if (!foodName) {
      setError('Enter a food name.');
      return;
    }

    if (!hasBeforeWeight && !hasAfterWeight) {
      setError('Enter at least one weight value.');
      return;
    }

    if (!hasBeforeWeight) {
      const afterWeight = Number(afterWeightValue);

      if (!Number.isFinite(afterWeight) || afterWeight < 0) {
        setError('Enter a valid after value.');
        return;
      }

      onSave({
        foodName,
        mode: 'direct',
        amount: 0,
        unit: 'g',
        afterWeight,
        needsAfterWeight: false,
        note: ''
      });
      resetForm();
      return;
    }

    const beforeWeight = Number(beforeWeightValue);

    if (!Number.isFinite(beforeWeight) || beforeWeight < 0) {
      setError('Enter a valid before value.');
      return;
    }

    if (!hasAfterWeight) {
      onSave({
        foodName,
        mode: 'direct',
        amount: form.needsAfterWeight ? 0 : beforeWeight,
        unit: 'g',
        beforeWeight: form.needsAfterWeight ? beforeWeight : undefined,
        needsAfterWeight: form.needsAfterWeight,
        note: ''
      });
      resetForm();
      return;
    }

    const afterWeight = Number(afterWeightValue);

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
      needsAfterWeight: form.needsAfterWeight,
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

  const fields = (
    <>
      <div className="field-stack autocomplete-shell">
        <label className="field">
          <div className="search-field">
            <input
              ref={foodInputRef}
              className="field-input field-input-lg"
              name="food-log-name"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="next"
              data-1p-ignore="true"
              data-lpignore="true"
              data-bwignore="true"
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

        {suggestionsOpen && form.foodName.trim() && suggestions.length > 0 ? (
          <div className="suggestions-dropdown">
            <div className="suggestions" role="listbox" aria-label="Food suggestions">
              {suggestions.map((food, index) => (
                <button
                  key={food.id}
                  className={`suggestion-item${highlightedIndex === index ? ' active' : ''}`}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyFood(food)}
                >
                  <span className="suggestion-copy">
                    <strong>{food.name}</strong>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="inline-fields screenshot-fields weight-fields">
        <div className="field">
          <label className="field-label" htmlFor={beforeWeightInputId}>
            Before
          </label>
          <div className="input-suffix-shell">
            <input
              id={beforeWeightInputId}
              ref={beforeInputRef}
              className="field-input number-field field-input-with-suffix"
              name="food-log-before"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="next"
              data-1p-ignore="true"
              data-lpignore="true"
              data-bwignore="true"
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
            <span className="input-suffix" aria-hidden="true">
              g
            </span>
          </div>
        </div>

        <div className="field field-with-inline-toggle">
          <div className="field-row field-row-compact">
            <label className="field-label" htmlFor={afterWeightInputId}>
              After
            </label>
            <label className="pending-after-inline" htmlFor={afterWeightRequiredId}>
              <input
                id={afterWeightRequiredId}
                className="pending-after-checkbox pending-after-checkbox-inline"
                type="checkbox"
                checked={form.needsAfterWeight}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    needsAfterWeight: event.target.checked
                  }));
                  setError('');
                }}
              />
              <span>Required</span>
            </label>
          </div>
          <div className="input-suffix-shell">
            <input
              id={afterWeightInputId}
              ref={afterInputRef}
              className="field-input number-field field-input-with-suffix"
              name="food-log-after"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="done"
              data-1p-ignore="true"
              data-lpignore="true"
              data-bwignore="true"
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
            <span className="input-suffix" aria-hidden="true">
              g
            </span>
          </div>
        </div>
      </div>

      {variant === 'modal' ? null : (
        <div className="composer-actions">
          <button className="primary-button screenshot-button" type="submit">
            Add Item
          </button>
        </div>
      )}

      {error ? <p className="error-copy">{error}</p> : null}
    </>
  );

  if (variant === 'modal') {
    return (
      <form
        id={activeFormId}
        className="composer-modal-form"
        onSubmit={(event) => {
          event.preventDefault();
          submitForm();
        }}
      >
        {fields}
      </form>
    );
  }

  return (
    <section className="panel composer-panel">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Quick log food</p>
        </div>
      </div>

      <form
        id={activeFormId}
        onSubmit={(event) => {
          event.preventDefault();
          submitForm();
        }}
      >
        {fields}
      </form>
    </section>
  );
}
