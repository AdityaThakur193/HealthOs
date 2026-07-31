/**
 * Adaptive TDEE Calibration Engine (MacroFactor Paradigm)
 * 
 * Principle: "Use software for certainty; use AI for uncertainty."
 * The true TDEE is determined empirically by observing weight fluctuations 
 * relative to calorie logs over a 14-day timeline.
 */

interface TDEEResult {
  status: "adaptive" | "calibrating";
  calculatedTdee: number;
  avgCalories: number;
  weightDeltaKg: number;
  daysLogged: number;
  weightsLogged: number;
  daysRemaining: number;
}

export function calculateAdaptiveTdee(profile: any, events: any[]): TDEEResult {
  const currentTdee = profile.tdee || 2400; // starting baseline TDEE
  
  // Filter events in the last 14 days
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fourteenDaysAgo = new Date(startOfToday.getTime() - 14 * 24 * 60 * 60 * 1000);

  const weightLogs = events
    .filter((e) => e.type === "weight" && new Date(e.timestamp) >= fourteenDaysAgo)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const mealLogs = events
    .filter((e) => e.type === "meal" && new Date(e.timestamp) >= fourteenDaysAgo);

  // Group meals by day to find unique logging days and daily calorie sums
  const dailyCalories: Record<string, number> = {};
  mealLogs.forEach((meal) => {
    const dayStr = new Date(meal.timestamp).toDateString();
    dailyCalories[dayStr] = (dailyCalories[dayStr] || 0) + (Number(meal.payload?.totalCalories) || 0);
  });

  const uniqueCalDays = Object.keys(dailyCalories);
  const loggedCalorieDays = uniqueCalDays.filter((day) => dailyCalories[day] > 0);

  const weightDaysCount = weightLogs.length;
  const calorieDaysCount = loggedCalorieDays.length;

  // Requirements: At least 3 weight logs and 7 calorie logs in the last 14 days
  const minWeightLogs = 3;
  const minCalorieLogs = 7;
  const isCalibrating = weightDaysCount < minWeightLogs || calorieDaysCount < minCalorieLogs;

  if (isCalibrating) {
    const weightDaysNeeded = Math.max(0, minWeightLogs - weightDaysCount);
    const calorieDaysNeeded = Math.max(0, minCalorieLogs - calorieDaysCount);
    const daysRemaining = Math.max(weightDaysNeeded, calorieDaysNeeded);

    return {
      status: "calibrating",
      calculatedTdee: currentTdee,
      avgCalories: calorieDaysCount > 0 ? Math.round(Object.values(dailyCalories).reduce((a, b) => a + b, 0) / calorieDaysCount) : 0,
      weightDeltaKg: 0,
      daysLogged: calorieDaysCount,
      weightsLogged: weightDaysCount,
      daysRemaining,
    };
  }

  // 1. Calculate Average Calories across logged days
  const totalCaloriesLogged = Object.values(dailyCalories).reduce((sum, val) => sum + val, 0);
  const avgCalories = totalCaloriesLogged / calorieDaysCount;

  // 2. Calculate weight trend using Linear Regression (y = mx + c)
  // x is time in fractional days since fourteenDaysAgo
  // y is weight in kg
  const t0 = fourteenDaysAgo.getTime();
  const dataPoints = weightLogs
    .map((log) => {
      const timeDiffDays = (new Date(log.timestamp).getTime() - t0) / (24 * 60 * 60 * 1000);
      const weight = Number(log.payload?.weightKg);
      return { x: timeDiffDays, y: weight };
    })
    .filter((pt) => !isNaN(pt.y) && pt.y > 0);

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  const n = dataPoints.length;

  dataPoints.forEach((pt) => {
    sumX += pt.x;
    sumY += pt.y;
    sumXY += pt.x * pt.y;
    sumXX += pt.x * pt.x;
  });

  const denominator = n * sumXX - sumX * sumX;
  
  // Default to flat if linear regression slope denominator is 0 (all logs at same timestamp)
  const slope = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
  
  // Total weight change over the 14-day window (slope * 14 days)
  const weightDeltaKg = slope * 14;

  // 3. Energy Balance Delta calculation
  // 1 kg body tissue is approximately 7700 kcal.
  const energyBalanceDelta = (weightDeltaKg * 7700) / 14;

  // Empirically estimated true maintenance TDEE
  const rawEmpiricalTdee = avgCalories - energyBalanceDelta;

  // 4. Smoothing and constraints (Philosophy: prevent wild swings from water retention)
  // Limit change rate to max +/- 200 kcal from baseline starting estimate
  const maxDiff = 200;
  // Calculate BMR baseline using Mifflin-St Jeor defaults if Katch-McArdle isn't available
  const baselineTdee = profile.bmr ? Math.round(profile.bmr * 1.3) : 2400;
  
  let calculatedTdee = Math.round(rawEmpiricalTdee);
  if (calculatedTdee > baselineTdee + maxDiff) {
    calculatedTdee = baselineTdee + maxDiff;
  } else if (calculatedTdee < baselineTdee - maxDiff) {
    calculatedTdee = baselineTdee - maxDiff;
  }

  // Ensure reasonable bounds
  calculatedTdee = Math.max(1200, Math.min(4500, calculatedTdee));

  return {
    status: "adaptive",
    calculatedTdee,
    avgCalories: Math.round(avgCalories),
    weightDeltaKg: Math.round(weightDeltaKg * 10) / 10,
    daysLogged: calorieDaysCount,
    weightsLogged: weightDaysCount,
    daysRemaining: 0,
  };
}
