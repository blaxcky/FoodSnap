import { PencilIcon, TrashIcon } from './Icons';
import type { SessionEntry } from '../lib/types';
import {
  canUndoDelete,
  formatEntryMeta,
  formatNumber,
  getUndoSecondsLeft,
  isAfterWeightPending,
  isEntryDeleted
} from '../lib/utils';

interface SessionListProps {
  mode: 'log' | 'history';
  entries: SessionEntry[];
  editingEntryId: string | null;
  now: number;
  onEdit: (entryId: string) => void;
  onDelete: (entryId: string) => void;
  onRestore: (entryId: string) => void;
}

export function SessionList({
  mode,
  entries,
  editingEntryId,
  now,
  onEdit,
  onDelete,
  onRestore
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
              ? 'Deleted items stay here and can be restored at any time.'
              : 'Start with a food name, then save and keep moving.'}
          </span>
        </div>
      ) : (
        <div className="entry-list">
          {entries.map((entry) => {
            const pendingAfterWeight = isAfterWeightPending(entry);
            const deleted = isEntryDeleted(entry);
            const canUndo = canUndoDelete(entry, now);
            const undoSecondsLeft = canUndo ? getUndoSecondsLeft(entry, now) : 0;
            const showInlineUndo = !isHistory && deleted && canUndo;
            const amountSummary = pendingAfterWeight
              ? formatEntryMeta(entry)
              : `${entry.unit === 'g'
                  ? `${formatNumber(entry.amount)}g`
                  : `${formatNumber(entry.amount)} pcs`}${entry.mode === 'difference' ? ` ${formatEntryMeta(entry)}` : ''}`;

            return (
              <article
                key={entry.id}
                className={`entry-card${editingEntryId === entry.id ? ' editing' : ''}${pendingAfterWeight ? ' pending-after' : ''}${deleted ? ' deleted' : ''}${showInlineUndo ? ' deleting-inline' : ''}`}
              >
                <div className="entry-row">
                  <div className="entry-main">
                    <h3>{entry.foodName}</h3>
                    <p>
                      {showInlineUndo
                        ? `Deleting in ${undoSecondsLeft}s • ${amountSummary}`
                        : deleted
                        ? `Removed from log • ${amountSummary}`
                        : pendingAfterWeight
                        ? formatEntryMeta(entry)
                        : `${entry.unit === 'g'
                            ? `${formatNumber(entry.amount)}g`
                            : `${formatNumber(entry.amount)} pcs`}${entry.mode === 'difference' ? ` ${formatEntryMeta(entry)}` : ''}`}
                    </p>
                  </div>

                  <div className="entry-actions">
                    {showInlineUndo ? (
                      <>
                        <span className="undo-timer-chip" aria-hidden="true">
                          {undoSecondsLeft}s
                        </span>
                        <button
                          className="ghost-button compact undo-inline-button"
                          type="button"
                          onClick={() => onRestore(entry.id)}
                        >
                          Undo
                        </button>
                      </>
                    ) : deleted ? (
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
                          aria-label={`Delete ${entry.foodName}`}
                        >
                          <TrashIcon className="ui-icon" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {showInlineUndo ? (
                  <p className="entry-note entry-note-deleted">
                    The entry is fading out and will leave the log unless you undo.
                  </p>
                ) : deleted ? (
                  <p className="entry-note entry-note-deleted">
                    Hidden from Log and excluded from export. Restore to include it again.
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
