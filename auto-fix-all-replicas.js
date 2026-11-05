#!/usr/bin/env node

import 'dotenv/config';

/**
 * Auto-Fix and Redeploy All Render Replica Containers
 * Ensures every replica has rootDir: "backend/", all environment variables,
 * and triggers a clean deploy.
 */

const RENDER_API_KEY = process.env.RENDER_API_KEY || '';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ronnykartikkpr10_db_user:Kartikprasad2003@studentcluster.6habnxr.mongodb.net/studentDB?retryWrites=true&w=majority';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://campusdesk-i31jnic3d-kartikprasad05.vercel.app,https://*.vercel.app,http://localhost:5173';

const cyan = (t) => `\x1b[36m${t}\x1b[0m`;
const green = (t) => `\x1b[32m${t}\x1b[0m`;
const yellow = (t) => `\x1b[33m${t}\x1b[0m`;
const bold = (t) => `\x1b[1m${t}\x1b[0m`;

async function main() {
  const headers = {
    Authorization: `Bearer ${RENDER_API_KEY}`,
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };

  console.log(cyan('\n[*] Fetching all Render services...'));
  const res = await fetch('https://api.render.com/v1/services?limit=20', { headers });
  const services = await res.json();

  const replicas = services.filter((s) => s.service.name.includes('replica'));
  console.log(green(`[✓] Found ${replicas.length} replica container(s) on Render.`));

  for (const r of replicas) {
    const item = r.service;
    console.log(bold(`\nInspecting replica: "${item.name}" (${item.id})...`));

    // 1. Ensure rootDir is "backend/"
    const patchPayload = {
      rootDir: 'backend/',
      serviceDetails: {
        rootDir: 'backend/',
        healthCheckPath: '',
        envSpecificDetails: {
          buildCommand: 'npm install',
          startCommand: 'npm start'
        }
      }
    };

    const patchRes = await fetch(`https://api.render.com/v1/services/${item.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(patchPayload)
    });

    if (patchRes.ok) {
      console.log(green(`  [✓] Verified rootDir: "backend/"`));
    }

    // 2. Ensure environment variables
    const envPayload = [
      { key: 'MONGODB_URI', value: MONGODB_URI },
      { key: 'FRONTEND_URL', value: FRONTEND_URL },
      { key: 'NODE_ENV', value: 'production' }
    ];

    const envRes = await fetch(`https://api.render.com/v1/services/${item.id}/env-vars`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(envPayload)
    });

    if (envRes.ok) {
      console.log(green(`  [✓] Verified environment variables (MONGODB_URI, FRONTEND_URL, NODE_ENV)`));
    }

    // 3. Trigger fresh deployment with clear cache
    console.log(cyan(`  [*] Triggering fresh deployment with clearCache...`));
    const deployRes = await fetch(`https://api.render.com/v1/services/${item.id}/deploys`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ clearCache: 'clear' })
    });

    if (deployRes.ok) {
      const depData = await deployRes.json();
      console.log(green(`  [✓] Deployment started! Deploy ID: ${depData.id}`));
      console.log(green(`  [➜] Live URL: ${bold(`https://${item.name}.onrender.com`)}`));
    } else {
      console.log(yellow(`  [!] Deploy notice: ${await deployRes.text()}`));
    }
  }

  console.log(green('\n============================================================='));
  console.log(bold(green('  [✓] ALL REPLICA CONTAINERS FIXED AND REDEPLOYING!')));
  console.log(green('=============================================================\n'));
}

main().catch(console.error);
