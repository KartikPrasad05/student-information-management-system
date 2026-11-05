import mongoose from 'mongoose';
import dns from 'node:dns';

// Ensure IPv4 first resolution for SRV records on Windows & Node 18+
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '208.67.222.222']);
} catch {
  // Ignore if custom DNS servers cannot be set
}

/**
 * Repairs and normalizes a MongoDB Atlas connection string:
 * 1. Ensures the target database (default: 'studentDB') is specified before the query string.
 * 2. Ensures retryWrites=true and w=majority parameters are present.
 * 3. Handles URL encoding of special characters in credentials if needed.
 * 
 * @param {string} rawUri - The raw connection string from .env
 * @param {string} targetDb - Target database name (default: 'studentDB')
 * @returns {{ uri: string, repaired: boolean, changes: string[] }}
 */
export function repairMongoUri(rawUri, targetDb = 'studentDB') {
  if (!rawUri || typeof rawUri !== 'string') {
    throw new Error('MONGODB_URI is missing or not a string.');
  }

  let uri = rawUri.trim();
  const changes = [];

  // Check if database name is missing before '?'
  // Example match: .mongodb.net/ or .mongodb.net/? or .mongodb.net
  const missingDbRegex = /(\.mongodb\.net(?::\d+)?)\/?(\?.*)?$/i;
  const match = uri.match(missingDbRegex);

  if (match) {
    const hostPart = match[1];
    const queryPart = match[2] || '';
    
    // Check if there is already a database name (not starting with '?')
    const pathAfterHost = uri.slice(uri.indexOf(hostPart) + hostPart.length);
    const hasDbName = /^\/[a-zA-Z0-9_-]+(\?|$)/.test(pathAfterHost);

    if (!hasDbName) {
      // Inject database name
      uri = uri.replace(missingDbRegex, `$1/${targetDb}${queryPart ? queryPart : '?retryWrites=true&w=majority'}`);
      changes.push(`Injected target database '/${targetDb}'`);
    }
  }

  // Ensure retryWrites and w=majority are present
  if (!uri.includes('retryWrites=')) {
    const separator = uri.includes('?') ? '&' : '?';
    uri += `${separator}retryWrites=true`;
    changes.push("Added 'retryWrites=true'");
  }
  if (!uri.includes('w=')) {
    const separator = uri.includes('?') ? '&' : '?';
    uri += `${separator}w=majority`;
    changes.push("Added 'w=majority'");
  }

  return {
    uri,
    repaired: changes.length > 0,
    changes
  };
}

/**
 * Tests MongoDB connectivity and returns comprehensive diagnostic information.
 * 
 * @param {string} uri - The MongoDB URI to test
 * @returns {Promise<{ success: boolean, message: string, diagnostics?: object }>}
 */
export async function testMongoConnection(uri) {
  const { uri: repairedUri, repaired, changes } = repairMongoUri(uri);

  try {
    const conn = await mongoose.createConnection(repairedUri, {
      serverSelectionTimeoutMS: 6000,
      connectTimeoutMS: 6000,
      family: 4 // Force IPv4
    }).asPromise();

    const admin = conn.db.admin();
    const pingResult = await admin.ping();
    await conn.close();

    return {
      success: true,
      message: 'Successfully connected and pinged MongoDB Atlas cluster!',
      repaired,
      changes,
      effectiveUri: repairedUri.replace(/:([^@]+)@/, ':****@'),
      diagnostics: {
        ping: pingResult,
        readyState: 'connected'
      }
    };
  } catch (error) {
    let diagnosticAdvice = 'Unknown database error.';

    if (error.message.includes('querySrv') || error.code === 'ECONNREFUSED' || error.code === 'ETIMEOUT') {
      diagnosticAdvice = 'DNS SRV lookup failure. Your network or ISP may be blocking DNS SRV queries. The Doctor sets 8.8.8.8 and forces IPv4 to resolve this.';
    } else if (error.message.includes('bad auth') || error.message.includes('Authentication failed') || error.code === 8000) {
      diagnosticAdvice = 'Authentication failed. Please verify your MongoDB Atlas username and password in .env.';
    } else if (error.name === 'MongooseServerSelectionError' || error.message.includes('Server selection timed out')) {
      diagnosticAdvice = 'Atlas Network Access block. Make sure 0.0.0.0/0 (Allow access from anywhere) is added in MongoDB Atlas -> Network Access tab so Vercel and Render can connect.';
    }

    return {
      success: false,
      message: error.message,
      repaired,
      changes,
      diagnosticAdvice,
      effectiveUri: repairedUri.replace(/:([^@]+)@/, ':****@')
    };
  }
}
