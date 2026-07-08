export interface Exercise {
  id: string;
  name: string;
  muscle: string;
  equipment: "barbell" | "dumbbell" | "cable" | "bodyweight" | "machine";
  targetSets: number;
  targetReps: string;
  restSeconds: number;
}

export interface WorkoutPlan {
  name: string;
  focus: string;
  targetDurationMin: number;
  exercises: Exercise[];
}

// Complete library of custom exercises mapping to ChatGPT evidence-based targets
const EXERCISE_LIBRARY: Record<string, Omit<Exercise, "targetSets" | "targetReps" | "restSeconds">> = {
  // Chest
  bench_press: { id: "bench_press", name: "Barbell Bench Press (2 RIR)", muscle: "chest", equipment: "barbell" },
  incline_db_press: { id: "incline_db_press", name: "Incline Dumbbell Press", muscle: "chest", equipment: "dumbbell" },
  pec_deck_fly: { id: "pec_deck_fly", name: "Pec Deck Fly", muscle: "chest", equipment: "machine" },
  incline_smith_press: { id: "incline_smith_press", name: "Incline Smith Press", muscle: "chest", equipment: "machine" },

  // Back / Lats
  wide_grip_lat_pulldown: { id: "wide_grip_lat_pulldown", name: "Wide Grip Lat Pulldown", muscle: "back", equipment: "machine" },
  chest_supported_row: { id: "chest_supported_row", name: "Chest Supported Row", muscle: "back", equipment: "machine" },
  seated_cable_row: { id: "seated_cable_row", name: "Seated Cable Row", muscle: "back", equipment: "cable" },
  neutral_grip_pulldown: { id: "neutral_grip_pulldown", name: "Neutral Grip Pulldown", muscle: "back", equipment: "machine" },
  single_arm_cable_row: { id: "single_arm_cable_row", name: "Single Arm Cable Row", muscle: "back", equipment: "cable" },

  // Shoulders / Delts
  cable_lateral_raise: { id: "cable_lateral_raise", name: "Cable Lateral Raise", muscle: "shoulders", equipment: "cable" },
  reverse_pec_deck: { id: "reverse_pec_deck", name: "Reverse Pec Deck (Rear Delts)", muscle: "shoulders", equipment: "machine" },
  face_pull: { id: "face_pull", name: "Cable Face Pull", muscle: "shoulders", equipment: "cable" },
  machine_shoulder_press: { id: "machine_shoulder_press", name: "Machine Shoulder Press", muscle: "shoulders", equipment: "machine" },
  lean_away_lateral_raise: { id: "lean_away_lateral_raise", name: "Lean Away Lateral Raise", muscle: "shoulders", equipment: "cable" },

  // Arms (Biceps/Triceps)
  bayesian_curl: { id: "bayesian_curl", name: "Bayesian Curl (Long Head emphasis)", muscle: "biceps", equipment: "cable" },
  preacher_curl: { id: "preacher_curl", name: "Preacher Curl (Short Head emphasis)", muscle: "biceps", equipment: "machine" },
  hammer_curl: { id: "hammer_curl", name: "Hammer Curl (Brachialis emphasis)", muscle: "biceps", equipment: "dumbbell" },
  incline_db_curl: { id: "incline_db_curl", name: "Incline Dumbbell Curl", muscle: "biceps", equipment: "dumbbell" },
  rope_pushdown: { id: "rope_pushdown", name: "Cable Rope Pushdown", muscle: "triceps", equipment: "cable" },
  overhead_cable_extension: { id: "overhead_cable_extension", name: "Overhead Cable Rope Extension", muscle: "triceps", equipment: "cable" },
  single_arm_cross_body_ext: { id: "single_arm_cross_body_ext", name: "Single Arm Cross-Body Extension", muscle: "triceps", equipment: "cable" },

  // Quads/Glutes/Hamstrings
  hack_squat: { id: "hack_squat", name: "Hack Squat Machine", muscle: "quads", equipment: "machine" },
  leg_press: { id: "leg_press", name: "Leg Press Machine", muscle: "quads", equipment: "machine" },
  leg_extension: { id: "leg_extension", name: "Leg Extension Machine", muscle: "quads", equipment: "machine" },
  romanian_deadlift: { id: "romanian_deadlift", name: "Barbell Romanian Deadlift", muscle: "hamstrings", equipment: "barbell" },
  seated_leg_curl: { id: "seated_leg_curl", name: "Seated Leg Curl Machine", muscle: "hamstrings", equipment: "machine" },
  hip_thrust: { id: "hip_thrust", name: "Glute Hip Thrust", muscle: "glutes", equipment: "barbell" },
  standing_calf_raise: { id: "standing_calf_raise", name: "Standing Calf Raises", muscle: "calves", equipment: "machine" },
  seated_calf_raise: { id: "seated_calf_raise", name: "Seated Calf Raises", muscle: "calves", equipment: "machine" },

  // Core & Recovery Work
  cable_crunch: { id: "cable_crunch", name: "Cable Crunch", muscle: "core", equipment: "cable" },
  hanging_knee_raise: { id: "hanging_knee_raise", name: "Hanging Knee Raise", muscle: "core", equipment: "bodyweight" },
  dead_bug: { id: "dead_bug", name: "Dead Bug", muscle: "core", equipment: "bodyweight" },
  bird_dog: { id: "bird_dog", name: "Bird Dog", muscle: "core", equipment: "bodyweight" },
  plank: { id: "plank", name: "Standard Forearm Plank", muscle: "core", equipment: "bodyweight" },
  
  // Cardio & Walks
  zone_2_cardio: { id: "zone_2_cardio", name: "Zone 2 Cardio (Brisk Walk or Treadmill)", muscle: "conditioning", equipment: "bodyweight" },
  incline_walk: { id: "incline_walk", name: "Incline Treadmill Walk", muscle: "conditioning", equipment: "machine" },
  mobility_routine: { id: "mobility_routine", name: "Full Body Mobility Routine", muscle: "recovery", equipment: "bodyweight" },
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
      // Locked-in Custom 5-Day Split: Tuesday (Push), Wednesday (Pull), Thursday (Recovery), Friday (Legs), Saturday (Upper), Sunday (Arms + Delts)
      return [
        { day: 2, name: "Tuesday — Push" },
        { day: 3, name: "Wednesday — Pull" },
        { day: 4, name: "Thursday — Recovery" },
        { day: 5, name: "Friday — Legs" },
        { day: 6, name: "Saturday — Upper" },
        { day: 0, name: "Sunday — Arms + Delts" },
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
    default: // fallback to 4 days
      return [
        { day: 2, name: "Tuesday — Upper A" },
        { day: 3, name: "Wednesday — Lower A" },
        { day: 5, name: "Friday — Upper B" },
        { day: 6, name: "Saturday — Lower B" },
      ];
  }
}

/**
 * Generates today's workout plan based on user specs and the day of week.
 */
export function getTodaysWorkout(
  profile: { gymFrequency?: number; gymExperience?: string; goal?: string },
  dayOfWeek?: number
): WorkoutPlan {
  const frequency = profile.gymFrequency ?? 4;
  const targetDay = dayOfWeek !== undefined ? dayOfWeek : new Date().getDay();

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
  if (frequency === 3) {
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
        { id: "cable_crunch", sets: 3, reps: "15", rest: 60 }
      );
    }
  }
  // ── 4-Day Lifting Program (Upper A, Lower A, Upper B, Lower B) ──
  else if (frequency === 4) {
    if (name.includes("Upper A")) {
      focus = "Upper Body Strength & Hypertrophy A";
      duration = 55;
      exerciseSpecs.push(
        { id: "bench_press", sets: 3, reps: "6-8", rest: 150 },
        { id: "wide_grip_lat_pulldown", sets: 3, reps: "8-10", rest: 90 },
        { id: "machine_shoulder_press", sets: 3, reps: "8-10", rest: 90 },
        { id: "seated_cable_row", sets: 3, reps: "10-12", rest: 90 },
        { id: "cable_lateral_raise", sets: 3, reps: "12-15", rest: 60 },
        { id: "bayesian_curl", sets: 3, reps: "10-12", rest: 60 },
        { id: "rope_pushdown", sets: 3, reps: "10-12", rest: 60 }
      );
    } else if (name.includes("Lower A")) {
      focus = "Lower Body Compound & Core A";
      duration = 50;
      exerciseSpecs.push(
        { id: "hack_squat", sets: 3, reps: "8-10", rest: 120 },
        { id: "romanian_deadlift", sets: 3, reps: "8-10", rest: 120 },
        { id: "leg_extension", sets: 3, reps: "12-15", rest: 90 },
        { id: "seated_leg_curl", sets: 3, reps: "10-12", rest: 90 },
        { id: "standing_calf_raise", sets: 4, reps: "12-15", rest: 60 },
        { id: "plank", sets: 3, reps: "60 sec", rest: 45 }
      );
    } else if (name.includes("Upper B")) {
      focus = "Upper Body Strength & Hypertrophy B";
      duration = 55;
      exerciseSpecs.push(
        { id: "incline_smith_press", sets: 3, reps: "8", rest: 120 },
        { id: "chest_supported_row", sets: 3, reps: "8-10", rest: 90 },
        { id: "incline_db_press", sets: 3, reps: "8-10", rest: 90 },
        { id: "neutral_grip_pulldown", sets: 3, reps: "10", rest: 90 },
        { id: "reverse_pec_deck", sets: 3, reps: "15", rest: 60 },
        { id: "preacher_curl", sets: 3, reps: "10-12", rest: 60 },
        { id: "overhead_cable_extension", sets: 3, reps: "12-15", rest: 60 }
      );
    } else if (name.includes("Lower B")) {
      focus = "Lower Body Hypertrophy & Core B";
      duration = 50;
      exerciseSpecs.push(
        { id: "leg_press", sets: 3, reps: "10-12", rest: 90 },
        { id: "seated_leg_curl", sets: 3, reps: "10-12", rest: 90 },
        { id: "hip_thrust", sets: 3, reps: "10-12", rest: 90 },
        { id: "leg_extension", sets: 2, reps: "15", rest: 90 },
        { id: "seated_calf_raise", sets: 3, reps: "15-20", rest: 60 },
        { id: "dead_bug", sets: 3, reps: "12", rest: 45 }
      );
    }
  }
  // ── Custom 5-Day Lifting Program ──
  else if (frequency === 5) {
    if (name.includes("Push")) {
      focus = "Chest, Shoulders & Triceps (Shoulder Friendly)";
      duration = 55;
      exerciseSpecs.push(
        { id: "bench_press", sets: 3, reps: "6-8", rest: 150 },
        { id: "incline_db_press", sets: 3, reps: "8-10", rest: 90 },
        { id: "pec_deck_fly", sets: 3, reps: "12-15", rest: 90 },
        { id: "cable_lateral_raise", sets: 4, reps: "12-15", rest: 90 },
        { id: "rope_pushdown", sets: 3, reps: "10-12", rest: 90 },
        { id: "overhead_cable_extension", sets: 2, reps: "12-15", rest: 90 },
        { id: "cable_crunch", sets: 3, reps: "15", rest: 60 }
      );
    } else if (name.includes("Pull")) {
      focus = "Lats, Upper Back & Biceps (Postural Focus)";
      duration = 60;
      exerciseSpecs.push(
        { id: "wide_grip_lat_pulldown", sets: 3, reps: "8-10", rest: 90 },
        { id: "chest_supported_row", sets: 3, reps: "8-10", rest: 90 },
        { id: "seated_cable_row", sets: 3, reps: "10-12", rest: 90 },
        { id: "reverse_pec_deck", sets: 3, reps: "15", rest: 90 },
        { id: "face_pull", sets: 3, reps: "15", rest: 90 },
        { id: "bayesian_curl", sets: 3, reps: "10-12", rest: 60 },
        { id: "preacher_curl", sets: 3, reps: "10-12", rest: 60 },
        { id: "hammer_curl", sets: 2, reps: "12-15", rest: 60 }
      );
    } else if (name.includes("Recovery")) {
      focus = "Active Recovery & Core Dial-in";
      duration = 45;
      exerciseSpecs.push(
        { id: "zone_2_cardio", sets: 1, reps: "35-45 min", rest: 0 },
        { id: "mobility_routine", sets: 1, reps: "10 min", rest: 0 },
        { id: "dead_bug", sets: 3, reps: "12", rest: 45 },
        { id: "bird_dog", sets: 3, reps: "12", rest: 45 },
        { id: "plank", sets: 3, reps: "60 sec", rest: 45 }
      );
    } else if (name.includes("Legs")) {
      focus = "Quads, Hamstrings, Glutes & Calves (Joint Friendly)";
      duration = 60;
      exerciseSpecs.push(
        { id: "hack_squat", sets: 3, reps: "8-10", rest: 120 },
        { id: "leg_press", sets: 3, reps: "10-12", rest: 90 },
        { id: "leg_extension", sets: 3, reps: "15", rest: 90 },
        { id: "romanian_deadlift", sets: 3, reps: "8-10", rest: 120 },
        { id: "seated_leg_curl", sets: 3, reps: "10-12", rest: 90 },
        { id: "hip_thrust", sets: 2, reps: "10-12", rest: 90 },
        { id: "standing_calf_raise", sets: 4, reps: "12-15", rest: 60 },
        { id: "seated_calf_raise", sets: 3, reps: "15-20", rest: 60 },
        { id: "hanging_knee_raise", sets: 3, reps: "12", rest: 60 }
      );
    } else if (name.includes("Upper")) {
      focus = "Strength + Hypertrophy Compounds";
      duration = 55;
      exerciseSpecs.push(
        { id: "incline_smith_press", sets: 3, reps: "8", rest: 120 },
        { id: "neutral_grip_pulldown", sets: 3, reps: "10", rest: 90 },
        { id: "single_arm_cable_row", sets: 3, reps: "10", rest: 90 },
        { id: "machine_shoulder_press", sets: 2, reps: "10", rest: 90 },
        { id: "cable_lateral_raise", sets: 3, reps: "15", rest: 60 },
        { id: "reverse_pec_deck", sets: 2, reps: "15", rest: 60 },
        { id: "bayesian_curl", sets: 2, reps: "12", rest: 60 },
        { id: "rope_pushdown", sets: 2, reps: "12", rest: 60 }
      );
    } else if (name.includes("Arms")) {
      focus = "Targeted Arm/Lateral Delts Hypertrophy";
      duration = 55;
      exerciseSpecs.push(
        { id: "incline_db_curl", sets: 3, reps: "10-12", rest: 60 },
        { id: "bayesian_curl", sets: 3, reps: "12", rest: 60 },
        { id: "hammer_curl", sets: 3, reps: "12", rest: 60 },
        { id: "rope_pushdown", sets: 3, reps: "12", rest: 60 },
        { id: "overhead_cable_extension", sets: 3, reps: "12", rest: 60 },
        { id: "single_arm_cross_body_ext", sets: 2, reps: "15", rest: 60 },
        { id: "cable_lateral_raise", sets: 4, reps: "15", rest: 60 },
        { id: "lean_away_lateral_raise", sets: 3, reps: "15", rest: 60 },
        { id: "reverse_pec_deck", sets: 3, reps: "15", rest: 60 },
        { id: "incline_walk", sets: 1, reps: "15-20 min", rest: 0 }
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
