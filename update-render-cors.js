#!/usr/bin/env node

/**
 * Configure CORS FRONTEND_URL on Render services
 * Allows the deployed Vercel frontend to communicate with both the
 * primary Render backend and the replica Render backend.
 */

const RENDER_API_KEY = 'rnd_99La8fihvmNPMsrIhDAziF4jMmYk';
const FRONTEND_URL = 'https://campusdesk-mzrar8brh-kartikprasad05.vercel.app,https://*.vercel.app,http://localhost:5173';

const cyan = (t) => `\x1b[36m${t}\x1b[0m`;
const green = (t) => `\x1b[32m${t}\x1b[0m`;
const bold = (t) => `\x1b[1m${t}\x1b[0m`;

async function main() {
  const headers = {
    Authorization: `Bearer ${RENDER_API_KEY}`,
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };

  const res = await fetch('https://api.render.com/v1/services?limit=10', { headers });
  const services = await res.json();

  for (const s of services) {
    const item = s.service;
    console.log(cyan(`\n[*] Updating environment variables for "${bold(item.name)}" (${item.id})...`));

    // Get current env vars
    const envRes = await fetch(`https://api.render.com/v1/services/${item.id}/env-vars`, { headers });
    const currentEnvs = await envRes.json();
    const envMap = new Map();

    for (const e of currentEnvs) {
      if (e.envVar?.key && e.envVar?.value) {
        envMap.set(e.envVar.key, e.envVar.value);
      }
    }

    // Set/overwrite FRONTEND_URL and ensure NODE_ENV
    envMap.set('FRONTEND_URL', FRONTEND_URL);
    envMap.set('NODE_ENV', 'production');

    const updatePayload = Array.from(envMap.entries()).map(([key, value]) => ({ key, value }));

    const putRes = await fetch(`https://api.render.com/v1/services/${item.id}/env-vars`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updatePayload)
    });

    if (putRes.ok) {
      console.log(green(`  [✓] Updated FRONTEND_URL on ${item.name}!`));
    } else {
      console.log(`  [!] Response (${putRes.status}): ${await putRes.text()}`);
    }
  }

  console.log(green('\n[✓] Render CORS configuration complete across all backend services!\n'));
}

main().catch(console.error);
