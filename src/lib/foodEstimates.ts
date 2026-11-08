import { AIMemory } from "./db/models";
import { estimateMessFoods } from "./gemini";
import type { FoodEstimates } from "./dietPlanner";

const ESTIMATES_KEY = "mess_food_estimates";
const MAX_ESTIMATES_PER_REQUEST = 80;

/**
 * Saved estimates keep a dish's numbers stable over time and mean the AI is
 * only asked about each dish once.
 */
export async function loadFoodEstimates(userId: string, needed: string[]): Promise<FoodEstimates> {
  let saved: FoodEstimates = {};
  try {
    const entry = await AIMemory.findOne({ userId, layer: 4, key: ESTIMATES_KEY }).lean();
    saved = (entry?.value as FoodEstimates) ?? {};
  } catch {
    // Without saved estimates the AI is simply asked again.
  }

  const missing = needed.filter((name) => !(name in saved)).slice(0, MAX_ESTIMATES_PER_REQUEST);
  if (missing.length === 0) return saved;

  try {
    const answered = await estimateMessFoods(missing);
    // Remember what it couldn't answer so each page load doesn't ask again.
    const merged: FoodEstimates = { ...saved, ...Object.fromEntries(missing.map((name) => [name, answered[name] ?? null])) };
    await AIMemory.updateOne(
      { userId, layer: 4, key: ESTIMATES_KEY },
      { $set: { value: merged } },
      { upsert: true }
    ).catch((error) => console.warn("Could not save food estimates:", error));
    return merged;
  } catch (error) {
    // Those foods are shown as unknown and not counted.
    console.warn("Food estimates unavailable:", error);
    return saved;
  }
}
