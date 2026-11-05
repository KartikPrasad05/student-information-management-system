#!/usr/bin/env node

const RENDER_API_KEY = 'rnd_99La8fihvmNPMsrIhDAziF4jMmYk';

async function main() {
  const headers = {
    Authorization: `Bearer ${RENDER_API_KEY}`,
    Accept: 'application/json'
  };

  const origId = 'srv-dbh45hafngtc73fbkf20';
  const replId = 'srv-dbm4ff61egvs73bak970';

  console.log('--- ORIGINAL SERVICE DETAILS ---');
  const oRes = await fetch(`https://api.render.com/v1/services/${origId}`, { headers });
  const oData = await oRes.json();
  console.log(JSON.stringify(oData, null, 2));

  console.log('\n--- ORIGINAL ENV VARS ---');
  const oEnvRes = await fetch(`https://api.render.com/v1/services/${origId}/env-vars`, { headers });
  console.log(JSON.stringify(await oEnvRes.json(), null, 2));

  console.log('\n--- REPLICA SERVICE DETAILS ---');
  const rRes = await fetch(`https://api.render.com/v1/services/${replId}`, { headers });
  const rData = await rRes.json();
  console.log(JSON.stringify(rData, null, 2));

  console.log('\n--- REPLICA ENV VARS ---');
  const rEnvRes = await fetch(`https://api.render.com/v1/services/${replId}/env-vars`, { headers });
  console.log(JSON.stringify(await rEnvRes.json(), null, 2));
}

main().catch(console.error);
