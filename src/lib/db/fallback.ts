import fs from "fs";
import path from "path";

/**
 * JSON-file store used only in development when MongoDB is unreachable.
 */

const DB_FILE_PATH = path.join(process.cwd(), "local_db.json");

export interface LocalProfile {
  _id: string;
  email: string;
  [key: string]: unknown;
}

export interface LocalEvent {
  _id: string;
  userId: string;
  type: string;
  timestamp: string;
  payload: Record<string, unknown>;
  [key: string]: unknown;
}

interface LocalDB {
  profiles: LocalProfile[];
  events: LocalEvent[];
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 11);
}

function initDB(): LocalDB {
  try {
    if (!fs.existsSync(DB_FILE_PATH)) {
      const initial: LocalDB = { profiles: [], events: [] };
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(initial, null, 2));
      return initial;
    }
    return JSON.parse(fs.readFileSync(DB_FILE_PATH, "utf8")) as LocalDB;
  } catch (err) {
    console.error("Failed to initialize local JSON DB:", err);
    return { profiles: [], events: [] };
  }
}

function saveDB(db: LocalDB) {
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error("Failed to save local JSON DB:", err);
  }
}

export async function getLocalProfile(email?: string): Promise<LocalProfile | null> {
  if (!email) return null;
  return initDB().profiles.find((p) => p.email.toLowerCase() === email.toLowerCase()) || null;
}

export async function getLocalProfileById(id: string): Promise<LocalProfile | null> {
  return initDB().profiles.find((p) => p._id === id) || null;
}

export async function saveLocalProfile(profileData: Record<string, unknown> & { email: string }): Promise<LocalProfile> {
  const db = initDB();
  const now = new Date().toISOString();
  let profile = db.profiles.find((p) => p.email === profileData.email);

  if (profile) {
    Object.assign(profile, profileData, { updatedAt: now });
  } else {
    profile = { _id: `local_user_${randomId()}`, ...profileData, createdAt: now, updatedAt: now };
    db.profiles.push(profile);
  }

  saveDB(db);
  return profile;
}

export async function getLocalEvents(query: { userId: string; type?: string; limit?: number; before?: string }): Promise<LocalEvent[]> {
  let filtered = initDB().events.filter((e) => e.userId === query.userId);

  if (query.type) {
    filtered = filtered.filter((e) => e.type === query.type);
  }

  if (query.before) {
    const beforeTime = new Date(query.before).getTime();
    filtered = filtered.filter((e) => new Date(e.timestamp).getTime() < beforeTime);
  }

  filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return query.limit ? filtered.slice(0, query.limit) : filtered;
}

export async function createLocalEvent(
  eventData: Pick<LocalEvent, "userId" | "type" | "timestamp" | "payload"> & Record<string, unknown>
): Promise<LocalEvent> {
  const db = initDB();
  const now = new Date().toISOString();
  const event: LocalEvent = { ...eventData, _id: `local_event_${randomId()}`, createdAt: now, updatedAt: now };
  db.events.push(event);
  saveDB(db);
  return event;
}

export async function deleteLocalEvents(userId: string): Promise<void> {
  const db = initDB();
  db.events = db.events.filter((e) => e.userId !== userId);
  saveDB(db);
}

export async function deleteLocalProfile(email: string): Promise<void> {
  const db = initDB();
  db.profiles = db.profiles.filter((p) => p.email.toLowerCase() !== email.toLowerCase());
  saveDB(db);
}

export async function deleteLocalEventById(eventId: string, userId: string): Promise<boolean> {
  const db = initDB();
  const initialLength = db.events.length;
  db.events = db.events.filter((e) => !(e._id === eventId && e.userId === userId));
  const deleted = db.events.length < initialLength;
  saveDB(db);
  return deleted;
}

export async function updateLocalEvent(
  eventId: string,
  userId: string,
  update: { payload: Record<string, unknown>; timestamp?: string }
): Promise<LocalEvent | null> {
  const db = initDB();
  const event = db.events.find((e) => e._id === eventId && e.userId === userId);
  if (!event) return null;

  event.payload = { ...event.payload, ...update.payload };
  event.timestamp = update.timestamp || event.timestamp;
  event.updatedAt = new Date().toISOString();
  saveDB(db);
  return event;
}
