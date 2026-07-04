import fs from "fs";
import path from "path";

const DB_FILE_PATH = path.join(process.cwd(), "local_db.json");

interface LocalDB {
  profiles: any[];
  events: any[];
}

// Ensure the local JSON DB exists
function initDB(): LocalDB {
  try {
    if (!fs.existsSync(DB_FILE_PATH)) {
      const initial: LocalDB = { profiles: [], events: [] };
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(initial, null, 2));
      return initial;
    }
    const data = fs.readFileSync(DB_FILE_PATH, "utf8");
    return JSON.parse(data) as LocalDB;
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

export async function getLocalProfile(email?: string) {
  const db = initDB();
  if (email) {
    return db.profiles.find((p) => p.email.toLowerCase() === email.toLowerCase()) || null;
  }
  return null;
}

export async function getLocalProfileById(id: string) {
  const db = initDB();
  return db.profiles.find((p) => p._id === id) || null;
}

export async function saveLocalProfile(profileData: any) {
  const db = initDB();
  let profile = db.profiles.find((p) => p.email === profileData.email);

  if (profile) {
    Object.assign(profile, profileData, { updatedAt: new Date().toISOString() });
  } else {
    profile = {
      _id: "local_user_" + Math.random().toString(36).substr(2, 9),
      ...profileData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.profiles.push(profile);
  }

  saveDB(db);
  return profile;
}

export async function getLocalEvents(query: { userId: string; type?: string; limit?: number; before?: string }) {
  const db = initDB();
  let filtered = db.events.filter((e) => e.userId === query.userId);

  if (query.type) {
    filtered = filtered.filter((e) => e.type === query.type);
  }

  if (query.before) {
    const beforeTime = new Date(query.before).getTime();
    filtered = filtered.filter((e) => new Date(e.timestamp).getTime() < beforeTime);
  }

  // Sort descending by timestamp
  filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (query.limit) {
    filtered = filtered.slice(0, query.limit);
  }

  return filtered;
}

export async function createLocalEvent(eventData: any) {
  const db = initDB();
  const event = {
    _id: "local_event_" + Math.random().toString(36).substr(2, 9),
    ...eventData,
    timestamp: eventData.timestamp || new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.events.push(event);
  saveDB(db);
  return event;
}

export async function deleteLocalEvents(userId: string) {
  const db = initDB();
  db.events = db.events.filter((e) => e.userId !== userId);
  saveDB(db);
}

export async function countLocalEvents(userId: string): Promise<number> {
  const db = initDB();
  return db.events.filter((e) => e.userId === userId).length;
}

export async function deleteLocalProfile(email: string) {
  const db = initDB();
  db.profiles = db.profiles.filter((p) => p.email.toLowerCase() !== email.toLowerCase());
  saveDB(db);
}

export async function deleteLocalEventById(eventId: string) {
  const db = initDB();
  db.events = db.events.filter((e) => e._id !== eventId);
  saveDB(db);
}


