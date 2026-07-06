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
    // family: 4 força IPv4; em runtimes serverless (Vercel) a resolução via
    // IPv6 do SRV do Atlas pode causar falha de handshake TLS
    // ("SSL alert number 80") contra o proxy de clusters compartilhados (M0).
    global._mongoClientPromise = new MongoClient(uri, { family: 4 }).connect();
  }
  return global._mongoClientPromise;
}

export async function getUsersCollection(): Promise<Collection<Document>> {
  const client = await getClientPromise();
  return client.db(DB_NAME).collection(USERS_COLLECTION);
}
