import 'dotenv/config';

const RENDER_API_KEY = process.env.RENDER_API_KEY || '';

async function check() {
  const headers = {
    Authorization: `Bearer ${RENDER_API_KEY}`,
    Accept: 'application/json'
  };

  const res = await fetch('https://api.render.com/v1/services?limit=20', { headers });
  if (!res.ok) {
    console.error('Render API error:', res.status, await res.text());
    return;
  }
  const services = await res.json();
  console.log('=== RENDER SERVICES STATUS ===');
  for (const s of services) {
    const item = s.service;
    console.log(`\nName: ${item.name}`);
    console.log(`ID: ${item.id}`);
    console.log(`Repo: ${item.repo}`);
    console.log(`Branch: ${item.branch}`);
    console.log(`RootDir: ${item.rootDir}`);
    console.log(`URL: ${item.serviceDetails?.url}`);
    
    // Check latest deploy
    const depRes = await fetch(`https://api.render.com/v1/services/${item.id}/deploys?limit=1`, { headers });
    if (depRes.ok) {
      const deploys = await depRes.json();
      if (deploys.length > 0) {
        console.log(`Latest Deploy: ${deploys[0].deploy.status} (created: ${deploys[0].deploy.createdAt})`);
      }
    }
  }
}

check().catch(console.error);
