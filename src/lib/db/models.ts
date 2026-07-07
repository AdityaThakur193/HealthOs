import mongoose, { Schema, Document, Model } from "mongoose";

/* ─────────────────────────────────────────────
 * User Profile Schema
 * ───────────────────────────────────────────── */

export interface IUserProfile extends Document {
  // Identity
  name: string;
  email: string;
  avatarUrl?: string;

  // Physical
  age: number;
  gender: "male" | "female" | "other";
  heightCm: number;
  weightKg: number;
  targetWeightKg?: number;
  stepsTarget: number;

  // Goals & Preferences
  goal: "lose_fat" | "build_muscle" | "maintain" | "recomp" | "general_health";
  activityLevel: "sedentary" | "light" | "moderate" | "active" | "very_active";
  gymExperience: "beginner" | "intermediate" | "advanced";
  gymFrequency: number;
  gymAccess: string;
  messAccess: string;
  dietPreference: "none" | "vegetarian" | "vegan" | "eggetarian" | "non_veg";

  // Health
  foodAllergies: string[];
  medicalConditions: string[];

  // Schedule
  sleepTarget: number; // hours
  collegeSchedule?: string;

  // Computed
  tdee?: number;
  bmr?: number;
  targetCalories?: number;
  targetProteinG?: number;
  neckCm?: number;
  waistCm?: number;
  hipCm?: number;
  customCalories?: number;
  customProtein?: number;
  useCustomMacros?: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const UserProfileSchema = new Schema<IUserProfile>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    avatarUrl: String,

    age: { type: Number, required: true },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      required: true,
    },
    heightCm: { type: Number, required: true },
    weightKg: { type: Number, required: true },
    targetWeightKg: { type: Number },
    stepsTarget: { type: Number, default: 10000 },

    goal: {
      type: String,
      enum: [
        "lose_fat",
        "build_muscle",
        "maintain",
        "recomp",
        "general_health",
      ],
      required: true,
    },
    activityLevel: {
      type: String,
      enum: ["sedentary", "light", "moderate", "active", "very_active"],
      required: true,
    },
    gymExperience: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      required: true,
    },
    gymFrequency: { type: Number, default: 4 },
    gymAccess: { type: String, default: "college_gym" },
    messAccess: { type: String, default: "hostel_mess" },
    dietPreference: {
      type: String,
      enum: ["none", "vegetarian", "vegan", "eggetarian", "non_veg"],
      default: "none",
    },

    foodAllergies: { type: [String], default: [] },
    medicalConditions: { type: [String], default: [] },

    sleepTarget: { type: Number, default: 8 },
    collegeSchedule: String,

    tdee: Number,
    bmr: Number,
    targetCalories: Number,
    targetProteinG: Number,
    neckCm: Number,
    waistCm: Number,
    hipCm: Number,
    customCalories: Number,
    customProtein: Number,
    useCustomMacros: { type: Boolean, default: false },
  },
  { timestamps: true }
);

/* ─────────────────────────────────────────────
 * Timeline Event Schema (Health Timeline)
 *
 * The center of the database. Every health action
 * is stored as a chronological event with a typed
 * JSON payload. This enables temporal reasoning
 * across all health dimensions.
 * ───────────────────────────────────────────── */

export type TimelineEventType =
  | "weight"
  | "meal"
  | "workout"
  | "sleep"
  | "steps"
  | "photo"
  | "measurement"
  | "note"
  | "water";

export interface ITimelineEvent extends Document {
  userId: mongoose.Types.ObjectId;
  type: TimelineEventType;
  timestamp: Date;
  payload: Record<string, unknown>;
  tags: string[];
  source: "manual" | "ai_vision" | "wearable" | "import";
  createdAt: Date;
  updatedAt: Date;
}

const TimelineEventSchema = new Schema<ITimelineEvent>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "UserProfile",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "weight",
        "meal",
        "workout",
        "sleep",
        "steps",
        "photo",
        "measurement",
        "note",
        "water",
      ],
      required: true,
    },
    timestamp: { type: Date, required: true, index: true },
    payload: { type: Schema.Types.Mixed, required: true },
    tags: { type: [String], default: [] },
    source: {
      type: String,
      enum: ["manual", "ai_vision", "wearable", "import"],
      default: "manual",
    },
  },
  { timestamps: true }
);

// Compound index for efficient timeline queries
TimelineEventSchema.index({ userId: 1, timestamp: -1 });
TimelineEventSchema.index({ userId: 1, type: 1, timestamp: -1 });

/* ─────────────────────────────────────────────
 * AI Memory Schema
 *
 * Structured knowledge layers (not chat history).
 * Layer 1: Today, Layer 2: This week,
 * Layer 3: This month, Layer 4: Long-term.
 * ───────────────────────────────────────────── */

export interface IAIMemory extends Document {
  userId: mongoose.Types.ObjectId;
  layer: 1 | 2 | 3 | 4;
  key: string;
  value: unknown;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AIMemorySchema = new Schema<IAIMemory>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "UserProfile",
      required: true,
      index: true,
    },
    layer: { type: Number, enum: [1, 2, 3, 4], required: true },
    key: { type: String, required: true },
    value: { type: Schema.Types.Mixed, required: true },
    expiresAt: Date,
  },
  { timestamps: true }
);

AIMemorySchema.index({ userId: 1, layer: 1, key: 1 });

/* ─────────────────────────────────────────────
 * Model Exports
 * ───────────────────────────────────────────── */

export const UserProfile: Model<IUserProfile> =
  mongoose.models.UserProfile ||
  mongoose.model<IUserProfile>("UserProfile", UserProfileSchema);

export const TimelineEvent: Model<ITimelineEvent> =
  mongoose.models.TimelineEvent ||
  mongoose.model<ITimelineEvent>("TimelineEvent", TimelineEventSchema);

export const AIMemory: Model<IAIMemory> =
  mongoose.models.AIMemory ||
  mongoose.model<IAIMemory>("AIMemory", AIMemorySchema);
