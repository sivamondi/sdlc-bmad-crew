# SDLC BMAD Crew

A production-ready web UI that runs the [BMad Method](https://github.com/bmad-method/bmad-method) agent framework as a full SDLC pipeline — from PRD to retrospective — through a browser interface.

> Built on top of the **BMad Method** — the best and most comprehensive Agile AI Driven Development framework with true scale-adaptive intelligence. 100% free and open source. No paywalls.  
> Learn more at [docs.bmad-method.org](https://docs.bmad-method.org)

---

## What is this?

Traditional AI tools do the thinking *for* you, producing average results. BMad agents act as expert collaborators who guide you through a structured process to bring out your best thinking in partnership with AI.

This app exposes the BMad agent team as a **three-phase SDLC workflow** you can run against any PRD or feature brief:

| Phase | Workflow | Agents |
|---|---|---|
| 🔵 Discovery & Planning | Epics → Architecture → Sprint Plan → BDD Tests | John (PM), Winston (Architect), Amelia (Dev) |
| 🟢 Build & Quality Assurance | Implement Code → Code Review → Test Execution | Amelia (Dev) |
| 🟣 Release & Retrospective | API Docs → Readiness Check → Retrospective | Paige (Tech Writer), Winston (Architect), Amelia (Dev) |

**Key features:**
- Upload a PRD and run any phase with one click
- Each agent streams its output live in the browser
- Results are rendered as structured cards — epics, architecture diagrams, sprint boards, test results, readiness scores
- **Cross-phase context chaining** — output from Phase 1 automatically flows into Phase 2 and Phase 3 prompts
- **Agent Chat mode** — have a free-form conversation with any individual agent
- Project results persist across sessions (saved to `~/.bmad/projects/`)

---

## Running Locally

### Prerequisites

- Python 3.10+
- Node.js 20+
- An [Anthropic API key](https://console.anthropic.com)

### 1. Clone and install

```bash
git clone <this-repo>
cd sdlc-bmad-crew
```

Install Python dependencies:

```bash
pip install -r crew-app/backend/requirements.txt
```

Install frontend dependencies:

```bash
cd crew-app/frontend
npm install
cd ../..
```

### 2. Set your API key

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Or create a `.env` file in the project root:

```
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Start the backend

```bash
python -m uvicorn crew-app.backend.app:app --host 0.0.0.0 --port 8000
```

### 4. Start the frontend (dev mode)

In a separate terminal:

```bash
cd crew-app/frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

> In dev mode the Vite dev server proxies `/api` and `/ws` to the backend on port 8000 automatically.

---

## Running with Docker

### Docker Compose (recommended)

```bash
ANTHROPIC_API_KEY=sk-ant-... docker compose up --build
```

App available at [http://localhost:8000](http://localhost:8000).

Project results and settings persist in a Docker volume (`bmad-data` → `/root/.bmad`).

### Plain Docker

```bash
# Build
docker build -t bmad-crew .

# Run
docker run -p 8000:8000 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -v bmad-data:/root/.bmad \
  bmad-crew
```

---

## Project Structure

```
sdlc-bmad-crew/
├── crew-app/
│   ├── backend/          # FastAPI + WebSocket server
│   │   ├── app.py        # Main application
│   │   └── requirements.txt
│   └── frontend/         # React + Vite + Tailwind UI
│       └── src/
│           └── pages/
│               ├── Build.jsx    # Workflow runner + Agent chat
│               └── Agents.jsx   # Agent & skill browser
├── .claude/
│   └── skills/           # BMad agent & skill definitions
├── _bmad_output/         # Generated files (code, feature files, docs)
├── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## How it works

1. **Create a project** and upload your PRD document
2. **Select a workflow phase** (Discovery & Planning → Build & QA → Release & Retrospective)
3. Click **Run Agents** — each BMad agent streams its response live
4. Results are saved per project — the next phase automatically picks up context from the previous one
5. Generated files (code, Gherkin feature files, docs) are saved to `_bmad_output/`

---

## Credits

This project is powered by the **[BMad Method](https://github.com/bmad-method/bmad-method)** — an open-source AI-driven agile development framework.

> *Build More Architect Dreams* — Scale-adaptive intelligence that adjusts from bug fixes to enterprise systems.

- 📖 [Documentation](https://docs.bmad-method.org)
- 💬 [Discord Community](https://discord.gg/bmad)
- 🐦 [X / Twitter](https://twitter.com/bmadcode)
- ⭐ [Star BMad on GitHub](https://github.com/bmad-method/bmad-method)

Licensed under [MIT](.claude/skills/LICENSE).
