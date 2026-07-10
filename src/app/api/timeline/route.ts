import { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { TimelineEvent } from "@/lib/db/models";
import { getLocalEvents, createLocalEvent, deleteLocalEventById, updateLocalEvent } from "@/lib/db/fallback";

export const dynamic = "force-dynamic";

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
    if (process.env.NODE_ENV === "production") {
      return Response.json({ error: "Database offline. Please try again later." }, { status: 500 });
    }
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

    // Convert string userId to ObjectId (chatbot sends string, schema needs ObjectId)
    let userObjectId: any = userId;
    try {
      userObjectId = new (require("mongoose").Types.ObjectId)(userId);
    } catch {
      // If userId is not a valid ObjectId hex string, keep as-is
    }

    const event = await TimelineEvent.create({
      userId: userObjectId,
      type,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      payload,
      tags: tags || [],
      source: source || "manual",
    });

    return Response.json({ event }, { status: 201 });
  } catch (error: any) {
    // Log the REAL error so we can debug it
    console.error("❌ Timeline POST error:", error?.message || error);

    // Validation/cast errors are NOT connection errors — surface them immediately
    if (error?.name === "ValidationError" || error?.name === "CastError") {
      console.error("❌ Mongoose validation/cast error (not a connection issue):", JSON.stringify(error?.errors));
      return Response.json({ error: `Validation failed: ${error.message}` }, { status: 400 });
    }

    // Actual connection failures fall back to local file in dev
    console.warn("⚠️ MongoDB connection failed on timeline POST. Saving to local file DB.");
    if (process.env.NODE_ENV === "production") {
      return Response.json({ error: "Database offline. Please try again later." }, { status: 500 });
    }
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

/**
 * DELETE /api/timeline
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");

    if (!eventId) {
      return Response.json({ error: "eventId is required" }, { status: 400 });
    }

    try {
      await connectDB();
      const res = await TimelineEvent.deleteOne({ _id: eventId });
      if (res.deletedCount === 0) {
        return Response.json({ error: "Event not found" }, { status: 404 });
      }
      console.log(`✅ Deleted MongoDB timeline event: ${eventId}`);
    } catch (dbError) {
      console.warn("⚠️ MongoDB offline. Deleting local JSON record.");
      if (process.env.NODE_ENV === "production") {
        return Response.json({ error: "Database offline. Please try again later." }, { status: 500 });
      }
      const deleted = await deleteLocalEventById(eventId);
      if (!deleted) {
        return Response.json({ error: "Event not found" }, { status: 404 });
      }
      console.log(`✅ Deleted local JSON event: ${eventId}`);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Timeline DELETE error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/timeline
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventId, payload, timestamp } = body;

    if (!eventId || !payload) {
      return Response.json({ error: "eventId and payload are required" }, { status: 400 });
    }

    try {
      await connectDB();
      const updateDoc: any = { payload };
      if (timestamp) {
        updateDoc.timestamp = new Date(timestamp);
      }
      
      const updatedEvent = await TimelineEvent.findOneAndUpdate(
        { _id: eventId },
        { $set: updateDoc },
        { new: true }
      );
      
      console.log(`✅ Updated MongoDB timeline event: ${eventId}`);
      return Response.json({ event: updatedEvent });
    } catch (dbError) {
      console.warn("⚠️ MongoDB offline. Updating local JSON record.");
      if (process.env.NODE_ENV === "production") {
        return Response.json({ error: "Database offline. Please try again later." }, { status: 500 });
      }
      
      const updatedEvent = await updateLocalEvent(eventId, { payload, timestamp });
      console.log(`✅ Updated local JSON event: ${eventId}`);
      return Response.json({ event: updatedEvent });
    }
  } catch (error) {
    console.error("Timeline PUT error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

