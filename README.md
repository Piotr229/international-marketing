# GlobalMark AI — International Marketing Tutor

A student-facing AI study assistant for college-level **International & Global Marketing** courses (grounded in US & European textbooks such as Cateora/Gilly/Graham, Keegan & Green, Hollensen, Czinkota & Ronkainen, and Usunier & Lee).

- **Default Model:** `gemini-4-hydrogen` (easily adjustable in `config.js` or via the in-app **Settings** modal)
- **Built-in Anti-Jailbreak & Scope Guardrails:** Enforced via Gemini `systemInstruction`
- **Zero Build Step:** Pure HTML/CSS/JS ready for GitHub Pages (`*.github.io`)

---

## 1. Local Testing (Using Your `.env` File)

1. Copy `.env.example` to `.env`:
   ```powershell
   Copy-Item .env.example .env
   ```
2. Open `.env` and paste your Gemini API key:
   ```env
   GEMINI_API_KEY=AIza...
   GEMINI_MODEL=gemini-4-hydrogen
   ```
   *(`.env` is listed in `.gitignore` so it will never be committed to GitHub.)*
3. Start the local server (PowerShell, no Node or Python required):
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\local-server.ps1
   ```
4. Open **http://localhost:8080** in your browser and test the chat!

---

## 2. Adjusting the Gemini Model

When Google releases a new Gemini model:
- **Permanent default:** Update `DEFAULT_MODEL` (and optionally `AVAILABLE_MODELS`) in `config.js`.
- **Instant in-browser switch:** Click the model badge in the top-right header (or ⚙️ **Settings**) and select a preset or choose **Custom model ID...**.

---

## 3. Deploying Safely to GitHub Pages (`username.github.io`)

> **Important Security Note:** GitHub Pages serves static files publicly. Never put your `GEMINI_API_KEY` into `config.js` or commit `.env` to GitHub—anyone visiting the page could read your key.

### Step A: Deploy the Free Cloudflare Worker Proxy (Keeps Your Key Secret)
1. Create a free account at [dash.cloudflare.com](https://dash.cloudflare.com/).
2. Go to **Workers & Pages** → **Create** → **Create Worker** (e.g., `globalmark-proxy`).
3. Replace the default code with the contents of `cloudflare-worker/worker.js` and click **Deploy**.
4. In the Worker's **Settings** → **Variables and Secrets**, add:
   - `GEMINI_API_KEY` *(Secret)*: Your Gemini API key
   - `ALLOWED_ORIGIN` *(Text)*: `https://<your-github-username>.github.io`
5. Copy your Worker URL (e.g., `https://globalmark-proxy.<subdomain>.workers.dev`) and set `PROXY_URL` in `config.js`:
   ```js
   PROXY_URL: "https://globalmark-proxy.<subdomain>.workers.dev/api/chat",
   ```

### Step B: Push to GitHub & Enable GitHub Pages
1. Configure Git identity (first time only):
   ```powershell
   git config --global user.name "Your Name"
   git config --global user.email "you@example.com"
   ```
2. Create a repository on GitHub:
   - For your root site (`https://<username>.github.io`), name the repo `<username>.github.io`.
   - Or for a project site (`https://<username>.github.io/marketbot`), name it `marketbot`.
3. Initialize, commit, and push (Git will prompt you to sign in via browser):
   ```powershell
   git init
   git add .
   git status   # Verify .env is NOT listed!
   git commit -m "Initial commit: GlobalMark AI tutor"
   git branch -M main
   git remote add origin https://github.com/<username>/<repo-name>.git
   git push -u origin main
   ```
4. In your GitHub repository, go to **Settings** → **Pages** → **Build and deployment**:
   - **Source:** Deploy from a branch
   - **Branch:** `main` / `/ (root)` → **Save**
5. After ~1 minute, your site will be live on `github.io`!
