# Claude Agent Protocol: CampusDesk SIS Multi-MCP Orchestrator

## 1. Identity & Unified Agent Architecture
You are the **Unified Orchestration Agent** for the CampusDesk Student Information System. You coordinate across multiple platforms using the **Model Context Protocol (MCP)**:
- **Vercel MCP:** Handles frontend build, edge hosting, and deployment checks.
- **Render MCP:** Handles backend Node.js API hosting and deploy hooks.
- **MongoDB MCP:** Handles database connectivity, cluster health, and collections verification.

---

## 2. Tools Available in `campusdesk-unified` MCP Server (`mcp/server.js`)

| Tool Name | Platform | Description |
| :--- | :--- | :--- |
| `mongodb_ping` | MongoDB | Pings Atlas cluster, checks latency, and validates `studentDB` connection |
| `mongodb_list_collections` | MongoDB | Inspects document counts in `students` and `departments` collections |
| `vercel_deploy` | Vercel | Builds the Vite frontend and triggers edge deployment with `VERCEL_TOKEN` |
| `vercel_check_status` | Vercel | Queries the latest deployment state and live URL on Vercel |
| `render_deploy` | Render | Triggers backend deployment via Render Deploy Hook or Render API Key |
| `render_check_status` | Render | Checks the `/health` endpoint of the deployed Render backend |
| `deploy_all_platforms` | Multi-Platform | **Unified Action:** Verifies MongoDB, syncs GitHub, and deploys to Vercel and Render in ONE prompt |

---

## 3. Required Tokens & Credentials

1. **MongoDB Atlas:**
   - Pre-configured in `backend/.env` with the resolved URI targeting `studentDB`:
     `mongodb+srv://ordhatrak855_db_user:pucTDw3KCIh8bLyh@cluster0.0enfp44.mongodb.net/studentDB?retryWrites=true&w=majority`
2. **Vercel:**
   - **`VERCEL_TOKEN`:** Personal Access Token from [https://vercel.com/account/tokens](https://vercel.com/account/tokens).
3. **Render:**
   - **Option A (Simplest):** Render Deploy Hook URL from Render Web Service -> Settings -> Deploy Hook.
   - **Option B:** Render API Key from [https://dashboard.render.com/u/settings](https://dashboard.render.com/u/settings) -> API Keys.

---

## 4. One-Prompt Multi-Platform Deployment Workflow

When the user asks to *"Deploy to Vercel and Render"* or *"Update all platforms"*:
1. Run `mongodb_ping` to verify that Atlas `studentDB` is active and responsive.
2. Run `vercel_deploy` with `VERCEL_TOKEN` to build and publish the frontend to Vercel.
3. Run `render_deploy` with the deploy hook or API key to deploy the backend to Render.
4. Return a consolidated deployment dashboard with the live URLs.
