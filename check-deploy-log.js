#!/usr/bin/env node

const RENDER_API_KEY = 'rnd_99La8fihvmNPMsrIhDAziF4jMmYk';

async function main() {
  const headers = {
    Authorization: `Bearer ${RENDER_API_KEY}`,
    Accept: 'application/json'
  };

  const res = await fetch('https://api.render.com/v1/services?limit=10', { headers });
  const services = await res.json();
  const replica = services.find((s) => s.service.name.includes('replica'));

  if (!replica) {
    console.log('No replica found');
    return;
  }

  const serviceId = replica.service.id;
  console.log(`Service: ${replica.service.name} (${serviceId})`);
  console.log(`Repo: ${replica.service.repo} | Branch: ${replica.service.branch}`);
  console.log(`RootDir: "${replica.service.serviceDetails?.rootDir || ''}"`);
  console.log(`BuildCmd: "${replica.service.serviceDetails?.envSpecificDetails?.buildCommand || ''}"`);
  console.log(`StartCmd: "${replica.service.serviceDetails?.envSpecificDetails?.startCommand || ''}"`);

  // Fetch deploys
  const deploysRes = await fetch(`https://api.render.com/v1/services/${serviceId}/deploys?limit=5`, { headers });
  const deploys = await deploysRes.json();
  console.log('\nRecent Deploys:');
  for (const d of deploys) {
    const dep = d.deploy;
    console.log(`  - Deploy ${dep.id}: status=${dep.status}, created=${dep.createdAt}, finished=${dep.finishedAt}`);
  }

  // Also check original service to compare:
  const original = services.find((s) => !s.service.name.includes('replica'));
  if (original) {
    console.log(`\nOriginal Service: ${original.service.name} (${original.service.id})`);
    console.log(`  Repo: ${original.service.repo} | Branch: ${original.service.branch}`);
    console.log(`  RootDir: "${original.service.serviceDetails?.rootDir || ''}"`);
    console.log(`  BuildCmd: "${original.service.serviceDetails?.envSpecificDetails?.buildCommand || ''}"`);
    console.log(`  StartCmd: "${original.service.serviceDetails?.envSpecificDetails?.startCommand || ''}"`);
    const origDeploysRes = await fetch(`https://api.render.com/v1/services/${original.service.id}/deploys?limit=2`, { headers });
    const origDeploys = await origDeploysRes.json();
    console.log('  Original Deploys:');
    for (const d of origDeploys) {
      console.log(`    - Deploy ${d.deploy.id}: status=${d.deploy.status}`);
    }
  }
}

main().catch(console.error);
