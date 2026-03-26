import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react';
import { SearchIcon } from './Icons';
import { getFoodSuggestions } from '../lib/search';
import type { EntryPayload, FoodProfile, SessionEntry } from '../lib/types';
import { isAfterWeightPending, isBeforeWeightPending } from '../lib/utils';

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
  calories: string;
  carbs: string;
  fat: string;
  protein: string;
}

function mapEntryToState(entry: SessionEntry): EditorState {
  const pendingBeforeWeight = isBeforeWeightPending(entry);

  return {
    foodName: entry.foodName,
    beforeWeight:
      entry.mode === 'difference'
        ? String(entry.beforeWeight ?? '')
        : pendingBeforeWeight
        ? ''
        : String(entry.beforeWeight ?? entry.amount),
    afterWeight:
      entry.mode === 'difference' || pendingBeforeWeight ? String(entry.afterWeight ?? '') : '',
    needsAfterWeight: Boolean(entry.needsAfterWeight),
    note: entry.note,
    calories: entry.calories != null ? String(entry.calories) : '',
    carbs: entry.carbs != null ? String(entry.carbs) : '',
    fat: entry.fat != null ? String(entry.fat) : '',
    protein: entry.protein != null ? String(entry.protein) : ''
  };
}

function parseOptionalNutritionValue(value: string, label: string) {
  const trimmed = value.trim();

  if (trimmed === '') {
    return { value: undefined };
  }

  const parsed = Number(trimmed);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return { error: `Enter a valid ${label} value.` };
  }

  return { value: parsed };
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
  const beforeWeightInputId = useId();
  const afterWeightInputId = useId();
  const afterWeightRequiredId = useId();
  const caloriesInputId = useId();
  const carbsInputId = useId();
  const fatInputId = useId();
  const proteinInputId = useId();

  const foodInputRef = useRef<HTMLInputElement>(null);
  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);
  const caloriesInputRef = useRef<HTMLInputElement>(null);
  const carbsInputRef = useRef<HTMLInputElement>(null);
  const fatInputRef = useRef<HTMLInputElement>(null);
  const proteinInputRef = useRef<HTMLInputElement>(null);

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
      if (entry.mode === 'difference' || isAfterWeightPending(entry)) {
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
    const beforeWeightValue = form.beforeWeight.trim();
    const afterWeightValue = form.afterWeight.trim();
    const hasBeforeWeight = beforeWeightValue !== '';
    const hasAfterWeight = afterWeightValue !== '';
    const note = form.note.trim();
    const caloriesResult = parseOptionalNutritionValue(form.calories, 'kcal');
    const carbsResult = parseOptionalNutritionValue(form.carbs, 'Kohlenhydrate');
    const fatResult = parseOptionalNutritionValue(form.fat, 'Fett');
    const proteinResult = parseOptionalNutritionValue(form.protein, 'Eiweiß');

    if (!foodName) {
      setError('Enter a food name.');
      return;
    }

    if (caloriesResult.error) {
      setError(caloriesResult.error);
      return;
    }

    if (carbsResult.error) {
      setError(carbsResult.error);
      return;
    }

    if (fatResult.error) {
      setError(fatResult.error);
      return;
    }

    if (proteinResult.error) {
      setError(proteinResult.error);
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
        note,
        calories: caloriesResult.value,
        carbs: carbsResult.value,
        fat: fatResult.value,
        protein: proteinResult.value
      });
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
        note,
        calories: caloriesResult.value,
        carbs: carbsResult.value,
        fat: fatResult.value,
        protein: proteinResult.value
      });
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
      note,
      calories: caloriesResult.value,
      carbs: carbsResult.value,
      fat: fatResult.value,
      protein: proteinResult.value
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
        className="modal-card edit-entry-modal"
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
                      } else if (entry.mode === 'difference' || isAfterWeightPending(entry)) {
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

        <div className="inline-fields screenshot-fields weight-fields">
          <div className="field field-with-inline-toggle">
            <div className="field-row field-row-compact">
              <label className="field-label" htmlFor={beforeWeightInputId}>
                Before
              </label>
              <span
                className="pending-after-inline pending-after-inline-placeholder"
                aria-hidden="true"
              >
                <span className="pending-after-checkbox pending-after-checkbox-inline" />
                <span>Required</span>
              </span>
            </div>
            <div className="input-suffix-shell">
              <input
                id={beforeWeightInputId}
                ref={beforeInputRef}
                className="field-input number-field field-input-with-suffix"
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
                    caloriesInputRef.current?.focus();
                  }
                }}
              />
              <span className="input-suffix" aria-hidden="true">
                g
              </span>
            </div>
          </div>
        </div>

        <div className="inline-fields nutrition-fields">
          <label className="field">
            <span className="field-label">kcal</span>
            <input
              id={caloriesInputId}
              ref={caloriesInputRef}
              className="field-input number-field"
              name="food-edit-calories"
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
              value={form.calories}
              onChange={(event) => {
                setForm((current) => ({ ...current, calories: event.target.value }));
                setError('');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  carbsInputRef.current?.focus();
                }
              }}
            />
          </label>

          <label className="field">
            <span className="field-label">KH</span>
            <div className="input-suffix-shell">
              <input
                id={carbsInputId}
                ref={carbsInputRef}
                className="field-input number-field field-input-with-suffix"
                name="food-edit-carbs"
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
                value={form.carbs}
                onChange={(event) => {
                  setForm((current) => ({ ...current, carbs: event.target.value }));
                  setError('');
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    fatInputRef.current?.focus();
                  }
                }}
              />
              <span className="input-suffix" aria-hidden="true">
                g
              </span>
            </div>
          </label>

          <label className="field">
            <span className="field-label">Fett</span>
            <div className="input-suffix-shell">
              <input
                id={fatInputId}
                ref={fatInputRef}
                className="field-input number-field field-input-with-suffix"
                name="food-edit-fat"
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
                value={form.fat}
                onChange={(event) => {
                  setForm((current) => ({ ...current, fat: event.target.value }));
                  setError('');
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    proteinInputRef.current?.focus();
                  }
                }}
              />
              <span className="input-suffix" aria-hidden="true">
                g
              </span>
            </div>
          </label>

          <label className="field">
            <span className="field-label">Eiweiß</span>
            <div className="input-suffix-shell">
              <input
                id={proteinInputId}
                ref={proteinInputRef}
                className="field-input number-field field-input-with-suffix"
                name="food-edit-protein"
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
                value={form.protein}
                onChange={(event) => {
                  setForm((current) => ({ ...current, protein: event.target.value }));
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
          </label>
        </div>

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
          Note and nutrition details are appended in parentheses in the text export, for example
          `Schnitzel (Hendl, 520 kcal, 12g Kohlenhydrate, 28g Fett, 41g Eiweiß)`.
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
