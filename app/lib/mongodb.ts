import { Db, MongoClient } from "mongodb";

declare global {
  // eslint-disable-next-line no-var
  var mongoClientPromise: Promise<MongoClient> | undefined;
}

export async function getMongoDb(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not configured");
  }

  if (!globalThis.mongoClientPromise) {
    const client = new MongoClient(uri);
    globalThis.mongoClientPromise = client.connect();
  }

  const client = await globalThis.mongoClientPromise;
  return client.db(process.env.MONGODB_DB);
}
