import type {
  EntryUnit,
  FoodProfile,
  NutritionFields,
  NutritionScope,
  SessionEntry
} from './types';

export function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

const nutritionKeys = ['calories', 'carbs', 'fat', 'protein'] as const;

export function normalizeNutritionScope(value: unknown): NutritionScope {
  return value === 'total' ? 'total' : 'per100g';
}

export function isNutritionValue(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function hasNutritionValues(source: Partial<NutritionFields> | null | undefined) {
  return nutritionKeys.some((key) => isNutritionValue(source?.[key]));
}

export function pickNutritionFields(source: Partial<NutritionFields> | null | undefined) {
  const nextValue = {
    calories: isNutritionValue(source?.calories) ? source.calories : undefined,
    carbs: isNutritionValue(source?.carbs) ? source.carbs : undefined,
    fat: isNutritionValue(source?.fat) ? source.fat : undefined,
    protein: isNutritionValue(source?.protein) ? source.protein : undefined
  } satisfies NutritionFields;

  if (hasNutritionValues(nextValue) || source?.nutritionScope === 'total') {
    return {
      ...nextValue,
      nutritionScope: normalizeNutritionScope(source?.nutritionScope)
    } satisfies NutritionFields;
  }

  return nextValue;
}

export function mergeDefinedNutrition<T extends NutritionFields>(
  target: T,
  source: Partial<NutritionFields> | null | undefined
) {
  const nextValue = { ...target } as T & NutritionFields;

  for (const key of nutritionKeys) {
    const value = source?.[key];

    if (isNutritionValue(value)) {
      nextValue[key] = value;
    }
  }

  if (hasNutritionValues(source)) {
    nextValue.nutritionScope = normalizeNutritionScope(source?.nutritionScope);
  } else if (hasNutritionValues(nextValue) && nextValue.nutritionScope != null) {
    nextValue.nutritionScope = normalizeNutritionScope(nextValue.nutritionScope);
  }

  return nextValue as T;
}

export function applyNutritionDefaults<T extends NutritionFields>(
  target: T,
  defaults: Partial<NutritionFields> | null | undefined
) {
  const nextValue = { ...target } as T & NutritionFields;
  const targetHasNutrition = hasNutritionValues(target);
  const defaultsHaveNutrition = hasNutritionValues(defaults);

  for (const key of nutritionKeys) {
    if (nextValue[key] != null) {
      continue;
    }

    const value = defaults?.[key];

    if (isNutritionValue(value)) {
      nextValue[key] = value;
    }
  }

  if (targetHasNutrition) {
    nextValue.nutritionScope = normalizeNutritionScope(target.nutritionScope);
  } else if (defaultsHaveNutrition) {
    nextValue.nutritionScope = normalizeNutritionScope(defaults?.nutritionScope);
  }

  return nextValue as T;
}

export function findFoodProfile(foods: FoodProfile[], foodName: string, foodId?: string) {
  if (foodId) {
    const matchingFood = foods.find((food) => food.id === foodId);

    if (matchingFood) {
      return matchingFood;
    }
  }

  const normalizedName = normalizeText(foodName);
  return foods.find((food) => food.normalizedName === normalizedName) ?? null;
}

export function formatNumber(value: number) {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(1).replace(/\.0$/, '');
}

export function formatAmount(value: number, unit: EntryUnit) {
  return unit === 'g' ? `${formatNumber(value)}g` : formatNumber(value);
}

export function formatDifferenceBreakdown(entry: SessionEntry) {
  return `(${formatNumber(entry.beforeWeight ?? 0)}g - ${formatNumber(entry.afterWeight ?? 0)}g)`;
}

export function getEntryBeforeAmount(entry: SessionEntry) {
  return entry.beforeWeight ?? entry.amount;
}

export function formatEntryMeta(entry: SessionEntry) {
  if (isBeforeWeightPending(entry)) {
    return `After ${formatNumber(entry.afterWeight ?? 0)}g • before pending`;
  }

  if (entry.needsAfterWeight && entry.afterWeight == null) {
    const before = getEntryBeforeAmount(entry);
    return `Before ${formatNumber(before)}g • after pending`;
  }

  if (entry.mode === 'difference') {
    return formatDifferenceBreakdown(entry);
  }

  return entry.unit === 'g' ? 'Direct grams' : 'Direct pieces';
}

export function isAfterWeightPending(entry: SessionEntry) {
  return Boolean(entry.needsAfterWeight && entry.afterWeight == null);
}

export function isBeforeWeightPending(entry: SessionEntry) {
  return entry.unit === 'g' && entry.afterWeight != null && entry.beforeWeight == null;
}

export function isZeroBeforeEntry(entry: SessionEntry) {
  return (
    entry.unit === 'g' &&
    !isBeforeWeightPending(entry) &&
    !isAfterWeightPending(entry) &&
    getEntryBeforeAmount(entry) === 0
  );
}

export function isEntryDeleted(entry: SessionEntry) {
  return Boolean(entry.deletedAt);
}

export function getUndoExpiryMs(entry: SessionEntry) {
  if (!entry.undoExpiresAt) {
    return null;
  }

  const parsed = Date.parse(entry.undoExpiresAt);
  return Number.isNaN(parsed) ? null : parsed;
}

export function canUndoDelete(entry: SessionEntry, now = Date.now()) {
  const expiresAt = getUndoExpiryMs(entry);
  return isEntryDeleted(entry) && expiresAt != null && expiresAt > now;
}

export function getUndoSecondsLeft(entry: SessionEntry, now = Date.now()) {
  const expiresAt = getUndoExpiryMs(entry);

  if (expiresAt == null) {
    return 0;
  }

  return Math.max(0, Math.ceil((expiresAt - now) / 1000));
}

export function isValidPositiveNumber(value: string) {
  if (value.trim() === '') {
    return false;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}
