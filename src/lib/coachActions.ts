/**
 * Turns the field names an AI coach reply may use into timeline payloads.
 */

export interface CoachMealData {
  mealType?: string;
  items?: { carbsG?: number; fatG?: number }[];
  totalCalories?: number;
  calories?: number;
  totalProtein?: number;
  totalProteinG?: number;
  protein?: number;
  totalCarbs?: number;
  totalCarbsG?: number;
  carbs?: number;
  totalFat?: number;
  totalFatG?: number;
  fat?: number;
  notes?: string;
}

/** Everything the AI coach may return in updatedData. */
export interface CoachActionData extends CoachMealData {
  steps?: number;
  count?: number;
  distanceKm?: number;
  caloriesBurned?: number;
  amountMl?: number;
  amountL?: number;
  glasses?: number;
  hours?: number;
  quality?: number;
  bedtime?: string;
  wakeTime?: string;
  weightKg?: number;
  workoutName?: string;
  durationMin?: number;
  musclesWorked?: string[];
  exercisesCompleted?: unknown[];
  gymFrequency?: number;
  habitTitle?: string;
  completed?: boolean;
  value?: number;
}

export function normalizeCoachMeal(data: CoachMealData) {
  const items = data.items || [];
  return {
    mealType: data.mealType || "meal",
    foods: items,
    totalCalories: data.totalCalories || data.calories || 0,
    totalProteinG: data.totalProtein || data.totalProteinG || data.protein || 0,
    totalCarbsG: data.totalCarbs || data.totalCarbsG || data.carbs || items.reduce((sum, food) => sum + (food.carbsG || 0), 0),
    totalFatG: data.totalFat || data.totalFatG || data.fat || items.reduce((sum, food) => sum + (food.fatG || 0), 0),
    notes: data.notes || "",
    loggedVia: "chatbot",
  };
}

export function normalizeCoachSteps(data: { steps?: number; count?: number; distanceKm?: number; caloriesBurned?: number; notes?: string }) {
  const steps = data.steps || data.count || 0;
  return {
    count: steps,
    steps,
    distanceKm: data.distanceKm || parseFloat((steps * 0.00075).toFixed(2)),
    caloriesBurned: data.caloriesBurned || Math.round(steps * 0.04),
    notes: data.notes || "",
    loggedVia: "chatbot",
  };
}

export function normalizeCoachWater(data: { amountMl?: number; amountL?: number; glasses?: number; notes?: string }) {
  const amountMl = data.amountMl || (data.amountL ? Math.round(data.amountL * 1000) : data.glasses ? data.glasses * 250 : 0);
  return {
    amountL: +(amountMl / 1000).toFixed(2),
    amountMl,
    glasses: data.glasses || Math.round(amountMl / 250),
    notes: data.notes || "",
    loggedVia: "chatbot",
  };
}
