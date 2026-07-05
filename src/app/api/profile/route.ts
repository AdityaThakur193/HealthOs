import { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { UserProfile, TimelineEvent } from "@/lib/db/models";
import { getLocalProfile, saveLocalProfile, createLocalEvent, deleteLocalEvents, countLocalEvents, deleteLocalProfile } from "@/lib/db/fallback";

/**
 * Helper to calculate TDEE, BMR, and targets (deterministic math).
 */
function calculateHealthTargets(data: {
  age: number;
  gender: "male" | "female" | "other";
  heightCm: number;
  weightKg: number;
  targetWeightKg?: number;
  neckCm?: number;
  waistCm?: number;
  hipCm?: number;
  customCalories?: number;
  customProtein?: number;
  useCustomMacros?: boolean;
  goal: "lose_fat" | "build_muscle" | "maintain" | "recomp" | "general_health";
  activityLevel: "sedentary" | "light" | "moderate" | "active" | "very_active";
  gymExperience: "beginner" | "intermediate" | "advanced";
}) {
  // 1. Calculate body fat percentage if measurements are provided (US Navy Method)
  let bodyFatPct: number | null = null;
  if (data.neckCm && data.waistCm && data.heightCm) {
    const neck = data.neckCm;
    const waist = data.waistCm;
    const height = data.heightCm;
    if (waist > neck) {
      if (data.gender === "male") {
        const waistIn = waist / 2.54;
        const neckIn = neck / 2.54;
        const heightIn = height / 2.54;
        if (waistIn > neckIn) {
          bodyFatPct = 86.010 * Math.log10(waistIn - neckIn) - 70.041 * Math.log10(heightIn) + 36.76;
        }
      } else {
        const hip = data.hipCm || 0;
        if (hip > 0) {
          const waistIn = waist / 2.54;
          const hipIn = hip / 2.54;
          const neckIn = neck / 2.54;
          const heightIn = height / 2.54;
          if ((waistIn + hipIn) > neckIn) {
            bodyFatPct = 163.205 * Math.log10(waistIn + hipIn - neckIn) - 97.684 * Math.log10(heightIn) - 78.387;
          }
        }
      }
    }
  }

  // 2. Calculate BMR
  let bmr = 0;
  if (bodyFatPct !== null && bodyFatPct > 0 && !isNaN(bodyFatPct)) {
    // Katch-McArdle BMR (gold standard based on lean mass)
    const leanMass = data.weightKg * (1 - bodyFatPct / 100);
    bmr = 370 + 21.6 * leanMass;
  } else {
    // Mifflin-St Jeor fallback
    bmr = 10 * data.weightKg + 6.25 * data.heightCm - 5 * data.age;
    if (data.gender === "male") {
      bmr += 5;
    } else if (data.gender === "female") {
      bmr -= 161;
    } else {
      bmr -= 80;
    }
  }

  const multipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };
  const tdee = bmr * multipliers[data.activityLevel];

  // Calculate reference weight based on body composition (BMI rules)
  const heightM = data.heightCm / 100;
  const bmi = data.weightKg / (heightM * heightM);
  let referenceWeight = data.weightKg;
  if (bmi > 25) {
    const idealWeight = 22 * heightM * heightM;
    referenceWeight = data.targetWeightKg || idealWeight;
  }

  let targetCalories = tdee;
  let targetProteinG = referenceWeight * 2.0;

  if (data.goal === "lose_fat") {
    targetCalories -= 500;
    targetProteinG = referenceWeight * 2.2;
  } else if (data.goal === "build_muscle") {
    targetCalories += 300;
    targetProteinG = referenceWeight * 1.8;
  } else if (data.goal === "recomp") {
    targetCalories -= 100;
    targetProteinG = referenceWeight * 2.3;
  }

  // Apply custom calorie/protein target overrides if requested (Philosophy 18: Autonomy)
  if (data.useCustomMacros) {
    if (data.customCalories && data.customCalories > 0) {
      targetCalories = data.customCalories;
    }
    if (data.customProtein && data.customProtein > 0) {
      targetProteinG = data.customProtein;
    }
  }

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targetCalories: Math.round(targetCalories),
    targetProteinG: Math.round(targetProteinG),
  };
}

/**
 * Seeds 7 days of sample historical health data events so the
 * dashboard, graphs, and weekly review have data on first login.
 * Uses the user's actual weight instead of hardcoded values.
 */
async function seedDemoData(userId: string, userWeightKg: number, dietPreference: string) {
  const now = new Date();
  const events = [];

  // Determine meal templates based on diet preference
  const isVeg = dietPreference === "vegetarian" || dietPreference === "vegan";
  const meals = isVeg
    ? {
        breakfast: { name: "Poha + Chai", cal: 380, prot: 8, foods: [{ name: "Poha", portionSize: "medium", estimatedCalories: 280, proteinG: 5 }, { name: "Chai", portionSize: "small", estimatedCalories: 100, proteinG: 3 }] },
        lunch: { name: "Dal Rice + Raita", cal: 620, prot: 18, foods: [{ name: "Dal", portionSize: "medium", estimatedCalories: 220, proteinG: 10 }, { name: "Rice", portionSize: "medium", estimatedCalories: 300, proteinG: 5 }, { name: "Raita", portionSize: "small", estimatedCalories: 100, proteinG: 3 }] },
        dinner: { name: "Paneer Bhurji + Roti", cal: 580, prot: 26, foods: [{ name: "Paneer Bhurji", portionSize: "medium", estimatedCalories: 330, proteinG: 18 }, { name: "Roti", portionSize: "medium", estimatedCalories: 250, proteinG: 8 }] },
      }
    : {
        breakfast: { name: "Egg Omelette + Toast", cal: 420, prot: 22, foods: [{ name: "Omelette (3 eggs)", portionSize: "medium", estimatedCalories: 320, proteinG: 19 }, { name: "Toast", portionSize: "small", estimatedCalories: 100, proteinG: 3 }] },
        lunch: { name: "Chicken Curry + Rice", cal: 680, prot: 35, foods: [{ name: "Chicken Curry", portionSize: "medium", estimatedCalories: 380, proteinG: 28 }, { name: "Rice", portionSize: "medium", estimatedCalories: 300, proteinG: 7 }] },
        dinner: { name: "Dal Tadka + Roti + Curd", cal: 590, prot: 22, foods: [{ name: "Dal Tadka", portionSize: "medium", estimatedCalories: 220, proteinG: 10 }, { name: "Roti", portionSize: "medium", estimatedCalories: 250, proteinG: 8 }, { name: "Curd", portionSize: "small", estimatedCalories: 120, proteinG: 4 }] },
      };

  for (let i = 7; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);

    // 1. Weight Event (gradual trend from user's actual weight)
    const weightKg = userWeightKg + (i * 0.12); // slightly higher in the past
    events.push({
      userId,
      type: "weight",
      timestamp: new Date(date.setHours(8, 0, 0, 0)).toISOString(),
      payload: { weightKg: Math.round(weightKg * 10) / 10 },
      source: "manual",
    });

    // 2. Sleep Event (fluctuating rest)
    const sleepHours = 6.2 + Math.random() * 1.6;
    events.push({
      userId,
      type: "sleep",
      timestamp: new Date(date.setHours(7, 30, 0, 0)).toISOString(),
      payload: { hours: Math.round(sleepHours * 10) / 10 },
      source: "wearable",
    });

    // 3. Steps Event
    const stepsCount = 8200 + Math.floor(Math.random() * 4500);
    events.push({
      userId,
      type: "steps",
      timestamp: new Date(date.setHours(21, 0, 0, 0)).toISOString(),
      payload: { count: stepsCount },
      source: "wearable",
    });

    // 4. Meal Events (use diet-appropriate templates)
    events.push({
      userId, type: "meal",
      timestamp: new Date(date.setHours(9, 30, 0, 0)).toISOString(),
      payload: { name: meals.breakfast.name, totalCalories: meals.breakfast.cal, totalProteinG: meals.breakfast.prot, foods: meals.breakfast.foods },
      source: "ai_vision",
    });
    events.push({
      userId, type: "meal",
      timestamp: new Date(date.setHours(13, 30, 0, 0)).toISOString(),
      payload: { name: meals.lunch.name, totalCalories: meals.lunch.cal, totalProteinG: meals.lunch.prot, foods: meals.lunch.foods },
      source: "ai_vision",
    });
    if (i > 0) {
      events.push({
        userId, type: "meal",
        timestamp: new Date(date.setHours(20, 30, 0, 0)).toISOString(),
        payload: { name: meals.dinner.name, totalCalories: meals.dinner.cal, totalProteinG: meals.dinner.prot, foods: meals.dinner.foods },
        source: "ai_vision",
      });
    }

    // 5. Workouts (every other day with realistic progression)
    if (i % 2 === 0) {
      const isPushDay = i % 4 === 0;
      events.push({
        userId,
        type: "workout",
        timestamp: new Date(date.setHours(18, 0, 0, 0)).toISOString(),
        payload: {
          name: isPushDay ? "Push Day" : "Pull Day",
          totalVolumeKg: 2300 + i * 50,
          completedSets: 12,
          exercises: isPushDay
            ? [
                { id: "bench_press", name: "Barbell Bench Press", sets: [{ weight: 40 + (7 - i) * 0.5, reps: 8, completed: true }, { weight: 40 + (7 - i) * 0.5, reps: 8, completed: true }, { weight: 40 + (7 - i) * 0.5, reps: 7, completed: true }] },
                { id: "incline_db_press", name: "Incline Dumbbell Press", sets: [{ weight: 14 + (7 - i) * 0.2, reps: 10, completed: true }, { weight: 14 + (7 - i) * 0.2, reps: 10, completed: true }, { weight: 14 + (7 - i) * 0.2, reps: 9, completed: true }] },
                { id: "lateral_raises", name: "Lateral Raises", sets: [{ weight: 8, reps: 12, completed: true }, { weight: 8, reps: 12, completed: true }, { weight: 8, reps: 12, completed: true }] },
              ]
            : [
                { id: "barbell_row", name: "Barbell Row", sets: [{ weight: 40, reps: 10, completed: true }, { weight: 40, reps: 10, completed: true }, { weight: 40, reps: 9, completed: true }] },
                { id: "lat_pulldown", name: "Lat Pulldown", sets: [{ weight: 35, reps: 10, completed: true }, { weight: 35, reps: 10, completed: true }, { weight: 35, reps: 10, completed: true }] },
                { id: "face_pulls", name: "Face Pulls", sets: [{ weight: 15, reps: 15, completed: true }, { weight: 15, reps: 15, completed: true }, { weight: 15, reps: 14, completed: true }] },
              ],
        },
        source: "manual",
      });
    }
  }

  // Try DB insert, fallback to Local JSON DB if DB is down
  try {
    await connectDB();
    await TimelineEvent.deleteMany({ userId });
    await TimelineEvent.insertMany(events);
    console.log("✅ Seeded sample data to MongoDB");
  } catch (err) {
    console.warn("⚠️ MongoDB offline. Seeding sample data to local_db.json");
    await deleteLocalEvents(userId);
    for (const e of events) {
      await createLocalEvent(e);
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return Response.json({ notInitialized: true }, { status: 200 });
    }

    await connectDB();
    const profile = await UserProfile.findOne({ email: email.toLowerCase() }).lean();

    if (!profile) {
      return Response.json({ notInitialized: true }, { status: 200 });
    }

    return Response.json({ profile });
  } catch (error) {
    console.warn("⚠️ MongoDB connection failed. Falling back to local file DB.");
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    const profile = await getLocalProfile(email || undefined);
    if (!profile) {
      return Response.json({ notInitialized: true }, { status: 200 });
    }
    return Response.json({ profile });
  }
}

/**
 * POST /api/profile
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    name,
    email,
    age,
    gender,
    heightCm,
    weightKg,
    targetWeightKg,
    goal,
    activityLevel,
    gymExperience,
    gymFrequency,
    gymAccess,
    messAccess,
    dietPreference,
    foodAllergies,
    medicalConditions,
    sleepTarget,
    collegeSchedule,
    seedDemo,
    neckCm,
    waistCm,
    hipCm,
    customCalories,
    customProtein,
    useCustomMacros,
  } = body;

  if (!name || !email || !age || !gender || !heightCm || !weightKg || !goal || !activityLevel || !gymExperience) {
    return Response.json(
      { error: "Basics, physical details, goal, activity level, and experience are required" },
      { status: 400 }
    );
  }

  const parsedWeight = parseFloat(weightKg);

  const targets = calculateHealthTargets({
    age: parseInt(age),
    gender,
    heightCm: parseInt(heightCm),
    weightKg: parsedWeight,
    targetWeightKg: targetWeightKg ? parseFloat(targetWeightKg) : undefined,
    neckCm: neckCm ? parseFloat(neckCm) : undefined,
    waistCm: waistCm ? parseFloat(waistCm) : undefined,
    hipCm: hipCm ? parseFloat(hipCm) : undefined,
    customCalories: customCalories ? parseInt(customCalories) : undefined,
    customProtein: customProtein ? parseInt(customProtein) : undefined,
    useCustomMacros: useCustomMacros || false,
    goal,
    activityLevel,
    gymExperience,
  });

  const profileData = {
    name,
    email,
    age: parseInt(age),
    gender,
    heightCm: parseInt(heightCm),
    weightKg: parsedWeight,
    targetWeightKg: targetWeightKg ? parseFloat(targetWeightKg) : parsedWeight,
    goal,
    activityLevel,
    gymExperience,
    gymFrequency: gymFrequency ? parseInt(gymFrequency) : 4,
    gymAccess: gymAccess || "college_gym",
    messAccess: messAccess || "hostel_mess",
    dietPreference: dietPreference || "none",
    foodAllergies: foodAllergies || [],
    medicalConditions: medicalConditions || [],
    sleepTarget: parseInt(sleepTarget || "8"),
    collegeSchedule: collegeSchedule || "",
    neckCm: neckCm ? parseFloat(neckCm) : undefined,
    waistCm: waistCm ? parseFloat(waistCm) : undefined,
    hipCm: hipCm ? parseFloat(hipCm) : undefined,
    customCalories: customCalories ? parseInt(customCalories) : undefined,
    customProtein: customProtein ? parseInt(customProtein) : undefined,
    useCustomMacros: useCustomMacros || false,
    ...targets,
  };

  let savedProfile: any = null;
  let isNewProfile = false;

  try {
    await connectDB();

    // Check if profile already exists
    const existingProfile = await UserProfile.findOne({ email }).lean();
    isNewProfile = !existingProfile;

    savedProfile = await UserProfile.findOneAndUpdate(
      { email },
      profileData,
      { new: true, upsert: true }
    );
  } catch (error) {
    console.warn("⚠️ MongoDB connection failed during POST. Saving to local file DB.");
    const existingLocal = await getLocalProfile(email);
    isNewProfile = !existingLocal;
    savedProfile = await saveLocalProfile(profileData);
  }

  // Only seed sample data on FIRST profile creation and if user requested it
  if (savedProfile && isNewProfile && seedDemo === true) {
    await seedDemoData(
      savedProfile._id.toString(),
      parsedWeight,
      dietPreference || "none"
    );
  }

  return Response.json({ profile: savedProfile }, { status: 200 });
}

/**
 * DELETE /api/profile
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return Response.json({ error: "email is required" }, { status: 400 });
    }

    try {
      await connectDB();
      const profile = await UserProfile.findOne({ email: email.toLowerCase() });
      if (profile) {
        const userId = profile._id.toString();
        // Delete all timeline events for this user
        await TimelineEvent.deleteMany({ userId });
        // Delete user profile
        await UserProfile.deleteOne({ email: email.toLowerCase() });
        console.log(`✅ Deleted MongoDB profile and timeline events for: ${email}`);
      }
    } catch (dbError) {
      console.warn("⚠️ MongoDB offline. Deleting local JSON record.");
      const profile = await getLocalProfile(email);
      if (profile) {
        const userId = profile._id.toString();
        await deleteLocalEvents(userId);
        await deleteLocalProfile(email);
        console.log(`✅ Deleted local JSON profile and events for: ${email}`);
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Profile DELETE error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

