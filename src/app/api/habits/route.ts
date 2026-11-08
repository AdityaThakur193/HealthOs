import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb";
import { Habit, HabitLog, TimelineEvent, UserProfile } from "@/lib/db/models";
import {
  calculateHabitStrength,
  calculateCurrentStreak,
  get30DayHeatmap,
  getStarterHabits,
  HabitDefinition,
  HabitWithStats,
  HabitLogEntry,
} from "@/lib/habitEngine";
import { requireSession, Session } from "@/lib/auth/session";
import { dayKey } from "@/lib/dateUtils";
import { invalidBodyResponse, isValidDateKey, readJsonObject } from "@/lib/validation";

export const dynamic = "force-dynamic";

type HabitLike = Partial<HabitDefinition> & { habitId?: string };
type HabitLogLike = HabitLogEntry & { habitId: string };

/** Per-user store for development without MongoDB. Never used in production. */
const memoryByUser = new Map<string, { habits: HabitLike[]; logs: HabitLogLike[] }>();

function memoryFor(email: string) {
  let store = memoryByUser.get(email);
  if (!store) {
    store = { habits: getStarterHabits(email), logs: [] };
    memoryByUser.set(email, store);
  }
  return store;
}

function serverError(context: string, error: unknown): Response {
  console.error(`${context}:`, error);
  return Response.json({ success: false, error: "Something went wrong saving your habits." }, { status: 500 });
}

/** Resolves the signed-in user's database id, or null when running on the memory store. */
async function resolveUser(session: Session): Promise<mongoose.Types.ObjectId | null | Response> {
  try {
    await connectToDatabase();
    const user = await UserProfile.findOne({ email: session.email }).select("_id").lean();
    if (!user) {
      return Response.json({ success: false, error: "Profile not set up yet.", notInitialized: true }, { status: 403 });
    }
    return user._id as mongoose.Types.ObjectId;
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      console.error("Habits could not reach MongoDB:", error);
      return Response.json({ success: false, error: "Database offline. Please try again later." }, { status: 503 });
    }
    return null;
  }
}

async function seedStarterHabits(userId: mongoose.Types.ObjectId) {
  // Upserts make concurrent first loads safe against the unique index.
  await Habit.bulkWrite(
    getStarterHabits(String(userId)).map((starter) => ({
      updateOne: {
        filter: { userId, habitId: starter.id },
        update: {
          $setOnInsert: {
            userId,
            habitId: starter.id,
            title: starter.title,
            category: starter.category,
            targetType: starter.targetType,
            targetValue: starter.targetValue,
            unit: starter.unit,
            frequency: starter.frequency,
            colorTag: starter.colorTag,
            icon: starter.icon,
            status: starter.status,
            notes: starter.notes,
            sortOrder: starter.sortOrder,
          },
        },
        upsert: true,
      },
    }))
  );
}

function withStats(habit: HabitLike, logs: HabitLogEntry[], todayKey: string, tz?: string): HabitWithStats {
  const targetValue = habit.targetValue || 1;
  const frequency = habit.frequency || "daily";
  const { currentStreak, bestStreak } = calculateCurrentStreak(logs, frequency, targetValue, tz);
  const todayLog = logs.find((log) => log.date === todayKey);

  return {
    id: (habit.habitId || habit.id) as string,
    userId: String(habit.userId),
    title: habit.title || "",
    category: habit.category || "Misc",
    targetType: habit.targetType || "boolean",
    targetValue,
    unit: habit.unit,
    frequency,
    weeklyTargetCount: habit.weeklyTargetCount || 7,
    colorTag: habit.colorTag || "#34d399",
    icon: habit.icon || "Sparkles",
    status: habit.status || "active",
    notes: habit.notes || "",
    sortOrder: habit.sortOrder || 1,
    createdAt: habit.createdAt ? new Date(habit.createdAt).toISOString() : new Date().toISOString(),
    habitStrength: calculateHabitStrength(logs, targetValue, tz),
    currentStreak,
    bestStreak,
    completedToday: Boolean(todayLog?.completed || (todayLog?.value && todayLog.value >= targetValue)),
    todayValue: todayLog?.value || 0,
    heatmap30Days: get30DayHeatmap(logs, targetValue, tz),
  };
}

export async function GET(request: Request) {
  const session = requireSession(request);
  if (session instanceof Response) return session;

  try {
    const userId = await resolveUser(session);
    if (userId instanceof Response) return userId;

    let habits: HabitLike[];
    let logs: HabitLogLike[];

    if (userId) {
      const hasHabits = await Habit.exists({ userId });
      if (!hasHabits) await seedStarterHabits(userId);
      [habits, logs] = await Promise.all([
        Habit.find({ userId, status: "active" }).sort({ sortOrder: 1 }).lean() as unknown as Promise<HabitLike[]>,
        HabitLog.find({ userId }).lean() as unknown as Promise<HabitLogLike[]>,
      ]);
    } else {
      const store = memoryFor(session.email);
      habits = store.habits.filter((habit) => habit.status === "active");
      logs = store.logs;
    }

    const logsByHabit = new Map<string, HabitLogEntry[]>();
    logs.forEach((log) => {
      const entries = logsByHabit.get(log.habitId) ?? [];
      entries.push({ date: log.date, completed: Boolean(log.completed), value: log.value || 0 });
      logsByHabit.set(log.habitId, entries);
    });

    const todayKey = dayKey(new Date(), session.tz);
    const habitsWithStats = habits.map((habit) =>
      withStats(habit, logsByHabit.get((habit.habitId || habit.id) as string) || [], todayKey, session.tz)
    );

    const totalHabits = habitsWithStats.length;
    const completedTodayCount = habitsWithStats.filter((habit) => habit.completedToday).length;

    return Response.json({
      success: true,
      habits: habitsWithStats,
      summary: {
        totalHabits,
        completedTodayCount,
        completionRateToday: totalHabits > 0 ? Math.round((completedTodayCount / totalHabits) * 100) : 0,
        avgHabitStrength: totalHabits > 0
          ? Math.round(habitsWithStats.reduce((total, habit) => total + habit.habitStrength, 0) / totalHabits)
          : 0,
        bestStreakOverall: habitsWithStats.reduce((max, habit) => Math.max(max, habit.currentStreak), 0),
      },
    });
  } catch (error) {
    return serverError("GET /api/habits", error);
  }
}

function habitFields(data: Record<string, unknown>) {
  return {
    title: String(data.title).trim(),
    category: typeof data.category === "string" ? data.category : "Misc",
    targetType: (data.targetType as HabitDefinition["targetType"]) || "boolean",
    targetValue: Number(data.targetValue) || 1,
    unit: typeof data.unit === "string" ? data.unit : "",
    frequency: (data.frequency as HabitDefinition["frequency"]) || "daily",
    weeklyTargetCount: Number(data.weeklyTargetCount) || 7,
    colorTag: typeof data.colorTag === "string" ? data.colorTag : "#34d399",
    icon: typeof data.icon === "string" ? data.icon : "Sparkles",
    status: (data.status as HabitDefinition["status"]) || "active",
    notes: typeof data.notes === "string" ? data.notes : "",
    sortOrder: Number(data.sortOrder) || 1,
  };
}

/** Mirrors a habit check-in on the Health Timeline: one event per habit per day. */
async function syncHabitTimeline(
  userId: mongoose.Types.ObjectId,
  habitId: string,
  date: string,
  completed: boolean,
  value: number
) {
  const filter = { userId, type: "habit", "payload.habitId": habitId, "payload.date": date };

  if (!completed) {
    await TimelineEvent.deleteOne(filter);
    return;
  }

  const definition = await Habit.findOne({ userId, habitId }).lean();
  await TimelineEvent.updateOne(
    filter,
    {
      $set: {
        payload: {
          habitId,
          date,
          title: definition?.title || habitId,
          category: definition?.category || "Habit",
          value,
          unit: definition?.unit || "",
        },
        source: "habit_tracker",
      },
      $setOnInsert: { timestamp: new Date() },
    },
    { upsert: true }
  );
}

export async function POST(request: Request) {
  const session = requireSession(request);
  if (session instanceof Response) return session;

  const body = await readJsonObject(request);
  if (!body) return invalidBodyResponse();

  try {
    const userId = await resolveUser(session);
    if (userId instanceof Response) return userId;

    const action = body.action;

    if (action === "checkin") {
      const checkin = (body.checkin ?? body) as Record<string, unknown>;
      const habitId = checkin.habitId;
      const date = checkin.date ?? dayKey(new Date(), session.tz);

      if (typeof habitId !== "string" || !habitId) {
        return Response.json({ success: false, error: "Missing habitId" }, { status: 400 });
      }
      if (!isValidDateKey(date)) {
        return Response.json({ success: false, error: "Invalid date" }, { status: 400 });
      }

      const completed = Boolean(checkin.completed);
      const value = checkin.value !== undefined ? Number(checkin.value) : completed ? 1 : 0;
      if (Number.isNaN(value) || value < 0) {
        return Response.json({ success: false, error: "Invalid value" }, { status: 400 });
      }

      if (userId) {
        await HabitLog.updateOne(
          { userId, habitId, date },
          { $set: { completed, value } },
          { upsert: true }
        );
        await syncHabitTimeline(userId, habitId, date, completed, value);
      } else {
        const { logs } = memoryFor(session.email);
        const entry = { habitId, date, completed, value };
        const index = logs.findIndex((log) => log.habitId === habitId && log.date === date);
        if (index >= 0) logs[index] = entry;
        else logs.push(entry);
      }

      return Response.json({ success: true, message: "Habit check-in saved" });
    }

    if (action === "save" || action === "create") {
      const data = (body.habit ?? body) as Record<string, unknown>;
      if (typeof data.title !== "string" || !data.title.trim()) {
        return Response.json({ success: false, error: "A habit title is required" }, { status: 400 });
      }

      const habitId = typeof data.id === "string" && data.id
        ? data.id
        : `habit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const fields = habitFields(data);

      if (userId) {
        await Habit.updateOne({ userId, habitId }, { $set: { ...fields, userId, habitId } }, { upsert: true });
      } else {
        const { habits } = memoryFor(session.email);
        const record: HabitLike = { ...fields, id: habitId, habitId, userId: session.email, createdAt: new Date().toISOString() };
        const index = habits.findIndex((habit) => (habit.habitId || habit.id) === habitId);
        if (index >= 0) habits[index] = record;
        else habits.push(record);
      }

      return Response.json({ success: true, habitId, message: "Custom habit saved successfully" });
    }

    if (action === "delete") {
      const habitId = body.habitId;
      if (typeof habitId !== "string" || !habitId) {
        return Response.json({ success: false, error: "Missing habitId" }, { status: 400 });
      }

      if (userId) {
        await Promise.all([
          Habit.deleteOne({ userId, habitId }),
          HabitLog.deleteMany({ userId, habitId }),
          TimelineEvent.deleteMany({ userId, type: "habit", "payload.habitId": habitId }),
        ]);
      } else {
        const store = memoryFor(session.email);
        store.habits = store.habits.filter((habit) => (habit.habitId || habit.id) !== habitId);
        store.logs = store.logs.filter((log) => log.habitId !== habitId);
      }

      return Response.json({ success: true, message: "Habit deleted" });
    }

    if (action === "reset") {
      if (userId) {
        await Promise.all([
          Habit.deleteMany({ userId }),
          HabitLog.deleteMany({ userId }),
          TimelineEvent.deleteMany({ userId, type: "habit" }),
        ]);
        await seedStarterHabits(userId);
      } else {
        memoryByUser.delete(session.email);
      }

      return Response.json({ success: true, message: "Habit data reset to the starter habits." });
    }

    return Response.json({ success: false, error: "Invalid action specified" }, { status: 400 });
  } catch (error) {
    return serverError("POST /api/habits", error);
  }
}
