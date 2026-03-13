interface SettingsPanelProps {
  foodCount: number;
  sessionCount: number;
  exportState: 'idle' | 'done' | 'error';
  refreshState: 'idle' | 'working' | 'error';
  onExportFoodMemory: () => void;
  onResetSession: () => void;
  onForceRefresh: () => Promise<void>;
}

export function SettingsPanel({
  foodCount,
  sessionCount,
  exportState,
  refreshState,
  onExportFoodMemory,
  onResetSession,
  onForceRefresh
}: SettingsPanelProps) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Settings</p>
          <h2>App maintenance</h2>
        </div>
      </div>

      <article className="settings-card">
        <div className="settings-copy">
          <h3>Force full app refresh</h3>
          <p>
            Deletes browser caches, unregisters service workers, and reloads the latest app
            version. Your local foods and session entries stay intact.
          </p>
        </div>

        <button
          className="primary-button settings-button"
          type="button"
          onClick={() => void onForceRefresh()}
          disabled={refreshState === 'working'}
        >
          {refreshState === 'working' ? 'Reloading app...' : 'Reload app completely'}
        </button>

        <p className="settings-note">
          Use this if a deployment is live but the installed PWA still shows an old version.
        </p>

        {refreshState === 'error' ? (
          <p className="error-copy">The forced refresh failed. Try again.</p>
        ) : null}
      </article>

      <article className="settings-card">
        <div className="settings-copy">
          <h3>Export food memory backup</h3>
          <p>
            Downloads your saved foods with their total save counts and preference data. The
            current session is not included.
          </p>
        </div>

        <button
          className="primary-button settings-button"
          type="button"
          onClick={onExportFoodMemory}
          disabled={foodCount === 0}
        >
          Export foods and save counts
        </button>

        <p className="settings-note">
          Includes {foodCount} remembered food{foodCount === 1 ? '' : 's'}. Session entries stay
          out of the backup.
        </p>

        {exportState === 'done' ? (
          <p className="success-copy">Backup downloaded.</p>
        ) : null}

        {exportState === 'error' ? (
          <p className="error-copy">The export failed. Try again.</p>
        ) : null}
      </article>

      <article className="settings-card">
        <div className="settings-copy">
          <h3>Reset current session</h3>
          <p>
            Clears only the foods in the current session. Your remembered foods and their total
            save counts remain stored and continue to drive autocomplete ranking.
          </p>
        </div>

        <button
          className="ghost-button destructive-action"
          type="button"
          onClick={onResetSession}
          disabled={sessionCount === 0}
        >
          Clear current session
        </button>

        <p className="settings-note">
          Current session items: {sessionCount}. Food memory is preserved.
        </p>
      </article>
    </section>
  );
}
