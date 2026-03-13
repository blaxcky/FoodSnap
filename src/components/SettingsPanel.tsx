interface SettingsPanelProps {
  refreshState: 'idle' | 'working' | 'error';
  onForceRefresh: () => Promise<void>;
}

export function SettingsPanel({
  refreshState,
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
    </section>
  );
}
