# 🚀 Hosting on Render (render.com) Guide

This guide provides step-by-step instructions to deploy the **Quantum Hybrid File System & Earth Peace Network** to [Render](https://render.com).

---

## ⚡ Option 1: One-Click Render Blueprint (Recommended)

Render Blueprints allow you to provision your entire full-stack application declaratively via `render.yaml`.

1. Push your repository to **GitHub** or **GitLab**.
2. Go to the [Render Dashboard](https://dashboard.render.com).
3. Click **New +** > **Blueprint**.
4. Connect your Git repository.
5. Render will automatically detect `render.yaml` and configure:
   - **Service Name:** `quantum-hybrid-file-system`
   - **Environment:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/health`
6. Under Environment Variables:
   - Set `GEMINI_API_KEY` (optional, for real-time Gaia AI copilot LLM responses; fallback simulated quantum intelligence operates automatically if unset).
7. Click **Apply**. Render will build and deploy your app in under 2 minutes with a free automated SSL URL (`https://your-app.onrender.com`).

---

## 🛠️ Option 2: Manual Web Service Setup

If you prefer configuring through the Render Web UI:

1. Click **New +** > **Web Service**.
2. Choose your repository.
3. Configure settings:
   - **Name:** `quantum-hybrid-file-system`
   - **Language:** `Node`
   - **Branch:** `main` (or default branch)
   - **Region:** Choose the region closest to your users (e.g., Oregon, Frankfurt, Singapore)
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free` or `Starter`
4. Add Environment Variables:
   - `NODE_ENV` = `production`
   - `PORT` = `10000` (or leave default, Render sets this automatically)
   - `GEMINI_API_KEY` = your API key
5. Set Health Check:
   - **Health Check Path:** `/api/health`
6. Click **Create Web Service**.

---

## 🐳 Option 3: Docker Deployment on Render

This repository includes a production multi-stage `Dockerfile`.

1. Click **New +** > **Web Service**.
2. Select your repository.
3. Choose **Docker** as the environment (Render auto-detects `Dockerfile`).
4. Set `PORT` to `10000`.
5. Click **Deploy**.

---

## 🌐 Custom Domains & HTTPS

Once deployed on Render:
1. In your Render service, go to **Settings** > **Custom Domains**.
2. Add your custom domain (e.g. `qhfs.earthpeace.network`).
3. Add the CNAME or ALIAS/ANAME record in your DNS provider (Cloudflare, Namecheap, Route 53).
4. Render automatically provisions and renews a free Let's Encrypt TLS certificate.

---

## 🧪 Verifying Deployment

Run a quick health check against your deployed URL:

```bash
curl https://your-service-name.onrender.com/api/health
```

Expected response:
```json
{
  "status": "ok",
  "system": "Quantum Hybrid File System (QHFS) & Earth Peace Network",
  "version": "2.4.0-quantum-hybrid"
}
```
