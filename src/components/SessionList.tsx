import { PencilIcon, TrashIcon } from './Icons';
import type { SessionEntry } from '../lib/types';
import { formatEntryMeta, formatNumber } from '../lib/utils';

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
          {entries.map((entry) => (
            <article
              key={entry.id}
              className={`entry-card${editingEntryId === entry.id ? ' editing' : ''}`}
            >
              <div className="entry-row">
                <div className="entry-main">
                  <h3>{entry.foodName}</h3>
                  <p>
                    {entry.unit === 'g'
                      ? `${formatNumber(entry.amount)}g`
                      : `${formatNumber(entry.amount)} pcs`}
                    {entry.mode === 'difference' ? ` • ${formatEntryMeta(entry)}` : ''}
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

              {entry.note ? <p className="entry-note">{entry.note}</p> : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
