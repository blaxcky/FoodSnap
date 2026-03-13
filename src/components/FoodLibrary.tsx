import { useMemo, useState } from 'react';
import type { FoodProfile } from '../lib/types';

interface FoodLibraryProps {
  foods: FoodProfile[];
  onToggleFavorite: (foodId: string) => void;
  onRenameFood: (foodId: string, nextName: string) => boolean;
}

export function FoodLibrary({
  foods,
  onToggleFavorite,
  onRenameFood
}: FoodLibraryProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [renameError, setRenameError] = useState('');

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

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Food memory</p>
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

            return (
              <article key={food.id} className="food-row">
                <button
                  className={`favorite-toggle${food.isFavorite ? ' active' : ''}`}
                  type="button"
                  onClick={() => onToggleFavorite(food.id)}
                  aria-label={food.isFavorite ? `Remove ${food.name} from favorites` : `Add ${food.name} to favorites`}
                >
                  {food.isFavorite ? 'Starred' : 'Star'}
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
                      <h3>{food.name}</h3>
                      <p>{food.usageCount} saves</p>
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

