import { useEffect, useMemo, useState } from 'react';
import { EntryComposer } from './components/EntryComposer';
import { ExportPanel } from './components/ExportPanel';
import { FoodLibrary } from './components/FoodLibrary';
import { SessionList } from './components/SessionList';
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

  useEffect(() => {
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

  function handleDuplicate(entryId: string) {
    const source = entries.find((entry) => entry.id === entryId);
    if (!source) {
      return;
    }

    commitEntry(
      {
        foodName: source.foodName,
        mode: source.mode,
        amount: source.amount,
        unit: source.unit,
        beforeWeight: source.beforeWeight,
        afterWeight: source.afterWeight,
        note: source.note
      },
      null
    );
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

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">FoodSnap</p>
          <h1>Fast manual food logging for later AI macros.</h1>
          <p className="hero-text">
            Capture foods, grams, or before-and-after differences without a nutrition database.
          </p>
        </div>
        <div className="hero-metrics">
          <div className="metric-card">
            <span>Session</span>
            <strong>{entries.length}</strong>
          </div>
          <div className="metric-card">
            <span>Remembered</span>
            <strong>{foods.length}</strong>
          </div>
        </div>
      </section>

      <EntryComposer
        foods={foods}
        editingEntry={editingEntry}
        onSave={handleSaveEntry}
        onCancelEdit={() => setEditingEntryId(null)}
      />

      <div className="content-grid">
        <SessionList
          entries={entries}
          editingEntryId={editingEntryId}
          onEdit={setEditingEntryId}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
        />

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
      </div>
    </main>
  );
}
