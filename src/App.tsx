import { useEffect, useMemo, useState } from 'react';
import { CreateEntryModal } from './components/CreateEntryModal';
import { EditEntryModal } from './components/EditEntryModal';
import { ExportPanel } from './components/ExportPanel';
import { FoodLibrary } from './components/FoodLibrary';
import { BookIcon, BoltIcon, ExportIcon, HistoryIcon, LogIcon, SettingsIcon } from './components/Icons';
import { SettingsPanel } from './components/SettingsPanel';
import { SessionList } from './components/SessionList';
import { downloadFoodMemoryBackup } from './lib/backup';
import { clearRefreshQueryParam, forceFreshAppLoad } from './lib/pwa';
import { formatExport, formatExportWithLeadIn } from './lib/export';
import { defaultAppState, loadAppState, saveAppState } from './lib/storage';
import type {
  EntryPayload,
  ExportFormat,
  FoodProfile,
  SessionEntry
} from './lib/types';
import { createId, isEntryDeleted, normalizeText, nowIso } from './lib/utils';

function normalizeLoadedEntries(entries: SessionEntry[]) {
  return entries.map((entry) => {
    if (!entry.undoExpiresAt) {
      return entry;
    }

    const nextEntry = { ...entry };
    delete nextEntry.undoExpiresAt;
    return nextEntry;
  });
}

function learnFood(foods: FoodProfile[], payload: EntryPayload, countAsSave: boolean) {
  const normalizedName = normalizeText(payload.foodName);
  const timestamp = nowIso();
  const existingFood = foods.find((food) => food.normalizedName === normalizedName);

  if (existingFood) {
    const nextFoods = foods.map((food) =>
      food.id === existingFood.id
        ? {
            ...food,
            name: payload.foodName,
            normalizedName,
            usageCount: countAsSave ? food.usageCount + 1 : food.usageCount,
            lastUsedAt: countAsSave ? timestamp : food.lastUsedAt,
            lastUnit: payload.unit
          }
        : food
    );

    return {
      foodId: existingFood.id,
      foods: nextFoods
    };
  }

  const nextFood: FoodProfile = {
    id: createId(),
    name: payload.foodName,
    normalizedName,
    usageCount: countAsSave ? 1 : 0,
    lastUsedAt: timestamp,
    createdAt: timestamp,
    isFavorite: false,
    lastUnit: payload.unit
  };

  return {
    foodId: nextFood.id,
    foods: [nextFood, ...foods]
  };
}

export default function App() {
  const [foods, setFoods] = useState<FoodProfile[]>(defaultAppState.foods);
  const [entries, setEntries] = useState<SessionEntry[]>(defaultAppState.currentSession);
  const [exportFormat, setExportFormat] = useState<ExportFormat>(defaultAppState.exportFormat);
  const [exportLeadIn, setExportLeadIn] = useState(defaultAppState.exportLeadIn);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [isHydrated, setIsHydrated] = useState(false);
  const [exportBackupState, setExportBackupState] = useState<'idle' | 'done' | 'error'>('idle');
  const [refreshState, setRefreshState] = useState<'idle' | 'working' | 'error'>('idle');
  const [activeTab, setActiveTab] = useState<'log' | 'history' | 'library' | 'export' | 'settings'>('log');
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  useEffect(() => {
    clearRefreshQueryParam();
    const state = loadAppState();
    setFoods(state.foods);
    setEntries(normalizeLoadedEntries(state.currentSession));
    setExportFormat(state.exportFormat);
    setExportLeadIn(state.exportLeadIn);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    saveAppState({
      version: 1,
      foods,
      currentSession: entries,
      exportFormat,
      exportLeadIn
    });
  }, [foods, entries, exportFormat, exportLeadIn, isHydrated]);

  const editingEntry = useMemo(
    () => entries.find((entry) => entry.id === editingEntryId) ?? null,
    [entries, editingEntryId]
  );

  const activeEntries = useMemo(
    () => entries.filter((entry) => !isEntryDeleted(entry)),
    [entries]
  );

  const logEntries = useMemo(
    () => entries.filter((entry) => !isEntryDeleted(entry)),
    [entries]
  );

  const exportText = useMemo(
    () => formatExportWithLeadIn(exportLeadIn, formatExport(activeEntries, exportFormat)),
    [activeEntries, exportFormat, exportLeadIn]
  );

  useEffect(() => {
    if (activeTab !== 'log' && isComposerOpen) {
      setIsComposerOpen(false);
    }
  }, [activeTab, isComposerOpen]);

  function commitEntry(payload: EntryPayload, targetEntryId: string | null) {
    const learning = learnFood(foods, payload, targetEntryId == null);
    const timestamp = nowIso();

    setFoods(learning.foods);
    setEntries((currentEntries) => {
      if (targetEntryId) {
        return currentEntries.map((entry) =>
          entry.id === targetEntryId
            ? {
                ...entry,
                foodId: learning.foodId,
                foodName: payload.foodName,
                mode: payload.mode,
                amount: payload.amount,
                unit: payload.unit,
                beforeWeight: payload.beforeWeight,
                afterWeight: payload.afterWeight,
                needsAfterWeight: payload.needsAfterWeight,
                note: payload.note,
                updatedAt: timestamp
              }
            : entry
        );
      }

      const nextEntry: SessionEntry = {
        id: createId(),
        foodId: learning.foodId,
        foodName: payload.foodName,
        mode: payload.mode,
        amount: payload.amount,
        unit: payload.unit,
        beforeWeight: payload.beforeWeight,
        afterWeight: payload.afterWeight,
        needsAfterWeight: payload.needsAfterWeight,
        note: payload.note,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      return [nextEntry, ...currentEntries];
    });
    setEditingEntryId(null);
    setCopyState('idle');
  }

  function handleSaveEntry(payload: EntryPayload) {
    commitEntry(payload, null);
    setIsComposerOpen(false);
  }

  function handleUpdateEntry(payload: EntryPayload) {
    if (!editingEntryId) {
      return;
    }

    commitEntry(payload, editingEntryId);
  }

  function handleDelete(entryId: string) {
    const timestamp = nowIso();

    setEntries((currentEntries) =>
      currentEntries.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              deletedAt: timestamp,
              undoExpiresAt: undefined,
              updatedAt: timestamp
            }
          : entry
      )
    );
    if (editingEntryId === entryId) {
      setEditingEntryId(null);
    }
    setCopyState('idle');
  }

  function handleRestore(entryId: string) {
    const timestamp = nowIso();

    setEntries((currentEntries) =>
      currentEntries.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              deletedAt: undefined,
              undoExpiresAt: undefined,
              updatedAt: timestamp
            }
          : entry
      )
    );
    setCopyState('idle');
  }

  function handleRenameFood(foodId: string, nextName: string) {
    const trimmedName = nextName.trim();
    const normalizedName = normalizeText(trimmedName);

    if (!trimmedName) {
      return false;
    }

    const conflict = foods.find(
      (food) => food.id !== foodId && food.normalizedName === normalizedName
    );
    if (conflict) {
      return false;
    }

    setFoods((currentFoods) =>
      currentFoods.map((food) =>
        food.id === foodId
          ? {
              ...food,
              name: trimmedName,
              normalizedName
            }
          : food
      )
    );

    setEntries((currentEntries) =>
      currentEntries.map((entry) =>
        entry.foodId === foodId
          ? {
              ...entry,
              foodName: trimmedName,
              updatedAt: nowIso()
            }
          : entry
      )
    );

    return true;
  }

  async function handleCopy() {
    if (!exportText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(exportText);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1800);
    } catch {
      setCopyState('error');
    }
  }

  function handleExportFoodMemory() {
    try {
      downloadFoodMemoryBackup(foods, {
        exportFormat,
        exportLeadIn
      });
      setExportBackupState('done');
      window.setTimeout(() => setExportBackupState('idle'), 1800);
    } catch {
      setExportBackupState('error');
    }
  }

  function handleResetSession() {
    setEntries([]);
    setEditingEntryId(null);
    setCopyState('idle');
  }

  function startEditing(entryId: string) {
    setIsComposerOpen(false);
    setEditingEntryId(entryId);
  }

  async function handleForceRefresh() {
    try {
      setRefreshState('working');
      await forceFreshAppLoad();
    } catch {
      setRefreshState('error');
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-markup">
          <span className="brand-icon">
            <BoltIcon className="brand-bolt" />
          </span>
          <strong>QuickLog</strong>
        </div>
        <button
          className="top-icon-button"
          type="button"
          onClick={() => setActiveTab('settings')}
          aria-label="Open settings"
        >
          <SettingsIcon className="ui-icon" />
        </button>
      </header>

      {activeTab === 'log' ? (
        <section className="screen-section muted-section screen-section-log">
          <SessionList
            mode="log"
            entries={logEntries}
            editingEntryId={editingEntryId}
            onEdit={startEditing}
            onDelete={handleDelete}
            onRestore={handleRestore}
          />
        </section>
      ) : null}

      {activeTab === 'history' ? (
        <section className="screen-section muted-section">
          <SessionList
            entries={entries}
            mode="history"
            editingEntryId={editingEntryId}
            onEdit={startEditing}
            onDelete={handleDelete}
            onRestore={handleRestore}
          />
        </section>
      ) : null}

      {activeTab === 'library' ? (
        <section className="screen-section">
          <FoodLibrary
            foods={foods}
            onToggleFavorite={(foodId) => {
              setFoods((currentFoods) =>
                currentFoods.map((food) =>
                  food.id === foodId
                    ? {
                        ...food,
                        isFavorite: !food.isFavorite
                      }
                    : food
                )
              );
            }}
            onRenameFood={handleRenameFood}
            onDeleteFood={(foodId) => {
              setFoods((currentFoods) => currentFoods.filter((food) => food.id !== foodId));
            }}
          />
        </section>
      ) : null}

      {activeTab === 'export' ? (
        <section className="screen-section">
          <ExportPanel
            exportFormat={exportFormat}
            exportText={exportText}
            copyState={copyState}
            sessionCount={activeEntries.length}
            onChangeFormat={(format) => {
              setExportFormat(format);
              setCopyState('idle');
            }}
            onCopy={handleCopy}
            onResetSession={handleResetSession}
          />
        </section>
      ) : null}

      {activeTab === 'settings' ? (
        <section className="screen-section">
          <SettingsPanel
            foodCount={foods.length}
            sessionCount={activeEntries.length}
            exportState={exportBackupState}
            exportLeadIn={exportLeadIn}
            refreshState={refreshState}
            onExportFoodMemory={handleExportFoodMemory}
            onChangeExportLeadIn={(value) => {
              setExportLeadIn(value);
              setCopyState('idle');
            }}
            onForceRefresh={handleForceRefresh}
          />
        </section>
      ) : null}

      <nav className="bottom-nav" aria-label="Primary">
        <button
          className={`bottom-nav-item${activeTab === 'log' ? ' active' : ''}`}
          type="button"
          onClick={() => setActiveTab('log')}
        >
          <LogIcon className="ui-icon" />
          <span>Log</span>
        </button>
        <button
          className={`bottom-nav-item${activeTab === 'history' ? ' active' : ''}`}
          type="button"
          onClick={() => setActiveTab('history')}
        >
          <HistoryIcon className="ui-icon" />
          <span>History</span>
        </button>
        <button
          className={`bottom-nav-item${activeTab === 'library' ? ' active' : ''}`}
          type="button"
          onClick={() => setActiveTab('library')}
        >
          <BookIcon className="ui-icon" />
          <span>Library</span>
        </button>
        <button
          className={`bottom-nav-item${activeTab === 'export' ? ' active' : ''}`}
          type="button"
          onClick={() => setActiveTab('export')}
        >
          <ExportIcon className="ui-icon" />
          <span>Export</span>
        </button>
      </nav>

      {activeTab === 'log' && !isComposerOpen ? (
        <div className="fab-anchor">
          <div className="fab-inner">
            <button
              className="floating-compose-button"
              type="button"
              onClick={() => setIsComposerOpen(true)}
              aria-label="Add a new log entry"
            >
              +
            </button>
          </div>
        </div>
      ) : null}

      {isComposerOpen ? (
        <CreateEntryModal
          foods={foods}
          onCancel={() => setIsComposerOpen(false)}
          onSave={handleSaveEntry}
        />
      ) : null}

      {editingEntry ? (
        <EditEntryModal
          foods={foods}
          entry={editingEntry}
          onCancel={() => setEditingEntryId(null)}
          onSave={handleUpdateEntry}
        />
      ) : null}
    </main>
  );
}
