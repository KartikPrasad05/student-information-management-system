#!/usr/bin/env node

async function testEndpoint(url) {
  console.log(`\nTesting: ${url}`);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    console.log(`Status: ${res.status} ${res.statusText}`);
    const text = await res.text();
    console.log(`Response: ${text.slice(0, 200)}`);
  } catch (err) {
    console.log(`Error: ${err.message}`);
  }
}

async function main() {
  const primary = 'https://student-information-management-system-7zv9.onrender.com';
  const replica = 'https://student-information-management-system-3gs8.onrender.com';

  console.log('=== TESTING PRIMARY RENDER ===');
  await testEndpoint(`${primary}/health`);
  await testEndpoint(`${primary}/api/students`);
  await testEndpoint(`${primary}/api/departments`);
  await testEndpoint(`${primary}/`);

  console.log('\n=== TESTING REPLICA RENDER ===');
  await testEndpoint(`${replica}/health`);
  await testEndpoint(`${replica}/api/students`);
  await testEndpoint(`${replica}/api/departments`);
}

main().catch(console.error);
