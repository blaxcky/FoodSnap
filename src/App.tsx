import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { CreateEntryModal } from './components/CreateEntryModal';
import { CameraCaptureModal } from './components/CameraCaptureModal';
import { EditEntryModal } from './components/EditEntryModal';
import { AggregateNoteModal } from './components/AggregateNoteModal';
import { ExportPanel } from './components/ExportPanel';
import { FoodLibrary } from './components/FoodLibrary';
import { BookIcon, CameraIcon, ExportIcon, HistoryIcon, LogIcon, PhotoIcon, SettingsIcon, BoltIcon } from './components/Icons';
import { PhotoPanel } from './components/PhotoPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { SessionList } from './components/SessionList';
import {
  downloadFoodMemoryBackup,
  importFoodMemoryBackup,
  parseFoodMemoryBackup,
  type FoodImportMode
} from './lib/backup';
import {
  loadCameraPreference,
  saveCameraPreference,
  type CameraPreference
} from './lib/cameraPreference';
import {
  deletePhotoBlob,
  deletePhotoBlobs,
  preparePhotoBlob,
  savePhotoBlob
} from './lib/photoStorage';
import {
  choosePhotoDirectory,
  getPhotoDirectoryPermission,
  getSavedPhotoDirectory,
  isPhotoFolderImportSupported,
  scanPhotoDirectory,
  type PhotoFolderStatus
} from './lib/photoFolderImport';
import {
  loadPhotoSizeReduction,
  savePhotoSizeReduction
} from './lib/photoSizePreference';
import { loadAutoPhotoSize, saveAutoPhotoSize } from './lib/autoPhotoSizePreference';
import { formatExport, formatExportWithLeadIn } from './lib/export';
import { clearRefreshQueryParam, consumeLaunchAction, forceFreshAppLoad } from './lib/pwa';
import {
  getAggregatedSessionListItems,
  getCombinedSessionEntryNote,
  updateSessionEntryNotes
} from './lib/sessionAggregation';
import {
  archiveEntriesAsExport,
  archiveEntriesManually,
  restoreEntries
} from './lib/sessionArchive';
import { defaultAppState, loadAppState, saveAppState } from './lib/storage';
import { applyTheme, listenForSystemThemeChange, loadThemePreference, saveThemePreference } from './lib/theme';
import type { ThemePreference } from './lib/theme';
import type {
  EntryPayload,
  FoodProfile,
  NutritionScope,
  PhotoItem,
  SessionEntry
} from './lib/types';
import {
  applyNutritionDefaults,
  createId,
  isEntryDeleted,
  mergeDefinedNutrition,
  pickNutritionFields,
  normalizeText,
  nowIso
} from './lib/utils';

type AppTab = 'log' | 'history' | 'photos' | 'library' | 'export' | 'settings';

interface CommitEntryOptions {
  forceEntryId?: string;
  sourcePhotoId?: string;
}

function normalizeLoadedEntries(entries: SessionEntry[]) {
  return entries.map((entry) => {
    const nextEntry = {
      ...entry,
      ...pickNutritionFields(entry)
    };

    if (nextEntry.undoExpiresAt) {
      delete nextEntry.undoExpiresAt;
    }

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
        ? mergeDefinedNutrition(
            {
              ...food,
              name: payload.foodName,
              normalizedName,
              usageCount: countAsSave ? food.usageCount + 1 : food.usageCount,
              lastUsedAt: countAsSave ? timestamp : food.lastUsedAt,
              lastUnit: payload.unit
            },
            payload
          )
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
    lastUnit: payload.unit,
    calories: payload.calories,
    carbs: payload.carbs,
    fat: payload.fat,
    protein: payload.protein,
    nutritionScope: payload.nutritionScope
  };

  return {
    foodId: nextFood.id,
    foods: [nextFood, ...foods]
  };
}

function isPhotoCompatiblePayload(payload: EntryPayload) {
  return (
    payload.mode === 'direct' &&
    payload.unit === 'g' &&
    payload.beforeWeight == null &&
    payload.afterWeight == null &&
    !payload.needsAfterWeight
  );
}

function makePhotoEntryPayload(foodName: string, weightGrams: number): EntryPayload {
  return {
    foodName,
    mode: 'direct',
    amount: weightGrams,
    unit: 'g',
    note: ''
  };
}

export default function App() {
  const [foods, setFoods] = useState<FoodProfile[]>(defaultAppState.foods);
  const [entries, setEntries] = useState<SessionEntry[]>(defaultAppState.currentSession);
  const [photoItems, setPhotoItems] = useState<PhotoItem[]>(defaultAppState.photoItems);
  const [exportLeadIn, setExportLeadIn] = useState(defaultAppState.exportLeadIn);
  const [isLogAggregated, setIsLogAggregated] = useState(defaultAppState.isLogAggregated);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingAggregateEntryIds, setEditingAggregateEntryIds] = useState<string[] | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [isHydrated, setIsHydrated] = useState(false);
  const [exportBackupState, setExportBackupState] = useState<'idle' | 'done' | 'error'>('idle');
  const [importBackupState, setImportBackupState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [importBackupMessage, setImportBackupMessage] = useState('');
  const [refreshState, setRefreshState] = useState<'idle' | 'working' | 'error'>('idle');
  const [activeTab, setActiveTab] = useState<AppTab>('log');
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [themePreference, setThemePreference] = useState<ThemePreference>(loadThemePreference);
  const [cameraPreference, setCameraPreference] = useState<CameraPreference>(loadCameraPreference);
  const [photoSizeReduction, setPhotoSizeReduction] = useState(loadPhotoSizeReduction);
  const [autoPhotoSize, setAutoPhotoSize] = useState(loadAutoPhotoSize);
  const [activePhotoFilter, setActivePhotoFilter] = useState<'pending' | 'archived'>('pending');
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [photoFeedbackMessage, setPhotoFeedbackMessage] = useState('');
  const [photoFeedbackTone, setPhotoFeedbackTone] = useState<'idle' | 'error'>('idle');
  const [photoActionState, setPhotoActionState] = useState<'idle' | 'working'>('idle');
  const [photoFolderState, setPhotoFolderState] = useState<{
    name: string | null;
    status: PhotoFolderStatus;
    importedCount: number;
    message: string;
  }>(() => ({
    name: null,
    status: isPhotoFolderImportSupported() ? 'loading' : 'unsupported',
    importedCount: 0,
    message: ''
  }));
  const [isDirectCameraOpen, setIsDirectCameraOpen] = useState(false);
  const [launchAction, setLaunchAction] = useState<'photo' | null>(null);
  const dialogHistoryActiveRef = useRef(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const photoFolderScanRef = useRef<Promise<void> | null>(null);
  const photoFolderRefreshRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    setLaunchAction(consumeLaunchAction());
    clearRefreshQueryParam();
    const state = loadAppState();
    setFoods(state.foods);
    setEntries(normalizeLoadedEntries(state.currentSession));
    setPhotoItems(state.photoItems);
    setExportLeadIn(state.exportLeadIn);
    setIsLogAggregated(state.isLogAggregated);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    saveAppState({
      version: 4,
      foods,
      currentSession: entries,
      photoItems,
      exportLeadIn,
      isLogAggregated
    });
  }, [foods, entries, photoItems, exportLeadIn, isLogAggregated, isHydrated]);

  useEffect(() => {
    applyTheme(themePreference);
    saveThemePreference(themePreference);
    return listenForSystemThemeChange(themePreference, () => applyTheme(themePreference));
  }, [themePreference]);

  useEffect(() => {
    saveCameraPreference(cameraPreference);
  }, [cameraPreference]);

  useEffect(() => {
    savePhotoSizeReduction(photoSizeReduction);
  }, [photoSizeReduction]);

  useEffect(() => {
    saveAutoPhotoSize(autoPhotoSize);
  }, [autoPhotoSize]);

  useEffect(() => {
    if (!isHydrated || launchAction !== 'photo') {
      return;
    }

    setIsComposerOpen(false);
    setEditingEntryId(null);
    setActiveTab('photos');
    setActivePhotoFilter('pending');
    setSelectedPhotoId(null);
    resetPhotoFeedback();

    if (cameraPreference === 'direct') {
      setIsDirectCameraOpen(true);
    } else {
      setPhotoFeedbackMessage('Photo shortcut opened. Tap Take photo to continue.');
    }

    setLaunchAction(null);
  }, [cameraPreference, isHydrated, launchAction]);

  const editingEntry = useMemo(
    () => entries.find((entry) => entry.id === editingEntryId) ?? null,
    [entries, editingEntryId]
  );

  const editingAggregateEntries = useMemo(() => {
    if (!editingAggregateEntryIds) {
      return [];
    }

    const targetIds = new Set(editingAggregateEntryIds);
    return entries.filter((entry) => targetIds.has(entry.id) && !isEntryDeleted(entry));
  }, [editingAggregateEntryIds, entries]);

  const activeEntries = useMemo(
    () => entries.filter((entry) => !isEntryDeleted(entry)),
    [entries]
  );
  const sessionEntryCount = entries.length;

  const logEntries = useMemo(
    () => entries.filter((entry) => !isEntryDeleted(entry)),
    [entries]
  );

  const logListItems = useMemo(
    () => (isLogAggregated ? getAggregatedSessionListItems(logEntries) : undefined),
    [isLogAggregated, logEntries]
  );

  const pendingPhotos = useMemo(
    () =>
      [...photoItems]
        .filter((photo) => photo.status === 'pending')
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    [photoItems]
  );

  const archivedPhotos = useMemo(
    () =>
      [...photoItems]
        .filter((photo) => photo.status === 'archived')
        .sort((left, right) => (right.completedAt ?? right.updatedAt).localeCompare(left.completedAt ?? left.updatedAt)),
    [photoItems]
  );

  const selectedPhoto = useMemo(
    () => photoItems.find((photo) => photo.id === selectedPhotoId) ?? null,
    [photoItems, selectedPhotoId]
  );
  const isPhotoDetailActive = activeTab === 'photos' && selectedPhoto != null;

  const exportText = useMemo(
    () => formatExportWithLeadIn(exportLeadIn, formatExport(activeEntries)),
    [activeEntries, exportLeadIn]
  );

  const visibleExportText = useMemo(
    () => formatExport(activeEntries),
    [activeEntries]
  );

  const isInputDialogOpen =
    isComposerOpen || editingEntryId != null || editingAggregateEntryIds != null;

  useEffect(() => {
    if (!selectedPhotoId) {
      return;
    }

    const exists = photoItems.some((photo) => photo.id === selectedPhotoId);
    if (!exists) {
      setSelectedPhotoId(null);
    }
  }, [photoItems, selectedPhotoId]);

  useEffect(() => {
    if (activeTab !== 'log' && isComposerOpen) {
      setIsComposerOpen(false);
    }
  }, [activeTab, isComposerOpen]);

  useEffect(() => {
    if (!isHydrated || activeTab !== 'photos' || !isPhotoFolderImportSupported()) {
      return;
    }

    void refreshSavedPhotoFolder();
  }, [activeTab, isHydrated]);

  useEffect(() => {
    if (!isInputDialogOpen) {
      return;
    }

    const handlePopState = () => {
      if (!dialogHistoryActiveRef.current) {
        return;
      }

      dialogHistoryActiveRef.current = false;
      setIsComposerOpen(false);
      setEditingEntryId(null);
      setEditingAggregateEntryIds(null);
    };

    dialogHistoryActiveRef.current = true;
    window.history.pushState({ quickLogDialog: true }, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isInputDialogOpen]);

  function resetPhotoFeedback() {
    setPhotoFeedbackMessage('');
    setPhotoFeedbackTone('idle');
  }

  function openSystemCamera() {
    cameraInputRef.current?.click();
  }

  function handleOpenCamera() {
    resetPhotoFeedback();

    if (cameraPreference === 'direct') {
      setIsDirectCameraOpen(true);
      return;
    }

    openSystemCamera();
  }

  function closeInputDialog() {
    const shouldConsumeHistory = dialogHistoryActiveRef.current;

    setIsComposerOpen(false);
    setEditingEntryId(null);
    setEditingAggregateEntryIds(null);

    if (shouldConsumeHistory) {
      dialogHistoryActiveRef.current = false;
      window.history.back();
    }
  }

  function commitEntry(payload: EntryPayload, targetEntryId: string | null, options: CommitEntryOptions = {}) {
    const rememberedFood = foods.find(
      (food) => food.normalizedName === normalizeText(payload.foodName)
    );
    const resolvedPayload = applyNutritionDefaults(payload, rememberedFood);
    const learning = learnFood(foods, resolvedPayload, targetEntryId == null);
    const timestamp = nowIso();
    const existingEntry = targetEntryId
      ? entries.find((entry) => entry.id === targetEntryId) ?? null
      : null;
    const keepLinkedPhoto = Boolean(
      existingEntry?.sourcePhotoId && isPhotoCompatiblePayload(resolvedPayload)
    );

    setFoods(learning.foods);
    setEntries((currentEntries) => {
      if (targetEntryId && existingEntry) {
        return currentEntries.map((entry) =>
          entry.id === targetEntryId
            ? {
                ...entry,
                foodId: learning.foodId,
                foodName: resolvedPayload.foodName,
                sourcePhotoId: keepLinkedPhoto ? existingEntry.sourcePhotoId : undefined,
                mode: resolvedPayload.mode,
                amount: resolvedPayload.amount,
                unit: resolvedPayload.unit,
                beforeWeight: resolvedPayload.beforeWeight,
                afterWeight: resolvedPayload.afterWeight,
                needsAfterWeight: resolvedPayload.needsAfterWeight,
                note: resolvedPayload.note,
                calories: resolvedPayload.calories,
                carbs: resolvedPayload.carbs,
                fat: resolvedPayload.fat,
                protein: resolvedPayload.protein,
                nutritionScope: resolvedPayload.nutritionScope,
                updatedAt: timestamp
              }
            : entry
        );
      }

      const nextEntry: SessionEntry = {
        id: options.forceEntryId ?? createId(),
        foodId: learning.foodId,
        foodName: resolvedPayload.foodName,
        sourcePhotoId: options.sourcePhotoId,
        mode: resolvedPayload.mode,
        amount: resolvedPayload.amount,
        unit: resolvedPayload.unit,
        beforeWeight: resolvedPayload.beforeWeight,
        afterWeight: resolvedPayload.afterWeight,
        needsAfterWeight: resolvedPayload.needsAfterWeight,
        note: resolvedPayload.note,
        calories: resolvedPayload.calories,
        carbs: resolvedPayload.carbs,
        fat: resolvedPayload.fat,
        protein: resolvedPayload.protein,
        nutritionScope: resolvedPayload.nutritionScope,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      return [nextEntry, ...currentEntries];
    });

    if (targetEntryId && existingEntry?.sourcePhotoId) {
      setPhotoItems((currentPhotos) =>
        currentPhotos.map((photo) => {
          if (photo.id !== existingEntry.sourcePhotoId) {
            return photo;
          }

          if (!keepLinkedPhoto) {
            return {
              ...photo,
              linkedEntryId: undefined,
              updatedAt: timestamp
            };
          }

          return {
            ...photo,
            foodName: resolvedPayload.foodName,
            weightGrams: resolvedPayload.amount,
            linkedEntryId: targetEntryId,
            updatedAt: timestamp
          };
        })
      );
    }

    setCopyState('idle');
  }

  function handleSaveEntry(payload: EntryPayload) {
    commitEntry(payload, null);
    closeInputDialog();
  }

  function handleUpdateEntry(payload: EntryPayload) {
    if (!editingEntryId) {
      return;
    }

    commitEntry(payload, editingEntryId);
    closeInputDialog();
  }

  function handleDelete(entryId: string) {
    const timestamp = nowIso();

    setEntries((currentEntries) => archiveEntriesManually(currentEntries, [entryId], timestamp));
    if (editingEntryId === entryId) {
      closeInputDialog();
    }
    setCopyState('idle');
  }

  function handleDeleteMany(entryIds: string[]) {
    const timestamp = nowIso();
    const targetEntryIds = new Set(entryIds);

    setEntries((currentEntries) =>
      archiveEntriesManually(currentEntries, targetEntryIds, timestamp)
    );
    if (editingEntryId && targetEntryIds.has(editingEntryId)) {
      closeInputDialog();
    }
    setCopyState('idle');
  }

  function handleRestore(entryId: string) {
    const timestamp = nowIso();

    setEntries((currentEntries) => restoreEntries(currentEntries, [entryId], timestamp));
    setCopyState('idle');
  }

  function handleRestoreMany(entryIds: string[]) {
    const timestamp = nowIso();
    const targetEntryIds = new Set(entryIds);

    setEntries((currentEntries) => restoreEntries(currentEntries, targetEntryIds, timestamp));
    setCopyState('idle');
  }

  function handleOpenLinkedPhoto(photoId: string) {
    setActiveTab('photos');
    setActivePhotoFilter('archived');
    setSelectedPhotoId(photoId);
    setIsComposerOpen(false);
    setEditingEntryId(null);
  }

  function handleUpdateFood(
    foodId: string,
    payload: {
      name: string;
      calories?: number;
      carbs?: number;
      fat?: number;
      protein?: number;
      nutritionScope?: NutritionScope;
    }
  ) {
    const trimmedName = payload.name.trim();
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

    const affectedEntryIds = entries
      .filter((entry) => entry.foodId === foodId && entry.sourcePhotoId)
      .map((entry) => entry.id);

    setFoods((currentFoods) =>
      currentFoods.map((food) =>
        food.id === foodId
          ? {
              ...food,
              name: trimmedName,
              normalizedName,
              calories: payload.calories,
              carbs: payload.carbs,
              fat: payload.fat,
              protein: payload.protein,
              nutritionScope: payload.nutritionScope
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

    if (affectedEntryIds.length > 0) {
      setPhotoItems((currentPhotos) =>
        currentPhotos.map((photo) =>
          photo.linkedEntryId && affectedEntryIds.includes(photo.linkedEntryId)
            ? {
                ...photo,
                foodName: trimmedName,
                updatedAt: nowIso()
              }
            : photo
        )
      );
    }

    return true;
  }

  async function handleCopy() {
    const exportTextSnapshot = exportText;
    const exportedEntryIds = activeEntries.map((entry) => entry.id);

    if (!exportTextSnapshot) {
      return;
    }

    try {
      await navigator.clipboard.writeText(exportTextSnapshot);

      if (exportedEntryIds.length > 0) {
        const timestamp = nowIso();
        const exportBatchId = createId();
        setEntries((currentEntries) =>
          archiveEntriesAsExport(
            currentEntries,
            exportedEntryIds,
            timestamp,
            exportBatchId
          )
        );
      }

      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1800);
    } catch {
      setCopyState('error');
    }
  }

  function handleExportFoodMemory() {
    setImportBackupState('idle');
    setImportBackupMessage('');

    try {
      downloadFoodMemoryBackup(foods, {
        exportLeadIn
      });
      setExportBackupState('done');
      window.setTimeout(() => setExportBackupState('idle'), 1800);
    } catch {
      setExportBackupState('error');
    }
  }

  async function handleImportFoodMemory(file: File, mode: FoodImportMode) {
    setExportBackupState('idle');
    setImportBackupState('working');
    setImportBackupMessage('');
    setCopyState('idle');

    try {
      const raw = await file.text();
      const backup = parseFoodMemoryBackup(raw);
      const result = importFoodMemoryBackup(foods, backup, mode);

      setFoods(result.foods);
      setExportLeadIn(result.exportLeadIn);
      setImportBackupState('done');
      setImportBackupMessage(
        mode === 'merge'
          ? `Merged ${result.importedFoodCount} backup food${result.importedFoodCount === 1 ? '' : 's'}. ${result.totalFoodCount} remembered food${result.totalFoodCount === 1 ? '' : 's'} now available.`
          : `Imported ${result.totalFoodCount} remembered food${result.totalFoodCount === 1 ? '' : 's'} from backup.`
      );
      window.setTimeout(() => setImportBackupState('idle'), 2400);
    } catch {
      setImportBackupState('error');
      setImportBackupMessage('Backup import failed. Use a valid FoodSnap backup JSON file.');
    }
  }

  async function handleResetSession() {
    const archivedLinkedPhotoIds = photoItems
      .filter((photo) => photo.status === 'archived' && photo.linkedEntryId)
      .map((photo) => photo.id);

    try {
      if (archivedLinkedPhotoIds.length > 0) {
        await deletePhotoBlobs(archivedLinkedPhotoIds);
      }
    } catch {
      setPhotoFeedbackTone('error');
      setPhotoFeedbackMessage('Some archived photo files could not be removed.');
    }

    setPhotoItems((currentPhotos) => currentPhotos.filter((photo) => photo.status === 'pending'));
    setEntries([]);
    setEditingEntryId(null);
    setSelectedPhotoId(null);
    setCopyState('idle');
  }

  function startEditing(entryId: string) {
    setIsComposerOpen(false);
    setEditingAggregateEntryIds(null);
    setEditingEntryId(entryId);
  }

  function startEditingAggregate(entryIds: string[]) {
    setIsComposerOpen(false);
    setEditingEntryId(null);
    setEditingAggregateEntryIds(entryIds);
  }

  function handleUpdateAggregateNote(note: string) {
    if (!editingAggregateEntryIds) {
      return;
    }

    const timestamp = nowIso();
    setEntries((currentEntries) =>
      updateSessionEntryNotes(currentEntries, editingAggregateEntryIds, note, timestamp)
    );
    setCopyState('idle');
    closeInputDialog();
  }

  async function handleForceRefresh() {
    try {
      setRefreshState('working');
      await forceFreshAppLoad();
    } catch {
      setRefreshState('error');
    }
  }

  async function handleAddPhotoBlobs(blobList: Blob[] | null) {
    const candidateBlobs = blobList ? Array.from(blobList) : [];
    const blobs = candidateBlobs.filter(
      (blob) => blob.type === '' || blob.type.startsWith('image/')
    );

    if (blobs.length === 0) {
      setPhotoFeedbackTone('error');
      setPhotoFeedbackMessage('Choose a valid image.');
      return false;
    }

    setPhotoActionState('working');
    resetPhotoFeedback();

    const uploadedPhotos: PhotoItem[] = [];

    try {
      for (const blob of blobs) {
        const processedBlob = await preparePhotoBlob(blob);
        const photoId = createId();
        const timestamp = nowIso();

        await savePhotoBlob(photoId, processedBlob);
        uploadedPhotos.push({
          id: photoId,
          status: 'pending',
          createdAt: timestamp,
          updatedAt: timestamp
        });
      }

      setPhotoItems((currentPhotos) => [...currentPhotos, ...uploadedPhotos]);
      setActiveTab('photos');
      setActivePhotoFilter('pending');
      setSelectedPhotoId(null);
    } catch {
      if (uploadedPhotos.length > 0) {
        await deletePhotoBlobs(uploadedPhotos.map((photo) => photo.id)).catch(() => undefined);
      }
      setPhotoFeedbackTone('error');
      setPhotoFeedbackMessage('The photo could not be stored on this device.');
      return false;
    } finally {
      setPhotoActionState('idle');
    }

    return true;
  }

  function scanPhotoFolder(directory: FileSystemDirectoryHandle) {
    if (photoFolderScanRef.current) {
      return photoFolderScanRef.current;
    }

    const scan = (async () => {
      setPhotoFolderState({
        name: directory.name,
        status: 'scanning',
        importedCount: 0,
        message: 'Checking this folder and its subfolders...'
      });

      try {
        const result = await scanPhotoDirectory(directory, async ({ file }) => {
          const processedBlob = await preparePhotoBlob(file);
          const photoId = createId();
          const modifiedAt = new Date(file.lastModified);
          const timestamp = Number.isNaN(modifiedAt.getTime())
            ? nowIso()
            : modifiedAt.toISOString();

          await savePhotoBlob(photoId, processedBlob);
          setPhotoItems((currentPhotos) => [
            ...currentPhotos,
            {
              id: photoId,
              status: 'pending',
              createdAt: timestamp,
              updatedAt: timestamp
            }
          ]);

          return async () => {
            await deletePhotoBlob(photoId);
            setPhotoItems((currentPhotos) =>
              currentPhotos.filter((photo) => photo.id !== photoId)
            );
          };
        });

        const importedLabel = `${result.importedCount} new photo${
          result.importedCount === 1 ? '' : 's'
        } imported.`;
        const message =
          result.importedCount > 0 ? importedLabel : 'Folder is up to date.';
        const failureMessage =
          result.failedCount > 0
            ? ` ${result.failedCount} image${result.failedCount === 1 ? '' : 's'} could not be imported.`
            : '';

        setPhotoFolderState({
          name: directory.name,
          status: result.failedCount > 0 ? 'error' : 'complete',
          importedCount: result.importedCount,
          message: `${message}${failureMessage}`
        });
        setActivePhotoFilter('pending');
      } catch {
        setPhotoFolderState({
          name: directory.name,
          status: 'error',
          importedCount: 0,
          message: 'The folder could not be scanned. Try granting access again.'
        });
      }
    })();

    photoFolderScanRef.current = scan;
    void scan.finally(() => {
      if (photoFolderScanRef.current === scan) {
        photoFolderScanRef.current = null;
      }
    });
    return scan;
  }

  function refreshSavedPhotoFolder() {
    if (photoFolderRefreshRef.current) {
      return photoFolderRefreshRef.current;
    }

    const refresh = (async () => {
      try {
        const directory = await getSavedPhotoDirectory();
        if (!directory) {
          setPhotoFolderState({ name: null, status: 'none', importedCount: 0, message: '' });
          return;
        }

        const permission = await getPhotoDirectoryPermission(directory);
        if (permission === 'granted') {
          await scanPhotoFolder(directory);
          return;
        }

        setPhotoFolderState({
          name: directory.name,
          status: 'permission',
          importedCount: 0,
          message:
            permission === 'denied'
              ? 'Folder access is blocked. Allow access to scan for new photos.'
              : 'Allow folder access to scan for new photos.'
        });
      } catch {
        setPhotoFolderState({
          name: null,
          status: 'error',
          importedCount: 0,
          message: 'The saved photo folder could not be opened.'
        });
      }
    })();

    photoFolderRefreshRef.current = refresh;
    void refresh.finally(() => {
      if (photoFolderRefreshRef.current === refresh) {
        photoFolderRefreshRef.current = null;
      }
    });
    return refresh;
  }

  async function handleChoosePhotoFolder() {
    try {
      const directory = await choosePhotoDirectory();
      await scanPhotoFolder(directory);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      setPhotoFolderState((current) => ({
        ...current,
        status: 'error',
        importedCount: 0,
        message: 'The folder could not be selected or saved.'
      }));
    }
  }

  async function handleAllowPhotoFolder() {
    try {
      const directory = await getSavedPhotoDirectory();
      if (!directory) {
        setPhotoFolderState({ name: null, status: 'none', importedCount: 0, message: '' });
        return;
      }

      const permission = await getPhotoDirectoryPermission(directory, true);
      if (permission === 'granted') {
        await scanPhotoFolder(directory);
        return;
      }

      setPhotoFolderState({
        name: directory.name,
        status: 'permission',
        importedCount: 0,
        message: 'Folder access was not granted. You can choose the folder again.'
      });
    } catch {
      setPhotoFolderState((current) => ({
        ...current,
        status: 'error',
        importedCount: 0,
        message: 'Folder access could not be requested.'
      }));
    }
  }

  async function handlePhotoInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = '';
    await handleAddPhotoBlobs(files);
  }

  async function handleDirectCameraCapture(blob: Blob) {
    const saved = await handleAddPhotoBlobs([blob]);

    if (saved) {
      setIsDirectCameraOpen(false);
    }
  }

  async function handleDeletePendingPhoto(photoId: string) {
    resetPhotoFeedback();

    try {
      await deletePhotoBlob(photoId);
      setPhotoItems((currentPhotos) => currentPhotos.filter((photo) => photo.id !== photoId));
      if (selectedPhotoId === photoId) {
        setSelectedPhotoId(null);
      }
      return true;
    } catch {
      setPhotoFeedbackTone('error');
      setPhotoFeedbackMessage('The open photo could not be deleted.');
      return false;
    }
  }

  function findNextPendingPhotoId(currentPhotoId: string) {
    const currentIndex = pendingPhotos.findIndex((photo) => photo.id === currentPhotoId);
    if (currentIndex === -1) {
      return null;
    }

    return pendingPhotos[currentIndex + 1]?.id ?? null;
  }

  async function handleSavePhoto(photoId: string, payload: { foodName: string; weightGrams: number }) {
    const photo = photoItems.find((item) => item.id === photoId);

    if (!photo) {
      return;
    }

    setPhotoActionState('working');
    resetPhotoFeedback();

    try {
      if (photo.status === 'pending') {
        const entryId = createId();
        const timestamp = nowIso();

        commitEntry(makePhotoEntryPayload(payload.foodName, payload.weightGrams), null, {
          forceEntryId: entryId,
          sourcePhotoId: photoId
        });

        setPhotoItems((currentPhotos) =>
          currentPhotos.map((item) =>
            item.id === photoId
              ? {
                  ...item,
                  status: 'archived',
                  foodName: payload.foodName,
                  weightGrams: payload.weightGrams,
                  linkedEntryId: entryId,
                  completedAt: timestamp,
                  updatedAt: timestamp
                }
              : item
          )
        );

        setActivePhotoFilter('pending');
        const nextPhotoId = findNextPendingPhotoId(photoId);
        setSelectedPhotoId(nextPhotoId);
        if (!nextPhotoId) {
          setPhotoFeedbackMessage('All open photos processed.');
        }
        return;
      }

      if (photo.linkedEntryId) {
        const linkedEntry = entries.find((entry) => entry.id === photo.linkedEntryId);

        commitEntry(
          {
            ...makePhotoEntryPayload(payload.foodName, payload.weightGrams),
            note: linkedEntry?.note ?? '',
            calories: linkedEntry?.calories,
            carbs: linkedEntry?.carbs,
            fat: linkedEntry?.fat,
            protein: linkedEntry?.protein,
            nutritionScope: linkedEntry?.nutritionScope
          },
          photo.linkedEntryId
        );
        setActivePhotoFilter('archived');
        setSelectedPhotoId(null);
        setPhotoFeedbackMessage('Photo updated.');
        return;
      }

      setPhotoItems((currentPhotos) =>
        currentPhotos.map((item) =>
          item.id === photoId
            ? {
                ...item,
                foodName: payload.foodName,
                weightGrams: payload.weightGrams,
                updatedAt: nowIso()
              }
            : item
        )
      );
      setActivePhotoFilter('archived');
      setSelectedPhotoId(null);
      setPhotoFeedbackMessage('Photo updated.');
    } finally {
      setPhotoActionState('idle');
    }
  }

  return (
    <main className={`app-shell${isPhotoDetailActive ? ' app-shell-photo-detail' : ''}`}>
      {!isPhotoDetailActive ? (
        <header className="app-header">
          <div className="brand-markup">
            <span className="brand-icon">
              <BoltIcon className="brand-bolt" />
            </span>
            <strong>FoodSnap</strong>
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
      ) : null}

      {activeTab === 'log' ? (
        <section className="screen-section muted-section screen-section-log">
          <SessionList
            mode="log"
            entries={logEntries}
            aggregatedItems={logListItems}
            isAggregated={isLogAggregated}
            editingEntryId={editingEntryId}
            onEdit={startEditing}
            onEditMany={startEditingAggregate}
            onDelete={handleDelete}
            onDeleteMany={handleDeleteMany}
            onRestore={handleRestore}
            onRestoreMany={handleRestoreMany}
            onOpenPhoto={handleOpenLinkedPhoto}
            onToggleAggregated={setIsLogAggregated}
          />
        </section>
      ) : null}

      {activeTab === 'history' ? (
        <section className="screen-section muted-section">
          <SessionList
            entries={entries}
            mode="history"
            isAggregated={isLogAggregated}
            editingEntryId={editingEntryId}
            onEdit={startEditing}
            onEditMany={startEditingAggregate}
            onDelete={handleDelete}
            onDeleteMany={handleDeleteMany}
            onRestore={handleRestore}
            onRestoreMany={handleRestoreMany}
            onOpenPhoto={handleOpenLinkedPhoto}
          />
        </section>
      ) : null}

      {activeTab === 'photos' ? (
        <section className={`screen-section${selectedPhoto ? ' screen-section-photo-detail' : ''}`}>
          <PhotoPanel
            foods={foods}
            pendingPhotos={pendingPhotos}
            archivedPhotos={archivedPhotos}
            activeFilter={activePhotoFilter}
            selectedPhoto={selectedPhoto}
            isBusy={photoActionState === 'working'}
            feedbackMessage={photoFeedbackMessage}
            feedbackTone={photoFeedbackTone}
            photoSizeReduction={photoSizeReduction}
            autoPhotoSize={autoPhotoSize}
            folderName={photoFolderState.name}
            folderStatus={photoFolderState.status}
            folderImportedCount={photoFolderState.importedCount}
            folderMessage={photoFolderState.message}
            onChangeFilter={setActivePhotoFilter}
            onOpenCamera={handleOpenCamera}
            onOpenGallery={() => galleryInputRef.current?.click()}
            onChooseFolder={() => {
              void handleChoosePhotoFolder();
            }}
            onAllowFolder={() => {
              void handleAllowPhotoFolder();
            }}
            onSelectPhoto={setSelectedPhotoId}
            onCloseDetail={() => setSelectedPhotoId(null)}
            onDeletePendingPhoto={handleDeletePendingPhoto}
            onSavePhoto={(photoId, payload) => {
              void handleSavePhoto(photoId, payload);
            }}
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
            onUpdateFood={handleUpdateFood}
            onDeleteFood={(foodId) => {
              setFoods((currentFoods) => currentFoods.filter((food) => food.id !== foodId));
            }}
          />
        </section>
      ) : null}

      {activeTab === 'export' ? (
        <section className="screen-section">
          <ExportPanel
            exportText={exportText}
            visibleExportText={visibleExportText}
            exportLeadIn={exportLeadIn}
            copyState={copyState}
            sessionCount={sessionEntryCount}
            onCopy={handleCopy}
            onResetSession={handleResetSession}
          />
        </section>
      ) : null}

      {activeTab === 'settings' ? (
        <section className="screen-section">
          <SettingsPanel
            foodCount={foods.length}
            sessionCount={sessionEntryCount}
            exportState={exportBackupState}
            importState={importBackupState}
            importMessage={importBackupMessage}
            exportLeadIn={exportLeadIn}
            refreshState={refreshState}
            themePreference={themePreference}
            cameraPreference={cameraPreference}
            photoSizeReduction={photoSizeReduction}
            autoPhotoSize={autoPhotoSize}
            onExportFoodMemory={handleExportFoodMemory}
            onImportFoodMemory={handleImportFoodMemory}
            onChangeExportLeadIn={(value) => {
              setExportLeadIn(value);
              setCopyState('idle');
            }}
            onForceRefresh={handleForceRefresh}
            onChangeTheme={setThemePreference}
            onChangeCameraPreference={setCameraPreference}
            onChangePhotoSizeReduction={setPhotoSizeReduction}
            onChangeAutoPhotoSize={setAutoPhotoSize}
          />
        </section>
      ) : null}

      {!isPhotoDetailActive ? (
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
            className={`bottom-nav-item${activeTab === 'photos' ? ' active' : ''}`}
            type="button"
            onClick={() => setActiveTab('photos')}
          >
            <PhotoIcon className="ui-icon" />
            <span>Photos</span>
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
      ) : null}

      {activeTab === 'log' && !isComposerOpen ? (
        <div className="fab-anchor">
          <div className="fab-inner">
            <button
              className="floating-photo-button"
              type="button"
              onClick={handleOpenCamera}
              aria-label="Capture a food photo"
            >
              <CameraIcon className="ui-icon" />
            </button>
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

      {activeTab === 'photos' && !selectedPhoto ? (
        <div className="fab-anchor">
          <div className="fab-inner">
            <button
              className="floating-photo-button"
              type="button"
              onClick={handleOpenCamera}
              aria-label="Take a food photo"
            >
              <CameraIcon className="ui-icon" />
            </button>
          </div>
        </div>
      ) : null}

      {isComposerOpen ? (
        <CreateEntryModal
          foods={foods}
          onCancel={closeInputDialog}
          onSave={handleSaveEntry}
        />
      ) : null}

      {editingEntry ? (
        <EditEntryModal
          foods={foods}
          entry={editingEntry}
          onCancel={closeInputDialog}
          onSave={handleUpdateEntry}
        />
      ) : null}

      {editingAggregateEntryIds && editingAggregateEntries.length > 0 ? (
        <AggregateNoteModal
          foodName={editingAggregateEntries[0].foodName}
          initialNote={getCombinedSessionEntryNote(editingAggregateEntries)}
          onCancel={closeInputDialog}
          onSave={handleUpdateAggregateNote}
        />
      ) : null}

      {isDirectCameraOpen ? (
        <CameraCaptureModal
          onCancel={() => setIsDirectCameraOpen(false)}
          onCapture={handleDirectCameraCapture}
          onFallback={openSystemCamera}
        />
      ) : null}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="visually-hidden"
        onChange={(event) => {
          void handlePhotoInputChange(event);
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="visually-hidden"
        onChange={(event) => {
          void handlePhotoInputChange(event);
        }}
      />
    </main>
  );
}
