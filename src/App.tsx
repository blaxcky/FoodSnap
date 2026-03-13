import { useEffect, useMemo, useState } from 'react';
import { EntryComposer } from './components/EntryComposer';
import { ExportPanel } from './components/ExportPanel';
import { FoodLibrary } from './components/FoodLibrary';
import { BookIcon, BoltIcon, ExportIcon, HistoryIcon, LogIcon, SettingsIcon } from './components/Icons';
import { SettingsPanel } from './components/SettingsPanel';
import { SessionList } from './components/SessionList';
import { clearRefreshQueryParam, forceFreshAppLoad } from './lib/pwa';
import { formatExport } from './lib/export';
import { defaultAppState, loadAppState, saveAppState } from './lib/storage';
import type {
  EntryPayload,
  ExportFormat,
  FoodProfile,
  SessionEntry
} from './lib/types';
import { createId, normalizeText, nowIso } from './lib/utils';

function learnFood(foods: FoodProfile[], payload: EntryPayload) {
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
            usageCount: food.usageCount + 1,
            lastUsedAt: timestamp,
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
    usageCount: 1,
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
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [isHydrated, setIsHydrated] = useState(false);
  const [refreshState, setRefreshState] = useState<'idle' | 'working' | 'error'>('idle');
  const [activeTab, setActiveTab] = useState<'log' | 'history' | 'library' | 'export' | 'settings'>('log');

  useEffect(() => {
    clearRefreshQueryParam();
    const state = loadAppState();
    setFoods(state.foods);
    setEntries(state.currentSession);
    setExportFormat(state.exportFormat);
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
      exportFormat
    });
  }, [foods, entries, exportFormat, isHydrated]);

  const editingEntry = useMemo(
    () => entries.find((entry) => entry.id === editingEntryId) ?? null,
    [entries, editingEntryId]
  );

  const exportText = useMemo(
    () => formatExport(entries, exportFormat),
    [entries, exportFormat]
  );

  function commitEntry(payload: EntryPayload, targetEntryId: string | null) {
    const learning = learnFood(foods, payload);
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
    commitEntry(payload, editingEntryId);
  }

  function handleDelete(entryId: string) {
    setEntries((currentEntries) => currentEntries.filter((entry) => entry.id !== entryId));
    if (editingEntryId === entryId) {
      setEditingEntryId(null);
    }
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

  function startEditing(entryId: string) {
    setEditingEntryId(entryId);
    setActiveTab('log');
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
        <>
          <section className="screen-section">
            <EntryComposer
              foods={foods}
              editingEntry={editingEntry}
              onSave={handleSaveEntry}
              onCancelEdit={() => setEditingEntryId(null)}
            />
          </section>

          <section className="screen-section muted-section">
            <SessionList
              entries={entries}
              editingEntryId={editingEntryId}
              onEdit={startEditing}
              onDelete={handleDelete}
            />
          </section>
        </>
      ) : null}

      {activeTab === 'history' ? (
        <section className="screen-section muted-section">
          <SessionList
            entries={entries}
            editingEntryId={editingEntryId}
            onEdit={startEditing}
            onDelete={handleDelete}
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
          />
        </section>
      ) : null}

      {activeTab === 'export' ? (
        <section className="screen-section">
          <ExportPanel
            exportFormat={exportFormat}
            exportText={exportText}
            copyState={copyState}
            onChangeFormat={(format) => {
              setExportFormat(format);
              setCopyState('idle');
            }}
            onCopy={handleCopy}
          />
        </section>
      ) : null}

      {activeTab === 'settings' ? (
        <section className="screen-section">
          <SettingsPanel
            refreshState={refreshState}
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
    </main>
  );
}
