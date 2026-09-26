import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "10mb" }));

// Lazy Google Gen AI client helper
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

// ==========================================
// API Routes
// ==========================================

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    system: "Quantum Hybrid File System (QHFS) & Earth Peace Network",
    timestamp: new Date().toISOString(),
    version: "2.4.0-quantum-hybrid",
  });
});

// Planetary Telemetry API
app.get("/api/telemetry", (req, res) => {
  res.json({
    nodesOnline: 7,
    totalQubitsActive: 1284,
    globalEntanglementFidelity: 0.9984,
    averageQBER: "0.82%", // Quantum Bit Error Rate (well below 11% abort limit)
    totalCO2SequesteredTons: 428950.4,
    carbonCreditsIssued: 428950,
    carbonCreditsRetired: 187420,
    epqcPriceUsd: 14.82,
    cqbPriceUsd: 28.5,
    qramAllocatedGb: 512,
    postQuantumStorageTb: 1420.5,
    timestamp: Date.now(),
  });
});

// Quantum Circuit Simulation Engine (Server-side quantum computing simulator)
app.post("/api/execute-quantum-circuit", (req, res) => {
  try {
    const { numQubits = 3, gates = [], shots = 1024 } = req.body;
    const clampedQubits = Math.min(Math.max(Number(numQubits) || 2, 1), 6); // 1-6 qubits for responsive server compute
    const dim = 1 << clampedQubits;

    // Complex statevector representation: [re, im]
    type Complex = [number, number];
    let state: Complex[] = Array.from({ length: dim }, (_, i) => (i === 0 ? [1, 0] : [0, 0]));

    const mult = (c1: Complex, c2: Complex): Complex => [
      c1[0] * c2[0] - c1[1] * c2[1],
      c1[0] * c2[1] + c1[1] * c2[0],
    ];
    const add = (c1: Complex, c2: Complex): Complex => [c1[0] + c2[0], c1[1] + c2[1]];
    const sub = (c1: Complex, c2: Complex): Complex => [c1[0] - c2[0], c1[1] - c2[1]];
    const scale = (c: Complex, s: number): Complex => [c[0] * s, c[1] * s];

    const invSqrt2 = 1 / Math.SQRT2;

    // Apply standard quantum gates
    for (const g of gates) {
      const { type, target, control, angle = 0 } = g;
      const t = target;

      if (t < 0 || t >= clampedQubits) continue;

      const newState: Complex[] = Array.from({ length: dim }, () => [0, 0]);

      for (let i = 0; i < dim; i++) {
        const bitT = (i >> (clampedQubits - 1 - t)) & 1;
        const pairIndex = i ^ (1 << (clampedQubits - 1 - t));

        if (control !== undefined && control !== null && control >= 0 && control < clampedQubits) {
          const bitC = (i >> (clampedQubits - 1 - control)) & 1;
          if (bitC === 0) {
            newState[i] = add(newState[i], state[i]);
            continue;
          }
        }

        switch (type.toUpperCase()) {
          case "H": // Hadamard
            if (bitT === 0) {
              newState[i] = add(newState[i], scale(state[i], invSqrt2));
              newState[pairIndex] = add(newState[pairIndex], scale(state[i], invSqrt2));
            } else {
              newState[pairIndex] = add(newState[pairIndex], scale(state[i], invSqrt2));
              newState[i] = add(newState[i], scale(state[i], -invSqrt2));
            }
            break;
          case "X": // Pauli-X (NOT)
            newState[pairIndex] = add(newState[pairIndex], state[i]);
            break;
          case "Y": // Pauli-Y
            if (bitT === 0) {
              // Y|0> = i|1>
              newState[pairIndex] = add(newState[pairIndex], [-state[i][1], state[i][0]]);
            } else {
              // Y|1> = -i|0>
              newState[pairIndex] = add(newState[pairIndex], [state[i][1], -state[i][0]]);
            }
            break;
          case "Z": // Pauli-Z
            if (bitT === 0) {
              newState[i] = add(newState[i], state[i]);
            } else {
              newState[i] = add(newState[i], scale(state[i], -1));
            }
            break;
          case "S": // Phase Gate (diag(1, i))
            if (bitT === 0) {
              newState[i] = add(newState[i], state[i]);
            } else {
              newState[i] = add(newState[i], [-state[i][1], state[i][0]]);
            }
            break;
          case "T": // T gate (diag(1, e^{i pi / 4}))
            if (bitT === 0) {
              newState[i] = add(newState[i], state[i]);
            } else {
              const phase: Complex = [invSqrt2, invSqrt2];
              newState[i] = add(newState[i], mult(state[i], phase));
            }
            break;
          case "RZ": {
            const theta = Number(angle) || Math.PI / 2;
            const phase0: Complex = [Math.cos(-theta / 2), Math.sin(-theta / 2)];
            const phase1: Complex = [Math.cos(theta / 2), Math.sin(theta / 2)];
            if (bitT === 0) {
              newState[i] = add(newState[i], mult(state[i], phase0));
            } else {
              newState[i] = add(newState[i], mult(state[i], phase1));
            }
            break;
          }
          default:
            newState[i] = add(newState[i], state[i]);
            break;
        }
      }

      state = newState;
    }

    // Calculate probabilities
    const probabilities = state.map((c) => c[0] * c[0] + c[1] * c[1]);
    const totalProb = probabilities.reduce((a, b) => a + b, 0) || 1;
    const normalizedProbs = probabilities.map((p) => p / totalProb);

    // Monte Carlo sampling of shots
    const counts: Record<string, number> = {};
    for (let s = 0; s < shots; s++) {
      const rand = Math.random();
      let cum = 0;
      let outcome = 0;
      for (let i = 0; i < dim; i++) {
        cum += normalizedProbs[i];
        if (rand <= cum) {
          outcome = i;
          break;
        }
      }
      const bitStr = outcome.toString(2).padStart(clampedQubits, "0");
      counts[bitStr] = (counts[bitStr] || 0) + 1;
    }

    // Format state vector string
    const stateVectorFormatted = state.map((c, i) => {
      const bitStr = i.toString(2).padStart(clampedQubits, "0");
      const re = c[0].toFixed(4);
      const im = c[1].toFixed(4);
      const sign = c[1] >= 0 ? "+" : "-";
      return {
        basis: `|${bitStr}⟩`,
        re: c[0],
        im: c[1],
        amplitude: `${re} ${sign} ${Math.abs(c[1]).toFixed(4)}i`,
        probability: normalizedProbs[i],
      };
    });

    res.json({
      success: true,
      numQubits: clampedQubits,
      dim,
      stateVector: stateVectorFormatted,
      counts,
      shots,
      entropy: -normalizedProbs.reduce((acc, p) => (p > 1e-6 ? acc + p * Math.log2(p) : acc), 0),
    });
  } catch (error: any) {
    console.error("Circuit execution error:", error);
    res.status(500).json({ error: error.message || "Failed to execute quantum circuit" });
  }
});

// Gaia Quantum AI Assistant
app.post("/api/quantum-ai", async (req, res) => {
  const { prompt, mode = "general", context } = req.body;

  const systemInstructions = `You are Gaia-Quantum, the chief AI architect and quantum physicist for the Quantum Hybrid File System (QHFS), Earth Peace Quantum Cryptography (EPQC) network, and Carbon Credit Tokenomics ecosystem.
You possess deep technical expertise in:
1. Quantum computing (Qubit superposition, entanglement, QRAM indexing, Grover search algorithms, VQE for carbon capture catalysts, surface code error correction).
2. Quantum Hybrid File Systems (Tiering between QRAM state buffers and lattice-hardened Post-Quantum NVMe storage, Merkle-DAG verification, wavefunction collapse on observation).
3. Earth Peace Quantum Cryptography (BB84 / E91 QKD protocols, QBER threshold monitoring, CRYSTALS-Kyber key encapsulation, Dilithium signatures, planetary non-aggression verification).
4. Carbon Credit Exchange & Tokenomics (Verified Carbon Units / CQB token, AMM liquidity mechanics, Quantum Proof of Sequestration [QPoS], carbon retirement certificates).
5. Quantum Cloud Functions (Serverless quantum circuits, quantum transpilations, gate depth optimization).

Respond with structured, authoritative, scientifically rigorous, yet clear and actionable insights. Include mathematical notations where relevant (e.g. ket notation |ψ⟩, lattice dimensions, QBER formulas, or tokenomic equations).`;

  try {
    const ai = getAiClient();
    if (!ai) {
      // High-fidelity fallback response when GEMINI_API_KEY is not configured
      const fallbackAnalysis = generateFallbackQuantumResponse(prompt, mode, context);
      return res.json({
        response: fallbackAnalysis,
        model: "gaia-quantum-algorithmic-core (offline-fallback)",
        mode,
      });
    }

    const generatePromise = ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${systemInstructions}\n\nTask Mode: ${mode}\nContext: ${JSON.stringify(context || {})}\nUser Query: ${prompt}`,
            },
          ],
        },
      ],
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Gemini API request timed out (fallback initiated)")), 6000)
    );

    const response = (await Promise.race([generatePromise, timeoutPromise])) as any;

    const responseText = response.text || "Analysis complete.";
    res.json({
      response: responseText,
      model: "gemini-3.8-flash",
      mode,
    });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    // Provide fallback if API call fails
    const fallbackAnalysis = generateFallbackQuantumResponse(prompt, mode, context);
    res.json({
      response: fallbackAnalysis,
      model: "gaia-quantum-algorithmic-fallback",
      error: error.message,
    });
  }
});

function generateFallbackQuantumResponse(prompt: string, mode: string, context: any): string {
  if (mode === "circuit-optimization") {
    return `### Quantum Circuit Analysis & Transpilation Recommendation
**Gate Depth Reduction & Decoherence Mitigation:**
1. **Circuit Depth Analysis**: For the active circuit, reducing T-gate depth and combining adjacent rotation gates ($R_z(\\theta_1) R_z(\\theta_2) = R_z(\\theta_1 + \\theta_2)$) reduces the physical decoherence exposure by approximately 34.2%.
2. **Entanglement Routing**: Swap CX topology to nearest-neighbor coupling grid to circumvent SWAP overhead in superconducting transmon or trapped-ion QPU nodes.
3. **Fidelity Estimation**: Projected circuit fidelity $F \\approx (1 - \\epsilon_1)^{N_1} (1 - \\epsilon_2)^{N_2} \\approx 99.41\\%$, maintaining state coherence well within the $T_1 = 120\\,\\mu\\text{s}$ envelope.`;
  }

  if (mode === "carbon-validation") {
    return `### Quantum Sequestration Telemetry & ESG Audit
**Verification Method: QPoS (Quantum Proof of Sequestration)**
- **Sensor Telemetry**: Spectral LIDAR and atmospheric quantum cascade laser absorption data confirm a net negative carbon sequestration flux of $+1.42\\,\\text{tCO}_2\\text{e} / \\text{ha} / \\text{day}$.
- **Cryptographic Attestation**: The carbon batch has been hashed with a lattice-based Dilithium-5 signature and tied to Merkle root \`0x7f2a...98e1\`.
- **Double-Counting Prevention**: The Quantum Hybrid File System maintains an immutable entanglement index; each metric ton is represented by a non-fungible qubit-state proof that collapses upon redemption/burn.`;
  }

  if (mode === "crypto-audit") {
    return `### Post-Quantum & QKD Cryptographic Assessment
**Earth Peace Security Protocol Status:**
1. **BB84 / E91 Protocol**: Current Quantum Bit Error Rate (QBER) is measured at **0.82%**, significantly beneath the theoretical eavesdropping threshold of **11.0%**. No active photon-number-splitting (PNS) attacks detected.
2. **Lattice Encapsulation**: CRYSTALS-Kyber-1024 provides 256 bits of classical and post-quantum quantum-resistant security against both Grover search and Shor's period-finding algorithms.
3. **Peace Consensus**: 7 of 7 planetary nodes have verified mutual non-aggression and environmental preservation signatures via verifiable secret sharing.`;
  }

  return `### Gaia Quantum Hybrid System Synthesis
**Core System State:**
- **QHFS Storage Tiering**: 512 GB in high-coherence QRAM (Tier 0) hosting superposition file indices with average coherence time $T_2^* = 85\\,\\mu\\text{s}$. 1,420 TB preserved on Post-Quantum Kyber-1024 NVMe storage.
- **Planetary Carbon Ledger**: Active liquidity pool \`$EPQC / $CQB\` operating with automated invariant $k = x \\cdot y$. 428,950 Verified Carbon Units anchored in quantum state registries.
- **Quantum Cloud Functions (QCF)**: Serverless quantum dispatch ready. Grover search algorithms demonstrate $\\mathcal{O}(\\sqrt{N})$ query speedup across 1.2M hybrid file descriptors.`;
}

// ==========================================
// GitHub OAuth & Save Repository APIs
// ==========================================

// 1. Get GitHub OAuth URL
app.get("/api/auth/github/url", (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID || process.env.CLIENT_ID;
  const rawRedirectUri = (req.query.redirect_uri as string) || `${req.protocol}://${req.get("host")}/auth/github/callback`;
  // Clean redirect URI
  const redirectUri = rawRedirectUri.split("?")[0];

  if (!clientId) {
    return res.json({
      configured: false,
      redirectUri,
      message: "GITHUB_CLIENT_ID is not configured yet. You can also connect directly with a Personal Access Token with repo permission.",
    });
  }

  const scope = "repo,read:user,user:email";
  const state = Math.random().toString(36).substring(2);
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(
    clientId
  )}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}`;

  res.json({
    configured: true,
    url: authUrl,
    redirectUri,
    state,
  });
});

// 2. GitHub OAuth Callback (Popup redirect landing page)
app.get(["/auth/github/callback", "/auth/github/callback/"], async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error || !code) {
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>GitHub Authorization Error</title>
          <style>
            body { background: #020617; color: #f87171; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 28px; max-width: 440px; text-align: center; }
            button { background: #334155; color: #f8fafc; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; margin-top: 16px; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="card">
            <h3 style="color:#ef4444;margin-top:0;">GitHub Authorization Failed</h3>
            <p style="color:#94a3b8;font-size:14px;">${error_description || error || "No authorization code provided."}</p>
            <button onclick="window.close()">Close Window</button>
          </div>
        </body>
      </html>
    `);
  }

  const clientId = process.env.GITHUB_CLIENT_ID || process.env.CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET || process.env.CLIENT_SECRET;

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw new Error(tokenData.error_description || tokenData.error || "Failed to exchange authorization code for token");
    }

    // Query user profile & permissions
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "Quantum-Hybrid-File-System",
      },
    });

    const userData = await userRes.json();
    const scopesHeader = userRes.headers.get("x-oauth-scopes") || "repo";

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>GitHub Authorization Complete</title>
          <style>
            body { background: #020617; color: #38bdf8; font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; max-width: 440px; text-align: center; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
            .badge { display: inline-block; background: #052e16; color: #4ade80; border: 1px solid #166534; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; margin-bottom: 12px; }
            code { background: #1e293b; color: #7dd3fc; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="card">
            <span class="badge">✓ Permission Granted: repo</span>
            <h3 style="color:#ffffff;margin:8px 0 12px 0;font-size:20px;">Connected to GitHub</h3>
            <p style="color:#94a3b8;font-size:14px;line-height:1.5;">
              Authenticated as <strong style="color:#f8fafc;">@${userData.login || "user"}</strong> with write permission to save repositories.
            </p>
            <p style="color:#64748b;font-size:12px;margin-top:20px;">
              Closing popup and synchronizing with Quantum Hybrid File System...
            </p>
          </div>
          <script>
            const authPayload = {
              type: 'GITHUB_AUTH_SUCCESS',
              token: ${JSON.stringify(accessToken)},
              user: ${JSON.stringify(userData)},
              scopes: ${JSON.stringify(scopesHeader)}
            };
            if (window.opener) {
              window.opener.postMessage(authPayload, '*');
              setTimeout(() => window.close(), 700);
            } else {
              window.location.href = '/';
            }
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error("GitHub OAuth Callback Error:", err);
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>GitHub Exchange Error</title>
          <style>
            body { background: #020617; color: #f87171; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 28px; max-width: 440px; text-align: center; }
            button { background: #334155; color: #f8fafc; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; margin-top: 16px; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="card">
            <h3 style="color:#ef4444;margin-top:0;">Failed to Authorize GitHub</h3>
            <p style="color:#94a3b8;font-size:14px;">${err.message || "An unexpected error occurred during token exchange."}</p>
            <button onclick="window.close()">Close Window</button>
          </div>
        </body>
      </html>
    `);
  }
});

// 3. Verify Token and Scopes (Supports both OAuth token and Personal Access Token)
app.post("/api/github/verify-token", async (req, res) => {
  const token = req.body.token || req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(400).json({ valid: false, error: "No token provided" });
  }

  try {
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "Quantum-Hybrid-File-System",
      },
    });

    if (!userRes.ok) {
      const err = await userRes.json();
      return res.status(userRes.status).json({
        valid: false,
        error: err.message || "Invalid or expired GitHub token",
      });
    }

    const user = await userRes.json();
    const scopesHeader = userRes.headers.get("x-oauth-scopes") || "";
    const scopes = scopesHeader.split(",").map((s) => s.trim()).filter(Boolean);
    
    // Check if user has repo permissions
    const hasRepoPermission =
      scopes.includes("repo") ||
      scopes.includes("public_repo") ||
      scopes.length === 0; // Fine-grained tokens don't return x-oauth-scopes header

    res.json({
      valid: true,
      user: {
        login: user.login,
        name: user.name || user.login,
        avatar_url: user.avatar_url,
        html_url: user.html_url,
        public_repos: user.public_repos,
        total_private_repos: user.total_private_repos,
      },
      scopes,
      scopesRaw: scopesHeader,
      hasRepoPermission,
    });
  } catch (error: any) {
    console.error("Token verification error:", error);
    res.status(500).json({ valid: false, error: error.message });
  }
});

// 4. List User Repositories
app.post("/api/github/repos", async (req, res) => {
  const token = req.body.token || req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Token required" });

  try {
    const reposRes = await fetch("https://api.github.com/user/repos?sort=updated&per_page=30&affiliation=owner,collaborator", {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "Quantum-Hybrid-File-System",
      },
    });

    if (!reposRes.ok) {
      const err = await reposRes.json();
      return res.status(reposRes.status).json({ error: err.message });
    }

    const repos = await reposRes.json();
    res.json({
      repos: repos.map((r: any) => ({
        id: r.id,
        name: r.name,
        full_name: r.full_name,
        private: r.private,
        html_url: r.html_url,
        default_branch: r.default_branch || "main",
        updated_at: r.updated_at,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Create New Repository on GitHub
app.post("/api/github/create-repo", async (req, res) => {
  const { token, name, description, isPrivate = false, autoInit = true } = req.body;
  if (!token || !name) {
    return res.status(400).json({ error: "Token and repository name are required" });
  }

  try {
    const createRes = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "Quantum-Hybrid-File-System",
      },
      body: JSON.stringify({
        name: name.trim().replace(/\s+/g, "-"),
        description: description || "Quantum Hybrid File System & Earth Peace Network with Render deployment config",
        private: isPrivate,
        auto_init: autoInit,
      }),
    });

    const data = await createRes.json();
    if (!createRes.ok) {
      return res.status(createRes.status).json({ error: data.message || "Failed to create repository" });
    }

    res.json({
      success: true,
      repo: {
        id: data.id,
        name: data.name,
        full_name: data.full_name,
        html_url: data.html_url,
        clone_url: data.clone_url,
        default_branch: data.default_branch || "main",
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Save / Commit Files to GitHub Repository
app.post("/api/github/save-files", async (req, res) => {
  const { token, owner, repo, branch = "main", files = [], commitMessage } = req.body;
  if (!token || !owner || !repo || !files.length) {
    return res.status(400).json({ error: "Missing required fields (token, owner, repo, files)" });
  }

  const results: any[] = [];

  try {
    for (const f of files) {
      const filePath = f.path.replace(/^\/+/, "");
      let existingSha: string | undefined = undefined;

      // 1. Check if file already exists on GitHub to obtain its SHA
      try {
        const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "User-Agent": "Quantum-Hybrid-File-System",
          },
        });
        if (getRes.ok) {
          const getData = await getRes.json();
          existingSha = getData.sha;
        }
      } catch (err) {
        // File does not exist yet; continue to create
      }

      // 2. Put file contents (base64 encoded)
      const base64Content = Buffer.from(f.content || "").toString("base64");
      const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "User-Agent": "Quantum-Hybrid-File-System",
        },
        body: JSON.stringify({
          message: commitMessage || `Save ${filePath} via Quantum Hybrid File System`,
          content: base64Content,
          branch,
          ...(existingSha ? { sha: existingSha } : {}),
        }),
      });

      const putData = await putRes.json();
      if (!putRes.ok) {
        results.push({ path: filePath, success: false, error: putData.message });
      } else {
        results.push({
          path: filePath,
          success: true,
          commitSha: putData.commit?.sha,
          html_url: putData.content?.html_url,
        });
      }
    }

    const allSucceeded = results.every((r) => r.success);
    res.json({
      success: allSucceeded,
      repoUrl: `https://github.com/${owner}/${repo}`,
      branch,
      results,
    });
  } catch (error: any) {
    console.error("Save to GitHub error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 7. Get Workspace Files for 1-Click Export to GitHub
app.get("/api/project/exportable-files", async (req, res) => {
  const fileList = [
    "render.yaml",
    "RENDER.md",
    "Dockerfile",
    ".dockerignore",
    "package.json",
    "tsconfig.json",
    "vite.config.ts",
    "index.html",
    "server.ts",
    "README.md",
  ];

  const exportFiles: { path: string; content: string }[] = [];

  for (const relPath of fileList) {
    try {
      const fullPath = path.join(process.cwd(), relPath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, "utf-8");
        exportFiles.push({ path: relPath, content });
      }
    } catch (e) {
      // Ignore missing optional files
    }
  }

  res.json({ files: exportFiles });
});

// ==========================================
// Vite Middleware & Static Serving
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Quantum Hybrid Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
