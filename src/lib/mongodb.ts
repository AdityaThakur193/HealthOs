import mongoose from "mongoose";

/**
 * MongoDB connection manager for Next.js serverless environments.
 *
 * In serverless functions, each invocation may spin up a new process.
 * We cache the connection on the global object to avoid exhausting
 * the MongoDB connection pool.
 */

function getMongoURI(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "Please define the MONGODB_URI environment variable in .env.local"
    );
  }
  return uri;
}

/**
 * Global type augmentation to cache the mongoose connection
 * across hot reloads in development.
 */
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global._mongooseCache ?? {
  conn: null,
  promise: null,
};

if (!global._mongooseCache) {
  global._mongooseCache = cached;
}

async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000, // Timeout after 5s if Atlas is unreachable
      connectTimeoutMS: 5000,
    };

    cached.promise = mongoose
      .connect(getMongoURI(), opts)
      .then((m) => {
        console.log("✅ MongoDB connected");
        return m;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default connectDB;
