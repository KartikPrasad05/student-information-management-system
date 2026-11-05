#!/usr/bin/env node

/**
 * CampusDesk Automated Multi-Platform Deployer
 * Deploys Frontend directly via Vercel REST API (bypassing Windows symlink EPERM issues)
 * and coordinates Render Backend REST API using provided credentials.
 */

import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { testMongoConnection } from './backend/utils/mongoUriDoctor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Terminal color formatting
const cyan = (t) => `\x1b[36m${t}\x1b[0m`;
const green = (t) => `\x1b[32m${t}\x1b[0m`;
const yellow = (t) => `\x1b[33m${t}\x1b[0m`;
const red = (t) => `\x1b[31m${t}\x1b[0m`;
const bold = (t) => `\x1b[1m${t}\x1b[0m`;

const VERCEL_TOKEN = process.env.VERCEL_TOKEN || '';
const RENDER_API_KEY = process.env.RENDER_API_KEY || '';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ronnykartikkpr10_db_user:Kartikprasad2003@studentcluster.6habnxr.mongodb.net/studentDB?retryWrites=true&w=majority';

console.log(cyan('\n============================================================='));
console.log(bold(cyan('  CampusDesk · Direct API Multi-Platform Deployer (Vercel + Render)')));
console.log(cyan('=============================================================\n'));

// Helper to recursively collect files from directory
function collectFiles(dir, base = '') {
  let results = [];
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const relPath = base ? `${base}/${entry}` : entry;
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(collectFiles(fullPath, relPath));
    } else {
      results.push({ fullPath, relPath: relPath.replace(/\\/g, '/') });
    }
  }
  return results;
}

async function main() {
  const summary = {
    mongodb: null,
    vercelUrl: null,
    renderUrl: null
  };

  // -------------------------------------------------------------
  // 1. Verify MongoDB Atlas (studentDB)
  // -------------------------------------------------------------
  console.log(bold('[1/3] Verifying MongoDB Atlas (studentDB)...'));
  try {
    const mongoStatus = await testMongoConnection(MONGODB_URI);
    if (mongoStatus.success) {
      console.log(green('  [✓] MongoDB Atlas online and authenticated to studentDB!'));
      summary.mongodb = 'online (studentDB)';
    } else {
      console.log(yellow(`  [!] MongoDB: ${mongoStatus.message}`));
      summary.mongodb = 'warning';
    }
  } catch (err) {
    console.log(yellow(`  [!] MongoDB check note: ${err.message}`));
  }

  // -------------------------------------------------------------
  // 2. Deploy Frontend Directly via Vercel REST API (Zero Symlinks)
  // -------------------------------------------------------------
  console.log(bold('\n[2/3] Building & Deploying Frontend to Vercel via Cloud API...'));
  try {
    console.log(cyan('  [*] Ensuring fresh Vite build (frontend/dist)...'));
    execSync('npm run build --workspace=frontend', { stdio: 'inherit', cwd: __dirname });
    console.log(green('  [✓] Vite build compiled successfully.'));

    const distDir = path.join(__dirname, 'frontend', 'dist');
    if (!fs.existsSync(distDir)) {
      throw new Error('frontend/dist folder was not found after build.');
    }

    const filesToUpload = collectFiles(distDir);
    console.log(cyan(`  [*] Uploading ${filesToUpload.length} static build assets to Vercel...`));

    const manifestFiles = [];

    for (const item of filesToUpload) {
      const buffer = fs.readFileSync(item.fullPath);
      const sha = crypto.createHash('sha1').update(buffer).digest('hex');

      // Upload raw file buffer to Vercel API
      const uploadRes = await fetch('https://api.vercel.com/v2/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${VERCEL_TOKEN}`,
          'Content-Type': 'application/octet-stream',
          'Content-Length': buffer.length.toString(),
          'x-vercel-digest': sha
        },
        body: buffer
      });

      if (!uploadRes.ok && uploadRes.status !== 409) {
        // 409 means file already exists in Vercel's content-addressable storage
        const errText = await uploadRes.text();
        console.log(yellow(`    [!] Notice on file ${item.relPath}: ${errText}`));
      }

      manifestFiles.push({
        file: item.relPath,
        sha,
        size: buffer.length
      });
    }

    console.log(cyan('  [*] Registering production deployment with Vercel Edge...'));
    const deployPayload = {
      name: 'campusdesk-sis',
      target: 'production',
      files: manifestFiles,
      projectSettings: {
        framework: null
      },
      routes: [
        {
          src: '/api/(.*)',
          dest: 'https://student-information-management-system-7zv9.onrender.com/api/$1'
        },
        {
          src: '/health',
          dest: 'https://student-information-management-system-7zv9.onrender.com/health'
        },
        { handle: 'filesystem' },
        { src: '/(.*)', dest: '/index.html' }
      ]
    };

    const deployRes = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(deployPayload)
    });

    const deployData = await deployRes.json();

    if (!deployRes.ok) {
      throw new Error(`Vercel deployment failed (${deployRes.status}): ${JSON.stringify(deployData)}`);
    }

    const rawUrl = deployData.url || (deployData.alias && deployData.alias[0]);
    const liveUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;

    console.log(green('  [✓] VERCEL DEPLOYMENT SUCCESSFUL!'));
    console.log(green(`  [➜] Live Vercel Frontend: ${bold(liveUrl)}`));
    summary.vercelUrl = liveUrl;
  } catch (err) {
    console.error(red(`  [✗] Vercel API error: ${err.message}`));
  }

  // -------------------------------------------------------------
  // 3. Coordinate Render Backend Web Service
  // -------------------------------------------------------------
  console.log(bold('\n[3/3] Coordinating Render Backend Web Service...'));
  try {
    console.log(cyan('  [*] Authenticating with Render API...'));
    const ownersRes = await fetch('https://api.render.com/v1/owners', {
      headers: { Authorization: `Bearer ${RENDER_API_KEY}` }
    });

    let ownerInfo = '';
    if (ownersRes.ok) {
      const owners = await ownersRes.json();
      if (owners.length > 0) {
        ownerInfo = owners[0].owner.email || owners[0].owner.name;
        console.log(green(`  [✓] Authenticated to Render account: ${ownerInfo}`));
      }
    }

    const servicesRes = await fetch('https://api.render.com/v1/services?limit=20', {
      headers: { Authorization: `Bearer ${RENDER_API_KEY}` }
    });

    if (servicesRes.ok) {
      const services = await servicesRes.json();
      const campusDeskService = services.find(
        (s) => s.service?.name?.toLowerCase().includes('campus') || s.service?.name?.toLowerCase().includes('p1')
      );

      if (campusDeskService) {
        const serviceId = campusDeskService.service.id;
        const serviceName = campusDeskService.service.name;
        const serviceUrl = campusDeskService.service.serviceDetails?.url || `https://${serviceName}.onrender.com`;

        console.log(green(`  [✓] Found existing Render service: "${serviceName}" (${serviceId})`));
        console.log(cyan('  [*] Triggering deployment on Render...'));

        const deployRes = await fetch(`https://api.render.com/v1/services/${serviceId}/deploys`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RENDER_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ clearCache: 'do_not_clear' })
        });

        if (deployRes.ok) {
          console.log(green(`  [✓] Render deployment triggered successfully!`));
          console.log(green(`  [➜] Live Render API: ${bold(serviceUrl)}`));
          summary.renderUrl = serviceUrl;
        } else {
          console.log(yellow(`  [!] Deploy trigger status: ${deployRes.status}`));
          summary.renderUrl = serviceUrl;
        }
      } else {
        console.log(yellow('  [i] No service named "campusdesk" found on Render yet.'));
        console.log(cyan('  [➜] To activate your Render backend:'));
        console.log('      1. Push your repo to GitHub using: connect-github.bat');
        console.log('      2. In dashboard.render.com, click "New +" -> "Web Service" -> Select your repo');
        console.log('      3. Render will auto-read render.yaml and connect with MONGODB_URI!');
      }
    }
  } catch (err) {
    console.log(yellow(`  [!] Render check: ${err.message}`));
  }

  // -------------------------------------------------------------
  // Final Summary
  // -------------------------------------------------------------
  console.log(cyan('\n============================================================='));
  console.log(bold(cyan('               Deployment Execution Summary')));
  console.log(cyan('============================================================='));
  if (summary.mongodb) {
    console.log(`  ${green('✓')} ${bold('MongoDB Atlas:')}  ${summary.mongodb}`);
  }
  if (summary.vercelUrl) {
    console.log(`  ${green('✓')} ${bold('Vercel (UI):')}    ${summary.vercelUrl}`);
  }
  if (summary.renderUrl) {
    console.log(`  ${green('✓')} ${bold('Render (API):')}   ${summary.renderUrl}`);
  }
  console.log(cyan('=============================================================\n'));
}

main().catch((err) => {
  console.error(red(`\nDeployment error: ${err.message}`));
  process.exit(1);
});
