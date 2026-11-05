#!/usr/bin/env node

/**
 * Render Container / Service Duplicator
 * Clones and spawns a replica/copy of an existing Render web service
 * using the Render REST API and your API Key.
 */

import 'dotenv/config';
import { testMongoConnection } from './backend/utils/mongoUriDoctor.js';

const RENDER_API_KEY = process.env.RENDER_API_KEY || '';

const cyan = (t) => `\x1b[36m${t}\x1b[0m`;
const green = (t) => `\x1b[32m${t}\x1b[0m`;
const yellow = (t) => `\x1b[33m${t}\x1b[0m`;
const red = (t) => `\x1b[31m${t}\x1b[0m`;
const bold = (t) => `\x1b[1m${t}\x1b[0m`;

console.log(cyan('\n============================================================='));
console.log(bold(cyan('  Render · Service / Container Replication Manager')));
console.log(cyan('=============================================================\n'));

async function main() {
  console.log(cyan('[*] Fetching existing Render services...'));
  
  const headers = {
    Authorization: `Bearer ${RENDER_API_KEY}`,
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };

  const servicesRes = await fetch('https://api.render.com/v1/services?limit=20', { headers });
  if (!servicesRes.ok) {
    throw new Error(`Failed to query Render API (${servicesRes.status}): ${await servicesRes.text()}`);
  }

  const services = await servicesRes.json();
  console.log(green(`[✓] Found ${services.length} existing service(s) on your Render account.`));

  if (services.length === 0) {
    console.log(yellow('\n[!] You do not have any services deployed on Render yet.'));
    console.log(cyan('[➜] To create your first container/service:'));
    console.log('    1. Go to https://dashboard.render.com/select-repo?type=web');
    console.log('    2. Connect your GitHub repository');
    console.log('    3. Render will deploy your service using render.yaml');
    console.log('    4. Once created, run this script again to spawn copies/replicas anytime!\n');
    return;
  }

  // Display available services
  console.log(bold('\nAvailable services to duplicate:'));
  services.forEach((s, idx) => {
    console.log(`  [${idx + 1}] ${bold(s.service.name)} (${s.service.id}) - Type: ${s.service.type} - URL: ${s.service.serviceDetails?.url || 'N/A'}`);
  });

  // Pick the target primary service
  const primaryService = services.find((s) => !s.service.name.includes('replica')) || services[0];
  const target = primaryService.service;
  const originalId = target.id;
  const originalName = target.name.replace(/-replica-.*$/, '');
  const replicaCount = services.filter((s) => s.service.name.includes('replica')).length + 1;
  const copyName = `${originalName}-replica-${replicaCount}-${Date.now().toString().slice(-4)}`;

  console.log(cyan(`\n[*] Selected source service: "${bold(target.name)}" (${originalId})`));
  console.log(cyan(`[*] Fetching environment variables from "${target.name}"...`));

  // Guaranteed production environment variables
  const defaultEnvs = [
    {
      key: 'MONGODB_URI',
      value: 'mongodb+srv://ronnykartikkpr10_db_user:Kartikprasad2003@studentcluster.6habnxr.mongodb.net/studentDB?retryWrites=true&w=majority'
    },
    {
      key: 'FRONTEND_URL',
      value: 'https://campusdesk-i31jnic3d-kartikprasad05.vercel.app,https://*.vercel.app,http://localhost:5173'
    },
    {
      key: 'NODE_ENV',
      value: 'production'
    }
  ];

  const envMap = new Map();
  defaultEnvs.forEach((e) => envMap.set(e.key, e.value));

  try {
    const envRes = await fetch(`https://api.render.com/v1/services/${originalId}/env-vars?limit=50`, { headers });
    if (envRes.ok) {
      const envData = await envRes.json();
      (envData || []).forEach((e) => {
        if (e.envVar?.key && e.envVar?.value) {
          envMap.set(e.envVar.key, e.envVar.value);
        }
      });
      console.log(green(`[✓] Prepared ${envMap.size} environment variable(s) to replicate.`));
    }
  } catch (err) {
    console.log(yellow(`[!] Could not fetch env vars: ${err.message}`));
  }

  const envVars = Array.from(envMap.entries()).map(([key, value]) => ({ key, value }));

  // Construct payload for duplicate container service
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
    rootDir: target.rootDir || 'backend/',
    serviceDetails: {
      env: serviceDetails.env || 'node',
      plan: serviceDetails.plan || 'free',
      region: serviceDetails.region || 'singapore',
      rootDir: target.rootDir || 'backend/',
      healthCheckPath: '',
      envSpecificDetails: {
        buildCommand,
        startCommand
      },
      envVars: envVars
    }
  };

  console.log(cyan(`\n[*] Spawning new container service: "${bold(copyName)}"...`));

  const createRes = await fetch('https://api.render.com/v1/services', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  const createData = await createRes.json();

  if (!createRes.ok) {
    console.error(red(`\n[✗] Failed to spawn container (${createRes.status}): ${JSON.stringify(createData, null, 2)}`));
    return;
  }

  const newService = createData;
  const newServiceId = newService.id;
  const newServiceUrl = newService.serviceDetails?.url || `https://${copyName}.onrender.com`;

  // Explicitly sync rootDir and env-vars to prevent Render initial-build race condition
  await fetch(`https://api.render.com/v1/services/${newServiceId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      rootDir: 'backend/',
      serviceDetails: { rootDir: 'backend/', healthCheckPath: '' }
    })
  });

  await fetch(`https://api.render.com/v1/services/${newServiceId}/env-vars`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(envVars)
  });

  // Trigger fresh deployment with clean cache
  await fetch(`https://api.render.com/v1/services/${newServiceId}/deploys`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ clearCache: 'clear' })
  });

  console.log(green('\n============================================================='));
  console.log(bold(green('  [✓] NEW CONTAINER SERVICE SPAWNED & DEPLOYING ON RENDER!')));
  console.log(green('============================================================='));
  console.log(`  ${bold('Service Name:')}   ${copyName}`);
  console.log(`  ${bold('Service ID:')}     ${newServiceId}`);
  console.log(`  ${bold('Live URL:')}       ${bold(newServiceUrl)}`);
  console.log(`  ${bold('Source Service:')} ${originalName}`);
  console.log(`  ${bold('Replicated Envs:')} ${envVars.length} env vars copied`);
  console.log(cyan('=============================================================\n'));
}

main().catch((err) => {
  console.error(red(`\nReplication error: ${err.message}`));
  process.exit(1);
});
