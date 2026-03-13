import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { getFoodSuggestions, getQuickFoods } from '../lib/search';
import type { EntryPayload, EntryUnit, FoodProfile, SessionEntry } from '../lib/types';
import { formatNumber } from '../lib/utils';

interface EntryComposerProps {
  foods: FoodProfile[];
  editingEntry: SessionEntry | null;
  onSave: (payload: EntryPayload) => void;
  onCancelEdit: () => void;
}

interface ComposerState {
  foodName: string;
  mode: 'direct' | 'difference';
  amount: string;
  unit: EntryUnit;
  beforeWeight: string;
  afterWeight: string;
  note: string;
}

const emptyState: ComposerState = {
  foodName: '',
  mode: 'direct',
  amount: '',
  unit: 'g',
  beforeWeight: '',
  afterWeight: '',
  note: ''
};

function mapEntryToState(entry: SessionEntry): ComposerState {
  return {
    foodName: entry.foodName,
    mode: entry.mode,
    amount: entry.mode === 'direct' ? String(entry.amount) : '',
    unit: entry.unit,
    beforeWeight: entry.mode === 'difference' ? String(entry.beforeWeight ?? '') : '',
    afterWeight: entry.mode === 'difference' ? String(entry.afterWeight ?? '') : '',
    note: entry.note
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
  const amountInputRef = useRef<HTMLInputElement>(null);
  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);

  const deferredQuery = useDeferredValue(form.foodName);
  const suggestions = useMemo(
    () => getFoodSuggestions(foods, deferredQuery, 6),
    [foods, deferredQuery]
  );
  const quickFoods = useMemo(() => getQuickFoods(foods, 8), [foods]);

  const consumedPreview = useMemo(() => {
    const before = Number(form.beforeWeight);
    const after = Number(form.afterWeight);

    if (!Number.isFinite(before) || !Number.isFinite(after)) {
      return null;
    }

    const consumed = before - after;
    return consumed >= 0 ? consumed : null;
  }, [form.beforeWeight, form.afterWeight]);

  useEffect(() => {
    if (editingEntry) {
      setForm(mapEntryToState(editingEntry));
      setError('');
      setSuggestionsOpen(false);
      window.requestAnimationFrame(() => {
        foodInputRef.current?.focus();
        foodInputRef.current?.select();
      });
      return;
    }

    setForm(emptyState);
  }, [editingEntry]);

  function focusAmountField(nextMode = form.mode) {
    window.requestAnimationFrame(() => {
      if (nextMode === 'direct') {
        amountInputRef.current?.focus();
      } else {
        beforeInputRef.current?.focus();
      }
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

    if (!foodName) {
      setError('Enter a food name.');
      return;
    }

    if (form.mode === 'direct') {
      const amount = Number(form.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        setError('Enter a valid amount.');
        return;
      }

      onSave({
        foodName,
        mode: 'direct',
        amount,
        unit: form.unit,
        note: form.note.trim()
      });
      resetForm();
      return;
    }

    const beforeWeight = Number(form.beforeWeight);
    const afterWeight = Number(form.afterWeight);

    if (!Number.isFinite(beforeWeight) || beforeWeight <= 0) {
      setError('Enter a valid before weight.');
      return;
    }

    if (!Number.isFinite(afterWeight) || afterWeight < 0) {
      setError('Enter a valid after weight.');
      return;
    }

    if (afterWeight > beforeWeight) {
      setError('After weight cannot be higher than before weight.');
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
      note: form.note.trim()
    });
    resetForm();
  }

  function applyFood(food: FoodProfile) {
    setForm((current) => ({
      ...current,
      foodName: food.name,
      unit: food.lastUnit
    }));
    setError('');
    setSuggestionsOpen(false);
    setHighlightedIndex(0);
    focusAmountField();
  }

  return (
    <section className="panel composer-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Fast entry</p>
          <h2>{editingEntry ? 'Update item' : 'Capture the next item'}</h2>
        </div>
        {editingEntry ? (
          <button
            className="ghost-button"
            type="button"
            onClick={() => {
              onCancelEdit();
              resetForm();
            }}
          >
            Cancel edit
          </button>
        ) : null}
      </div>

      <div className="quick-chip-row" aria-label="Remembered foods">
        {quickFoods.length > 0 ? (
          quickFoods.map((food) => (
            <button
              key={food.id}
              className={`quick-chip${food.isFavorite ? ' favorite' : ''}`}
              type="button"
              onClick={() => applyFood(food)}
            >
              {food.name}
            </button>
          ))
        ) : (
          <span className="helper-copy">Saved foods appear here for one-tap re-entry.</span>
        )}
      </div>

      <div className="field-stack">
        <label className="field">
          <span className="field-label">Food</span>
          <input
            ref={foodInputRef}
            className="field-input field-input-lg"
            inputMode="text"
            placeholder="Potatoes, Nutella, Eggs..."
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

                focusAmountField();
              }

              if (event.key === 'Escape') {
                setSuggestionsOpen(false);
              }
            }}
          />
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
                <small>
                  {food.usageCount} saves{food.isFavorite ? ' • favorite' : ''}
                </small>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mode-toggle" role="tablist" aria-label="Entry mode">
        <button
          className={`mode-pill${form.mode === 'direct' ? ' active' : ''}`}
          type="button"
          onClick={() => {
            setForm((current) => ({ ...current, mode: 'direct' }));
            setError('');
            focusAmountField('direct');
          }}
        >
          Direct
        </button>
        <button
          className={`mode-pill${form.mode === 'difference' ? ' active' : ''}`}
          type="button"
          onClick={() => {
            setForm((current) => ({ ...current, mode: 'difference' }));
            setError('');
            focusAmountField('difference');
          }}
        >
          Before / after
        </button>
      </div>

      {form.mode === 'direct' ? (
        <div className="inline-fields">
          <label className="field">
            <span className="field-label">Amount</span>
            <input
              ref={amountInputRef}
              className="field-input"
              inputMode="decimal"
              placeholder="252"
              value={form.amount}
              onChange={(event) => {
                setForm((current) => ({ ...current, amount: event.target.value }));
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

          <fieldset className="mini-toggle">
            <legend className="field-label">Unit</legend>
            <button
              className={`mini-pill${form.unit === 'g' ? ' active' : ''}`}
              type="button"
              onClick={() => setForm((current) => ({ ...current, unit: 'g' }))}
            >
              g
            </button>
            <button
              className={`mini-pill${form.unit === 'pcs' ? ' active' : ''}`}
              type="button"
              onClick={() => setForm((current) => ({ ...current, unit: 'pcs' }))}
            >
              pcs
            </button>
          </fieldset>
        </div>
      ) : (
        <div className="inline-fields">
          <label className="field">
            <span className="field-label">Before</span>
            <input
              ref={beforeInputRef}
              className="field-input"
              inputMode="decimal"
              placeholder="812"
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
            <span className="field-label">After</span>
            <input
              ref={afterInputRef}
              className="field-input"
              inputMode="decimal"
              placeholder="776"
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
      )}

      <label className="field">
        <span className="field-label">Note</span>
        <input
          className="field-input"
          inputMode="text"
          placeholder="Optional detail"
          value={form.note}
          onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
        />
      </label>

      <div className="composer-footer">
        <div className="status-copy" aria-live="polite">
          {form.mode === 'difference' && consumedPreview !== null
            ? `Consumed ${formatNumber(consumedPreview)}g`
            : 'Enter saves and resets the form.'}
        </div>
        <button className="primary-button" type="button" onClick={submitForm}>
          {editingEntry ? 'Update item' : 'Save item'}
        </button>
      </div>

      {error ? <p className="error-copy">{error}</p> : null}
    </section>
  );
}

