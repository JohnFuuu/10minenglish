import mongoose from 'mongoose';

export async function connectToDatabase(uri: string) {
  await mongoose.connect(uri);
}
