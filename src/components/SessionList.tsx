import { CheckIcon, PencilIcon, PhotoIcon } from './Icons';
import type { SessionEntry } from '../lib/types';
import {
  formatEntryMeta,
  formatNumber,
  isAfterWeightPending,
  isBeforeWeightPending,
  isEntryDeleted,
  isZeroBeforeEntry
} from '../lib/utils';

interface SessionListProps {
  mode: 'log' | 'history';
  entries: SessionEntry[];
  editingEntryId: string | null;
  onEdit: (entryId: string) => void;
  onDelete: (entryId: string) => void;
  onRestore: (entryId: string) => void;
  onOpenPhoto: (photoId: string) => void;
}

export function SessionList({
  mode,
  entries,
  editingEntryId,
  onEdit,
  onDelete,
  onRestore,
  onOpenPhoto
}: SessionListProps) {
  const isHistory = mode === 'history';

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="section-kicker">{isHistory ? 'History' : 'Current session'}</p>
        </div>
        <span className="status-badge">{isHistory ? 'Archive' : 'Active'}</span>
      </div>

      {entries.length === 0 ? (
        <div className="empty-state">
          <p>{isHistory ? 'No history yet.' : 'No entries yet.'}</p>
          <span>
            {isHistory
              ? 'Hidden items stay here and can be restored at any time.'
              : 'Start with a food name, then save and keep moving.'}
          </span>
        </div>
      ) : (
        <div className="entry-list">
          {entries.map((entry) => {
            const pendingBeforeWeight = isBeforeWeightPending(entry);
            const pendingAfterWeight = isAfterWeightPending(entry);
            const deleted = isEntryDeleted(entry);
            const zeroBefore = isZeroBeforeEntry(entry);
            const incompleteWeight = pendingBeforeWeight || pendingAfterWeight;
            const amountSummary = incompleteWeight
              ? formatEntryMeta(entry)
              : `${entry.unit === 'g'
                  ? `${formatNumber(entry.amount)}g`
                  : `${formatNumber(entry.amount)} pcs`}${entry.mode === 'difference' ? ` ${formatEntryMeta(entry)}` : ''}`;

            return (
              <article
                key={entry.id}
                className={`entry-card${editingEntryId === entry.id ? ' editing' : ''}${pendingBeforeWeight ? ' pending-before' : ''}${pendingAfterWeight ? ' pending-after' : ''}${zeroBefore ? ' zero-before' : ''}${deleted ? ' deleted' : ''}`}
              >
                <div className="entry-row">
                  <div className="entry-main">
                    <h3>{entry.foodName}</h3>
                    <p>
                      {deleted
                        ? `Hidden from log • ${amountSummary}`
                        : incompleteWeight
                        ? formatEntryMeta(entry)
                        : `${entry.unit === 'g'
                            ? `${formatNumber(entry.amount)}g`
                            : `${formatNumber(entry.amount)} pcs`}${entry.mode === 'difference' ? ` ${formatEntryMeta(entry)}` : ''}`}
                    </p>
                  </div>

                  <div className="entry-actions">
                    {entry.sourcePhotoId ? (
                      <button
                        className="icon-action photo-link-action"
                        type="button"
                        onClick={() => onOpenPhoto(entry.sourcePhotoId!)}
                        aria-label={`Open linked photo for ${entry.foodName}`}
                      >
                        <PhotoIcon className="ui-icon" />
                      </button>
                    ) : null}
                    {deleted ? (
                      <button
                        className="ghost-button compact"
                        type="button"
                        onClick={() => onRestore(entry.id)}
                      >
                        Restore
                      </button>
                    ) : (
                      <>
                        <button
                          className="icon-action"
                          type="button"
                          onClick={() => onEdit(entry.id)}
                          aria-label={`Edit ${entry.foodName}`}
                        >
                          <PencilIcon className="ui-icon" />
                        </button>
                        <button
                          className="icon-action"
                          type="button"
                          onClick={() => onDelete(entry.id)}
                          aria-label={`Hide ${entry.foodName} from log and export`}
                        >
                          <CheckIcon className="ui-icon" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {deleted ? (
                  <p className="entry-note entry-note-deleted">
                    Hidden from Log and excluded from export. Restore to include it again.
                  </p>
                ) : pendingBeforeWeight ? (
                  <p className="entry-note entry-note-pending-before">
                    After weight already entered. Add before weight to complete it.
                  </p>
                ) : zeroBefore ? (
                  <p className="entry-note entry-note-zero">
                    Pre-entered with 0g. Update the weight later when you know it.
                  </p>
                ) : pendingAfterWeight ? (
                  <p className="entry-note entry-note-pending">
                    After weight still missing. Edit the item to complete it.
                  </p>
                ) : null}

                {entry.note ? <p className="entry-note">{entry.note}</p> : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
