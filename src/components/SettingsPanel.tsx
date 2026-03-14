import { BoltIcon, ExportIcon, SettingsIcon } from './Icons';

interface SettingsPanelProps {
  foodCount: number;
  sessionCount: number;
  exportState: 'idle' | 'done' | 'error';
  refreshState: 'idle' | 'working' | 'error';
  onExportFoodMemory: () => void;
  onForceRefresh: () => Promise<void>;
}

export function SettingsPanel({
  foodCount,
  sessionCount,
  exportState,
  refreshState,
  onExportFoodMemory,
  onForceRefresh
}: SettingsPanelProps) {
  return (
    <section className="panel settings-panel">
      <div className="settings-hero">
        <div className="settings-hero-copy">
          <p className="section-kicker">Settings</p>
          <h2>Preferences</h2>
          <p className="settings-hero-note">
            A quieter, local-first setup for managing your app, data, and recovery actions.
          </p>
        </div>

        <article className="settings-profile-card" aria-label="App profile">
          <div className="settings-profile-main">
            <span className="settings-profile-icon">
              <BoltIcon className="ui-icon" />
            </span>

            <div>
              <h3>QuickLog</h3>
              <p>Local profile with on-device food memory and session data.</p>
            </div>
          </div>

          <div className="settings-profile-stats" aria-label="App stats">
            <div>
              <span>Foods</span>
              <strong>{foodCount}</strong>
            </div>
            <div>
              <span>Session</span>
              <strong>{sessionCount}</strong>
            </div>
          </div>
        </article>
      </div>

      <section className="settings-section" aria-labelledby="settings-profile-title">
        <div className="settings-section-header">
          <p id="settings-profile-title" className="settings-section-title">
            Profile
          </p>
          <p className="settings-section-caption">Profile and device status</p>
        </div>

        <div className="settings-list">
          <div className="settings-row">
            <div className="settings-row-copy">
              <h3>Profile type</h3>
              <p>This app currently runs as a local profile without cloud sync.</p>
            </div>
            <div className="settings-row-value">
              <span className="settings-pill">On device</span>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-copy">
              <h3>App status</h3>
              <p>Your remembered foods and current session stay available offline.</p>
            </div>
            <div className="settings-row-value settings-row-value-strong">Active</div>
          </div>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="settings-privacy-title">
        <div className="settings-section-header">
          <p id="settings-privacy-title" className="settings-section-title">
            Privacy
          </p>
          <p className="settings-section-caption">How data is handled</p>
        </div>

        <div className="settings-list">
          <div className="settings-row">
            <div className="settings-row-copy">
              <h3>Data storage</h3>
              <p>Foods, save counts, and the current session are stored locally in the browser.</p>
            </div>
            <div className="settings-row-value settings-row-value-strong">Local only</div>
          </div>

          <div className="settings-row">
            <div className="settings-row-copy">
              <h3>Remembered foods</h3>
              <p>Autocomplete ranking uses your saved food memory and preference history.</p>
            </div>
            <div className="settings-row-value">{foodCount}</div>
          </div>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="settings-backup-title">
        <div className="settings-section-header">
          <p id="settings-backup-title" className="settings-section-title">
            Data & backup
          </p>
          <p className="settings-section-caption">Export and recovery actions</p>
        </div>

        <div className="settings-list">
          <div className="settings-row settings-row-action">
            <div className="settings-row-copy">
              <h3>Export food memory backup</h3>
              <p>Downloads remembered foods with save counts and preference data.</p>
            </div>
            <div className="settings-row-control">
              <button
                className="ghost-button settings-inline-button"
                type="button"
                onClick={onExportFoodMemory}
                disabled={foodCount === 0}
              >
                <ExportIcon className="settings-inline-icon" />
                Export
              </button>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-copy">
              <h3>Current session entries</h3>
              <p>Session items are separate from remembered foods and excluded from backups.</p>
            </div>
            <div className="settings-row-value">{sessionCount}</div>
          </div>
        </div>

        <p className={`settings-feedback${exportState === 'error' ? ' is-error' : ''}`}>
          {exportState === 'done'
            ? 'Backup downloaded successfully.'
            : exportState === 'error'
              ? 'Backup export failed. Try again.'
              : `Available for ${foodCount} remembered food${foodCount === 1 ? '' : 's'}.`}
        </p>
      </section>

      <section className="settings-section" aria-labelledby="settings-maintenance-title">
        <div className="settings-section-header">
          <p id="settings-maintenance-title" className="settings-section-title">
            Maintenance
          </p>
          <p className="settings-section-caption">App refresh and repair</p>
        </div>

        <div className="settings-list">
          <div className="settings-row settings-row-action">
            <div className="settings-row-copy">
              <h3>Force full app refresh</h3>
              <p>Clears caches, unregisters service workers, and reloads the latest app shell.</p>
            </div>
            <div className="settings-row-control">
              <button
                className="ghost-button settings-inline-button"
                type="button"
                onClick={() => void onForceRefresh()}
                disabled={refreshState === 'working'}
              >
                <SettingsIcon className="settings-inline-icon" />
                {refreshState === 'working' ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>

        <p className={`settings-feedback${refreshState === 'error' ? ' is-error' : ''}`}>
          {refreshState === 'error'
            ? 'The forced refresh failed. Try again.'
            : 'Use this when the installed app still shows an older deployment.'}
        </p>
      </section>
    </section>
  );
}
