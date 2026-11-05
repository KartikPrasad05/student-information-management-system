#!/usr/bin/env node

import 'dotenv/config';

/**
 * Patch Render Replica Service
 * Sets rootDir to "backend/" and triggers clean deployment.
 */

const RENDER_API_KEY = process.env.RENDER_API_KEY || '';
const replId = 'srv-dbm4ff61egvs73bak970';

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

  console.log(cyan('\n[*] Updating replica service settings on Render...'));
  
  // Patch rootDir to "backend/" and match original service settings
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

  const patchRes = await fetch(`https://api.render.com/v1/services/${replId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(patchPayload)
  });

  if (!patchRes.ok) {
    throw new Error(`Failed to update service (${patchRes.status}): ${await patchRes.text()}`);
  }

  const updatedService = await patchRes.json();
  console.log(green(`[✓] Successfully updated rootDir to "${updatedService.rootDir || 'backend/'}"!`));

  // Trigger fresh deploy with clean cache
  console.log(cyan('[*] Triggering fresh deployment with clearCache...'));
  const deployRes = await fetch(`https://api.render.com/v1/services/${replId}/deploys`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ clearCache: 'clear' })
  });

  if (deployRes.ok) {
    const deployData = await deployRes.json();
    console.log(green('\n============================================================='));
    console.log(bold(green('  [✓] REPLICA CONTAINER DEPLOYMENT STARTED!')));
    console.log(green('============================================================='));
    console.log(`  Service:     student-information-management-system-replica-1349`);
    console.log(`  Deploy ID:   ${deployData.id}`);
    console.log(`  Root Dir:    backend/`);
    console.log(`  Live URL:    ${bold('https://student-information-management-system-3gs8.onrender.com')}`);
    console.log(cyan('=============================================================\n'));
  } else {
    console.log(yellow(`[!] Deploy trigger notice: ${await deployRes.text()}`));
  }
}

main().catch(console.error);
