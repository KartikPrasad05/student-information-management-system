# Student Information Management System

<div align="center">

[![Live Application](https://img.shields.io/badge/🚀%20Live%20Website-Click%20Here%20to%20Open-00C7B7?style=for-the-badge&logo=vercel&logoColor=white)](https://campusdesk-es0ugpfs1-kartikprasad05.vercel.app)
[![API Status](https://img.shields.io/badge/Render%20API-Online-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://student-information-management-system-7zv9.onrender.com)
[![Database](https://img.shields.io/badge/MongoDB%20Atlas-Connected-00ED64?style=for-the-badge&logo=mongodb&logoColor=white)](https://cloud.mongodb.com)

### 🌐 [👉 Click Here to Open Running Website (Live on Vercel)](https://campusdesk-es0ugpfs1-kartikprasad05.vercel.app)

**Direct Link:** [`https://campusdesk-es0ugpfs1-kartikprasad05.vercel.app`](https://campusdesk-es0ugpfs1-kartikprasad05.vercel.app)

</div>

---

### 📌 Live Cloud Architecture Links
| Component | Platform | Live URL / Endpoint | Status |
| :--- | :--- | :--- | :--- |
| **Frontend UI (SIS)** | **Vercel Edge** | [https://campusdesk-es0ugpfs1-kartikprasad05.vercel.app](https://campusdesk-es0ugpfs1-kartikprasad05.vercel.app) | 🟢 **Live Online** |
| **Backend REST API** | **Render (Singapore)** | [https://student-information-management-system-7zv9.onrender.com](https://student-information-management-system-7zv9.onrender.com) | 🟢 **Live Online** |
| **Backend Health Check** | **Render** | [https://student-information-management-system-7zv9.onrender.com/health](https://student-information-management-system-7zv9.onrender.com/health) | 🟢 **Active** |
| **Database Cluster** | **MongoDB Atlas** | `studentDB` (`students`, `departments`) | 🟢 **Connected** |

---

## 🏆 Resolution of the MongoDB URI Issue

A major challenge developers face with MongoDB Atlas on Node.js/Windows and cloud deployments is connection failures (`MongooseServerSelectionError`, `querySrv ECONNREFUSED`, `Authentication failed`). 

This project solves the MongoDB URI issue completely through:

### 1. Missing Database Path Correction
- **Problem:** Standard connection strings end in `.mongodb.net/?appName=...` without a database name. Mongoose defaults to `test`, which triggers authentication errors for restricted database users and scatters data.
- **Solution:** Our built-in **MongoDB Doctor** (`backend/utils/mongoUriDoctor.js`) automatically detects missing database segments and injects `/studentDB?retryWrites=true&w=majority` into the URI dynamically.

### 2. DNS SRV Resolution Fix on Windows & Node 18+
- **Problem:** Node 18+ resolves SRV records via IPv6 by default on certain Windows environments, throwing `querySrv ECONNREFUSED`.
- **Solution:** We enforce IPv4 resolution order (`dns.setDefaultResultOrder('ipv4first')`) and set fallback DNS resolvers (`8.8.8.8`, `1.1.1.1`) before establishing cluster connections.

### 3. Serverless Connection Pooling
- **Problem:** Serverless platforms (Vercel) create and destroy lambdas rapidly, exhausting MongoDB connection quotas.
- **Solution:** Connection caching in `backend/config/database.js` ensures warm connections are reused across serverless invocations (`readyState === 1`).

### 4. Automated Diagnostic Feedback
- If an IP restriction or network block occurs, the Doctor outputs actionable instructions to add `0.0.0.0/0` in MongoDB Atlas Network Access.

---

## 🤖 Claude: Unified Agent for Multiple MCP Servers

This project is configured so that **Claude acts as a Unified Agent** coordinating across multiple platforms simultaneously using Anthropic's **Model Context Protocol (MCP)**.

### Multiple MCP Servers Configured ([`claude_desktop_config.json`](./claude_desktop_config.json))
- **`campusdesk-unified`:** Our custom MCP server (`mcp/server.js`) implementing tools for database verification, multi-platform deployment, and cross-platform health checks.
- **`vercel`:** Official Vercel MCP server for managing edge deployments and environment variables.
- **`render`:** Render MCP server for managing backend web services.
- **`github`:** GitHub MCP server for repository version control and branch management.

### Update Multiple Platforms in One Prompt
With this setup, a single prompt to Claude such as:
> *"Deploy the latest changes to Vercel and Render and push to GitHub"*

triggers Claude to automatically:
1. Verify the MongoDB Atlas URI and connectivity via `verify_mongodb_uri`.
2. Commit and push the code changes to GitHub.
3. Build and deploy the frontend to **Vercel** (`vercel.json`).
4. Trigger the backend API deployment on **Render** (`render.yaml`).
5. Output a unified multi-platform deployment dashboard in a single response.

You can also run this multi-platform deployment anytime via the CLI:
```bash
npm run deploy:all "feat: update campusdesk system"
```

---

## 💻 Local Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Verify `backend/.env`:
```env
PORT=5000
MONGODB_URI=mongodb+srv://ordhatrak855_db_user:pucTDw3KCIh8bLyh@cluster0.0enfp44.mongodb.net/studentDB?retryWrites=true&w=majority&appName=Cluster0
FRONTEND_URL=http://localhost:5173,https://*.vercel.app
```

### 3. Start Both Frontend and Backend
```bash
npm run dev
```
- **Frontend:** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://localhost:5000](http://localhost:5000)
- **API Health Check:** [http://localhost:5000/health](http://localhost:5000/health)

---

## 🚀 Multi-Platform Deployment Guide

### Platform 1: Deploy Backend to Render
1. Go to [render.com](https://render.com) and create a **Web Service** pointing to your repository.
2. Select the `backend` folder as the root directory:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/health`
3. Under **Environment Variables**, set:
   - `NODE_ENV`: `production`
   - `MONGODB_URI`: `<Your MongoDB Atlas connection string>`
   - `FRONTEND_URL`: `https://*.vercel.app` *(or your exact Vercel domain)*
4. Note your Render URL (e.g. `https://campusdesk-api.onrender.com`).

### Platform 2: Deploy Frontend to Vercel
1. Go to [vercel.com](https://vercel.com) and click **Add New...** → **Project**.
2. Import your GitHub repository. Vercel automatically detects [`vercel.json`](./vercel.json):
   - **Build Command:** `npm run build --workspace=frontend`
   - **Output Directory:** `frontend/dist`
3. Under **Environment Variables**, set:
   - `VITE_API_URL`: `https://campusdesk-api.onrender.com` *(your Render backend URL)*
4. Click **Deploy**. Your frontend is now live on Vercel's global CDN edge!

---

## 📂 Project Architecture

```text
├── .github/
│   └── workflows/ci.yml         # GitHub Actions build check
├── backend/
│   ├── config/database.js       # MongoDB Atlas connection (with auto-repair)
│   ├── controllers/             # Express API controllers
│   ├── models/                  # Mongoose models (Student, Department)
│   ├── routes/                  # Express REST routes
│   ├── utils/mongoUriDoctor.js  # MongoDB URI Doctor & diagnostic tool
│   └── server.js                # Express app entry
├── frontend/
│   ├── src/                     # React 18 application
│   │   ├── App.jsx              # Main SIS dashboard (Dark/Light mode, Table/Grid)
│   │   ├── styles.css           # Modern professional design system
│   │   └── api.js               # API client & health check
│   └── vite.config.js           # Vite dev proxy configuration
├── mcp/
│   └── server.js                # Custom Model Context Protocol (MCP) server
├── claude_desktop_config.json   # Multi-MCP configuration for Claude Desktop
├── CLAUDE.md                    # Claude Unified Agent system prompt & protocol
├── unified-deploy.js            # Single-command multi-platform deployment script
├── vercel.json                  # Vercel deployment configuration
├── render.yaml                  # Render deployment configuration
└── package.json                 # Monorepo workspaces & deployment scripts
```

---

## License

ISC License. Built for collegiate student information management.
