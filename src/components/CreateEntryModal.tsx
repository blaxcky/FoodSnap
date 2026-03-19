import { useEffect } from 'react';
import type { EntryPayload, FoodProfile } from '../lib/types';
import { EntryComposer } from './EntryComposer';

interface CreateEntryModalProps {
  foods: FoodProfile[];
  onCancel: () => void;
  onSave: (payload: EntryPayload) => void;
}

export function CreateEntryModal({
  foods,
  onCancel,
  onSave
}: CreateEntryModalProps) {
  useEffect(() => {
    const { documentElement, body } = document;
    const previousHtmlOverflow = documentElement.style.overflow;
    const previousHtmlOverscrollBehavior = documentElement.style.overscrollBehavior;
    const previousOverflow = body.style.overflow;
    const previousOverscrollBehavior = body.style.overscrollBehavior;

    documentElement.style.overflow = 'hidden';
    documentElement.style.overscrollBehavior = 'none';
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';

    return () => {
      documentElement.style.overflow = previousHtmlOverflow;
      documentElement.style.overscrollBehavior = previousHtmlOverscrollBehavior;
      body.style.overflow = previousOverflow;
      body.style.overscrollBehavior = previousOverscrollBehavior;
    };
  }, []);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <section
        className="modal-card create-entry-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-entry-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading modal-heading">
          <div>
            <p className="section-kicker">Quick log</p>
            <h2 id="create-entry-title">Add new item</h2>
          </div>
          <button className="ghost-button compact" type="button" onClick={onCancel}>
            Close
          </button>
        </div>

        <EntryComposer foods={foods} onSave={onSave} variant="modal" />
      </section>
    </div>
  );
}
