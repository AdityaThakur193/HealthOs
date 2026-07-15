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
  bench_press: { id: "bench_press", name: "Barbell Bench Press (2 RIR)", muscle: "chest", equipment: "barbell", youtubeId: "gRVjAtPip0Y" },
  incline_db_press: { id: "incline_db_press", name: "Incline Dumbbell Press", muscle: "chest", equipment: "dumbbell", youtubeId: "8iPckaTs9aM" },
  pec_deck_fly: { id: "pec_deck_fly", name: "Pec Deck Fly", muscle: "chest", equipment: "machine", youtubeId: "eGjt4lk6g34" },
  incline_smith_press: { id: "incline_smith_press", name: "Incline Smith Press", muscle: "chest", equipment: "machine", youtubeId: "3m0VvHvx6o4" },
  machine_chest_press: { id: "machine_chest_press", name: "Machine Chest Press", muscle: "chest", equipment: "machine", youtubeId: "mS6NdfgUvHk" },

  // Back / Lats
  wide_grip_lat_pulldown: { id: "wide_grip_lat_pulldown", name: "Wide Grip Lat Pulldown", muscle: "back", equipment: "machine", youtubeId: "1SStR4EwP_E" },
  chest_supported_row: { id: "chest_supported_row", name: "Chest Supported Row", muscle: "back", equipment: "machine", youtubeId: "H75im9fAUMc" },
  seated_cable_row: { id: "seated_cable_row", name: "Seated Cable Row", muscle: "back", equipment: "cable", youtubeId: "GZbfZ033fQ4" },
  neutral_grip_pulldown: { id: "neutral_grip_pulldown", name: "Neutral Grip Pulldown", muscle: "back", equipment: "machine", youtubeId: "1SStR4EwP_E" },
  single_arm_cable_row: { id: "single_arm_cable_row", name: "Single Arm Cable Row", muscle: "back", equipment: "cable", youtubeId: "k_m75n2S-7w" },
  straight_arm_pulldown: { id: "straight_arm_pulldown", name: "Straight Arm Pulldown", muscle: "back", equipment: "cable", youtubeId: "P4S1f-UplxI" },

  // Shoulders / Delts
  cable_lateral_raise: { id: "cable_lateral_raise", name: "Cable Lateral Raise", muscle: "shoulders", equipment: "cable", youtubeId: "PPripNh_sDw" },
  reverse_pec_deck: { id: "reverse_pec_deck", name: "Reverse Pec Deck (Rear Delts)", muscle: "shoulders", equipment: "machine", youtubeId: "5ykMyyPcxW0" },
  face_pull: { id: "face_pull", name: "Cable Face Pull", muscle: "shoulders", equipment: "cable", youtubeId: "V81Z35t-6i0" },
  machine_shoulder_press: { id: "machine_shoulder_press", name: "Machine Shoulder Press", muscle: "shoulders", equipment: "machine", youtubeId: "WvLM7e-wTIk" },
  lean_away_lateral_raise: { id: "lean_away_lateral_raise", name: "Lean Away Lateral Raise", muscle: "shoulders", equipment: "cable", youtubeId: "PPripNh_sDw" },

  // Arms (Biceps/Triceps)
  bayesian_curl: { id: "bayesian_curl", name: "Bayesian Curl (Long Head emphasis)", muscle: "biceps", equipment: "cable", youtubeId: "GusFwM2oO3M" },
  preacher_curl: { id: "preacher_curl", name: "Preacher Curl (Short Head emphasis)", muscle: "biceps", equipment: "machine", youtubeId: "fIWP-FRFNPM" },
  hammer_curl: { id: "hammer_curl", name: "Hammer Curl (Brachialis emphasis)", muscle: "biceps", equipment: "dumbbell", youtubeId: "zC3nLlEvin4" },
  incline_db_curl: { id: "incline_db_curl", name: "Incline Dumbbell Curl", muscle: "biceps", equipment: "dumbbell", youtubeId: "aTYlqC_JacQ" },
  rope_pushdown: { id: "rope_pushdown", name: "Cable Rope Pushdown", muscle: "triceps", equipment: "cable", youtubeId: "vB5OHsJ3EME" },
  overhead_cable_extension: { id: "overhead_cable_extension", name: "Overhead Cable Rope Extension", muscle: "triceps", equipment: "cable", youtubeId: "1yPJG3-Y8E0" },
  single_arm_cross_body_ext: { id: "single_arm_cross_body_ext", name: "Single Arm Cross-Body Extension", muscle: "triceps", equipment: "cable", youtubeId: "vB5OHsJ3EME" },

  // Quads/Glutes/Hamstrings
  hack_squat: { id: "hack_squat", name: "Hack Squat Machine", muscle: "quads", equipment: "machine", youtubeId: "0tYmXGpbS6w" },
  leg_press: { id: "leg_press", name: "Leg Press Machine", muscle: "quads", equipment: "machine", youtubeId: "IZxyjWwMJyQ" },
  leg_extension: { id: "leg_extension", name: "Leg Extension Machine", muscle: "quads", equipment: "machine", youtubeId: "IZxyjWwMJyQ" },
  romanian_deadlift: { id: "romanian_deadlift", name: "Barbell Romanian Deadlift", muscle: "hamstrings", equipment: "barbell", youtubeId: "JCXUYt5RQ0k" },
  seated_leg_curl: { id: "seated_leg_curl", name: "Seated Leg Curl Machine", muscle: "hamstrings", equipment: "machine", youtubeId: "Orxowest56U" },
  lying_leg_curl: { id: "lying_leg_curl", name: "Lying Leg Curl Machine", muscle: "hamstrings", equipment: "machine", youtubeId: "n5Vb0f4M33I" },
  hip_thrust: { id: "hip_thrust", name: "Glute Hip Thrust", muscle: "glutes", equipment: "barbell", youtubeId: "LM8XH3VJHbs" },
  standing_calf_raise: { id: "standing_calf_raise", name: "Standing Calf Raises", muscle: "calves", equipment: "machine", youtubeId: "hL5vLz87Ypw" },
  seated_calf_raise: { id: "seated_calf_raise", name: "Seated Calf Raises", muscle: "calves", equipment: "machine", youtubeId: "JbC8JZZZ5_Q" },
  bulgarian_split_squat: { id: "bulgarian_split_squat", name: "Bulgarian Split Squat", muscle: "quads", equipment: "dumbbell", youtubeId: "2C-uNgw13cY" },
  front_squat: { id: "front_squat", name: "Front Squat OR Smith Squat", muscle: "quads", equipment: "barbell", youtubeId: "v-mQm_dra5g" },

  // Core & Recovery Work
  cable_crunch: { id: "cable_crunch", name: "Cable Crunch", muscle: "core", equipment: "cable", youtubeId: "2Cw7WkF-R2c" },
  hanging_knee_raise: { id: "hanging_knee_raise", name: "Hanging Knee Raise", muscle: "core", equipment: "bodyweight", youtubeId: "4H2L50_rNQA" },
  dead_bug: { id: "dead_bug", name: "Dead Bug", muscle: "core", equipment: "bodyweight", youtubeId: "4XLEnwUr1d8" },
  bird_dog: { id: "bird_dog", name: "Bird Dog", muscle: "core", equipment: "bodyweight", youtubeId: "wiFSPDxGpQA" },
  plank: { id: "plank", name: "Standard Forearm Plank", muscle: "core", equipment: "bodyweight", youtubeId: "pSHjTRCQxIw" },
  ab_wheel: { id: "ab_wheel", name: "Ab Wheel", muscle: "core", equipment: "bodyweight", youtubeId: "rqIeOIJ3ycU" },
  
  // Cardio & Walks
  zone_2_cardio: { id: "zone_2_cardio", name: "Zone 2 Cardio (Brisk Walk or Treadmill)", muscle: "conditioning", equipment: "bodyweight", youtubeId: "V4d3P5GqH58" },
  incline_walk: { id: "incline_walk", name: "Incline Treadmill Walk", muscle: "conditioning", equipment: "machine", youtubeId: "T_WfCskp6p4" },
  mobility_routine: { id: "mobility_routine", name: "Full Body Mobility Routine", muscle: "recovery", equipment: "bodyweight", youtubeId: "v41v70eF0hE" },
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
      // Locked-in Custom 9.8/10 Split: Tuesday (Upper A), Wednesday (Lower A), Thursday (Recovery), Friday (Upper B), Saturday (Lower B), Sunday (Sunday Optional)
      return [
        { day: 2, name: "Tuesday — Upper A" },
        { day: 3, name: "Wednesday — Lower A" },
        { day: 4, name: "Thursday — Recovery" },
        { day: 5, name: "Friday — Upper B" },
        { day: 6, name: "Saturday — Lower B" },
        { day: 0, name: "Sunday — Optional Delts" },
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
        { id: "seated_calf_raise", sets: 3, reps: "15-20", rest: 60 }
      );
    }
  }
  // ── 4-Day Lifting Program (Upper A, Lower A, Upper B, Lower B) ──
  else if (frequency === 4) {
    if (name.includes("Upper A")) {
      focus = "Upper Body Strength & Hypertrophy A";
      duration = 55;
      exerciseSpecs.push(
        { id: "bench_press", sets: 3, reps: "6-8", rest: 120 },
        { id: "chest_supported_row", sets: 3, reps: "8-10", rest: 90 },
        { id: "incline_db_press", sets: 3, reps: "8-10", rest: 90 },
        { id: "wide_grip_lat_pulldown", sets: 3, reps: "10-12", rest: 90 },
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
  // ── Custom 9.8/10 5-Day Hypertrophy Program ──
  else if (frequency === 5) {
    if (name.includes("Upper A")) {
      focus = "Horizontal Push & Pull (Chest/Back Compounds)";
      duration = 55;
      exerciseSpecs.push(
        { id: "bench_press", sets: 3, reps: "5-8", rest: 180 },
        { id: "incline_db_press", sets: 3, reps: "8-10", rest: 90 },
        { id: "chest_supported_row", sets: 3, reps: "8-10", rest: 90 },
        { id: "seated_cable_row", sets: 2, reps: "10-12", rest: 90 },
        { id: "cable_lateral_raise", sets: 4, reps: "12-15", rest: 90 },
        { id: "rope_pushdown", sets: 3, reps: "10-12", rest: 90 },
        { id: "bayesian_curl", sets: 3, reps: "10-12", rest: 60 },
        { id: "cable_crunch", sets: 3, reps: "12-15", rest: 60 }
      );
    } else if (name.includes("Lower A")) {
      focus = "Quad-Dominant Lower Body Strength & Hypertrophy";
      duration = 60;
      exerciseSpecs.push(
        { id: "hack_squat", sets: 3, reps: "6-8", rest: 180 },
        { id: "leg_press", sets: 3, reps: "10-12", rest: 120 },
        { id: "romanian_deadlift", sets: 3, reps: "8-10", rest: 180 },
        { id: "seated_leg_curl", sets: 3, reps: "10-12", rest: 90 },
        { id: "leg_extension", sets: 2, reps: "12-15", rest: 90 },
        { id: "standing_calf_raise", sets: 4, reps: "12-15", rest: 60 },
        { id: "hanging_knee_raise", sets: 3, reps: "12-15", rest: 60 }
      );
    } else if (name.includes("Recovery")) {
      focus = "Active Recovery, Cardio & Core Stability";
      duration = 45;
      exerciseSpecs.push(
        { id: "zone_2_cardio", sets: 1, reps: "40 min", rest: 0 },
        { id: "mobility_routine", sets: 1, reps: "15 min", rest: 0 },
        { id: "dead_bug", sets: 3, reps: "12", rest: 45 },
        { id: "bird_dog", sets: 3, reps: "12", rest: 45 },
        { id: "plank", sets: 3, reps: "60 sec", rest: 45 }
      );
    } else if (name.includes("Upper B")) {
      focus = "Vertical Push & Pull (Lats/Rear Delts Hypertrophy)";
      duration = 55;
      exerciseSpecs.push(
        { id: "neutral_grip_pulldown", sets: 3, reps: "8-10", rest: 90 },
        { id: "single_arm_cable_row", sets: 3, reps: "10-12", rest: 90 },
        { id: "straight_arm_pulldown", sets: 2, reps: "12-15", rest: 90 },
        { id: "machine_chest_press", sets: 3, reps: "8-10", rest: 120 },
        { id: "pec_deck_fly", sets: 2, reps: "12-15", rest: 90 },
        { id: "reverse_pec_deck", sets: 3, reps: "15", rest: 60 },
        { id: "face_pull", sets: 3, reps: "15", rest: 90 },
        { id: "preacher_curl", sets: 3, reps: "10-12", rest: 60 },
        { id: "overhead_cable_extension", sets: 3, reps: "10-12", rest: 90 }
      );
    } else if (name.includes("Lower B")) {
      focus = "Posterior Chain Leg Volume & Direct Arm Work";
      duration = 60;
      exerciseSpecs.push(
        { id: "front_squat", sets: 3, reps: "8-10", rest: 180 },
        { id: "bulgarian_split_squat", sets: 3, reps: "10", rest: 90 },
        { id: "lying_leg_curl", sets: 3, reps: "10-12", rest: 90 },
        { id: "hip_thrust", sets: 3, reps: "10", rest: 90 },
        { id: "seated_calf_raise", sets: 4, reps: "15-20", rest: 60 },
        { id: "incline_db_curl", sets: 3, reps: "10-12", rest: 60 },
        { id: "hammer_curl", sets: 3, reps: "12", rest: 60 },
        { id: "single_arm_cross_body_ext", sets: 3, reps: "12", rest: 60 },
        { id: "overhead_cable_extension", sets: 2, reps: "15", rest: 60 },
        { id: "ab_wheel", sets: 3, reps: "10", rest: 45 }
      );
    } else if (name.includes("Sunday") || name.includes("Delts")) {
      focus = "Optional Delts & Cardio Conditioning";
      duration = 45;
      exerciseSpecs.push(
        { id: "cable_lateral_raise", sets: 4, reps: "15-20", rest: 60 },
        { id: "lean_away_lateral_raise", sets: 3, reps: "12-15", rest: 60 },
        { id: "reverse_pec_deck", sets: 3, reps: "15", rest: 60 },
        { id: "incline_walk", sets: 1, reps: "20-30 min", rest: 0 }
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
