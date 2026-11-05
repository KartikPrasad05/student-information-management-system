#!/usr/bin/env node

import 'dotenv/config';

/**
 * Fix and Redeploy Render Replica Service
 * Sets missing MONGODB_URI and FRONTEND_URL environment variables on the replica
 * and triggers a fresh deployment.
 */

const RENDER_API_KEY = process.env.RENDER_API_KEY || '';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ronnykartikkpr10_db_user:Kartikprasad2003@studentcluster.6habnxr.mongodb.net/studentDB?retryWrites=true&w=majority';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://campusdesk-i31jnic3d-kartikprasad05.vercel.app';

const cyan = (t) => `\x1b[36m${t}\x1b[0m`;
const green = (t) => `\x1b[32m${t}\x1b[0m`;
const yellow = (t) => `\x1b[33m${t}\x1b[0m`;
const red = (t) => `\x1b[31m${t}\x1b[0m`;
const bold = (t) => `\x1b[1m${t}\x1b[0m`;

async function main() {
  const headers = {
    Authorization: `Bearer ${RENDER_API_KEY}`,
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };

  console.log(cyan('\n[*] Finding replica service on Render...'));
  const res = await fetch('https://api.render.com/v1/services?limit=10', { headers });
  if (!res.ok) {
    throw new Error(`Failed to query Render services: ${await res.text()}`);
  }

  const services = await res.json();
  const replica = services.find((s) => s.service.name.includes('replica'));

  if (!replica) {
    console.log(yellow('No replica service found.'));
    return;
  }

  const serviceId = replica.service.id;
  const serviceName = replica.service.name;
  console.log(green(`[✓] Found replica: "${serviceName}" (${serviceId})`));

  // Inspect environment variables
  console.log(cyan('[*] Injecting verified production environment variables...'));
  const envPayload = [
    { key: 'MONGODB_URI', value: MONGODB_URI },
    { key: 'FRONTEND_URL', value: FRONTEND_URL },
    { key: 'NODE_ENV', value: 'production' }
  ];

  const updateEnvRes = await fetch(`https://api.render.com/v1/services/${serviceId}/env-vars`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(envPayload)
  });

  if (updateEnvRes.ok) {
    console.log(green('  [✓] Successfully injected MONGODB_URI, FRONTEND_URL, and NODE_ENV!'));
  } else {
    console.log(yellow(`  [!] Notice updating env vars (${updateEnvRes.status}): ${await updateEnvRes.text()}`));
  }

  // Trigger fresh deployment
  console.log(cyan('[*] Triggering fresh deployment with clear cache...'));
  const deployRes = await fetch(`https://api.render.com/v1/services/${serviceId}/deploys`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ clearCache: 'clear' })
  });

  if (deployRes.ok) {
    const deployData = await deployRes.json();
    console.log(green('\n============================================================='));
    console.log(bold(green('  [✓] REDEPLOYMENT TRIGGERED SUCCESSFULLY!')));
    console.log(green('============================================================='));
    console.log(`  Service:     ${serviceName}`);
    console.log(`  Deploy ID:   ${deployData.id}`);
    console.log(`  Live URL:    ${bold(`https://${serviceName}.onrender.com`)}`);
    console.log(cyan('=============================================================\n'));
  } else {
    console.log(red(`  [✗] Failed to trigger deploy: ${await deployRes.text()}`));
  }
}

main().catch(console.error);
