#!/usr/bin/env node

/**
 * CampusDesk Unified MCP Server
 * Model Context Protocol (MCP) server providing Claude with direct tools for:
 * 1. MongoDB Atlas management & inspection
 * 2. Vercel deployment & project management
 * 3. Render deployment & service management
 * 4. Unified multi-platform deployment orchestration
 */

import readline from 'node:readline';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { testMongoConnection, repairMongoUri } from '../backend/utils/mongoUriDoctor.js';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Helper to log debug info to stderr so stdio JSON-RPC remains clean
function logDebug(...args) {
  process.stderr.write(`[MCP Server] ${args.join(' ')}\n`);
}

// Read environment variables from backend/.env or system environment
function getEnv(key, fallback = '') {
  if (process.env[key]) return process.env[key];
  const envPath = path.join(rootDir, 'backend', '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    const regex = new RegExp(`^${key}=(.*)$`, 'm');
    const match = content.match(regex);
    if (match) return match[1].trim();
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Tool Definitions
// ---------------------------------------------------------------------------
const TOOLS = [
  // --- MONGODB TOOLS ---
  {
    name: 'mongodb_ping',
    description: 'Verifies MongoDB Atlas connectivity, checks latency, and ensures the target database (studentDB) is accessible.',
    inputSchema: {
      type: 'object',
      properties: {
        customUri: {
          type: 'string',
          description: 'Optional custom MongoDB URI. Defaults to MONGODB_URI in backend/.env'
        }
      }
    }
  },
  {
    name: 'mongodb_list_collections',
    description: 'Lists all collections in the MongoDB Atlas database and shows document counts for students and departments.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },

  // --- VERCEL TOOLS ---
  {
    name: 'vercel_deploy',
    description: 'Builds the Vite frontend and deploys it to Vercel using the Vercel API or Vercel CLI.',
    inputSchema: {
      type: 'object',
      properties: {
        vercelToken: {
          type: 'string',
          description: 'Vercel API Token (from https://vercel.com/account/tokens). If omitted, reads from process.env.VERCEL_TOKEN'
        },
        prod: {
          type: 'boolean',
          description: 'Deploy to production (default: true)',
          default: true
        }
      }
    }
  },
  {
    name: 'vercel_check_status',
    description: 'Checks the latest deployment status and live URL of the project on Vercel.',
    inputSchema: {
      type: 'object',
      properties: {
        vercelToken: {
          type: 'string',
          description: 'Vercel API Token'
        },
        projectId: {
          type: 'string',
          description: 'Optional Vercel Project ID or Name (defaults to campusdesk)'
        }
      }
    }
  },

  // --- RENDER TOOLS ---
  {
    name: 'render_deploy',
    description: 'Triggers a deployment of the backend API on Render via Render Deploy Hook or Render API Key.',
    inputSchema: {
      type: 'object',
      properties: {
        deployHookUrl: {
          type: 'string',
          description: 'Render Deploy Hook URL (e.g. https://api.render.com/deploy/srv-xxxx?key=yyyy)'
        },
        renderApiKey: {
          type: 'string',
          description: 'Render API Key (from https://dashboard.render.com/u/settings -> API Keys)'
        },
        serviceId: {
          type: 'string',
          description: 'Render Service ID (required if using renderApiKey instead of deployHookUrl)'
        }
      }
    }
  },
  {
    name: 'render_check_status',
    description: 'Checks the health and status of the deployed Render backend service.',
    inputSchema: {
      type: 'object',
      properties: {
        serviceUrl: {
          type: 'string',
          description: 'Live Render service URL to query (e.g. https://campusdesk-api.onrender.com)'
        }
      },
      required: ['serviceUrl']
    }
  },
  {
    name: 'render_spawn_replica',
    description: 'Spawns an exact copy/replica container service on Render with the same configuration, repo, and environment variables.',
    inputSchema: {
      type: 'object',
      properties: {
        sourceServiceId: {
          type: 'string',
          description: 'Optional source Render service ID to duplicate. Defaults to the first active web service.'
        },
        replicaName: {
          type: 'string',
          description: 'Optional custom name for the replica service'
        }
      }
    }
  },

  // --- UNIFIED MULTI-PLATFORM TOOL ---
  {
    name: 'deploy_all_platforms',
    description: 'UNIFIED ORCHESTRATION: Verifies MongoDB, synchronizes GitHub, triggers Vercel frontend deployment, and triggers Render backend deployment in ONE prompt.',
    inputSchema: {
      type: 'object',
      properties: {
        commitMessage: {
          type: 'string',
          description: 'Git commit message for changes',
          default: 'feat: multi-platform deployment via Claude MCP'
        },
        vercelToken: {
          type: 'string',
          description: 'Optional Vercel Token (if not stored in env)'
        },
        renderDeployHookUrl: {
          type: 'string',
          description: 'Optional Render Deploy Hook URL (if not stored in env)'
        }
      }
    }
  }
];

// ---------------------------------------------------------------------------
// Tool Handlers
// ---------------------------------------------------------------------------

// 1. MongoDB Ping
async function handleMongoPing(args) {
  const uri = args?.customUri || getEnv('MONGODB_URI');
  if (!uri) {
    return { error: 'No MONGODB_URI found. Please provide customUri or configure backend/.env.' };
  }
  return await testMongoConnection(uri);
}

// 2. MongoDB List Collections
async function handleMongoListCollections() {
  const rawUri = getEnv('MONGODB_URI');
  if (!rawUri) {
    return { error: 'No MONGODB_URI configured.' };
  }
  const { uri } = repairMongoUri(rawUri, 'studentDB');
  
  const conn = await mongoose.createConnection(uri, {
    dbName: 'studentDB',
    serverSelectionTimeoutMS: 6000,
    family: 4
  }).asPromise();

  try {
    const collections = await conn.db.listCollections().toArray();
    const stats = {};
    for (const col of collections) {
      stats[col.name] = await conn.db.collection(col.name).countDocuments();
    }
    return {
      database: 'studentDB',
      collections: stats,
      count: collections.length
    };
  } finally {
    await conn.close();
  }
}

// 3. Vercel Deploy
async function handleVercelDeploy(args) {
  const token = args?.vercelToken || getEnv('VERCEL_TOKEN');

  logDebug('Building frontend for Vercel...');
  try {
    await execAsync('npm run build --workspace=frontend', { cwd: rootDir });
  } catch (err) {
    return { error: `Frontend build failed: ${err.message}` };
  }

  if (!token) {
    return {
      status: 'ready_for_token',
      built: true,
      message: 'Frontend is built (frontend/dist) and ready. To deploy automatically via MCP, please provide your Vercel Token (from https://vercel.com/account/tokens). Alternatively, pushing to GitHub will auto-trigger Vercel if your repo is linked!'
    };
  }

  // Deploy using Vercel CLI with token
  try {
    logDebug('Invoking Vercel CLI with token...');
    const prodFlag = args.prod !== false ? '--prod' : '';
    const { stdout } = await execAsync(`npx vercel ${prodFlag} --token "${token}" --yes`, {
      cwd: rootDir,
      env: { ...process.env, VERCEL_TOKEN: token }
    });
    return {
      status: 'deployed',
      output: stdout.trim(),
      message: 'Successfully deployed to Vercel!'
    };
  } catch (err) {
    return {
      status: 'error',
      message: err.message,
      suggestion: 'Check if your VERCEL_TOKEN has full deployment permissions.'
    };
  }
}

// 4. Vercel Check Status
async function handleVercelCheckStatus(args) {
  const token = args?.vercelToken || getEnv('VERCEL_TOKEN');
  if (!token) {
    return { error: 'VERCEL_TOKEN is required to query Vercel API.' };
  }

  try {
    const res = await fetch('https://api.vercel.com/v6/deployments?limit=3', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      return { error: `Vercel API error (${res.status}): ${await res.text()}` };
    }
    const data = await res.json();
    return {
      deployments: (data.deployments || []).map((d) => ({
        url: `https://${d.url}`,
        state: d.state,
        creator: d.creator?.username,
        created: new Date(d.created).toISOString()
      }))
    };
  } catch (err) {
    return { error: err.message };
  }
}

// 5. Render Deploy
async function handleRenderDeploy(args) {
  const hookUrl = args?.deployHookUrl || getEnv('RENDER_DEPLOY_HOOK_URL');
  const apiKey = args?.renderApiKey || getEnv('RENDER_API_KEY');
  const serviceId = args?.serviceId || getEnv('RENDER_SERVICE_ID');

  // Method A: Trigger via Deploy Hook
  if (hookUrl) {
    try {
      logDebug(`Triggering Render Deploy Hook: ${hookUrl}`);
      const res = await fetch(hookUrl, { method: 'POST' });
      const text = await res.text();
      return {
        status: res.ok ? 'deploy_triggered' : 'failed',
        statusCode: res.status,
        response: text,
        message: res.ok ? 'Render deployment triggered successfully via deploy hook!' : 'Render deploy hook returned error.'
      };
    } catch (err) {
      return { error: `Failed to invoke Render deploy hook: ${err.message}` };
    }
  }

  // Method B: Trigger via Render API Key
  if (apiKey && serviceId) {
    try {
      logDebug(`Triggering Render deploy via API for service: ${serviceId}`);
      const res = await fetch(`https://api.render.com/v1/services/${serviceId}/deploys`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clearCache: 'do_not_clear' })
      });
      const data = await res.json();
      return {
        status: res.ok ? 'deploy_triggered' : 'failed',
        data,
        message: res.ok ? 'Render deployment triggered successfully via API!' : data.message
      };
    } catch (err) {
      return { error: `Failed to trigger Render deploy via API: ${err.message}` };
    }
  }

  return {
    status: 'ready_for_credentials',
    message: 'To trigger Render deployments via MCP, provide either: (1) Render Deploy Hook URL (from Render Dashboard -> Service -> Settings -> Deploy Hook), OR (2) Render API Key + Service ID. Note: Pushing to GitHub also auto-triggers Render when connected!'
  };
}

// 6. Render Check Status
async function handleRenderCheckStatus(args) {
  const url = args.serviceUrl.replace(/\/+$/, '');
  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(6000) });
    const json = await res.json().catch(() => ({}));
    return {
      url,
      online: res.ok,
      statusCode: res.status,
      health: json
    };
  } catch (err) {
    return {
      url,
      online: false,
      message: err.message
    };
  }
}

// 7. Render Spawn Replica Container
async function handleRenderSpawnReplica(args) {
  const apiKey = getEnv('RENDER_API_KEY');
  if (!apiKey) return { error: 'RENDER_API_KEY is not set.' };

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };

  const servicesRes = await fetch('https://api.render.com/v1/services?limit=20', { headers });
  if (!servicesRes.ok) return { error: `Failed to query Render (${servicesRes.status})` };
  const services = await servicesRes.json();
  if (!services.length) return { error: 'No services found on Render to copy.' };

  let target = services[0].service;
  if (args?.sourceServiceId) {
    const found = services.find((s) => s.service.id === args.sourceServiceId);
    if (found) target = found.service;
  }

  const copyName = args?.replicaName || `${target.name}-replica-${Date.now().toString().slice(-4)}`;

  // Fetch env vars
  let envVars = [];
  try {
    const envRes = await fetch(`https://api.render.com/v1/services/${target.id}/env-vars?limit=50`, { headers });
    if (envRes.ok) {
      const envData = await envRes.json();
      envVars = (envData || []).map((e) => ({ key: e.envVar?.key, value: e.envVar?.value })).filter((e) => e.key && e.value);
    }
  } catch {}

  const serviceDetails = target.serviceDetails || {};
  const envSpecificDetails = serviceDetails.envSpecificDetails || {};
  const buildCommand = envSpecificDetails.buildCommand || serviceDetails.buildCommand || 'npm install';
  const startCommand = envSpecificDetails.startCommand || serviceDetails.startCommand || 'npm start';

  const payload = {
    type: target.type || 'web_service',
    name: copyName,
    ownerId: target.ownerId,
    repo: target.repo,
    branch: target.branch || 'main',
    autoDeploy: target.autoDeploy !== 'no' ? 'yes' : 'no',
    serviceDetails: {
      env: serviceDetails.env || 'node',
      plan: serviceDetails.plan || 'free',
      region: serviceDetails.region || 'oregon',
      rootDir: serviceDetails.rootDir || 'backend',
      healthCheckPath: serviceDetails.healthCheckPath || '/health',
      envSpecificDetails: {
        buildCommand,
        startCommand
      },
      envVars: envVars
    }
  };

  const createRes = await fetch('https://api.render.com/v1/services', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  const data = await createRes.json();
  if (!createRes.ok) return { error: data.message || 'Failed to spawn replica on Render', data };

  return {
    status: 'spawned',
    serviceName: copyName,
    serviceId: data.id,
    url: data.serviceDetails?.url || `https://${copyName}.onrender.com`,
    replicatedFrom: target.name
  };
}

// 7. Unified Multi-Platform Deploy
async function handleDeployAll(args) {
  const commitMsg = args.commitMessage || 'feat: multi-platform deployment via Claude MCP';
  const report = {
    timestamp: new Date().toISOString(),
    platforms: {}
  };

  // 1. Check MongoDB
  try {
    const mongoRes = await handleMongoPing({});
    report.platforms.mongodb = {
      status: mongoRes.success ? 'online' : 'error',
      database: 'studentDB',
      details: mongoRes.message
    };
  } catch (err) {
    report.platforms.mongodb = { status: 'error', error: err.message };
  }

  // 2. Git & GitHub Sync
  try {
    await execAsync('git add .', { cwd: rootDir });
    try {
      await execAsync(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, { cwd: rootDir });
    } catch {
      // Clean commit
    }
    const { stdout: remotes } = await execAsync('git remote -v', { cwd: rootDir }).catch(() => ({ stdout: '' }));
    if (remotes.includes('origin')) {
      await execAsync('git push -u origin main', { cwd: rootDir });
      report.platforms.github = { status: 'synced', message: `Pushed "${commitMsg}" to origin/main` };
    } else {
      report.platforms.github = { status: 'committed_locally', message: 'Ready to push once remote origin is set' };
    }
  } catch (err) {
    report.platforms.github = { status: 'error', error: err.message };
  }

  // 3. Vercel Deploy
  report.platforms.vercel = await handleVercelDeploy({ vercelToken: args.vercelToken });

  // 4. Render Deploy
  report.platforms.render = await handleRenderDeploy({ deployHookUrl: args.renderDeployHookUrl });

  return report;
}

// ---------------------------------------------------------------------------
// JSON-RPC Transport
// ---------------------------------------------------------------------------
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', async (line) => {
  if (!line.trim()) return;

  let request;
  try {
    request = JSON.parse(line);
  } catch (err) {
    logDebug('Invalid JSON line:', line);
    return;
  }

  const { id, method, params } = request;

  // Initialize
  if (method === 'initialize') {
    const response = {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: {
          name: 'campusdesk-unified-mcp',
          version: '2.0.0'
        }
      }
    };
    process.stdout.write(JSON.stringify(response) + '\n');
    return;
  }

  // List tools
  if (method === 'tools/list') {
    const response = {
      jsonrpc: '2.0',
      id,
      result: { tools: TOOLS }
    };
    process.stdout.write(JSON.stringify(response) + '\n');
    return;
  }

  // Call tool
  if (method === 'tools/call') {
    const { name, arguments: args } = params || {};
    logDebug(`Invoking tool: ${name}`);

    try {
      let result;
      switch (name) {
        case 'mongodb_ping':
          result = await handleMongoPing(args);
          break;
        case 'mongodb_list_collections':
          result = await handleMongoListCollections();
          break;
        case 'vercel_deploy':
          result = await handleVercelDeploy(args);
          break;
        case 'vercel_check_status':
          result = await handleVercelCheckStatus(args);
          break;
        case 'render_deploy':
          result = await handleRenderDeploy(args);
          break;
        case 'render_check_status':
          result = await handleRenderCheckStatus(args);
          break;
        case 'render_spawn_replica':
          result = await handleRenderSpawnReplica(args);
          break;
        case 'deploy_all_platforms':
          result = await handleDeployAll(args);
          break;
        default:
          throw new Error(`Tool not found: ${name}`);
      }

      const response = {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        }
      };
      process.stdout.write(JSON.stringify(response) + '\n');
    } catch (err) {
      const errorResponse = {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: err.message
        }
      };
      process.stdout.write(JSON.stringify(errorResponse) + '\n');
    }
  }
});

logDebug('CampusDesk Unified MCP Server (Vercel, Render, MongoDB) listening on stdio.');
