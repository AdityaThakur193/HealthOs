import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import { UserProfile, Habit, HabitLog, TimelineEvent } from "@/lib/db/models";
import {
  calculateHabitStrength,
  calculateCurrentStreak,
  get30DayHeatmap,
  formatDateKey,
  getStarterHabits,
  HabitWithStats,
  HabitLogEntry,
} from "@/lib/habitEngine";
import mongoose from "mongoose";

// In-memory fallback if MongoDB Atlas is unavailable
let memoryHabits: any[] = [];
let memoryHabitLogs: any[] = [];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "email query parameter is required" }, { status: 400 });
    }

    let dbConnected = false;
    let userIdStr = "default_user";

    try {
      await connectToDatabase();
      const user = await UserProfile.findOne({ email });
      if (user) {
        userIdStr = user._id.toString();
      }
      dbConnected = true;
    } catch {
      console.warn("MongoDB connection unavailable for /api/habits, using memory fallback.");
    }

    let habitsRaw: any[] = [];
    let logsRaw: any[] = [];

    if (dbConnected && userIdStr !== "default_user") {
      const userObjectId = new mongoose.Types.ObjectId(userIdStr);
      habitsRaw = await Habit.find({ userId: userObjectId, status: "active" }).sort({ sortOrder: 1 });
      
      // If user has no habits defined yet, seed starter habits
      if (habitsRaw.length === 0) {
        const starter = getStarterHabits(userIdStr);
        for (const s of starter) {
          await Habit.create({
            userId: userObjectId,
            habitId: s.id,
            title: s.title,
            category: s.category,
            targetType: s.targetType,
            targetValue: s.targetValue,
            unit: s.unit,
            frequency: s.frequency,
            colorTag: s.colorTag,
            icon: s.icon,
            status: s.status,
            notes: s.notes,
            sortOrder: s.sortOrder,
          });
        }
        habitsRaw = await Habit.find({ userId: userObjectId, status: "active" }).sort({ sortOrder: 1 });
      }

      logsRaw = await HabitLog.find({ userId: userObjectId });
    } else {
      if (memoryHabits.length === 0) {
        memoryHabits = getStarterHabits(userIdStr);
      }
      habitsRaw = memoryHabits.filter((h) => h.status === "active");
      logsRaw = memoryHabitLogs;
    }

    const todayKey = formatDateKey(new Date());

    // Map logs by habitId
    const habitLogMap = new Map<string, HabitLogEntry[]>();
    logsRaw.forEach((l) => {
      const hId = l.habitId;
      if (!habitLogMap.has(hId)) habitLogMap.set(hId, []);
      habitLogMap.get(hId)!.push({
        date: l.date,
        completed: Boolean(l.completed),
        value: l.value || 0,
      });
    });

    // Compute statistics for each custom habit
    const habitsWithStats: HabitWithStats[] = habitsRaw.map((h) => {
      const hId = h.habitId || h.id;
      const logs = habitLogMap.get(hId) || [];
      const targetVal = h.targetValue || 1;

      const strength = calculateHabitStrength(logs, targetVal);
      const { currentStreak, bestStreak } = calculateCurrentStreak(logs, h.frequency || "daily");
      const heatmap = get30DayHeatmap(logs, targetVal);

      const todayLog = logs.find((l) => l.date === todayKey);
      const completedToday = Boolean(todayLog?.completed || (todayLog?.value && todayLog.value >= targetVal));
      const todayValue = todayLog?.value || 0;

      return {
        id: hId,
        userId: String(h.userId),
        title: h.title,
        category: h.category || "Misc",
        targetType: h.targetType || "boolean",
        targetValue: targetVal,
        unit: h.unit,
        frequency: h.frequency || "daily",
        weeklyTargetCount: h.weeklyTargetCount || 7,
        colorTag: h.colorTag || "#34d399",
        icon: h.icon || "Sparkles",
        status: h.status || "active",
        notes: h.notes || "",
        sortOrder: h.sortOrder || 1,
        createdAt: h.createdAt ? new Date(h.createdAt).toISOString() : new Date().toISOString(),
        habitStrength: strength,
        currentStreak,
        bestStreak,
        completedToday,
        todayValue,
        heatmap30Days: heatmap,
      };
    });

    const totalHabits = habitsWithStats.length;
    const completedTodayCount = habitsWithStats.filter((h) => h.completedToday).length;
    const avgStrength = totalHabits > 0 
      ? Math.round(habitsWithStats.reduce((acc, h) => acc + h.habitStrength, 0) / totalHabits) 
      : 0;
    const bestStreakOverall = habitsWithStats.reduce((max, h) => Math.max(max, h.currentStreak), 0);

    return NextResponse.json({
      success: true,
      habits: habitsWithStats,
      summary: {
        totalHabits,
        completedTodayCount,
        completionRateToday: totalHabits > 0 ? Math.round((completedTodayCount / totalHabits) * 100) : 0,
        avgHabitStrength: avgStrength,
        bestStreakOverall,
      },
    });
  } catch (error: any) {
    console.error("GET /api/habits Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, email, habit, checkin } = body;

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    let dbConnected = false;
    let userIdStr = "default_user";
    let userObjectId: mongoose.Types.ObjectId | null = null;

    try {
      await connectToDatabase();
      const user = await UserProfile.findOne({ email });
      if (user) {
        userIdStr = user._id.toString();
        userObjectId = user._id as mongoose.Types.ObjectId;
        dbConnected = true;
      }
    } catch {
      console.warn("MongoDB unavailable for POST /api/habits, using memory fallback.");
    }

    // ── ACTION 1: CHECKIN / TOGGLE ──────────────────────────────────────────
    if (action === "checkin" || checkin) {
      const { habitId, date = formatDateKey(new Date()), value, completed } = checkin || body;
      
      if (!habitId) {
        return NextResponse.json({ success: false, error: "Missing habitId" }, { status: 400 });
      }

      let isCompleted = Boolean(completed);
      let logValue = value !== undefined ? Number(value) : (isCompleted ? 1 : 0);

      if (dbConnected && userObjectId) {
        // Upsert HabitLog
        await HabitLog.findOneAndUpdate(
          { userId: userObjectId, habitId, date },
          { completed: isCompleted, value: logValue },
          { upsert: true, new: true }
        );

        // Fetch Habit details for Timeline entry
        const hDef = await Habit.findOne({ userId: userObjectId, habitId });
        const habitTitle = hDef ? hDef.title : habitId;

        // Sync with Health Timeline if completed
        if (isCompleted) {
          await TimelineEvent.create({
            userId: userObjectId,
            type: "habit",
            source: "habit_tracker",
            payload: {
              habitId,
              title: habitTitle,
              category: hDef?.category || "Habit",
              value: logValue,
              unit: hDef?.unit || "",
              timestamp: new Date().toISOString(),
            },
            timestamp: new Date(),
          });
        }
      } else {
        const existingIdx = memoryHabitLogs.findIndex((l) => l.habitId === habitId && l.date === date);
        if (existingIdx >= 0) {
          memoryHabitLogs[existingIdx] = { habitId, date, completed: isCompleted, value: logValue };
        } else {
          memoryHabitLogs.push({ habitId, date, completed: isCompleted, value: logValue });
        }
      }

      return NextResponse.json({ success: true, message: "Habit check-in saved" });
    }

    // ── ACTION 2: CREATE / SAVE HABIT ───────────────────────────────────────
    if (action === "save" || action === "create" || habit) {
      const hData = habit || body;
      const hId = hData.id || `habit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      if (dbConnected && userObjectId) {
        await Habit.findOneAndUpdate(
          { userId: userObjectId, habitId: hId },
          {
            userId: userObjectId,
            habitId: hId,
            title: hData.title,
            category: hData.category || "Misc",
            targetType: hData.targetType || "boolean",
            targetValue: Number(hData.targetValue) || 1,
            unit: hData.unit || "",
            frequency: hData.frequency || "daily",
            colorTag: hData.colorTag || "#34d399",
            icon: hData.icon || "Sparkles",
            status: hData.status || "active",
            notes: hData.notes || "",
            sortOrder: Number(hData.sortOrder) || 1,
          },
          { upsert: true, new: true }
        );
      } else {
        const idx = memoryHabits.findIndex((h) => h.id === hId || h.habitId === hId);
        const newHabit = {
          id: hId,
          habitId: hId,
          userId: userIdStr,
          title: hData.title,
          category: hData.category || "Misc",
          targetType: hData.targetType || "boolean",
          targetValue: Number(hData.targetValue) || 1,
          unit: hData.unit || "",
          frequency: hData.frequency || "daily",
          colorTag: hData.colorTag || "#34d399",
          icon: hData.icon || "Sparkles",
          status: hData.status || "active",
          notes: hData.notes || "",
          sortOrder: Number(hData.sortOrder) || 1,
          createdAt: new Date().toISOString(),
        };

        if (idx >= 0) {
          memoryHabits[idx] = newHabit;
        } else {
          memoryHabits.push(newHabit);
        }
      }

      return NextResponse.json({ success: true, habitId: hId, message: "Custom habit saved successfully" });
    }

    // ── ACTION 3: DELETE / ARCHIVE ──────────────────────────────────────────
    if (action === "delete" || action === "archive") {
      const { habitId } = body;
      if (!habitId) {
        return NextResponse.json({ success: false, error: "Missing habitId" }, { status: 400 });
      }

      if (dbConnected && userObjectId) {
        if (action === "delete") {
          await Habit.deleteOne({ userId: userObjectId, habitId });
          await HabitLog.deleteMany({ userId: userObjectId, habitId });
        } else {
          await Habit.findOneAndUpdate({ userId: userObjectId, habitId }, { status: "archived" });
        }
      } else {
        if (action === "delete") {
          memoryHabits = memoryHabits.filter((h) => h.id !== habitId && h.habitId !== habitId);
          memoryHabitLogs = memoryHabitLogs.filter((l) => l.habitId !== habitId);
        } else {
          const h = memoryHabits.find((x) => x.id === habitId || x.habitId === habitId);
          if (h) h.status = "archived";
        }
      }

      return NextResponse.json({ success: true, message: `Habit ${action}d successfully` });
    }

    return NextResponse.json({ success: false, error: "Invalid action specified" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/habits Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
