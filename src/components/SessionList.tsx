import { PencilIcon, TrashIcon } from './Icons';
import type { SessionEntry } from '../lib/types';
import { formatEntryMeta, formatNumber, isAfterWeightPending } from '../lib/utils';

interface SessionListProps {
  entries: SessionEntry[];
  editingEntryId: string | null;
  onEdit: (entryId: string) => void;
  onDelete: (entryId: string) => void;
}

export function SessionList({
  entries,
  editingEntryId,
  onEdit,
  onDelete
}: SessionListProps) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Current session</p>
        </div>
        <span className="status-badge">Active</span>
      </div>

      {entries.length === 0 ? (
        <div className="empty-state">
          <p>No entries yet.</p>
          <span>Start with a food name, then save and keep moving.</span>
        </div>
      ) : (
        <div className="entry-list">
          {entries.map((entry) => {
            const pendingAfterWeight = isAfterWeightPending(entry);

            return (
              <article
                key={entry.id}
                className={`entry-card${editingEntryId === entry.id ? ' editing' : ''}${pendingAfterWeight ? ' pending-after' : ''}`}
              >
                <div className="entry-row">
                  <div className="entry-main">
                    <h3>{entry.foodName}</h3>
                    <p>
                      {pendingAfterWeight
                        ? formatEntryMeta(entry)
                        : `${entry.unit === 'g'
                            ? `${formatNumber(entry.amount)}g`
                            : `${formatNumber(entry.amount)} pcs`}${entry.mode === 'difference' ? ` • ${formatEntryMeta(entry)}` : ''}`}
                    </p>
                  </div>

                  <div className="entry-actions">
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
                  </div>
                </div>

                {pendingAfterWeight ? (
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
