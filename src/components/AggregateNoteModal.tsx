import { useEffect, useId, useRef, useState } from 'react';

interface AggregateNoteModalProps {
  foodName: string;
  initialNote: string;
  onCancel: () => void;
  onSave: (note: string) => void;
}

export function AggregateNoteModal({
  foodName,
  initialNote,
  onCancel,
  onSave
}: AggregateNoteModalProps) {
  const [note, setNote] = useState(initialNote);
  const titleId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <form
        className="modal-card aggregate-note-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onSave(note);
        }}
      >
        <div className="modal-heading">
          <div>
            <p className="section-kicker">Added entry</p>
            <h2 id={titleId}>Edit note for {foodName}</h2>
          </div>
        </div>

        <label className="field modal-note-field">
          <span>Note</span>
          <textarea
            ref={inputRef}
            className="export-textarea modal-note-input"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>

        <div className="modal-actions">
          <button className="ghost-button compact" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="primary-button modal-save-button" type="submit">
            Save note
          </button>
        </div>
      </form>
    </div>
  );
}
