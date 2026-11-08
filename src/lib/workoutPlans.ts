export interface Exercise {
  id: string;
  name: string;
  muscle: string;
  equipment: "barbell" | "dumbbell" | "cable" | "bodyweight" | "machine";
  targetSets: number;
  targetReps: string;
  restSeconds: number;
  youtubeId?: string;
}

export interface WorkoutPlan {
  name: string;
  focus: string;
  targetDurationMin: number;
  exercises: Exercise[];
}

// Complete library of custom exercises mapping to ChatGPT evidence-based targets with form videos
const EXERCISE_LIBRARY: Record<string, Omit<Exercise, "targetSets" | "targetReps" | "restSeconds">> = {
  // Chest
  bench_press: { id: "bench_press", name: "Barbell Bench Press (2 RIR)", muscle: "chest", equipment: "barbell", youtubeId: "fGm-ef-4PVk?t=107" },
  incline_db_press: { id: "incline_db_press", name: "Incline Dumbbell Press", muscle: "chest", equipment: "dumbbell", youtubeId: "fGm-ef-4PVk?t=256" },
  pec_deck_fly: { id: "pec_deck_fly", name: "Pec Deck Fly", muscle: "chest", equipment: "machine", youtubeId: "fGm-ef-4PVk?t=669" },
  incline_smith_press: { id: "incline_smith_press", name: "Incline Smith Press", muscle: "chest", equipment: "machine", youtubeId: "fGm-ef-4PVk?t=586" },
  machine_chest_press: { id: "machine_chest_press", name: "Machine Chest Press", muscle: "chest", equipment: "machine", youtubeId: "fGm-ef-4PVk?t=276" },
  high_to_low_cable_fly: { id: "high_to_low_cable_fly", name: "High-to-Low Cable Fly", muscle: "chest", equipment: "cable", youtubeId: "5SrkaIbDth4" },

  // Back / Lats
  wide_grip_lat_pulldown: { id: "wide_grip_lat_pulldown", name: "Wide Grip Lat Pulldown", muscle: "back", equipment: "machine", youtubeId: "jLvqKgW-_G8?t=218" },
  chest_supported_row: { id: "chest_supported_row", name: "Chest Supported Row", muscle: "back", equipment: "machine", youtubeId: "jLvqKgW-_G8?t=533" },
  seated_cable_row: { id: "seated_cable_row", name: "Seated Cable Row", muscle: "back", equipment: "cable", youtubeId: "jLvqKgW-_G8?t=562" },
  neutral_grip_pulldown: { id: "neutral_grip_pulldown", name: "Neutral Grip Pulldown", muscle: "back", equipment: "machine", youtubeId: "jLvqKgW-_G8?t=239" },
  single_arm_cable_row: { id: "single_arm_cable_row", name: "Single Arm Cable Row", muscle: "back", equipment: "cable", youtubeId: "jLvqKgW-_G8?t=278" },
  straight_arm_pulldown: { id: "straight_arm_pulldown", name: "Straight Arm Pulldown", muscle: "back", equipment: "cable", youtubeId: "jLvqKgW-_G8?t=637" },

  // Shoulders
  cable_lateral_raise: { id: "cable_lateral_raise", name: "Cable Lateral Raise", muscle: "shoulders", equipment: "cable", youtubeId: "SgyUoY0IZ7A?t=477" },
  reverse_pec_deck: { id: "reverse_pec_deck", name: "Reverse Pec Deck", muscle: "shoulders", equipment: "machine", youtubeId: "SgyUoY0IZ7A?t=626" },
  face_pull: { id: "face_pull", name: "Cable Face Pull", muscle: "shoulders", equipment: "cable", youtubeId: "SgyUoY0IZ7A?t=661" },
  machine_shoulder_press: { id: "machine_shoulder_press", name: "Machine Shoulder Press", muscle: "shoulders", equipment: "machine", youtubeId: "SgyUoY0IZ7A?t=349" },
  seated_db_shoulder_press: { id: "seated_db_shoulder_press", name: "Seated DB Shoulder Press (30° Scapular Tuck)", muscle: "shoulders", equipment: "dumbbell", youtubeId: "SgyUoY0IZ7A?t=349" },
  lean_away_lateral_raise: { id: "lean_away_lateral_raise", name: "Lean-Away Dumbbell Lateral Raise", muscle: "shoulders", equipment: "dumbbell", youtubeId: "SgyUoY0IZ7A?t=178" },

  // Biceps & Triceps
  bayesian_curl: { id: "bayesian_curl", name: "Bayesian Cable Curl", muscle: "biceps", equipment: "cable", youtubeId: "GNO4OtYoCYk?t=628" },
  preacher_curl: { id: "preacher_curl", name: "EZ-Bar Preacher Curl", muscle: "biceps", equipment: "barbell", youtubeId: "GNO4OtYoCYk?t=265" },
  hammer_curl: { id: "hammer_curl", name: "Dumbbell Hammer Curl", muscle: "biceps", equipment: "dumbbell", youtubeId: "GNO4OtYoCYk?t=786" },
  incline_db_curl: { id: "incline_db_curl", name: "Incline Dumbbell Curl", muscle: "biceps", equipment: "dumbbell", youtubeId: "GNO4OtYoCYk?t=320" },
  rope_pushdown: { id: "rope_pushdown", name: "Cable Rope Pushdown", muscle: "triceps", equipment: "cable", youtubeId: "OpRMRhr0Ycc?t=60" },
  overhead_cable_extension: { id: "overhead_cable_extension", name: "Overhead Cable Rope Extension", muscle: "triceps", equipment: "cable", youtubeId: "OpRMRhr0Ycc?t=193" },
  single_arm_cross_body_ext: { id: "single_arm_cross_body_ext", name: "Single Arm Cross-Body Cable Extension", muscle: "triceps", equipment: "cable", youtubeId: "OpRMRhr0Ycc?t=295" },

  // Quads/Glutes/Hamstrings
  hack_squat: { id: "hack_squat", name: "Hack Squat Machine", muscle: "quads", equipment: "machine", youtubeId: "kIXcoivzGf8?t=276" },
  leg_press: { id: "leg_press", name: "Leg Press Machine", muscle: "quads", equipment: "machine", youtubeId: "kIXcoivzGf8?t=350" },
  leg_extension: { id: "leg_extension", name: "Leg Extension Machine", muscle: "quads", equipment: "machine", youtubeId: "kIXcoivzGf8?t=425" },
  romanian_deadlift: { id: "romanian_deadlift", name: "Barbell Romanian Deadlift", muscle: "hamstrings", equipment: "barbell", youtubeId: "0a_fVS2s4Ho?t=180" },
  seated_leg_curl: { id: "seated_leg_curl", name: "Seated Leg Curl Machine", muscle: "hamstrings", equipment: "machine", youtubeId: "0a_fVS2s4Ho?t=433" },
  lying_leg_curl: { id: "lying_leg_curl", name: "Lying Leg Curl Machine", muscle: "hamstrings", equipment: "machine", youtubeId: "0a_fVS2s4Ho?t=326" },
  parent_squat: { id: "parent_squat", name: "Back Squat", muscle: "quads", equipment: "barbell", youtubeId: "kIXcoivzGf8?t=121" },
  hip_thrust: { id: "hip_thrust", name: "Glute Hip Thrust", muscle: "glutes", equipment: "barbell", youtubeId: "3ryh7PNhz3E?t=126" },
  standing_calf_raise: { id: "standing_calf_raise", name: "Standing Calf Raises", muscle: "calves", equipment: "machine", youtubeId: "21inrjhoFkQ?t=1" },
  seated_calf_raise: { id: "seated_calf_raise", name: "Seated Calf Raises", muscle: "calves", equipment: "machine", youtubeId: "21inrjhoFkQ?t=1" },
  bulgarian_split_squat: { id: "bulgarian_split_squat", name: "Bulgarian Split Squat", muscle: "quads", equipment: "dumbbell", youtubeId: "kIXcoivzGf8?t=574" },
  walking_lunges: { id: "walking_lunges", name: "Walking Dumbbell Lunges (Use Straps)", muscle: "quads", equipment: "dumbbell", youtubeId: "kIXcoivzGf8?t=574" },
  front_squat: { id: "front_squat", name: "Front Squat OR Smith Squat", muscle: "quads", equipment: "barbell", youtubeId: "kIXcoivzGf8?t=184" },

  // Core & Recovery Work
  cable_crunch: { id: "cable_crunch", name: "Cable Crunch", muscle: "core", equipment: "cable", youtubeId: "Tn-XvYG9x7w?t=183" },
  cable_woodchopper: { id: "cable_woodchopper", name: "Cable Woodchoppers", muscle: "core", equipment: "cable", youtubeId: "Tn-XvYG9x7w?t=183" },
  cable_chest_fly: { id: "cable_chest_fly", name: "Cable Chest Fly", muscle: "chest", equipment: "cable", youtubeId: "fGm-ef-4PVk?t=669" },
  single_arm_db_row: { id: "single_arm_db_row", name: "Single-Arm Dumbbell Row (Bench)", muscle: "back", equipment: "dumbbell", youtubeId: "jLvqKgW-_G8?t=278" },
  hanging_knee_raise: { id: "hanging_knee_raise", name: "Hanging Knee Raise", muscle: "core", equipment: "bodyweight", youtubeId: "Pr1ieGZ5atk?t=1" },
  dead_bug: { id: "dead_bug", name: "Dead Bug", muscle: "core", equipment: "bodyweight", youtubeId: "iTOFy7oN00k?t=0" },
  bird_dog: { id: "bird_dog", name: "Bird Dog", muscle: "core", equipment: "bodyweight", youtubeId: "pW80G48QAIo?t=1" },
  plank: { id: "plank", name: "Standard Forearm Plank", muscle: "core", equipment: "bodyweight", youtubeId: "1G0y8D5rFDc?t=74" },
  ab_wheel: { id: "ab_wheel", name: "Ab Wheel", muscle: "core", equipment: "bodyweight", youtubeId: "1G0y8D5rFDc?t=302" },
  
  // Cardio & Walks
  zone_2_cardio: { id: "zone_2_cardio", name: "Zone 2 Cardio (Brisk Walk or Treadmill)", muscle: "conditioning", equipment: "bodyweight", youtubeId: "JH76GpD9spc?t=1" },
  incline_walk: { id: "incline_walk", name: "Incline Treadmill Walk", muscle: "conditioning", equipment: "machine", youtubeId: "JH76GpD9spc?t=1" },
  mobility_routine: { id: "mobility_routine", name: "Full Body Mobility Routine", muscle: "recovery", equipment: "bodyweight", youtubeId: "E81GN-3A8XM?t=1" },
};

/**
 * Returns the weekly schedule mapping of dayIndex (0 = Sun, 1 = Mon...) to workout type
 */
export function getWeekSchedule(gymFrequency: number): { day: number; name: string }[] {
  // 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday
  switch (gymFrequency) {
    case 3:
      return [
        { day: 2, name: "Tuesday — Push" },
        { day: 3, name: "Wednesday — Pull" },
        { day: 5, name: "Friday — Legs" },
      ];
    case 4:
      return [
        { day: 2, name: "Tuesday — Upper A" },
        { day: 3, name: "Wednesday — Lower A" },
        { day: 5, name: "Friday — Upper B" },
        { day: 6, name: "Saturday — Lower B" },
      ];
    case 5:
      return [
        { day: 2, name: "Tuesday — Upper A" },
        { day: 3, name: "Wednesday — Lower A" },
        { day: 4, name: "Thursday — Push" },
        { day: 5, name: "Friday — Pull" },
        { day: 6, name: "Saturday — Legs" },
      ];
    case 6:
      return [
        { day: 2, name: "Tuesday — Push A" },
        { day: 3, name: "Wednesday — Pull A" },
        { day: 4, name: "Thursday — Legs A" },
        { day: 5, name: "Friday — Push B" },
        { day: 6, name: "Saturday — Pull B" },
        { day: 0, name: "Sunday — Legs B" },
      ];
    default:
      return getWeekSchedule(4);
  }
}

const SUPPORTED_FREQUENCIES = [3, 4, 5, 6];

export interface PreviousSet {
  weight?: number;
  reps?: number;
  completed?: boolean;
}

export interface ProgressionResult {
  previousWeight: number;
  suggestedWeight: number;
}

/**
 * Double progression: add weight only after every working set at the top
 * weight reached the top of the rep range. Returns null when the sets hold no
 * usable data, so the caller can look further back in history.
 */
export function calculateProgression(
  sets: PreviousSet[],
  targetReps: string,
  exerciseId: string = ""
): ProgressionResult | null {
  const completed = sets.filter((set) => set.completed);
  const working = completed.length > 0 ? completed : sets;
  const previousWeight = Math.max(0, ...working.map((set) => set.weight || 0));
  if (previousWeight <= 0) return null;

  const topSets = working.filter((set) => set.weight === previousWeight);
  const lowestReps = Math.min(...topSets.map((set) => set.reps || 0));
  const repNumbers = targetReps.match(/\d+/g);
  const topOfRange = repNumbers ? parseInt(repNumbers[Math.min(1, repNumbers.length - 1)], 10) : NaN;

  const increment = /dumbbell|db|lateral/.test(exerciseId) ? 2 : 2.5;
  const earnedIncrease = !Number.isNaN(topOfRange) && lowestReps >= topOfRange;

  return { previousWeight, suggestedWeight: earnedIncrease ? previousWeight + increment : previousWeight };
}

/**
 * Generates today's workout plan based on user specs and the day of week.
 */
export function getTodaysWorkout(
  profile?: {
    gymFrequency?: number;
    gymExperience?: string;
    goal?: string;
    customWorkoutPlan?: Record<string, unknown>;
  },
  dayOfWeek?: number
): WorkoutPlan {
  // Only the supported splits have exercise programs; anything else gets the default.
  const frequency = SUPPORTED_FREQUENCIES.includes(profile?.gymFrequency as number) ? (profile?.gymFrequency as number) : 4;
  const targetDay = dayOfWeek !== undefined ? dayOfWeek : new Date().getDay();

  const customPlan = profile?.customWorkoutPlan?.[targetDay];
  if (customPlan) return customPlan as WorkoutPlan;

  // Find if today is scheduled as a workout
  const schedule = getWeekSchedule(frequency);
  const scheduledWorkout = schedule.find((s) => s.day === targetDay);

  if (!scheduledWorkout) {
    return {
      name: "Rest Day",
      focus: "Recovery & Mobility",
      targetDurationMin: 20,
      exercises: [],
    };
  }

  const name = scheduledWorkout.name;
  let focus = "General Fitness";
  let duration = 45;
  const exerciseSpecs: { id: string; sets: number; reps: string; rest: number }[] = [];

  // ── 3-Day Lifting Program (Push, Pull, Legs) with custom posture and joint guidelines ──
  // The 5-day split combines the Upper/Lower A days with Push, Pull and Legs.
  if (frequency === 3 || (frequency === 5 && /Push|Pull|Legs/.test(name))) {
    if (name.includes("Push")) {
      focus = "Chest, Shoulders & Triceps (Shoulder Friendly)";
      duration = 50;
      exerciseSpecs.push(
        { id: "bench_press", sets: 3, reps: "6-8", rest: 150 },
        { id: "incline_db_press", sets: 3, reps: "8-10", rest: 90 },
        { id: "pec_deck_fly", sets: 3, reps: "12-15", rest: 90 },
        { id: "cable_lateral_raise", sets: 3, reps: "12-15", rest: 90 },
        { id: "rope_pushdown", sets: 3, reps: "10-12", rest: 90 },
        { id: "overhead_cable_extension", sets: 2, reps: "12-15", rest: 90 }
      );
    } else if (name.includes("Pull")) {
      focus = "Lats, Upper Back & Biceps (Postural Focus)";
      duration = 50;
      exerciseSpecs.push(
        { id: "wide_grip_lat_pulldown", sets: 3, reps: "8-10", rest: 90 },
        { id: "chest_supported_row", sets: 3, reps: "8-10", rest: 90 },
        { id: "reverse_pec_deck", sets: 3, reps: "15", rest: 90 },
        { id: "face_pull", sets: 3, reps: "15", rest: 90 },
        { id: "bayesian_curl", sets: 3, reps: "10-12", rest: 60 },
        { id: "hammer_curl", sets: 2, reps: "12-15", rest: 60 }
      );
    } else if (name.includes("Legs")) {
      focus = "Quads, Hamstrings, Glutes & Calves (Joint Friendly)";
      duration = 55;
      exerciseSpecs.push(
        { id: "hack_squat", sets: 3, reps: "8-10", rest: 120 },
        { id: "leg_press", sets: 3, reps: "10-12", rest: 90 },
        { id: "romanian_deadlift", sets: 3, reps: "8-10", rest: 120 },
        { id: "seated_leg_curl", sets: 3, reps: "10-12", rest: 90 },
        { id: "standing_calf_raise", sets: 4, reps: "12-15", rest: 60 },
        { id: "seated_calf_raise", sets: 3, reps: "15-20", rest: 60 }
      );
    }
  }
  // ── 4-Day Lifting Program (Upper A, Lower A, Upper B, Lower B) ──
  else if (frequency === 4 || frequency === 5) {
    if (name.includes("Upper A")) {
      focus = "Upper Body Horizontal Power & Arms";
      duration = 55;
      exerciseSpecs.push(
        { id: "incline_db_press", sets: 3, reps: "6-8", rest: 120 },
        { id: "single_arm_db_row", sets: 3, reps: "8-10", rest: 90 },
        { id: "seated_cable_row", sets: 3, reps: "10-12", rest: 90 },
        { id: "cable_lateral_raise", sets: 3, reps: "12-15", rest: 60 },
        { id: "rope_pushdown", sets: 3, reps: "10-12", rest: 60 },
        { id: "bayesian_curl", sets: 3, reps: "10-12", rest: 60 }
      );
    } else if (name.includes("Lower A")) {
      focus = "Lower Body Quad Strength, Hamstrings & Core";
      duration = 55;
      exerciseSpecs.push(
        { id: "hack_squat", sets: 3, reps: "6-8", rest: 150 },
        { id: "romanian_deadlift", sets: 3, reps: "8-10", rest: 120 },
        { id: "leg_extension", sets: 3, reps: "12-15", rest: 75 },
        { id: "seated_leg_curl", sets: 3, reps: "10-12", rest: 75 },
        { id: "standing_calf_raise", sets: 3, reps: "12-15", rest: 60 },
        { id: "cable_crunch", sets: 3, reps: "12-15", rest: 60 }
      );
    } else if (name.includes("Upper B")) {
      focus = "Upper Body Vertical Pull, 3D Shoulders & Arms";
      duration = 55;
      exerciseSpecs.push(
        { id: "neutral_grip_pulldown", sets: 3, reps: "8-10", rest: 90 },
        { id: "seated_db_shoulder_press", sets: 3, reps: "8-10", rest: 90 },
        { id: "cable_chest_fly", sets: 3, reps: "12-15", rest: 75 },
        { id: "face_pull", sets: 3, reps: "15", rest: 60 },
        { id: "preacher_curl", sets: 3, reps: "10-12", rest: 60 },
        { id: "overhead_cable_extension", sets: 3, reps: "10-12", rest: 60 }
      );
    } else if (name.includes("Lower B")) {
      focus = "Lower Body Posterior Chain, Glutes & Obliques";
      duration = 55;
      exerciseSpecs.push(
        { id: "front_squat", sets: 3, reps: "8-10", rest: 120 },
        { id: "lying_leg_curl", sets: 3, reps: "10-12", rest: 75 },
        { id: "walking_lunges", sets: 3, reps: "10/leg", rest: 90 },
        { id: "seated_calf_raise", sets: 3, reps: "15-20", rest: 60 },
        { id: "hanging_knee_raise", sets: 3, reps: "12-15", rest: 60 },
        { id: "cable_woodchopper", sets: 3, reps: "12/side", rest: 45 }
      );
    }
  }
  // ── 6-Day Lifting Program (Push A, Pull A, Legs A, Push B, Pull B, Legs B) ──
  else if (frequency === 6) {
    if (name.includes("Push A")) {
      focus = "Chest, Shoulders & Triceps Strength A";
      duration = 50;
      exerciseSpecs.push(
        { id: "bench_press", sets: 3, reps: "6-8", rest: 150 },
        { id: "incline_db_press", sets: 3, reps: "8-10", rest: 90 },
        { id: "cable_lateral_raise", sets: 4, reps: "12-15", rest: 90 },
        { id: "rope_pushdown", sets: 3, reps: "10-12", rest: 90 },
        { id: "cable_crunch", sets: 3, reps: "15", rest: 60 }
      );
    } else if (name.includes("Pull A")) {
      focus = "Lats, Posterior Delts & Biceps A";
      duration = 50;
      exerciseSpecs.push(
        { id: "wide_grip_lat_pulldown", sets: 3, reps: "8-10", rest: 90 },
        { id: "chest_supported_row", sets: 3, reps: "8-10", rest: 90 },
        { id: "reverse_pec_deck", sets: 3, reps: "15", rest: 90 },
        { id: "bayesian_curl", sets: 3, reps: "10-12", rest: 60 },
        { id: "hammer_curl", sets: 2, reps: "12-15", rest: 60 }
      );
    } else if (name.includes("Legs A")) {
      focus = "Quads, Hamstrings & Calves Joint-Safe A";
      duration = 55;
      exerciseSpecs.push(
        { id: "hack_squat", sets: 3, reps: "8-10", rest: 120 },
        { id: "romanian_deadlift", sets: 3, reps: "8-10", rest: 120 },
        { id: "leg_extension", sets: 3, reps: "15", rest: 90 },
        { id: "standing_calf_raise", sets: 4, reps: "12-15", rest: 60 }
      );
    } else if (name.includes("Push B")) {
      focus = "Chest, Shoulders & Triceps Hypertrophy B";
      duration = 50;
      exerciseSpecs.push(
        { id: "incline_smith_press", sets: 3, reps: "8", rest: 120 },
        { id: "pec_deck_fly", sets: 3, reps: "12-15", rest: 90 },
        { id: "lean_away_lateral_raise", sets: 3, reps: "15", rest: 90 },
        { id: "overhead_cable_extension", sets: 3, reps: "12-15", rest: 90 },
        { id: "dead_bug", sets: 3, reps: "12", rest: 45 }
      );
    } else if (name.includes("Pull B")) {
      focus = "Lats, Mid-Back & Arm Accessories B";
      duration = 50;
      exerciseSpecs.push(
        { id: "neutral_grip_pulldown", sets: 3, reps: "10", rest: 90 },
        { id: "seated_cable_row", sets: 3, reps: "10-12", rest: 90 },
        { id: "face_pull", sets: 3, reps: "15", rest: 90 },
        { id: "preacher_curl", sets: 3, reps: "10-12", rest: 60 },
        { id: "bayesian_curl", sets: 3, reps: "12", rest: 60 }
      );
    } else if (name.includes("Legs B")) {
      focus = "Leg Volume & Glute Accessories B";
      duration = 50;
      exerciseSpecs.push(
        { id: "leg_press", sets: 3, reps: "10-12", rest: 90 },
        { id: "seated_leg_curl", sets: 3, reps: "10-12", rest: 90 },
        { id: "hip_thrust", sets: 2, reps: "10-12", rest: 90 },
        { id: "seated_calf_raise", sets: 3, reps: "15-20", rest: 60 }
      );
    }
  }

  // Map exerciseSpecs to fully formed Exercise objects
  const exercises: Exercise[] = exerciseSpecs
    .filter((spec) => EXERCISE_LIBRARY[spec.id] !== undefined)
    .map((spec) => {
      const base = EXERCISE_LIBRARY[spec.id];
      return {
        ...base,
        targetSets: spec.sets,
        targetReps: spec.reps,
        restSeconds: spec.rest,
      } as Exercise;
    });

  return {
    name,
    focus,
    targetDurationMin: duration,
    exercises,
  };
}

/* ─────────────────────────────────────────────
 * Weekly plans: templates and user edits
 * ───────────────────────────────────────────── */

export type WeekPlan = Record<string, WorkoutPlan>;
export type LibraryExercise = Omit<Exercise, "targetSets" | "targetReps" | "restSeconds">;

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const EQUIPMENT: Exercise["equipment"][] = ["barbell", "dumbbell", "cable", "bodyweight", "machine"];
const MAX_EXERCISES_PER_DAY = 15;

const REST_DAY: WorkoutPlan = { name: "Rest Day", focus: "Recovery & Mobility", targetDurationMin: 20, exercises: [] };

export function getExerciseLibrary(): LibraryExercise[] {
  return Object.values(EXERCISE_LIBRARY);
}

/** The default week for a number of training days. */
export function buildTemplateWeek(gymFrequency?: number): WeekPlan {
  return Object.fromEntries(ALL_DAYS.map((day) => [day, getTodaysWorkout({ gymFrequency }, day)]));
}

/** The plan the user follows now: their own where they have one, else the template. */
export function getCurrentWeek(profile: Parameters<typeof getTodaysWorkout>[0]): WeekPlan {
  return Object.fromEntries(ALL_DAYS.map((day) => [day, getTodaysWorkout(profile, day)]));
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 50);
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function sanitizeExercise(raw: Partial<Exercise> | null): Exercise | string {
  const name = cleanText(raw?.name, 80);
  if (!name) return "Every exercise needs a name.";

  const targetSets = Math.round(Number(raw?.targetSets));
  if (!(targetSets >= 1 && targetSets <= 10)) return `${name}: sets must be between 1 and 10.`;

  const targetReps = cleanText(raw?.targetReps, 20);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9 /.-]*$/.test(targetReps)) return `${name}: enter reps like 8-12.`;

  const rest = Number(raw?.restSeconds);
  const id = typeof raw?.id === "string" && /^[a-z0-9_]{1,60}$/.test(raw.id) ? raw.id : `custom_${slugify(name)}`;
  const library = EXERCISE_LIBRARY[id];
  const youtubeId = typeof raw?.youtubeId === "string" && /^[\w-]+(\?t=\d+)?$/.test(raw.youtubeId) ? raw.youtubeId : library?.youtubeId;

  return {
    id,
    name,
    muscle: cleanText(raw?.muscle, 30) || library?.muscle || "other",
    equipment: EQUIPMENT.includes(raw?.equipment as Exercise["equipment"]) ? (raw?.equipment as Exercise["equipment"]) : library?.equipment ?? "bodyweight",
    targetSets,
    targetReps,
    restSeconds: rest >= 0 && rest <= 600 ? Math.round(rest) : 90,
    ...(youtubeId ? { youtubeId } : {}),
  };
}

function estimateMinutes(exercises: Exercise[]): number {
  const seconds = exercises.reduce((total, exercise) => total + exercise.targetSets * (exercise.restSeconds + 45), 0);
  return Math.max(10, Math.min(240, Math.round(seconds / 60)));
}

function sanitizeDay(raw: Partial<WorkoutPlan> | null): WorkoutPlan | string {
  if (!Array.isArray(raw?.exercises)) return "Each day needs a list of exercises.";
  if (raw.exercises.length === 0) return REST_DAY;
  if (raw.exercises.length > MAX_EXERCISES_PER_DAY) return `A day can have at most ${MAX_EXERCISES_PER_DAY} exercises.`;

  const exercises: Exercise[] = [];
  for (const candidate of raw.exercises) {
    const exercise = sanitizeExercise(candidate);
    if (typeof exercise === "string") return exercise;
    if (!exercises.some((existing) => existing.id === exercise.id)) exercises.push(exercise);
  }

  const name = cleanText(raw.name, 40);
  if (!name || name === REST_DAY.name) return "Give this training day a name.";

  const minutes = Number(raw.targetDurationMin);
  return {
    name,
    focus: cleanText(raw.focus, 80) || [...new Set(exercises.map((exercise) => exercise.muscle))].slice(0, 4).join(", "),
    targetDurationMin: minutes >= 10 && minutes <= 240 ? Math.round(minutes) : estimateMinutes(exercises),
    exercises,
  };
}

/** Validates a full week. Returns the clean plan, or a message saying what's wrong. */
export function sanitizeWeekPlan(raw: unknown): WeekPlan | string {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "That workout plan isn't valid.";

  const plan: WeekPlan = {};
  for (const day of ALL_DAYS) {
    const result = sanitizeDay((raw as Record<string, Partial<WorkoutPlan>>)[day] ?? null);
    if (typeof result === "string") return result;
    plan[day] = result;
  }
  return plan;
}

function findLibraryExercise(name: string): LibraryExercise | undefined {
  const normalize = (text: string) => text.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const wanted = normalize(name);
  const library = getExerciseLibrary();
  return (
    library.find((exercise) => normalize(exercise.name) === wanted || exercise.id === wanted.replace(/ /g, "_")) ??
    library.find((exercise) => normalize(exercise.name).includes(wanted) || wanted.includes(normalize(exercise.name)))
  );
}

export interface WorkoutDayEdit {
  day?: unknown;
  rest?: unknown;
  name?: unknown;
  add?: { name?: unknown; sets?: unknown; reps?: unknown }[];
  remove?: unknown[];
}

/** Applies one day's change, such as the coach adding an exercise, to a week. */
export function applyWorkoutDayEdit(week: WeekPlan, edit: WorkoutDayEdit): WeekPlan | string {
  const day = DAY_NAMES.indexOf(String(edit.day).toLowerCase());
  if (day === -1) return "Tell me which day to change.";
  if (edit.rest === true) return { ...week, [day]: REST_DAY };

  const current = week[day] ?? REST_DAY;
  const removals = (edit.remove ?? []).map((item) => String(item).toLowerCase());
  const kept = current.exercises.filter(
    (exercise) => !removals.some((item) => exercise.name.toLowerCase().includes(item) || item.includes(exercise.name.toLowerCase()))
  );

  const added = (edit.add ?? []).map((item) => {
    const name = cleanText(item.name, 80);
    const library = findLibraryExercise(name);
    return { ...library, name: library?.name ?? name, id: library?.id, targetSets: item.sets ?? 3, targetReps: item.reps ?? "8-12", restSeconds: 90 };
  }) as Partial<Exercise>[];

  const result = sanitizeDay({
    name: cleanText(edit.name, 40) || (current.name === REST_DAY.name ? "Workout" : current.name),
    exercises: [...kept, ...added] as Exercise[],
  });
  return typeof result === "string" ? result : { ...week, [day]: result };
}
