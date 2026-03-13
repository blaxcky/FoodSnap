import type { FoodProfile } from './types';

interface FoodMemoryBackup {
  app: 'FoodSnap';
  version: 1;
  exportedAt: string;
  foods: FoodProfile[];
}

export function downloadFoodMemoryBackup(foods: FoodProfile[]) {
  const payload: FoodMemoryBackup = {
    app: 'FoodSnap',
    version: 1,
    exportedAt: new Date().toISOString(),
    foods
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
