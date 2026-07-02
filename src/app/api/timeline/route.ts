import { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { TimelineEvent } from "@/lib/db/models";
import { getLocalEvents, createLocalEvent } from "@/lib/db/fallback";

/**
 * GET /api/timeline
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const userId = searchParams.get("userId");
  const type = searchParams.get("type");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const before = searchParams.get("before");

  if (!userId) {
    return Response.json(
      { error: "userId query parameter is required" },
      { status: 400 }
    );
  }

  try {
    await connectDB();

    const query: Record<string, unknown> = { userId };
    if (type) query.type = type;
    if (before) query.timestamp = { $lt: new Date(before) };

    const events = await TimelineEvent.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return Response.json({
      events,
      count: events.length,
      hasMore: events.length === limit,
    });
  } catch (error) {
    console.warn("⚠️ MongoDB connection failed on timeline GET. Querying local file DB.");
    const events = await getLocalEvents({
      userId,
      type: type || undefined,
      limit,
      before: before || undefined,
    });
    return Response.json({
      events,
      count: events.length,
      hasMore: events.length === limit,
    });
  }
}

/**
 * POST /api/timeline
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { userId, type, timestamp, payload, tags, source } = body;

  if (!userId || !type || !payload) {
    return Response.json(
      { error: "userId, type, and payload are required" },
      { status: 400 }
    );
  }

  try {
    await connectDB();

    const event = await TimelineEvent.create({
      userId,
      type,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      payload,
      tags: tags || [],
      source: source || "manual",
    });

    return Response.json({ event }, { status: 201 });
  } catch (error) {
    console.warn("⚠️ MongoDB connection failed on timeline POST. Saving to local file DB.");
    const event = await createLocalEvent({
      userId,
      type,
      timestamp: timestamp || new Date().toISOString(),
      payload,
      tags: tags || [],
      source: source || "manual",
    });
    return Response.json({ event }, { status: 201 });
  }
}
