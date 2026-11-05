import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dns from 'node:dns';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDatabase } from './config/database.js';
import { seedDefaultDepartments } from './controllers/departmentController.js';
import studentRoutes from './routes/studentRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js';

// Workaround for Node.js DNS resolution with MongoDB SRV records on some systems
try {
  dns.setServers(['1.1.1.1', '8.8.8.8']);
} catch {
  // Ignore if custom DNS servers cannot be set
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../frontend/dist');

const app = express();
const port = Number(process.env.PORT) || 5000;
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable('x-powered-by');

// Configure Helmet with relaxed cross-origin policies for static frontend serving
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS setup supporting exact origins, wildcards (*), local dev, and Vercel domains
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // Allow local development ports automatically
    if (process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    // Allow Vercel or Render deployment domains
    if (/^https:\/\/[a-zA-Z0-9-]+\.(vercel\.app|onrender\.com)$/.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin is not allowed by CORS.'));
  },
  credentials: true
}));

app.use(express.json({ limit: '20kb' }));

// Ensure database connection is active on serverless invocations (e.g. Vercel)
app.use(async (_request, _response, next) => {
  try {
    await connectDatabase();
    next();
  } catch (error) {
    next(error);
  }
});

// Rate limiting (exempt /health check)
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));

// Health check endpoint
app.get('/health', (_request, response) => {
  response.json({
    success: true,
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// REST API routes
app.use('/api/students', studentRoutes);
app.use('/api/departments', departmentRoutes);

// Optional: Serve frontend static build if present (enables single-service fullstack deployment)
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (request, response, next) => {
    if (request.path.startsWith('/api') || request.path === '/health') {
      return next();
    }
    response.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  // If frontend not built into dist, root returns API meta
  app.get('/', (_request, response) => {
    response.json({
      name: 'CampusDesk Student Information System API',
      status: 'active',
      endpoints: {
        health: '/health',
        students: '/api/students',
        departments: '/api/departments'
      }
    });
  });
}

// 404 handler for unmatched API routes
app.use((_request, response) => {
  response.status(404).json({ success: false, message: 'The requested resource was not found.' });
});

// Centralized error handling
app.use((error, _request, response, _next) => {
  if (error.message === 'Origin is not allowed by CORS.') {
    return response.status(403).json({ success: false, message: 'This website is not allowed to access the API.' });
  }
  if (error instanceof SyntaxError && 'body' in error) {
    return response.status(400).json({ success: false, message: 'Request body must be valid JSON.' });
  }
  if (error.type === 'entity.too.large') {
    return response.status(413).json({ success: false, message: 'Request body is too large.' });
  }
  console.error('Unhandled API error:', error);
  return response.status(500).json({ success: false, message: error.message || 'An unexpected server error occurred.' });
});

async function start() {
  await connectDatabase();
  await seedDefaultDepartments();
  app.listen(port, () => console.log(`CampusDesk API listening on port ${port}`));
}

// Only launch standalone HTTP listener if not running in a serverless environment like Vercel
if (process.env.VERCEL !== '1') {
  start().catch((error) => {
    console.error('Unable to start the student API:', error.message);
    process.exitCode = 1;
  });
}

export default app;
