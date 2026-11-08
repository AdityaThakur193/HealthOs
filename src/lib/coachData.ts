import connectDB from "./mongodb";
import { AIMemory, Habit, HabitLog, LeanUserProfile, TimelineEvent, UserProfile } from "./db/models";
import { getLocalEvents, getLocalProfileById } from "./db/fallback";
import type { CoachRecommendation } from "./gemini";
import { dayKey, startOfDay } from "./dateUtils";
import type { TimelineLike } from "./tdee";

export interface CoachSnapshot {
  profile: LeanUserProfile;
  recentEvents: TimelineLike[];
  notes: TimelineLike[];
  latestWeight?: TimelineLike;
  habits: { title: string; doneToday: boolean }[];
}

const RECENT_DAYS = 14;
const CACHE_KEY = "coach_recommendation";

/** Everything the coaches need to know about one user. */
export async function loadCoachSnapshot(userId: string, tz?: string): Promise<CoachSnapshot | null> {
  const windowStart = startOfDay(tz, RECENT_DAYS);

  try {
    await connectDB();
    const profile = await UserProfile.findById(userId).lean<LeanUserProfile>();
    if (!profile) return null;

    const [recentEvents, notes, latestWeight, habits, logs] = await Promise.all([
      TimelineEvent.find({ userId, timestamp: { $gte: windowStart } }).select("-payload.imagePreview").lean(),
      TimelineEvent.find({ userId, type: "note" }).lean(),
      TimelineEvent.findOne({ userId, type: "weight" }).sort({ timestamp: -1 }).lean(),
      Habit.find({ userId, status: "active" }).select("habitId title targetValue").lean(),
      HabitLog.find({ userId, date: dayKey(new Date(), tz) }).select("habitId completed value").lean(),
    ]);

    return {
      profile,
      recentEvents,
      notes,
      latestWeight: latestWeight ?? undefined,
      habits: habits.map((habit) => {
        const log = logs.find((entry) => entry.habitId === habit.habitId);
        return {
          title: habit.title,
          doneToday: Boolean(log?.completed || (log?.value && log.value >= (habit.targetValue || 1))),
        };
      }),
    };
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw error;
    console.warn("Coach could not reach MongoDB:", error);

    const profile = (await getLocalProfileById(userId)) as unknown as LeanUserProfile | null;
    if (!profile) return null;
    const all = await getLocalEvents({ userId });
    return {
      profile,
      recentEvents: all.filter((event) => new Date(event.timestamp) >= windowStart),
      notes: all.filter((event) => event.type === "note"),
      latestWeight: all.find((event) => event.type === "weight"),
      habits: [],
    };
  }
}

/** A saved coach message, if nothing relevant has changed since it was written. */
export async function readCachedRecommendation(userId: string, fingerprint: string): Promise<CoachRecommendation | null> {
  try {
    const entry = await AIMemory.findOne({ userId, layer: 1, key: CACHE_KEY }).lean();
    const value = entry?.value as { fingerprint?: string; recommendation?: CoachRecommendation } | undefined;
    return value?.fingerprint === fingerprint ? value.recommendation ?? null : null;
  } catch {
    return null;
  }
}

export async function saveCachedRecommendation(
  userId: string,
  fingerprint: string,
  recommendation: CoachRecommendation
): Promise<void> {
  try {
    await AIMemory.updateOne(
      { userId, layer: 1, key: CACHE_KEY },
      { $set: { value: { fingerprint, recommendation } } },
      { upsert: true }
    );
  } catch (error) {
    console.warn("Could not save the coach message:", error);
  }
}
