import { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { TimelineEvent } from "@/lib/db/models";
import { getLocalEvents, createLocalEvent, deleteLocalEventById, updateLocalEvent, LocalEvent } from "@/lib/db/fallback";
import { requireUserSession } from "@/lib/auth/session";
import {
  CLIENT_EVENT_SOURCES,
  TIMELINE_EVENT_TYPES,
  invalidBodyResponse,
  isValidDate,
  isValidEventId,
  readJsonObject,
  validateTimelinePayload,
} from "@/lib/validation";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

function databaseOfflineResponse(): Response {
  return Response.json({ error: "Database offline. Please try again later." }, { status: 503 });
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function includes<T extends string>(list: readonly T[], value: unknown): value is T {
  return list.includes(value as T);
}

function parseLimit(raw: string | null): number {
  const parsed = parseInt(raw || "", 10);
  return Number.isNaN(parsed) || parsed < 1 ? DEFAULT_LIMIT : Math.min(parsed, MAX_LIMIT);
}

/**
 * GET /api/timeline
 */
export async function GET(request: NextRequest) {
  const session = requireUserSession(request);
  if (session instanceof Response) return session;

  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type");
  const before = searchParams.get("before");
  const limit = parseLimit(searchParams.get("limit"));

  if (before && !isValidDate(before)) {
    return Response.json({ error: "before must be a valid date" }, { status: 400 });
  }

  try {
    await connectDB();

    const query: Record<string, unknown> = { userId: session.userId };
    if (type) query.type = type;
    if (before) query.timestamp = { $lt: new Date(before) };

    // Older meals may embed a full photo; lists never need it.
    const events = await TimelineEvent.find(query)
      .select("-payload.imagePreview")
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return Response.json({ events, count: events.length, hasMore: events.length === limit });
  } catch (error) {
    console.warn("Timeline GET could not reach MongoDB:", error);
    if (isProduction()) return databaseOfflineResponse();

    const events = await getLocalEvents({
      userId: session.userId,
      type: type || undefined,
      limit,
      before: before || undefined,
    });
    return Response.json({ events, count: events.length, hasMore: events.length === limit });
  }
}

/**
 * POST /api/timeline
 */
export async function POST(request: NextRequest) {
  const session = requireUserSession(request);
  if (session instanceof Response) return session;

  const body = await readJsonObject(request);
  if (!body) return invalidBodyResponse();
  const { type, timestamp, payload, tags, source } = body;

  if (source === "mock") {
    return Response.json({ error: "Cannot log demo or mock meal data to timeline." }, { status: 400 });
  }
  if (!includes(TIMELINE_EVENT_TYPES, type) || type === "habit") {
    return Response.json({ error: "A valid event type is required" }, { status: 400 });
  }
  if (timestamp !== undefined && !isValidDate(timestamp)) {
    return Response.json({ error: "timestamp must be a valid date" }, { status: 400 });
  }
  if (source !== undefined && !includes(CLIENT_EVENT_SOURCES, source)) {
    return Response.json({ error: "Invalid event source" }, { status: 400 });
  }

  const validationError = validateTimelinePayload(type, payload);
  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  const eventPayload = payload as Record<string, unknown>;
  const eventTime = timestamp ? new Date(timestamp as string) : new Date();
  const eventTags = Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === "string") : [];

  try {
    await connectDB();
    const event = await TimelineEvent.create({
      userId: session.userId,
      type,
      timestamp: eventTime,
      payload: eventPayload,
      tags: eventTags,
      source: source || "manual",
    });
    return Response.json({ event }, { status: 201 });
  } catch (error) {
    const name = (error as Error)?.name;
    if (name === "ValidationError" || name === "CastError") {
      if (isProduction() || !session.userId.startsWith("local_user_")) {
        return Response.json({ error: "The log entry is invalid." }, { status: 400 });
      }
    }

    console.warn("Timeline POST could not reach MongoDB:", error);
    if (isProduction()) return databaseOfflineResponse();

    const event = await createLocalEvent({
      userId: session.userId,
      type,
      timestamp: eventTime.toISOString(),
      payload: eventPayload,
      tags: eventTags,
      source: source || "manual",
    });
    return Response.json({ event }, { status: 201 });
  }
}

/**
 * DELETE /api/timeline
 */
export async function DELETE(request: NextRequest) {
  const session = requireUserSession(request);
  if (session instanceof Response) return session;

  const eventId = request.nextUrl.searchParams.get("eventId");
  if (!isValidEventId(eventId)) {
    return Response.json({ error: "A valid eventId is required" }, { status: 400 });
  }

  let deleted: boolean;
  try {
    await connectDB();
    const result = await TimelineEvent.deleteOne({ _id: eventId, userId: session.userId });
    deleted = result.deletedCount > 0;
  } catch (error) {
    console.warn("Timeline DELETE could not reach MongoDB:", error);
    if (isProduction()) return databaseOfflineResponse();
    deleted = await deleteLocalEventById(eventId, session.userId);
  }

  return deleted
    ? Response.json({ success: true })
    : Response.json({ error: "Event not found" }, { status: 404 });
}

/**
 * PUT /api/timeline
 */
export async function PUT(request: NextRequest) {
  const session = requireUserSession(request);
  if (session instanceof Response) return session;

  const body = await readJsonObject(request);
  if (!body) return invalidBodyResponse();
  const { eventId, payload, timestamp } = body;

  if (!isValidEventId(eventId) || !payload || typeof payload !== "object" || Array.isArray(payload)) {
    return Response.json({ error: "A valid eventId and payload are required" }, { status: 400 });
  }
  if (timestamp !== undefined && !isValidDate(timestamp)) {
    return Response.json({ error: "timestamp must be a valid date" }, { status: 400 });
  }

  const changes = payload as Record<string, unknown>;

  try {
    await connectDB();
    const existing = await TimelineEvent.findOne({ _id: eventId, userId: session.userId });
    if (!existing) {
      return Response.json({ error: "Event not found" }, { status: 404 });
    }

    // Edits send only the changed fields; keep the rest of the entry.
    const merged = { ...existing.payload, ...changes };
    const validationError = validateTimelinePayload(existing.type, merged);
    if (validationError) {
      return Response.json({ error: validationError }, { status: 400 });
    }

    existing.payload = merged;
    existing.markModified("payload");
    if (timestamp) existing.timestamp = new Date(timestamp as string);
    await existing.save();

    return Response.json({ event: existing });
  } catch (error) {
    console.warn("Timeline PUT could not reach MongoDB:", error);
    if (isProduction()) return databaseOfflineResponse();

    const event: LocalEvent | null = await updateLocalEvent(eventId, session.userId, {
      payload: changes,
      timestamp: timestamp as string | undefined,
    });
    return event
      ? Response.json({ event })
      : Response.json({ error: "Event not found" }, { status: 404 });
  }
}
