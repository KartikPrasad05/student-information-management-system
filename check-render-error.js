#!/usr/bin/env node

/**
 * Render Diagnostic Tool
 * Inspects why the deploy failed on Render and diagnoses the exact fix.
 */

const RENDER_API_KEY = 'rnd_99La8fihvmNPMsrIhDAziF4jMmYk';

const cyan = (t) => `\x1b[36m${t}\x1b[0m`;
const green = (t) => `\x1b[32m${t}\x1b[0m`;
const yellow = (t) => `\x1b[33m${t}\x1b[0m`;
const red = (t) => `\x1b[31m${t}\x1b[0m`;
const bold = (t) => `\x1b[1m${t}\x1b[0m`;

async function main() {
  const headers = {
    Authorization: `Bearer ${RENDER_API_KEY}`,
    Accept: 'application/json'
  };

  console.log(cyan('\n[*] Querying Render services...'));
  const res = await fetch('https://api.render.com/v1/services?limit=10', { headers });
  if (!res.ok) {
    console.error(red(`API Error: ${await res.text()}`));
    return;
  }

  const services = await res.json();
  for (const s of services) {
    const item = s.service;
    console.log(bold(`\nService: ${item.name} (${item.id})`));
    console.log(`  Repo: ${item.repo} | Branch: ${item.branch}`);
    console.log(`  Root Directory: "${item.serviceDetails?.rootDir || ''}"`);
    console.log(`  Build Command: "${item.serviceDetails?.envSpecificDetails?.buildCommand || item.serviceDetails?.buildCommand || ''}"`);
    console.log(`  Start Command: "${item.serviceDetails?.envSpecificDetails?.startCommand || item.serviceDetails?.startCommand || ''}"`);

    // Check env vars
    const envRes = await fetch(`https://api.render.com/v1/services/${item.id}/env-vars`, { headers });
    if (envRes.ok) {
      const envData = await envRes.json();
      console.log(`  Env Vars Count: ${envData.length}`);
      envData.forEach((e) => {
        const val = e.envVar?.value ? `${e.envVar.value.slice(0, 15)}...` : '(EMPTY/NULL)';
        console.log(`    - ${e.envVar?.key}: ${val}`);
      });
    }

    // Check latest deploys
    const deploysRes = await fetch(`https://api.render.com/v1/services/${item.id}/deploys?limit=2`, { headers });
    if (deploysRes.ok) {
      const deploys = await deploysRes.json();
      deploys.forEach((d) => {
        const dep = d.deploy;
        console.log(`  Latest Deploy: ${dep.id} | Status: ${bold(dep.status)} | Finished: ${dep.finishedAt || 'In progress'}`);
      });
    }
  }
}

main().catch(console.error);
