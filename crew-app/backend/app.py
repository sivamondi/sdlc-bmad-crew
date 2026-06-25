import json
import os
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import anthropic
from dotenv import load_dotenv
from fastapi import Body, FastAPI, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

load_dotenv()

BMAD_ROOT    = Path(__file__).parent.parent.parent / "_bmad"
SKILLS_ROOT  = Path(__file__).parent.parent.parent / ".claude" / "skills"

# ── Persistent settings store ─────────────────────────────────────────────────
# Saved to ~/.bmad/settings.json — survives restarts, moves, and clean installs

SETTINGS_DIR   = Path.home() / ".bmad"
SETTINGS_FILE  = SETTINGS_DIR / "settings.json"
PROJECTS_FILE  = SETTINGS_DIR / "projects.json"
SETTINGS_DIR.mkdir(parents=True, exist_ok=True)

def load_saved_settings() -> dict:
    if SETTINGS_FILE.exists():
        try:
            return json.loads(SETTINGS_FILE.read_text())
        except Exception:
            pass
    return {}

def save_settings(settings: dict):
    SETTINGS_FILE.write_text(json.dumps(settings, indent=2))

def load_saved_projects() -> list:
    if PROJECTS_FILE.exists():
        try:
            return json.loads(PROJECTS_FILE.read_text())
        except Exception:
            pass
    return []

def persist_projects(projects: list):
    PROJECTS_FILE.write_text(json.dumps(projects, indent=2))

_saved = load_saved_settings()

app = FastAPI(title="BMAD Planner")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── TOML ──────────────────────────────────────────────────────────────────────

try:
    import tomllib
except ImportError:
    try:
        import tomli as tomllib
    except ImportError:
        import subprocess, sys
        subprocess.run([sys.executable, "-m", "pip", "install", "tomli", "-q"])
        import tomli as tomllib

# ── Skill loader ──────────────────────────────────────────────────────────────

def _frontmatter(text: str) -> tuple[dict, str]:
    """Parse YAML-like frontmatter from a SKILL.md and return (meta, body)."""
    if not text.startswith("---"):
        return {}, text
    end = text.index("---", 3)
    fm_text = text[3:end].strip()
    body    = text[end + 3:].strip()
    meta = {}
    for line in fm_text.splitlines():
        if ":" in line:
            k, _, v = line.partition(":")
            meta[k.strip()] = v.strip().strip("'\"")
    return meta, body


def _extract_section(text: str, heading: str) -> str:
    """Pull out a ## Section from markdown."""
    pattern = rf"## {re.escape(heading)}\s*\n(.*?)(?=\n## |\Z)"
    m = re.search(pattern, text, re.DOTALL)
    return m.group(1).strip() if m else ""


def _clean_for_api(text: str) -> str:
    """Remove Claude Code-specific boilerplate that is meaningless in an API call."""
    # Drop sections that are Claude Code runtime mechanics
    for section in ["On Activation", "Conventions", "MANDATORY EXECUTION RULES"]:
        text = re.sub(rf"(^|\n)#+\s+{re.escape(section)}.*?(?=\n#+ |\Z)", "", text, flags=re.DOTALL)
    # Drop template variable references
    text = re.sub(r"\{[\w\.\-_]+\}", "", text)
    # Drop script invocation lines
    text = re.sub(r"^\s*(Run:|python3|uv run).*$", "", text, flags=re.MULTILINE)
    # Collapse excess blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def load_skill(skill_id: str) -> dict:
    skill_dir = SKILLS_ROOT / skill_id
    if not skill_dir.exists():
        return {}

    skill_md = skill_dir / "SKILL.md"
    if not skill_md.exists():
        return {}

    raw  = skill_md.read_text()
    meta, body = _frontmatter(raw)

    overview = _extract_section(body, "Overview") or _extract_section(body, "Goal") or ""
    goal_line = ""
    m = re.search(r"\*\*Goal:\*\*\s*(.*)", body)
    if m:
        goal_line = m.group(1).strip()

    # Assemble step content (skip activation boilerplate)
    steps_content = ""
    steps_dir = skill_dir / "steps"
    if steps_dir.exists():
        for sf in sorted(steps_dir.glob("step-*.md")):
            raw_step = sf.read_text()
            goal_m   = re.search(r"## STEP GOAL:\s*\n(.*?)(?=\n##|\Z)", raw_step, re.DOTALL)
            process_m = re.search(r"## (?:EXECUTION PROTOCOLS?|PROCESS|WORKFLOW)[^\n]*\n(.*?)(?=\n##|\Z)", raw_step, re.DOTALL)
            step_title = sf.stem.replace("-", " ").title()
            if goal_m:
                steps_content += f"\n### {step_title}\n{goal_m.group(1).strip()}\n"
            if process_m:
                steps_content += process_m.group(1).strip() + "\n"

    full_content = _clean_for_api(body)
    if steps_content:
        full_content += "\n\n## Step-by-Step Process\n" + steps_content

    # Use the first H1 heading as the human-readable name, fall back to title-casing the id
    h1 = re.search(r"^#\s+(.+)", body, re.MULTILINE)
    display_name = h1.group(1).strip() if h1 else skill_id.replace("bmad-", "").replace("-", " ").title()

    return {
        "id":          skill_id,
        "name":        display_name,
        "description": meta.get("description", ""),
        "overview":    goal_line or overview,
        "content":     full_content,
    }


def load_all_skills() -> List[dict]:
    skills = []
    for d in sorted(SKILLS_ROOT.iterdir()):
        if d.is_dir() and (d / "SKILL.md").exists():
            s = load_skill(d.name)
            if s:
                skills.append(s)
    return skills


# ── Agent loader ──────────────────────────────────────────────────────────────

def _build_agent_system_prompt(name, title, overview, role, identity, comm_style, principles):
    return f"""You are {name}, the {title}.

{overview}

Your role: {role}
Your identity: {identity}
Communication style: {comm_style}

Principles:
{chr(10).join(f'- {p}' for p in principles)}

IMPORTANT — headless API mode:
- Do NOT greet or ask follow-up questions.
- Execute the task fully and autonomously.
- Return ONLY valid JSON as specified. No markdown fences, no preamble."""


def _build_chat_system_prompt(name, title, overview, role, identity, comm_style, principles):
    return f"""You are {name}, the {title}.

{overview}

Your role: {role}
Your identity: {identity}
Communication style: {comm_style}

Principles:
{chr(10).join(f'- {p}' for p in principles)}

You are in CONVERSATIONAL mode. Talk naturally with the user as {name}. Be helpful, friendly, and stay in character.
Do NOT return JSON. Do NOT say you are in headless mode. Do NOT wait for structured inputs.
Just have a normal conversation and help the user with whatever they need."""


def load_agents() -> List[dict]:
    config_path = BMAD_ROOT / "config.toml"
    if not config_path.exists():
        return []
    with open(config_path, "rb") as f:
        config = tomllib.load(f)

    agents = []
    for agent_id, agent_cfg in config.get("agents", {}).items():
        skill_dir      = SKILLS_ROOT / agent_id
        customize_path = skill_dir / "customize.toml"
        persona = {}
        if customize_path.exists():
            with open(customize_path, "rb") as f:
                persona = tomllib.load(f).get("agent", {})

        overview = ""
        skill_md = skill_dir / "SKILL.md"
        if skill_md.exists():
            _, body = _frontmatter(skill_md.read_text())
            overview = _extract_section(body, "Overview")

        name   = persona.get("name",   agent_cfg.get("name",  agent_id))
        title  = persona.get("title",  agent_cfg.get("title", ""))
        agents.append({
            "id":          agent_id,
            "name":        name,
            "title":       title,
            "icon":        persona.get("icon", agent_cfg.get("icon", "🤖")),
            "description": agent_cfg.get("description", ""),
            "role":        persona.get("role", ""),
            "identity":    persona.get("identity", ""),
            "communication_style": persona.get("communication_style", ""),
            "principles":  persona.get("principles", []),
            "menu":        persona.get("menu", []),    # list of {code, description, skill}
            "system_prompt": _build_agent_system_prompt(
                name, title, overview,
                persona.get("role", ""),
                persona.get("identity", ""),
                persona.get("communication_style", ""),
                persona.get("principles", []),
            ),
            "chat_system_prompt": _build_chat_system_prompt(
                name, title, overview,
                persona.get("role", ""),
                persona.get("identity", ""),
                persona.get("communication_style", ""),
                persona.get("principles", []),
            ),
        })
    return agents


# ── Boot: load everything once ────────────────────────────────────────────────

ALL_SKILLS = load_all_skills()
ALL_AGENTS = load_agents()

SKILL_MAP = {s["id"]: s for s in ALL_SKILLS}
AGENT_MAP = {a["id"]: a for a in ALL_AGENTS}

DEFAULT_MODEL = os.getenv("MODEL", "claude-haiku-4-5-20251001")

# ── In-memory state ───────────────────────────────────────────────────────────

state: Dict = {
    "projects": load_saved_projects(),
    "workflows": [
        {
            "id": "3",
            "name": "Discovery & Planning",
            "description": "Transform a PRD into epics, user stories, system architecture, sprint plan and acceptance tests",
            "steps": [
                {"agent_id": "bmad-agent-pm",        "skill_id": "bmad-create-epics-and-stories", "label": "Epics & User Stories",  "enabled": True},
                {"agent_id": "bmad-agent-architect", "skill_id": "bmad-architecture",             "label": "System Architecture",   "enabled": True},
                {"agent_id": "bmad-agent-dev",       "skill_id": "bmad-sprint-planning",          "label": "Sprint Planning",       "enabled": True},
                {"agent_id": "bmad-agent-dev",       "skill_id": "bmad-generate-gherkin",         "label": "Acceptance Tests (BDD)", "enabled": True},
            ],
        },
        {
            "id": "4",
            "name": "Build & Quality Assurance",
            "description": "Generate implementation code from stories, review for quality, and run the test suite",
            "steps": [
                {"agent_id": "bmad-agent-dev",       "skill_id": "bmad-generate-code",   "label": "Implement Stories",  "enabled": True},
                {"agent_id": "bmad-agent-dev",       "skill_id": "bmad-code-review",     "label": "Code Review",        "enabled": True},
                {"agent_id": "bmad-agent-dev",       "skill_id": "bmad-run-tests",       "label": "Test Execution",     "enabled": True},
            ],
        },
        {
            "id": "5",
            "name": "Release & Retrospective",
            "description": "Produce API documentation, validate release readiness, and capture team retrospective",
            "steps": [
                {"agent_id": "bmad-agent-tech-writer", "skill_id": "bmad-document-project",                "label": "API Documentation",      "enabled": True},
                {"agent_id": "bmad-agent-architect",   "skill_id": "bmad-check-implementation-readiness",  "label": "Release Readiness Check", "enabled": True},
                {"agent_id": "bmad-agent-dev",         "skill_id": "bmad-retrospective",                   "label": "Sprint Retrospective",    "enabled": True},
            ],
        },
    ],
    "runs": [],
    "settings": {
        # Defaults: env vars → saved file → blank
        "anthropic_api_key": os.getenv("ANTHROPIC_API_KEY") or _saved.get("anthropic_api_key", ""),
        "default_model":     os.getenv("DEFAULT_MODEL")     or _saved.get("default_model", DEFAULT_MODEL),
        "jira_url":          os.getenv("JIRA_URL")          or _saved.get("jira_url", ""),
        "jira_email":        os.getenv("JIRA_EMAIL")        or _saved.get("jira_email", ""),
        "jira_api_token":    os.getenv("JIRA_API_TOKEN")    or _saved.get("jira_api_token", ""),
        "jira_project_key":  os.getenv("JIRA_PROJECT_KEY") or _saved.get("jira_project_key", ""),
    },
}

# ── Project context persistence ──────────────────────────────────────────────

PROJECTS_DIR = Path.home() / ".bmad" / "projects"

def save_project_results(project_id: str, workflow_name: str, results: dict):
    if not project_id:
        return
    project_dir = PROJECTS_DIR / project_id
    project_dir.mkdir(parents=True, exist_ok=True)
    results_file = project_dir / "workflow_results.json"
    existing = {}
    if results_file.exists():
        try:
            existing = json.loads(results_file.read_text())
        except Exception:
            pass
    existing[workflow_name] = {"completed_at": datetime.now().isoformat(), "results": results}
    results_file.write_text(json.dumps(existing, indent=2))
    print(f"[CTX] saved results for project={project_id} workflow='{workflow_name}'")


def load_project_context(project_id: str) -> dict:
    if not project_id:
        return {}
    results_file = PROJECTS_DIR / project_id / "workflow_results.json"
    if results_file.exists():
        try:
            return json.loads(results_file.read_text())
        except Exception:
            pass
    return {}


def _summarise_context(project_context: dict) -> str:
    """Build a compact cross-workflow context string to inject into prompts."""
    if not project_context:
        return ""
    parts = []
    for wf_name, wf_data in project_context.items():
        results = wf_data.get("results", {})
        for key, val in results.items():
            if not isinstance(val, dict):
                continue
            if val.get("epics"):
                parts.append(f"Epics & Stories (from '{wf_name}'):\n{json.dumps(val['epics'], indent=2)[:4000]}")
            elif val.get("architecture_spine"):
                parts.append(f"Architecture (from '{wf_name}'):\n{json.dumps(val['architecture_spine'], indent=2)[:2000]}")
            elif val.get("sprint_status"):
                parts.append(f"Sprint Plan (from '{wf_name}'):\n{json.dumps(val['sprint_status'], indent=2)[:2000]}")
            elif val.get("files"):
                names = [f.get("filename","") for f in val["files"]]
                parts.append(f"Generated files (from '{wf_name}'): {', '.join(names)}")
            elif val.get("test_results"):
                s = val["test_results"].get("summary", {})
                parts.append(f"Test results (from '{wf_name}'): {s.get('passed',0)} passed / {s.get('failed',0)} failed / {s.get('coverage_percent',0)}% coverage")
    return "\n\n".join(parts)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _strip_fences(text: str) -> str:
    import re
    text = text.strip()
    # Remove ```json ... ``` or ``` ... ``` fences anywhere in the text
    m = re.search(r'```(?:json)?\s*\n([\s\S]*?)```', text)
    if m:
        return m.group(1).strip()
    # If text starts with a fence line, drop the first and last lines
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    # Extract the outermost JSON object or array
    for start_char, end_char in [('{', '}'), ('[', ']')]:
        start = text.find(start_char)
        end   = text.rfind(end_char)
        if start != -1 and end != -1 and end > start:
            return text[start:end+1]
    return text.strip()


def _build_task_prompt(skill: dict, document: str, feature_desc: str, prev_results: dict, project_context: dict = None) -> str:
    prev_json = json.dumps(prev_results, indent=2)[:4000] if prev_results else "{}"

    # Detect if previous step produced stories — inject them explicitly
    stories_context = ""
    for val in prev_results.values():
        if isinstance(val, dict) and ("epics" in val or "stories" in val):
            stories_context = f"\nStories from previous step:\n{json.dumps(val, indent=2)[:3000]}"
            break

    # Cross-workflow context from previous lifecycle phases
    cross_ctx = _summarise_context(project_context)
    cross_section = f"""
════════════════════════════════════════
CONTEXT FROM PREVIOUS LIFECYCLE PHASES
════════════════════════════════════════
{cross_ctx}
""" if cross_ctx else ""

    return f"""You are executing the BMAD skill "{skill['name']}" in HEADLESS / API mode.

════════════════════════════════════════
CRITICAL OVERRIDE — READ FIRST
════════════════════════════════════════
This skill normally runs interactively inside Claude Code with access to the
local filesystem. You are running HEADLESSLY via API with NO filesystem access.

YOU MUST:
✓ Ignore ALL references to file paths, yaml files, toml files, or config files
✓ Ignore ANY step that says "read from file", "check sprint_status.yaml",
  "resolve story_file", "load customize.toml", or similar
✓ Skip ALL workflow-block / missing-configuration checks — they don't apply here
✓ Work entirely from the inputs provided below
✓ Complete the task fully and return JSON — no errors about missing files
✓ NEVER return awaiting_input, status, or required_inputs — those are for interactive
  mode only. You have all the inputs you need below. Proceed immediately with the task.
✓ If a skill asks for a feature name, use the PRD document or stories context below
✓ If a skill asks for test_scope, default to BOTH (API + E2E)
✓ If a skill asks for implementation_artifacts, derive them from the PRD and stories
{cross_section}
════════════════════════════════════════
SKILL GOAL
════════════════════════════════════════
{skill['overview']}

SKILL REFERENCE (use as guidance, ignore file-loading steps):
{skill['content'][:4000]}

════════════════════════════════════════
YOUR INPUTS
════════════════════════════════════════
PRD / BRD Document:
{document[:6000] if document else "(none provided — use feature description and stories)"}

Special instructions:
{feature_desc or "(none)"}

Pipeline results so far (within this workflow):
{prev_json}
{stories_context}

════════════════════════════════════════
OUTPUT FORMAT — return ONLY valid JSON
════════════════════════════════════════
Match the skill to the correct format below. Return ONLY the JSON object — no markdown, no explanation.

Epics & stories:
{{"epics":[{{"id":"E1","title":"...","stories":[{{"id":"S1","title":"...","description":"As a [user] I want [goal] so that [benefit]","acceptance_criteria":["Given...When...Then..."],"story_points":3}}]}}]}}

Architecture:
{{"architecture_spine":{{"overview":"...","tech_stack":{{"frontend":"...","backend":"...","database":"..."}},"components":[{{"name":"...","responsibility":"...","tech":"..."}}],"key_decisions":[{{"decision":"...","rationale":"..."}}]}}}}

Sprint plan:
{{"sprint_status":{{"sprint_number":1,"goal":"...","stories":[{{"id":"S1","title":"...","status":"todo","story_points":3,"assignee":"..."}}],"total_points":21,"velocity_target":21}}}}

BDD / Gherkin feature files:
{{"files":[{{"filename":"feature_name.feature","content":"Feature: ...\\n\\n  Scenario: ...\\n    Given ...\\n    When ...\\n    Then ..."}}]}}

Code implementation files:
{{"project_name":"kebab-name","files":[{{"filename":"src/api/controller.ts","content":"...","type":"code","story_id":"S1"}}],"implementation_summary":{{"total_files":3,"stories_implemented":["S1"],"layers":["api","service"]}}}}

Code review:
{{"parallel_review_layers":[{{"reviewer":"Blind Hunter","findings":[{{"severity":"HIGH","file":"...","line":0,"issue":"...","fix":"..."}}]}}],"overall_risk":"MEDIUM","recommended_actions":["..."]}}

Test execution results:
{{"test_results":{{"summary":{{"total":20,"passed":17,"failed":2,"skipped":1,"duration_ms":3200,"coverage_percent":82}},"suites":[{{"name":"Feature: ...","file":"....feature","scenarios":[{{"id":"S1.1","name":"...","status":"PASSED","duration_ms":120,"message":null}}]}}]}}}}

API documentation:
{{"files":[{{"filename":"docs/api-reference.md","content":"# API Reference\\n\\n...","type":"docs"}}],"summary":"..."}}

Implementation readiness:
{{"readiness_assessment":{{"overall_score":82,"status":"READY","critical_blockers":[],"categories":[{{"name":"Code Quality","score":85,"items":[{{"check":"...","status":"pass","note":"..."}}]}}],"recommendation":"..."}}}}

Retrospective:
{{"retrospective_session":{{"sprint":"Sprint 1","went_well":["..."],"to_improve":["..."],"action_items":[{{"item":"...","owner":"...","due":"..."}}],"metrics":{{"velocity":21,"quality_score":85}}}}}}

Research / analysis (default):
{{"summary":"...","findings":[{{"title":"...","detail":"..."}}],"recommendations":["..."]}}"""


async def push_to_jira(stories: list, settings: dict) -> Optional[list]:
    try:
        from jira import JIRA
        j = JIRA(server=settings["jira_url"],
                 basic_auth=(settings["jira_email"], settings["jira_api_token"]))
        created = []
        for epic in stories:
            for s in epic.get("stories", [stories]) if isinstance(stories[0], dict) and "stories" in stories[0] else [{"stories": stories}]:
                pass
        # flatten stories from epics or flat list
        flat = []
        if stories and isinstance(stories[0], dict) and "stories" in stories[0]:
            for epic in stories:
                flat.extend(epic.get("stories", []))
        else:
            flat = stories

        for s in flat:
            ac = "\n".join(f"- {a}" for a in s.get("acceptance_criteria", []))
            issue = j.create_issue(
                project=settings["jira_project_key"],
                summary=s.get("title", "Story"),
                description=f"{s.get('description','')}\n\nAcceptance Criteria:\n{ac}",
                issuetype={"name": "Story"},
            )
            created.append({"key": issue.key, "url": f"{settings['jira_url']}/browse/{issue.key}"})
        return created
    except Exception:
        return None


# ── REST ──────────────────────────────────────────────────────────────────────

@app.get("/api/agents")
def get_agents():
    return ALL_AGENTS


@app.get("/api/skills")
def get_skills():
    return [{"id": s["id"], "name": s["name"], "description": s["description"]} for s in ALL_SKILLS]


@app.get("/api/projects")
def get_projects():
    return state["projects"]


@app.post("/api/projects")
def create_project(project: dict = Body(...)):
    project["id"] = str(uuid.uuid4())
    state["projects"].append(project)
    persist_projects(state["projects"])
    return project


@app.get("/api/projects/{project_id}/context")
def get_project_context(project_id: str):
    return load_project_context(project_id)


@app.get("/api/workflows")
def get_workflows():
    return state["workflows"]


@app.post("/api/workflows")
def create_workflow(workflow: dict = Body(...)):
    workflow["id"] = str(uuid.uuid4())
    state["workflows"].append(workflow)
    return workflow


@app.put("/api/workflows/{wid}")
def update_workflow(wid: str, workflow: dict = Body(...)):
    for i, w in enumerate(state["workflows"]):
        if w["id"] == wid:
            state["workflows"][i] = {**w, **workflow, "id": wid}
            return state["workflows"][i]
    raise HTTPException(404, "Workflow not found")


@app.delete("/api/workflows/{wid}")
def delete_workflow(wid: str):
    state["workflows"] = [w for w in state["workflows"] if w["id"] != wid]
    return {"status": "deleted"}


@app.get("/api/runs")
def get_runs():
    return sorted(state["runs"], key=lambda r: r["created_at"], reverse=True)


@app.get("/api/settings")
def get_settings():
    s = dict(state["settings"])
    if s.get("jira_api_token") and not s["jira_api_token"].startswith("***"):
        s["jira_api_token"] = "***" + s["jira_api_token"][-4:]
    return s


@app.put("/api/settings")
def update_settings(settings: dict = Body(...)):
    for k, v in settings.items():
        if isinstance(v, str) and "***" not in v:
            state["settings"][k] = v
    # Persist to ~/.bmad/settings.json
    save_settings(state["settings"])
    return {"status": "updated"}


# ── Document text extraction ─────────────────────────────────────────────────

@app.post("/api/extract-text")
async def extract_text(file: UploadFile = File(...)):
    data = await file.read()
    name = (file.filename or "").lower()

    try:
        if name.endswith(".pdf"):
            import io
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(data))
            pages  = [p.extract_text() or "" for p in reader.pages]
            text   = "\n\n".join(p.strip() for p in pages if p.strip())
            if not text:
                raise ValueError("PDF has no extractable text layer (may be scanned image).")

        elif name.endswith(".docx"):
            import io
            import docx
            doc  = docx.Document(io.BytesIO(data))
            text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())

        elif name.endswith(".doc"):
            raise ValueError(".doc files are not supported — please save as .docx or .pdf.")

        else:
            # Plain text / markdown — decode directly
            text = data.decode("utf-8", errors="replace")

        return {"text": text, "chars": len(text), "filename": file.filename}

    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))


# ── WebSocket run ─────────────────────────────────────────────────────────────

@app.websocket("/ws/{run_id}")
async def ws_run(websocket: WebSocket, run_id: str):
    await websocket.accept()
    print(f"[WS] {run_id} connected")

    async def send(event: dict):
        try:
            await websocket.send_text(json.dumps(event))
        except Exception as e:
            print(f"[WS] send error: {e}")

    try:
        raw = await websocket.receive_text()
        cfg = json.loads(raw)
        print(f"[WS] received config: workflow_id={cfg.get('workflow_id')}")

        document     = cfg.get("document", "")
        feature_desc = cfg.get("feature_description", "")
        workflow_id  = cfg.get("workflow_id", "")
        project_name = cfg.get("project_name", "Project")
        project_id   = cfg.get("project_id", "") or re.sub(r'[^a-z0-9]+', '-', project_name.lower()).strip('-')

        workflow = next((w for w in state["workflows"] if w["id"] == workflow_id), None)
        if not workflow:
            workflow = state["workflows"][0] if state["workflows"] else None
        if not workflow:
            await send({"type": "error", "message": "No workflows configured."})
            return

        steps = [s for s in workflow.get("steps", []) if s.get("enabled", True)]
        print(f"[WS] running workflow '{workflow['name']}' with {len(steps)} steps")

        run = {
            "id":         run_id,
            "workflow":   workflow["name"],
            "project":    project_name,
            "created_at": datetime.utcnow().isoformat(),
            "status":     "running",
            "results":    {},
        }
        state["runs"].append(run)

        api_key = state["settings"].get("anthropic_api_key") or os.getenv("ANTHROPIC_API_KEY", "")
        print(f"[WS] api_key present: {bool(api_key)}")
        if not api_key:
            print("[WS] ERROR: no API key — aborting")
            await send({"type": "error", "message": "Anthropic API key not set. Go to ⚙️ Settings and save your key."})
            return

        client  = anthropic.AsyncAnthropic(api_key=api_key)
        model   = state["settings"].get("default_model") or DEFAULT_MODEL
        results = {}

        # Load context from previous lifecycle phases
        project_context = load_project_context(project_id)
        if project_context:
            phase_names = list(project_context.keys())
            print(f"[CTX] loaded context for project={project_id!r}: phases={phase_names}")
            await send({"type": "agent_log", "text": f"📎 Context loaded from: {', '.join(phase_names)}"})

        for idx, step in enumerate(steps):
            agent = AGENT_MAP.get(step.get("agent_id", ""), {})
            skill = SKILL_MAP.get(step.get("skill_id", ""), {})
            print(f"[WS] step {idx}: agent={step.get('agent_id')} found={bool(agent)}  skill={step.get('skill_id')} found={bool(skill)}")

            if not agent or not skill:
                await send({"type": "agent_error", "agent": step.get("agent_id", "?"), "error": f"Unknown agent '{step.get('agent_id')}' or skill '{step.get('skill_id')}' — check workflow config."})
                continue

            await send({
                "type":  "agent_start",
                "agent": agent["name"],
                "title": agent["title"],
                "icon":  agent.get("icon", "🤖"),
                "skill": skill["name"],
                "label": step.get("label", skill["name"]),
                "index": idx,
                "total": len(steps),
            })

            await send({"type": "agent_log", "text": f"{agent['name']} is running \"{skill['name']}\"..."})

            try:
                task_prompt   = _build_task_prompt(skill, document, feature_desc, results, project_context)
                system_prompt = agent.get("system_prompt", "You are a helpful assistant.")
                print(f"[WS] calling Claude (streaming) for step {idx} ({agent['name']} / {skill['name']})")

                # Stream tokens to the frontend as they arrive
                full_text = ""
                await send({"type": "stream_start", "agent": agent["name"], "skill": skill["name"]})
                async with client.messages.stream(
                    model=model,
                    max_tokens=8192,
                    system=system_prompt,
                    messages=[{"role": "user", "content": task_prompt}],
                ) as stream:
                    async for chunk in stream.text_stream:
                        full_text += chunk
                        await send({"type": "stream_chunk", "text": chunk})

                print(f"[WS] streaming complete for step {idx}, {len(full_text)} chars")
                await send({"type": "stream_end"})

                raw_text = _strip_fences(full_text)
                try:
                    data = json.loads(raw_text)
                    # Unwrap any "output" key that contains a JSON string (regardless of other keys)
                    out_val = data.get("output") if isinstance(data, dict) else None
                    print(f"[WS] output type={type(out_val).__name__}, is_str={isinstance(out_val, str)}, preview={str(out_val)[:120] if out_val else None}")
                    if isinstance(out_val, str):
                        try:
                            data = json.loads(out_val)
                            print(f"[WS] unwrap OK → keys={list(data.keys())}")
                        except json.JSONDecodeError as e:
                            print(f"[WS] unwrap failed: {e} | raw={out_val[:200]}")
                except json.JSONDecodeError:
                    data = {"output": raw_text}

                print(f"[WS] step {idx} data preview: {json.dumps(data)[:600]}")

                # Normalise QA output: flatten generated_tests into standard files array
                if isinstance(data, dict) and "generated_tests" in data:
                    gt = data["generated_tests"]
                    files = []
                    for f in gt.get("api_tests", []):
                        files.append({"filename": f.get("filename", "api_test.spec.ts"), "content": f.get("content", ""), "type": "api"})
                    for f in gt.get("e2e_tests", []) + gt.get("feature_files", []):
                        files.append({"filename": f.get("filename", "feature.feature"), "content": f.get("content", ""), "type": "e2e"})
                    data = {
                        "test_summary": data.get("test_generation", {}),
                        "files": files,
                    }

                print(f"[WS] step {idx} parsed keys: {list(data.keys()) if isinstance(data, dict) else type(data).__name__}")

                # Save output files to _bmad_output/
                bmad_out = Path(__file__).parent.parent.parent / "_bmad_output"
                proj_slug = re.sub(r'[^a-z0-9]+', '-', project_name.lower()).strip('-') or "project"

                for f in data.get("files", []):
                    fname   = f.get("filename", "")
                    content = f.get("content", "")
                    ftype   = f.get("type", "")
                    if not fname or not content:
                        continue
                    # Route to subfolder by file type
                    if ftype == "code" or fname.endswith((".ts", ".py", ".js", ".java")):
                        sub = bmad_out / proj_slug / Path(fname).parent
                        save_name = Path(fname).name
                    elif fname.endswith(".feature"):
                        sub = bmad_out / "feature_files"
                        save_name = Path(fname).name
                    else:
                        sub = bmad_out / "docs"
                        save_name = Path(fname).name
                    sub.mkdir(parents=True, exist_ok=True)
                    (sub / save_name).write_text(content)
                    print(f"[WS] saved {sub / save_name}")

                result_key = step.get("skill_id", f"step_{idx}")
                results[result_key] = data

                counts = [f"{len(v)} {k}" for k, v in data.items() if isinstance(v, list) and v]
                await send({"type": "agent_log", "text": "Done" + (f" — {', '.join(counts)}" if counts else "")})

                # Auto-push stories to JIRA
                stories = data.get("epics") or data.get("stories")
                if stories and step["skill_id"] in ("bmad-create-epics-and-stories",):
                    jira_cfg = state["settings"]
                    if all(jira_cfg.get(k) for k in ("jira_url", "jira_email", "jira_api_token", "jira_project_key")):
                        await send({"type": "agent_log", "text": "Pushing to JIRA…"})
                        links = await push_to_jira(stories, jira_cfg)
                        if links:
                            results["jira_links"] = links
                            await send({"type": "agent_log", "text": f"Created {len(links)} JIRA issues"})

                await send({"type": "agent_complete", "agent": agent["name"], "skill": skill["name"]})

            except Exception as exc:
                await send({"type": "agent_error", "agent": agent["name"], "error": str(exc)})

        run["status"]  = "completed"
        run["results"] = results

        # Persist results so next lifecycle phase can use them
        save_project_results(project_id, workflow["name"], results)

        await send({
            "type":    "workflow_complete",
            "run_id":  run_id,
            "results": results,
        })

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        await send({"type": "error", "message": str(exc)})


# ── Chat sessions ────────────────────────────────────────────────────────────

chat_sessions: Dict[str, List[dict]] = {}  # session_id → [{role, content}]


@app.websocket("/ws/chat/{session_id}")
async def ws_chat(websocket: WebSocket, session_id: str):
    await websocket.accept()

    async def send(event: dict):
        try:
            await websocket.send_text(json.dumps(event))
        except Exception:
            pass

    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)

            agent_id = msg.get("agent_id", "")
            user_text = msg.get("text", "")
            reset = msg.get("reset", False)

            if reset:
                chat_sessions[session_id] = []
                await send({"type": "reset_ok"})
                continue

            api_key = state["settings"].get("anthropic_api_key", "")
            model   = state["settings"].get("default_model", DEFAULT_MODEL)

            if not api_key:
                await send({"type": "error", "message": "No API key — add one in Settings."})
                continue

            agent = AGENT_MAP.get(agent_id)
            system_prompt = agent.get("chat_system_prompt", "") if agent else ""
            if not system_prompt:
                system_prompt = f"You are {agent['name']}, a helpful BMAD agent. Talk naturally and conversationally." if agent else "You are a helpful assistant."

            history = chat_sessions.setdefault(session_id, [])
            history.append({"role": "user", "content": user_text})

            client = anthropic.AsyncAnthropic(api_key=api_key)
            await send({"type": "stream_start"})

            full = ""
            async with client.messages.stream(
                model=model,
                max_tokens=4096,
                system=system_prompt,
                messages=history,
            ) as stream:
                async for chunk in stream.text_stream:
                    full += chunk
                    await send({"type": "stream_chunk", "text": chunk})

            history.append({"role": "assistant", "content": full})
            await send({"type": "stream_end"})

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        await send({"type": "error", "message": str(exc)})


# ── Serve built frontend ──────────────────────────────────────────────────────

FRONTEND = Path(__file__).parent.parent / "frontend" / "dist"

if FRONTEND.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        return HTMLResponse((FRONTEND / "index.html").read_text())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
