import { useEffect, useMemo, useRef, useState } from 'react';
import { StarIcon, TrashIcon } from './Icons';
import { copyTextToClipboard } from '../lib/clipboard';
import type { FoodProfile } from '../lib/types';

interface FoodLibraryProps {
  foods: FoodProfile[];
  onToggleFavorite: (foodId: string) => void;
  onRenameFood: (foodId: string, nextName: string) => boolean;
  onDeleteFood: (foodId: string) => void;
}

export function FoodLibrary({
  foods,
  onToggleFavorite,
  onRenameFood,
  onDeleteFood
}: FoodLibraryProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [renameError, setRenameError] = useState('');
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
                    <input
                      className="field-input"
                      value={draftName}
                      onChange={(event) => {
                        setDraftName(event.target.value);
                        setRenameError('');
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          const didSave = onRenameFood(food.id, draftName);
                          if (didSave) {
                            setEditingId(null);
                            setDraftName('');
                          } else {
                            setRenameError('Pick a unique, non-empty name.');
                          }
                        }
                      }}
                    />
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
                      onClick={() => {
                        const didSave = onRenameFood(food.id, draftName);
                        if (didSave) {
                          setEditingId(null);
                          setDraftName('');
                        } else {
                          setRenameError('Pick a unique, non-empty name.');
                        }
                      }}
                    >
                      Save
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setDraftName('');
                        setRenameError('');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="entry-actions">
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => {
                        setEditingId(food.id);
                        setDraftName(food.name);
                        setRenameError('');
                      }}
                    >
                      Rename
                    </button>
                    <button
                      className="icon-action destructive-action"
                      type="button"
                      onClick={() => {
                        if (editingId === food.id) {
                          setEditingId(null);
                          setDraftName('');
                        }
                        setRenameError('');
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

      {renameError ? <p className="error-copy">{renameError}</p> : null}
    </section>
  );
}
