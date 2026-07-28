import mongoose from "mongoose";

/**
 * MongoDB connection manager for Next.js serverless environments.
 *
 * Caches the connection on the global object to avoid exhausting
 * the MongoDB Atlas connection pool across hot reloads / serverless invocations.
 */

function getMongoURI(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Please define the MONGODB_URI environment variable in .env.local");
  }
  return uri;
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global._mongooseCache ?? { conn: null, promise: null };
if (!global._mongooseCache) global._mongooseCache = cached;

async function connectDB(): Promise<typeof mongoose> {
  // If we have a live, connected connection — reuse it
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  // If connection dropped, clear the stale cache so we reconnect fresh
  if (cached.conn && mongoose.connection.readyState !== 1) {
    console.warn("⚠️ Mongoose connection stale (readyState:", mongoose.connection.readyState, ") — reconnecting...");
    cached.conn = null;
    cached.promise = null;
  }

  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: true,          // Queue ops during brief reconnects (don't fail immediately)
      serverSelectionTimeoutMS: 3000, // Tight 3s timeout for fast response & memory fallback
      connectTimeoutMS: 3000,
      socketTimeoutMS: 30000,        // Keep socket alive for 30s
      maxPoolSize: 10,               // Limit connections per serverless instance
      minPoolSize: 1,
      retryWrites: true,
    };

    cached.promise = mongoose
      .connect(getMongoURI(), opts)
      .then((m) => {
        console.log("✅ MongoDB connected");
        // Reset cache if connection drops so next request reconnects
        mongoose.connection.on("disconnected", () => {
          console.warn("🔌 MongoDB disconnected — will reconnect on next request");
          cached.conn = null;
          cached.promise = null;
        });
        return m;
      })
      .catch((err) => {
        cached.promise = null; // Allow retry on next request
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export default connectDB;
