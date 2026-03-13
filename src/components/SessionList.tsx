import type { SessionEntry } from '../lib/types';
import { formatEntryMeta, formatNumber } from '../lib/utils';

interface SessionListProps {
  entries: SessionEntry[];
  editingEntryId: string | null;
  onEdit: (entryId: string) => void;
  onDuplicate: (entryId: string) => void;
  onDelete: (entryId: string) => void;
}

export function SessionList({
  entries,
  editingEntryId,
  onEdit,
  onDuplicate,
  onDelete
}: SessionListProps) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Current session</p>
          <h2>{entries.length} item{entries.length === 1 ? '' : 's'} captured</h2>
        </div>
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
              <div className="entry-main">
                <div>
                  <h3>{entry.foodName}</h3>
                  <p>{entry.unit === 'g' ? `${formatNumber(entry.amount)}g` : `${formatNumber(entry.amount)} pcs`}</p>
                </div>
                <small>{formatEntryMeta(entry)}</small>
              </div>

              {entry.note ? <p className="entry-note">{entry.note}</p> : null}

              <div className="entry-actions">
                <button className="ghost-button" type="button" onClick={() => onEdit(entry.id)}>
                  Edit
                </button>
                <button className="ghost-button" type="button" onClick={() => onDuplicate(entry.id)}>
                  Again
                </button>
                <button className="ghost-button danger" type="button" onClick={() => onDelete(entry.id)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

