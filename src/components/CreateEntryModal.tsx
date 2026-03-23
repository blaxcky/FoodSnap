import { useEffect, useId, useState, type CSSProperties } from 'react';
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
  const [backdropStyle, setBackdropStyle] = useState<CSSProperties | undefined>(undefined);
  const [modalStyle, setModalStyle] = useState<CSSProperties | undefined>(undefined);
  const formId = useId();

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

  useEffect(() => {
    const viewport = window.visualViewport;

    if (!viewport) {
      return;
    }

    let frameId = 0;

    const updateViewport = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const height = Math.round(viewport.height);

        setBackdropStyle({
          top: Math.round(viewport.offsetTop),
          bottom: 'auto',
          height
        });
        setModalStyle({
          maxHeight: Math.max(320, height - 28)
        });
      });
    };

    updateViewport();
    viewport.addEventListener('resize', updateViewport);
    viewport.addEventListener('scroll', updateViewport);

    return () => {
      window.cancelAnimationFrame(frameId);
      viewport.removeEventListener('resize', updateViewport);
      viewport.removeEventListener('scroll', updateViewport);
    };
  }, []);

  return (
    <div
      className="modal-backdrop create-entry-backdrop"
      role="presentation"
      onClick={onCancel}
      style={backdropStyle}
    >
      <section
        className="modal-card create-entry-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-entry-title"
        onClick={(event) => event.stopPropagation()}
        style={modalStyle}
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

        <div className="create-entry-body">
          <EntryComposer foods={foods} onSave={onSave} variant="modal" formId={formId} />
        </div>

        <div className="create-entry-footer">
          <button className="primary-button create-entry-submit" type="submit" form={formId}>
            Add Item
          </button>
        </div>
      </section>
    </div>
  );
}
