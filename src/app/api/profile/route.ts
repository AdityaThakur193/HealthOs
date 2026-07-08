import { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { UserProfile, TimelineEvent } from "@/lib/db/models";
import { getLocalProfile, saveLocalProfile, createLocalEvent, deleteLocalEvents, countLocalEvents, deleteLocalProfile } from "@/lib/db/fallback";
import { calculateAdaptiveTdee } from "@/lib/tdee";

export const dynamic = "force-dynamic";

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



export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return Response.json({ notInitialized: true }, { status: 200 });
    }

    await connectDB();
    const profileDoc = await UserProfile.findOne({ email: email.toLowerCase() });

    if (!profileDoc) {
      return Response.json({ notInitialized: true }, { status: 200 });
    }

    const profile = profileDoc.toObject();

    // Query events to calculate Adaptive TDEE
    const events = await TimelineEvent.find({ userId: profile._id }).lean();
    const tdeeResult = calculateAdaptiveTdee(profile, events);

    // If adaptive TDEE is computed and differs from stored, let's update it in the DB
    if (tdeeResult.status === "adaptive" && tdeeResult.calculatedTdee !== profile.tdee) {
      profileDoc.tdee = tdeeResult.calculatedTdee;
      
      // Re-calculate target calories based on goal if custom macros overrides are NOT enabled
      if (!profileDoc.useCustomMacros) {
        let newTargetCalories = tdeeResult.calculatedTdee;
        if (profileDoc.goal === "lose_fat") {
          newTargetCalories -= 500;
        } else if (profileDoc.goal === "build_muscle") {
          newTargetCalories += 300;
        } else if (profileDoc.goal === "recomp") {
          newTargetCalories -= 100;
        }
        profileDoc.targetCalories = Math.round(newTargetCalories);
      }
      
      await profileDoc.save();
      profile.tdee = profileDoc.tdee;
      profile.targetCalories = profileDoc.targetCalories;
    }

    // Calculate Logging Streak
    const uniqueLoggingDays = new Set(
      events.map((e) => new Date(e.timestamp).toDateString())
    );

    let streak = 0;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const todayStr = startOfToday.toDateString();
    const yesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = yesterday.toDateString();

    let currentCheck = startOfToday;
    if (uniqueLoggingDays.has(todayStr)) {
      streak = 1;
      currentCheck = yesterday;
    } else if (uniqueLoggingDays.has(yesterdayStr)) {
      streak = 1;
      currentCheck = new Date(yesterday.getTime() - 24 * 60 * 60 * 1000);
    }

    if (streak > 0) {
      while (true) {
        const dateStr = currentCheck.toDateString();
        if (uniqueLoggingDays.has(dateStr)) {
          streak++;
          currentCheck = new Date(currentCheck.getTime() - 24 * 60 * 60 * 1000);
        } else {
          break;
        }
      }
    }

    return Response.json({
      profile,
      tdeeMode: tdeeResult.status,
      daysRemaining: tdeeResult.daysRemaining,
      avgCalories: tdeeResult.avgCalories,
      weightDeltaKg: tdeeResult.weightDeltaKg,
      streak,
    });
  } catch (error) {
    console.warn("⚠️ MongoDB connection failed. Falling back to local file DB.");
    if (process.env.NODE_ENV === "production") {
      return Response.json({ error: "Database offline. Please try again later." }, { status: 500 });
    }
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    const profile = await getLocalProfile(email || undefined);
    if (!profile) {
      return Response.json({ notInitialized: true }, { status: 200 });
    }
    return Response.json({
      profile,
      tdeeMode: "calibrating",
      daysRemaining: 14,
      avgCalories: 0,
      weightDeltaKg: 0,
    });
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

  const profileData: any = {
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

  if (body.messMenu !== undefined) {
    profileData.messMenu = body.messMenu;
  }
  if (body.dietPlan !== undefined) {
    profileData.dietPlan = body.dietPlan;
  }

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
    if (process.env.NODE_ENV === "production") {
      return Response.json({ error: "Database offline. Please try again later." }, { status: 500 });
    }
    const existingLocal = await getLocalProfile(email);
    isNewProfile = !existingLocal;
    savedProfile = await saveLocalProfile(profileData);
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

