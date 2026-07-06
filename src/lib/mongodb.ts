import { MongoClient, type Collection, type Document } from "mongodb";

const DB_NAME = "dbcyfra";
const USERS_COLLECTION = "user";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function getClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI não configurado.");
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = new MongoClient(uri).connect();
  }
  return global._mongoClientPromise;
}

export async function getUsersCollection(): Promise<Collection<Document>> {
  const client = await getClientPromise();
  return client.db(DB_NAME).collection(USERS_COLLECTION);
}
