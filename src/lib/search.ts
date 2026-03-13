import type { FoodProfile } from './types';
import { normalizeText } from './utils';

function daysSince(dateString: string) {
  const parsed = new Date(dateString).getTime();
  if (Number.isNaN(parsed)) {
    return 365;
  }

  return Math.max(0, (Date.now() - parsed) / (1000 * 60 * 60 * 24));
}

function isSubsequence(query: string, target: string) {
  let queryIndex = 0;

  for (let index = 0; index < target.length && queryIndex < query.length; index += 1) {
    if (target[index] === query[queryIndex]) {
      queryIndex += 1;
    }
  }

  return queryIndex === query.length;
}

function scoreFood(food: FoodProfile, query: string) {
  const normalizedName = food.normalizedName;
  let score = 0;

  if (normalizedName === query) {
    score += 1000;
  } else if (normalizedName.startsWith(query)) {
    score += 720;
  } else if (normalizedName.split(' ').some((part) => part.startsWith(query))) {
    score += 520;
  } else if (normalizedName.includes(query)) {
    score += 340;
  } else if (isSubsequence(query, normalizedName)) {
    score += 170;
  } else {
    return -1;
  }

  if (food.isFavorite) {
    score += 90;
  }

  score += Math.min(food.usageCount * 8, 160);
  score += Math.max(0, 50 - daysSince(food.lastUsedAt) * 3);

  return score;
}

export function getFoodSuggestions(foods: FoodProfile[], query: string, limit = 6) {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return getQuickFoods(foods, limit);
  }

  return [...foods]
    .map((food) => ({ food, score: scoreFood(food, normalizedQuery) }))
    .filter((item) => item.score >= 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return right.food.lastUsedAt.localeCompare(left.food.lastUsedAt);
    })
    .slice(0, limit)
    .map((item) => item.food);
}

export function getQuickFoods(foods: FoodProfile[], limit = 6) {
  return [...foods]
    .sort((left, right) => {
      if (left.isFavorite !== right.isFavorite) {
        return left.isFavorite ? -1 : 1;
      }

      if (right.lastUsedAt !== left.lastUsedAt) {
        return right.lastUsedAt.localeCompare(left.lastUsedAt);
      }

      if (right.usageCount !== left.usageCount) {
        return right.usageCount - left.usageCount;
      }

      return left.name.localeCompare(right.name);
    })
    .slice(0, limit);
}

