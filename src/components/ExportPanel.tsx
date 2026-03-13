import type { ExportFormat } from '../lib/types';

interface ExportPanelProps {
  exportFormat: ExportFormat;
  exportText: string;
  copyState: 'idle' | 'copied' | 'error';
  onChangeFormat: (format: ExportFormat) => void;
  onCopy: () => void;
}

export function ExportPanel({
  exportFormat,
  exportText,
  copyState,
  onChangeFormat,
  onCopy
}: ExportPanelProps) {
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
          : 'Use Simple for AI input. Raw keeps the original jar-style weighings.'}
      </p>
    </section>
  );
}
