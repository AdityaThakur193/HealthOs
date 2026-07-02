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

// Global library of exercises categorized by muscle and equipment
const EXERCISE_LIBRARY: Record<string, Omit<Exercise, "targetSets" | "targetReps" | "restSeconds">> = {
  // Chest
  bench_press: { id: "bench_press", name: "Barbell Bench Press", muscle: "chest", equipment: "barbell" },
  incline_db_press: { id: "incline_db_press", name: "Incline Dumbbell Press", muscle: "chest", equipment: "dumbbell" },
  chest_fly: { id: "chest_fly", name: "Cable Chest Fly", muscle: "chest", equipment: "cable" },
  pushups: { id: "pushups", name: "Decline Pushups", muscle: "chest", equipment: "bodyweight" },

  // Back
  pullups: { id: "pullups", name: "Weighted Pullups", muscle: "back", equipment: "bodyweight" },
  lat_pulldown: { id: "lat_pulldown", name: "Lat Pulldown", muscle: "back", equipment: "machine" },
  barbell_row: { id: "barbell_row", name: "Barbell Row", muscle: "back", equipment: "barbell" },
  seated_row: { id: "seated_row", name: "Cable Seated Row", muscle: "back", equipment: "cable" },

  // Shoulders
  overhead_press: { id: "overhead_press", name: "Barbell Overhead Press", muscle: "shoulders", equipment: "barbell" },
  db_shoulder_press: { id: "db_shoulder_press", name: "Dumbbell Shoulder Press", muscle: "shoulders", equipment: "dumbbell" },
  lateral_raises: { id: "lateral_raises", name: "Dumbbell Lateral Raises", muscle: "shoulders", equipment: "dumbbell" },
  face_pulls: { id: "face_pulls", name: "Cable Face Pulls", muscle: "shoulders", equipment: "cable" },

  // Quads/Glutes/Hamstrings
  squat: { id: "squat", name: "Barbell Back Squat", muscle: "quads", equipment: "barbell" },
  leg_press: { id: "leg_press", name: "Leg Press Machine", muscle: "quads", equipment: "machine" },
  romanian_deadlift: { id: "romanian_deadlift", name: "Barbell Romanian Deadlift", muscle: "hamstrings", equipment: "barbell" },
  leg_curl: { id: "leg_curl", name: "Lying Leg Curl", muscle: "hamstrings", equipment: "machine" },
  calf_raise: { id: "calf_raise", name: "Standing Calf Raises", muscle: "calves", equipment: "machine" },

  // Arms
  bicep_curl: { id: "bicep_curl", name: "Dumbbell Alternate Bicep Curl", muscle: "biceps", equipment: "dumbbell" },
  hammer_curl: { id: "hammer_curl", name: "Hammer Curl", muscle: "biceps", equipment: "dumbbell" },
  tricep_pushdown: { id: "tricep_pushdown", name: "Cable Tricep Pushdown", muscle: "triceps", equipment: "cable" },
  tricep_extension: { id: "tricep_extension", name: "Overhead Tricep Extension", muscle: "triceps", equipment: "cable" },
};

/**
 * Returns the weekly schedule mapping of dayIndex (0 = Sun, 1 = Mon...) to workout type
 */
export function getWeekSchedule(gymFrequency: number): { day: number; name: string }[] {
  // 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday
  switch (gymFrequency) {
    case 3:
      return [
        { day: 1, name: "Push Day" },
        { day: 3, name: "Pull Day" },
        { day: 5, name: "Legs Day" },
      ];
    case 4:
      return [
        { day: 1, name: "Upper Day A" },
        { day: 2, name: "Lower Day A" },
        { day: 4, name: "Upper Day B" },
        { day: 5, name: "Lower Day B" },
      ];
    case 5:
      return [
        { day: 1, name: "Push Day" },
        { day: 2, name: "Pull Day" },
        { day: 3, name: "Legs Day" },
        { day: 5, name: "Upper Day" },
        { day: 6, name: "Lower Day" },
      ];
    case 6:
      return [
        { day: 1, name: "Push Day A" },
        { day: 2, name: "Pull Day A" },
        { day: 3, name: "Legs Day A" },
        { day: 4, name: "Push Day B" },
        { day: 5, name: "Pull Day B" },
        { day: 6, name: "Legs Day B" },
      ];
    default: // fallback to 4 days
      return [
        { day: 1, name: "Upper Day A" },
        { day: 2, name: "Lower Day A" },
        { day: 4, name: "Upper Day B" },
        { day: 5, name: "Lower Day B" },
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
  const frequency = profile.gymFrequency || 4;
  const experience = profile.gymExperience || "beginner";
  
  // Use current local day of week if not specified (0 = Sunday, 1 = Monday, etc.)
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

  // Determine sets & rep ranges based on lifting experience
  let sets = 3;
  let reps = "8-12";
  let rest = 90;

  if (experience === "beginner") {
    sets = 3;
    reps = "10-12";
    rest = 90;
  } else if (experience === "intermediate") {
    sets = 3;
    reps = "8-10";
    rest = 90;
  } else if (experience === "advanced") {
    sets = 4;
    reps = "6-8";
    rest = 120;
  }

  // Populate exercises based on workout name
  const name = scheduledWorkout.name;
  let focus = "Full Body Work";
  let duration = 45;
  const selectedExIds: string[] = [];

  if (name.includes("Push Day")) {
    focus = "Chest, Shoulders & Triceps";
    duration = 50;
    selectedExIds.push("bench_press", "incline_db_press", "db_shoulder_press", "lateral_raises", "tricep_pushdown");
    if (experience === "advanced") selectedExIds.push("tricep_extension");
  } else if (name.includes("Pull Day")) {
    focus = "Back, Rear Delts & Biceps";
    duration = 50;
    selectedExIds.push("pullups", "barbell_row", "seated_row", "face_pulls", "bicep_curl");
    if (experience === "advanced") selectedExIds.push("hammer_curl");
  } else if (name.includes("Legs Day")) {
    focus = "Quads, Hamstrings & Calves";
    duration = 55;
    selectedExIds.push("squat", "leg_press", "romanian_deadlift", "leg_curl", "calf_raise");
  } else if (name.includes("Upper Day")) {
    focus = "Chest, Back & Shoulders";
    duration = 50;
    selectedExIds.push("bench_press", "seated_row", "db_shoulder_press", "lat_pulldown", "bicep_curl");
    if (experience === "advanced") selectedExIds.push("tricep_pushdown");
  } else if (name.includes("Lower Day")) {
    focus = "Quads, Glutes & Hamstrings";
    duration = 45;
    selectedExIds.push("squat", "romanian_deadlift", "leg_curl", "calf_raise");
    if (experience !== "beginner") selectedExIds.push("leg_press");
  }

  // Map to fully formatted Exercise objects
  const exercises: Exercise[] = selectedExIds
    .filter((id) => EXERCISE_LIBRARY[id] !== undefined)
    .map((id) => {
      const base = EXERCISE_LIBRARY[id];
      // Adapt sets/reps based on exercise type (e.g. lateral raises always slightly higher reps)
      let customReps = reps;
      if (id === "lateral_raises" || id === "face_pulls" || id === "calf_raise") {
        customReps = experience === "advanced" ? "10-12" : "12-15";
      } else if (id === "pullups" && experience === "beginner") {
        customReps = "5-8 (Assisted)";
      }

      return {
        ...base,
        targetSets: sets,
        targetReps: customReps,
        restSeconds: rest,
      } as Exercise;
    });

  return {
    name,
    focus,
    targetDurationMin: duration,
    exercises,
  };
}
