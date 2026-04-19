import type { EntryUnit, FoodProfile } from './types';
import { normalizeText, pickNutritionFields } from './utils';

interface BackupSettings {
  exportLeadIn: string;
}

export interface FoodMemoryBackup {
  app: 'FoodSnap';
  version: 3 | 4;
  exportedAt: string;
  foods: FoodProfile[];
  settings: BackupSettings;
}

export type FoodImportMode = 'merge' | 'replace';

interface ImportFoodMemoryResult {
  foods: FoodProfile[];
  exportLeadIn: string;
  importedFoodCount: number;
  totalFoodCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null;
}

function isEntryUnit(value: unknown): value is EntryUnit {
  return value === 'g' || value === 'pcs';
}

function parseFoodProfile(value: unknown) {
  if (!isRecord(value)) {
    throw new Error('Invalid food backup entry.');
  }

  const id = value.id;
  const name = value.name;
  const usageCount = value.usageCount;
  const lastUsedAt = value.lastUsedAt;
  const createdAt = value.createdAt;
  const isFavorite = value.isFavorite;
  const lastUnit = value.lastUnit;

  if (
    typeof id !== 'string' ||
    typeof name !== 'string' ||
    typeof usageCount !== 'number' ||
    !Number.isFinite(usageCount) ||
    usageCount < 0 ||
    typeof lastUsedAt !== 'string' ||
    typeof createdAt !== 'string' ||
    typeof isFavorite !== 'boolean' ||
    !isEntryUnit(lastUnit)
  ) {
    throw new Error('Invalid food backup entry.');
  }

  return {
    id,
    name,
    normalizedName: normalizeText(name),
    usageCount,
    lastUsedAt,
    createdAt,
    isFavorite,
    lastUnit,
    ...pickNutritionFields(value)
  } satisfies FoodProfile;
}

function dedupeFoodsByNormalizedName(foods: FoodProfile[]) {
  const uniqueFoods = new Map<string, FoodProfile>();

  for (const food of foods) {
    uniqueFoods.delete(food.normalizedName);
    uniqueFoods.set(food.normalizedName, food);
  }

  return [...uniqueFoods.values()];
}

export function downloadFoodMemoryBackup(foods: FoodProfile[], settings: BackupSettings) {
  const payload: FoodMemoryBackup = {
    app: 'FoodSnap',
    version: 4,
    exportedAt: new Date().toISOString(),
    foods,
    settings
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json'
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const dateStamp = payload.exportedAt.slice(0, 10);

  anchor.href = url;
  anchor.download = `foodsnap-food-memory-${dateStamp}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function parseFoodMemoryBackup(raw: string): FoodMemoryBackup {
  const parsed = JSON.parse(raw) as unknown;

  if (
    !isRecord(parsed) ||
    parsed.app !== 'FoodSnap' ||
    (parsed.version !== 3 && parsed.version !== 4)
  ) {
    throw new Error('Invalid FoodSnap backup file.');
  }

  if (typeof parsed.exportedAt !== 'string' || !Array.isArray(parsed.foods)) {
    throw new Error('Invalid FoodSnap backup file.');
  }

  const settings = isRecord(parsed.settings) ? parsed.settings : {};
  const exportLeadIn = typeof settings.exportLeadIn === 'string' ? settings.exportLeadIn : '';

  return {
    app: 'FoodSnap',
    version: parsed.version,
    exportedAt: parsed.exportedAt,
    foods: dedupeFoodsByNormalizedName(parsed.foods.map(parseFoodProfile)),
    settings: {
      exportLeadIn
    }
  };
}

export function importFoodMemoryBackup(
  currentFoods: FoodProfile[],
  backup: FoodMemoryBackup,
  mode: FoodImportMode
): ImportFoodMemoryResult {
  const importedFoods = dedupeFoodsByNormalizedName(backup.foods);

  if (mode === 'replace') {
    return {
      foods: importedFoods,
      exportLeadIn: backup.settings.exportLeadIn,
      importedFoodCount: importedFoods.length,
      totalFoodCount: importedFoods.length
    };
  }

  const mergedFoods = new Map(
    dedupeFoodsByNormalizedName(currentFoods).map((food) => [food.normalizedName, food] as const)
  );

  for (const importedFood of importedFoods) {
    const existingFood = mergedFoods.get(importedFood.normalizedName);

    if (existingFood) {
      mergedFoods.set(importedFood.normalizedName, {
        ...importedFood,
        id: existingFood.id
      });
      continue;
    }

    mergedFoods.set(importedFood.normalizedName, importedFood);
  }

  const foods = [...mergedFoods.values()];

  return {
    foods,
    exportLeadIn: backup.settings.exportLeadIn,
    importedFoodCount: importedFoods.length,
    totalFoodCount: foods.length
  };
}
