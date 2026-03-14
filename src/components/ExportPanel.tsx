import { useEffect, useState } from 'react';
import type { ExportFormat } from '../lib/types';

interface ExportPanelProps {
  exportFormat: ExportFormat;
  exportText: string;
  copyState: 'idle' | 'copied' | 'error';
  sessionCount: number;
  onChangeFormat: (format: ExportFormat) => void;
  onCopy: () => void;
  onResetSession: () => void;
}

export function ExportPanel({
  exportFormat,
  exportText,
  copyState,
  sessionCount,
  onChangeFormat,
  onCopy,
  onResetSession
}: ExportPanelProps) {
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

  useEffect(() => {
    if (!isResetDialogOpen) {
      return;
    }

    const { body } = document;
    const scrollY = window.scrollY;
    const previousOverflow = body.style.overflow;
    const previousPosition = body.style.position;
    const previousTop = body.style.top;
    const previousWidth = body.style.width;

    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';

    return () => {
      body.style.overflow = previousOverflow;
      body.style.position = previousPosition;
      body.style.top = previousTop;
      body.style.width = previousWidth;
      window.scrollTo(0, scrollY);
    };
  }, [isResetDialogOpen]);

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Export</p>
          <h2>Plain text for AI analysis</h2>
        </div>
        <button className="primary-button" type="button" onClick={onCopy} disabled={!exportText}>
          {copyState === 'copied' ? 'Copied' : 'Copy text'}
        </button>
      </div>

      <div className="mode-toggle export-toggle" role="tablist" aria-label="Export format">
        <button
          className={`mode-pill${exportFormat === 'simple' ? ' active' : ''}`}
          type="button"
          onClick={() => onChangeFormat('simple')}
        >
          Simple
        </button>
        <button
          className={`mode-pill${exportFormat === 'raw' ? ' active' : ''}`}
          type="button"
          onClick={() => onChangeFormat('raw')}
        >
          Raw difference
        </button>
      </div>

      <textarea
        className="export-textarea"
        readOnly
        value={exportText || 'Entries will appear here as soon as you save them.'}
      />

      <p className="helper-copy">
        {copyState === 'error'
          ? 'Clipboard access failed. Select the text manually.'
          : 'Use Simple for AI input. Your custom intro text is included before the exported foods.'}
      </p>

      <section className="export-danger-zone" aria-labelledby="export-reset-title">
        <div className="settings-section-header">
          <p id="export-reset-title" className="settings-section-title settings-section-title-danger">
            Reset session
          </p>
          <p className="settings-section-caption">
            Clears only the current session. Food memory stays stored.
          </p>
        </div>

        <article className="settings-danger-card export-danger-card">
          <div className="settings-row settings-row-action settings-row-danger">
            <div className="settings-row-copy">
              <h3>Clear current session</h3>
              <p>{sessionCount} item{sessionCount === 1 ? '' : 's'} currently in the session.</p>
            </div>
            <div className="settings-row-control">
              <button
                className="ghost-button settings-inline-button destructive-action"
                type="button"
                onClick={() => setIsResetDialogOpen(true)}
                disabled={sessionCount === 0}
              >
                Clear
              </button>
            </div>
          </div>
        </article>
      </section>

      {isResetDialogOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsResetDialogOpen(false)}>
          <section
            className="modal-card confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-session-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-heading modal-heading">
              <div>
                <p className="section-kicker">Confirm reset</p>
                <h2 id="reset-session-title">Clear current session?</h2>
              </div>
            </div>

            <p className="helper-copy">
              This removes all current session entries from Log and Export. Remembered foods stay untouched.
            </p>

            <div className="modal-actions">
              <button
                className="ghost-button"
                type="button"
                onClick={() => setIsResetDialogOpen(false)}
              >
                Cancel
              </button>
              <button
                className="primary-button modal-save-button destructive-fill"
                type="button"
                onClick={() => {
                  onResetSession();
                  setIsResetDialogOpen(false);
                }}
              >
                Reset session
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
