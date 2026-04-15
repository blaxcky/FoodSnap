import type { FoodProfile, PersistedAppState, PhotoItem, SessionEntry } from './types';
import { isNutritionValue, normalizeText, pickNutritionFields } from './utils';

const STORAGE_KEY = 'foodsnap:v1';

export const defaultAppState: PersistedAppState = {
  version: 2,
  foods: [],
  currentSession: [],
  photoItems: [],
  exportLeadIn: ''
};

function isSessionEntry(value: unknown): value is SessionEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const entry = value as Record<string, unknown>;

  return (
    typeof entry.id === 'string' &&
    typeof entry.foodId === 'string' &&
    typeof entry.foodName === 'string' &&
    (entry.sourcePhotoId == null || typeof entry.sourcePhotoId === 'string') &&
    (entry.mode === 'direct' || entry.mode === 'difference') &&
    typeof entry.amount === 'number' &&
    (entry.unit === 'g' || entry.unit === 'pcs') &&
    typeof entry.note === 'string' &&
    (entry.calories == null || isNutritionValue(entry.calories)) &&
    (entry.carbs == null || isNutritionValue(entry.carbs)) &&
    (entry.fat == null || isNutritionValue(entry.fat)) &&
    (entry.protein == null || isNutritionValue(entry.protein)) &&
    typeof entry.createdAt === 'string' &&
    typeof entry.updatedAt === 'string'
  );
}

function parseFoodProfile(value: unknown): FoodProfile | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const food = value as Record<string, unknown>;

  if (
    typeof food.id !== 'string' ||
    typeof food.name !== 'string' ||
    typeof food.usageCount !== 'number' ||
    !Number.isFinite(food.usageCount) ||
    food.usageCount < 0 ||
    typeof food.lastUsedAt !== 'string' ||
    typeof food.createdAt !== 'string' ||
    typeof food.isFavorite !== 'boolean' ||
    (food.lastUnit !== 'g' && food.lastUnit !== 'pcs')
  ) {
    return null;
  }

  return {
    id: food.id,
    name: food.name,
    normalizedName: normalizeText(food.name),
    usageCount: food.usageCount,
    lastUsedAt: food.lastUsedAt,
    createdAt: food.createdAt,
    isFavorite: food.isFavorite,
    lastUnit: food.lastUnit,
    ...pickNutritionFields(food)
  };
}

function isPhotoItem(value: unknown): value is PhotoItem {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const photo = value as Record<string, unknown>;

  return (
    typeof photo.id === 'string' &&
    (photo.status === 'pending' || photo.status === 'archived') &&
    typeof photo.createdAt === 'string' &&
    typeof photo.updatedAt === 'string' &&
    (photo.completedAt == null || typeof photo.completedAt === 'string') &&
    (photo.foodName == null || typeof photo.foodName === 'string') &&
    (photo.weightGrams == null || typeof photo.weightGrams === 'number') &&
    (photo.linkedEntryId == null || typeof photo.linkedEntryId === 'string')
  );
}

export function loadAppState(): PersistedAppState {
  if (typeof window === 'undefined') {
    return defaultAppState;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultAppState;
    }

    const parsed = JSON.parse(raw) as Partial<PersistedAppState> & {
      version?: number;
      photoItems?: unknown;
      currentSession?: unknown;
    };

    return {
      version: 2,
      foods: Array.isArray(parsed.foods)
        ? parsed.foods
            .map((food) => parseFoodProfile(food))
            .filter((food): food is FoodProfile => food != null)
        : [],
      currentSession: Array.isArray(parsed.currentSession)
        ? parsed.currentSession.filter(isSessionEntry)
        : [],
      photoItems: Array.isArray(parsed.photoItems) ? parsed.photoItems.filter(isPhotoItem) : [],
      exportLeadIn: typeof parsed.exportLeadIn === 'string' ? parsed.exportLeadIn : ''
    };
  } catch {
    return defaultAppState;
  }
}

export function saveAppState(state: PersistedAppState) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
