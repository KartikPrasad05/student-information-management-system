import mongoose from 'mongoose';
import dns from 'node:dns';
import { repairMongoUri } from '../utils/mongoUriDoctor.js';

// Enforce IPv4 lookup order to resolve Node.js 18+ Windows SRV resolution failures
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '208.67.222.222']);
} catch {
  // Ignore if custom DNS servers cannot be set in current environment
}

let cachedConnection = null;

export async function connectDatabase() {
  // Reuse existing connection in serverless environments (Vercel)
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  const rawUri = process.env.MONGODB_URI;
  if (!rawUri) {
    throw new Error(
      'MONGODB_URI is required. Please set MONGODB_URI in backend/.env or your Vercel/Render Environment Variables.'
    );
  }

  // Auto-repair URI (injects /studentDB and retry parameters if missing)
  const { uri: repairedUri, repaired, changes } = repairMongoUri(rawUri, 'studentDB');
  if (repaired) {
    console.log(`[MongoDB Doctor] Auto-corrected MONGODB_URI: ${changes.join(', ')}`);
  }

  mongoose.set('strictQuery', true);

  try {
    cachedConnection = await mongoose.connect(repairedUri, {
      dbName: 'studentDB',
      serverSelectionTimeoutMS: 10000,
      family: 4 // Force IPv4 to prevent Windows/cloud ECONNREFUSED on SRV records
    });
    console.log('Connected to MongoDB Atlas (database: studentDB).');
    return cachedConnection;
  } catch (error) {
    console.error('--- MongoDB Connection Diagnosis ---');
    console.error(`Error: ${error.message}`);

    if (error.message.includes('querySrv') || error.code === 'ECONNREFUSED' || error.code === 'ETIMEOUT') {
      console.error(
        '[Fix Required] DNS SRV lookup failed. Check your network or use Google DNS (8.8.8.8).'
      );
    } else if (error.message.includes('Authentication failed') || error.code === 8000) {
      console.error(
        '[Fix Required] MongoDB Authentication failed. Check your Atlas database username & password.'
      );
    } else if (error.name === 'MongooseServerSelectionError') {
      console.error(
        '[Fix Required] Atlas Network Access Block: Go to MongoDB Atlas -> Network Access -> Add IP Address -> Add "0.0.0.0/0" (Allow access from anywhere).'
      );
    }
    console.error('------------------------------------');
    throw error;
  }
}
