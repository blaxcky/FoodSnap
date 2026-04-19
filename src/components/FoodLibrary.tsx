import { useEffect, useMemo, useRef, useState } from 'react';
import { StarIcon, TrashIcon } from './Icons';
import { copyTextToClipboard } from '../lib/clipboard';
import type { FoodProfile, NutritionScope } from '../lib/types';
import { formatNumber, normalizeNutritionScope } from '../lib/utils';

interface FoodLibraryProps {
  foods: FoodProfile[];
  onToggleFavorite: (foodId: string) => void;
  onUpdateFood: (
    foodId: string,
    payload: {
      name: string;
      calories?: number;
      carbs?: number;
      fat?: number;
      protein?: number;
      nutritionScope?: NutritionScope;
    }
  ) => boolean;
  onDeleteFood: (foodId: string) => void;
}

interface FoodDraftState {
  name: string;
  calories: string;
  carbs: string;
  fat: string;
  protein: string;
  nutritionScope: NutritionScope;
}

function formatNutritionInputValue(value: number | undefined) {
  return value != null ? String(value) : '';
}

function formatNutritionSummaryDetail(
  value: number | undefined,
  label: string,
  unitSuffix: string,
  nutritionScope: NutritionScope | undefined
) {
  if (value == null) {
    return null;
  }

  const scopeLabel =
    normalizeNutritionScope(nutritionScope) === 'total' ? 'total' : 'per 100g';
  return `${formatNumber(value)}${unitSuffix} ${label} ${scopeLabel}`;
}

function formatNutritionSummary(food: FoodProfile) {
  const details = [
    formatNutritionSummaryDetail(food.calories, 'kcal', '', food.nutritionScope),
    formatNutritionSummaryDetail(food.carbs, 'KH', 'g', food.nutritionScope),
    formatNutritionSummaryDetail(food.fat, 'Fett', 'g', food.nutritionScope),
    formatNutritionSummaryDetail(food.protein, 'Eiweiß', 'g', food.nutritionScope)
  ].filter((value): value is string => value != null);

  return details.length > 0 ? details.join(' • ') : 'No nutrition defaults saved';
}

function createDraft(food: FoodProfile): FoodDraftState {
  return {
    name: food.name,
    calories: formatNutritionInputValue(food.calories),
    carbs: formatNutritionInputValue(food.carbs),
    fat: formatNutritionInputValue(food.fat),
    protein: formatNutritionInputValue(food.protein),
    nutritionScope: normalizeNutritionScope(food.nutritionScope)
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

export function FoodLibrary({
  foods,
  onToggleFavorite,
  onUpdateFood,
  onDeleteFood
}: FoodLibraryProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<FoodDraftState | null>(null);
  const [editError, setEditError] = useState('');
  const [clipboardFeedback, setClipboardFeedback] = useState<{
    foodId: string;
    tone: 'copied' | 'error';
  } | null>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (feedbackTimeoutRef.current != null) {
        window.clearTimeout(feedbackTimeoutRef.current);
      }
    },
    []
  );

  const sortedFoods = useMemo(
    () =>
      [...foods].sort((left, right) => {
        if (left.isFavorite !== right.isFavorite) {
          return left.isFavorite ? -1 : 1;
        }

        if (right.usageCount !== left.usageCount) {
          return right.usageCount - left.usageCount;
        }

        return right.lastUsedAt.localeCompare(left.lastUsedAt);
      }),
    [foods]
  );

  function resetEditing() {
    setEditingId(null);
    setDraft(null);
    setEditError('');
  }

  function startEditing(food: FoodProfile) {
    setEditingId(food.id);
    setDraft(createDraft(food));
    setEditError('');
  }

  function saveFood(foodId: string) {
    if (!draft) {
      return;
    }

    const trimmedName = draft.name.trim();
    const caloriesResult = parseOptionalNutritionValue(draft.calories, 'kcal');
    const carbsResult = parseOptionalNutritionValue(draft.carbs, 'Kohlenhydrate');
    const fatResult = parseOptionalNutritionValue(draft.fat, 'Fett');
    const proteinResult = parseOptionalNutritionValue(draft.protein, 'Eiweiß');

    if (!trimmedName) {
      setEditError('Pick a unique, non-empty name.');
      return;
    }

    if (caloriesResult.error) {
      setEditError(caloriesResult.error);
      return;
    }

    if (carbsResult.error) {
      setEditError(carbsResult.error);
      return;
    }

    if (fatResult.error) {
      setEditError(fatResult.error);
      return;
    }

    if (proteinResult.error) {
      setEditError(proteinResult.error);
      return;
    }

    const didSave = onUpdateFood(foodId, {
      name: trimmedName,
      calories: caloriesResult.value,
      carbs: carbsResult.value,
      fat: fatResult.value,
      protein: proteinResult.value,
      nutritionScope: draft.nutritionScope
    });

    if (!didSave) {
      setEditError('Pick a unique, non-empty name.');
      return;
    }

    resetEditing();
  }

  async function handleCopyFoodName(foodId: string, foodName: string) {
    const didCopy = await copyTextToClipboard(foodName);

    if (feedbackTimeoutRef.current != null) {
      window.clearTimeout(feedbackTimeoutRef.current);
    }

    setClipboardFeedback({
      foodId,
      tone: didCopy ? 'copied' : 'error'
    });
    feedbackTimeoutRef.current = window.setTimeout(() => setClipboardFeedback(null), 1800);
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Library</p>
          <h2>Remembered foods</h2>
        </div>
      </div>

      {sortedFoods.length === 0 ? (
        <div className="empty-state">
          <p>No remembered foods yet.</p>
          <span>Saved entries build your personal autocomplete list.</span>
        </div>
      ) : (
        <div className="food-library">
          {sortedFoods.map((food) => {
            const isEditing = editingId === food.id;
            const clipboardFeedbackMessage =
              clipboardFeedback?.foodId === food.id
                ? clipboardFeedback.tone === 'copied'
                  ? 'Copied to clipboard'
                  : 'Clipboard access failed'
                : null;

            return (
              <article key={food.id} className="food-row">
                <button
                  className={`favorite-toggle${food.isFavorite ? ' active' : ''}`}
                  type="button"
                  onClick={() => onToggleFavorite(food.id)}
                  aria-label={food.isFavorite ? `Remove ${food.name} from favorites` : `Add ${food.name} to favorites`}
                >
                  <StarIcon className="ui-icon favorite-icon" />
                </button>

                <div className="food-row-main">
                  {isEditing ? (
                    <div className="food-edit-fields">
                      <input
                        className="field-input"
                        value={draft?.name ?? ''}
                        onChange={(event) => {
                          setDraft((current) =>
                            current ? { ...current, name: event.target.value } : current
                          );
                          setEditError('');
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            saveFood(food.id);
                          }
                        }}
                      />

                      <div className="inline-fields nutrition-fields food-library-nutrition-fields">
                        <label className="field">
                          <span className="field-label">kcal</span>
                          <input
                            className="field-input number-field"
                            inputMode="decimal"
                            placeholder="0"
                            value={draft?.calories ?? ''}
                            onChange={(event) => {
                              setDraft((current) =>
                                current ? { ...current, calories: event.target.value } : current
                              );
                              setEditError('');
                            }}
                          />
                        </label>

                        <label className="field">
                          <span className="field-label">KH</span>
                          <div className="input-suffix-shell">
                            <input
                              className="field-input number-field field-input-with-suffix"
                              inputMode="decimal"
                              placeholder="0"
                              value={draft?.carbs ?? ''}
                              onChange={(event) => {
                                setDraft((current) =>
                                  current ? { ...current, carbs: event.target.value } : current
                                );
                                setEditError('');
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
                              className="field-input number-field field-input-with-suffix"
                              inputMode="decimal"
                              placeholder="0"
                              value={draft?.fat ?? ''}
                              onChange={(event) => {
                                setDraft((current) =>
                                  current ? { ...current, fat: event.target.value } : current
                                );
                                setEditError('');
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
                              className="field-input number-field field-input-with-suffix"
                              inputMode="decimal"
                              placeholder="0"
                              value={draft?.protein ?? ''}
                              onChange={(event) => {
                                setDraft((current) =>
                                  current ? { ...current, protein: event.target.value } : current
                                );
                                setEditError('');
                              }}
                            />
                            <span className="input-suffix" aria-hidden="true">
                              g
                            </span>
                          </div>
                        </label>
                      </div>

                      <label className="pending-after-inline nutrition-scope-toggle">
                        <input
                          className="pending-after-checkbox pending-after-checkbox-inline"
                          type="checkbox"
                          checked={(draft?.nutritionScope ?? 'per100g') === 'total'}
                          onChange={(event) => {
                            setDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    nutritionScope: event.target.checked ? 'total' : 'per100g'
                                  }
                                : current
                            );
                            setEditError('');
                          }}
                        />
                        <span>Total amount</span>
                      </label>
                    </div>
                  ) : (
                    <>
                      <h3>
                        <button
                          className="food-name-button"
                          type="button"
                          onClick={() => handleCopyFoodName(food.id, food.name)}
                          aria-label={`Copy ${food.name} to clipboard`}
                        >
                          {food.name}
                        </button>
                      </h3>
                      <p>{food.usageCount} saves</p>
                      <p className="food-nutrition-summary">{formatNutritionSummary(food)}</p>
                      {clipboardFeedbackMessage ? (
                        <p
                          className={`inline-feedback${clipboardFeedback?.tone === 'error' ? ' is-error' : ''}`}
                        >
                          {clipboardFeedbackMessage}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>

                {isEditing ? (
                  <div className="entry-actions">
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => saveFood(food.id)}
                    >
                      Save
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={resetEditing}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="entry-actions">
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => startEditing(food)}
                    >
                      Edit
                    </button>
                    <button
                      className="icon-action destructive-action"
                      type="button"
                      onClick={() => {
                        if (editingId === food.id) {
                          setDraft(null);
                          setEditingId(null);
                        }
                        setEditError('');
                        onDeleteFood(food.id);
                      }}
                      aria-label={`Delete remembered food ${food.name}`}
                    >
                      <TrashIcon className="ui-icon" />
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {editError ? <p className="error-copy">{editError}</p> : null}
    </section>
  );
}
