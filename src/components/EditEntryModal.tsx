import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { SearchIcon } from './Icons';
import { getFoodSuggestions } from '../lib/search';
import type { EntryPayload, FoodProfile, SessionEntry } from '../lib/types';

interface EditEntryModalProps {
  foods: FoodProfile[];
  entry: SessionEntry;
  onCancel: () => void;
  onSave: (payload: EntryPayload) => void;
}

interface EditorState {
  foodName: string;
  beforeWeight: string;
  afterWeight: string;
  needsAfterWeight: boolean;
  note: string;
}

function mapEntryToState(entry: SessionEntry): EditorState {
  return {
    foodName: entry.foodName,
    beforeWeight:
      entry.mode === 'difference'
        ? String(entry.beforeWeight ?? '')
        : String(entry.beforeWeight ?? entry.amount),
    afterWeight: entry.mode === 'difference' ? String(entry.afterWeight ?? '') : '',
    needsAfterWeight: Boolean(entry.needsAfterWeight),
    note: entry.note
  };
}

export function EditEntryModal({
  foods,
  entry,
  onCancel,
  onSave
}: EditEntryModalProps) {
  const [form, setForm] = useState<EditorState>(() => mapEntryToState(entry));
  const [isNameEditable, setIsNameEditable] = useState(false);
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
    setForm(mapEntryToState(entry));
    setIsNameEditable(false);
    setError('');
    setSuggestionsOpen(false);
    setHighlightedIndex(0);
    window.requestAnimationFrame(() => {
      if (entry.mode === 'difference' || (entry.needsAfterWeight && entry.afterWeight == null)) {
        afterInputRef.current?.focus();
        afterInputRef.current?.select();
        return;
      }

      beforeInputRef.current?.focus();
      beforeInputRef.current?.select();
    });
  }, [entry]);

  useEffect(() => {
    const { documentElement, body } = document;
    const previousHtmlOverflow = documentElement.style.overflow;
    const previousHtmlOverscrollBehavior = documentElement.style.overscrollBehavior;
    const previousOverflow = body.style.overflow;
    const previousOverscrollBehavior = body.style.overscrollBehavior;

    documentElement.style.overflow = 'hidden';
    documentElement.style.overscrollBehavior = 'none';
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';

    return () => {
      documentElement.style.overflow = previousHtmlOverflow;
      documentElement.style.overscrollBehavior = previousHtmlOverscrollBehavior;
      body.style.overflow = previousOverflow;
      body.style.overscrollBehavior = previousOverscrollBehavior;
    };
  }, []);

  function submitForm() {
    const foodName = form.foodName.trim();
    const beforeWeight = Number(form.beforeWeight);

    if (!foodName) {
      setError('Enter a food name.');
      return;
    }

    if (!Number.isFinite(beforeWeight) || beforeWeight < 0) {
      setError('Enter a valid before value.');
      return;
    }

    if (form.afterWeight.trim() === '') {
      onSave({
        foodName,
        mode: 'direct',
        amount: form.needsAfterWeight ? 0 : beforeWeight,
        unit: 'g',
        beforeWeight: form.needsAfterWeight ? beforeWeight : undefined,
        needsAfterWeight: form.needsAfterWeight,
        note: form.note.trim()
      });
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
      needsAfterWeight: form.needsAfterWeight,
      note: form.note.trim()
    });
  }

  function applyFood(food: FoodProfile) {
    if (!isNameEditable) {
      return;
    }

    setForm((current) => ({
      ...current,
      foodName: food.name
    }));
    setError('');
    setSuggestionsOpen(false);
    setHighlightedIndex(0);
    window.requestAnimationFrame(() => {
      beforeInputRef.current?.focus();
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-entry-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading modal-heading">
          <div>
            <p className="section-kicker">Edit entry</p>
            <h2 id="edit-entry-title">Update saved item</h2>
          </div>
          <button className="ghost-button compact" type="button" onClick={onCancel}>
            Close
          </button>
        </div>

        <div className="field-stack autocomplete-shell">
          <label className="field">
            <span className="field-row">
              <span className="field-label">Food</span>
              <button
                className="ghost-button compact"
                type="button"
                onClick={() => {
                  setIsNameEditable((current) => {
                    const next = !current;

                    window.requestAnimationFrame(() => {
                      if (next) {
                        foodInputRef.current?.focus();
                        foodInputRef.current?.select();
                      } else if (
                        entry.mode === 'difference' ||
                        (entry.needsAfterWeight && entry.afterWeight == null)
                      ) {
                        afterInputRef.current?.focus();
                      } else {
                        beforeInputRef.current?.focus();
                      }
                    });

                    return next;
                  });
                  setSuggestionsOpen(false);
                }}
              >
                {isNameEditable ? 'Done' : 'Edit name'}
              </button>
            </span>
            <div className="search-field">
              <input
                ref={foodInputRef}
                className="field-input"
                name="food-edit-name"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="next"
                data-1p-ignore="true"
                data-lpignore="true"
                data-bwignore="true"
                inputMode="text"
                readOnly={!isNameEditable}
                value={form.foodName}
                onChange={(event) => {
                  setForm((current) => ({ ...current, foodName: event.target.value }));
                  setError('');
                  setSuggestionsOpen(true);
                  setHighlightedIndex(0);
                }}
                onFocus={() => {
                  if (isNameEditable) {
                    setSuggestionsOpen(true);
                  }
                }}
                onBlur={() => {
                  window.setTimeout(() => setSuggestionsOpen(false), 120);
                }}
                onKeyDown={(event) => {
                  if (!isNameEditable) {
                    return;
                  }

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

                    beforeInputRef.current?.focus();
                  }

                  if (event.key === 'Escape') {
                    setSuggestionsOpen(false);
                  }
                }}
              />
              <span className="field-icon" aria-hidden="true">
                <SearchIcon className="ui-icon" />
              </span>
            </div>
          </label>

          {isNameEditable && suggestionsOpen && form.foodName.trim() && suggestions.length > 0 ? (
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

        <div className="inline-fields screenshot-fields">
          <label className="field">
            <span className="field-label">Before (g)</span>
            <input
              ref={beforeInputRef}
              className="field-input number-field"
              name="food-edit-before"
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
          </label>

          <label className="field">
            <span className="field-label">
              After (g) <span className="field-label-optional">(opt)</span>
            </span>
            <input
              ref={afterInputRef}
              className="field-input number-field"
              name="food-edit-after"
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
          </label>
        </div>

        <label className="pending-after-toggle pending-after-toggle-modal">
          <input
            className="pending-after-checkbox"
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
          <span className="pending-after-copy">
            <strong>After weight still required</strong>
            <span>
              Keep this enabled if the item should stay marked until an after weight is added.
            </span>
          </span>
        </label>

        <label className="field modal-note-field">
          <span className="field-label">
            Note <span className="field-label-optional">(opt)</span>
          </span>
          <textarea
            className="export-textarea modal-note-input"
            name="food-edit-note"
            placeholder="e.g. chicken, breaded, homemade..."
            value={form.note}
            onChange={(event) => {
              setForm((current) => ({ ...current, note: event.target.value }));
            }}
          />
        </label>

        <p className="helper-copy">
          The note is appended in parentheses in the text export, for example `Schnitzel (Hendl)`.
        </p>

        <div className="modal-actions">
          <button className="ghost-button" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="primary-button modal-save-button" type="button" onClick={submitForm}>
            Save changes
          </button>
        </div>

        {error ? <p className="error-copy">{error}</p> : null}
      </section>
    </div>
  );
}
