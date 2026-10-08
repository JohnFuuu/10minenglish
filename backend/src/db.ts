import mongoose from 'mongoose';

// MONGODB_DB_NAME picks the database when the connection string doesn't name
// one (Atlas's copy-paste string ends in "/?appName=…", which would
// otherwise mean the default "test" database).
export async function connectToDatabase(uri: string) {
  const dbName = process.env.MONGODB_DB_NAME;
  await mongoose.connect(uri, dbName ? { dbName } : {});
}
