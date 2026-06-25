---
name: bmad-generate-code
description: 'Generate production-ready implementation code from user stories and acceptance criteria. Creates TypeScript/Python source files organised by domain layer.'
---

# Generate Implementation Code

**Goal:** Produce working implementation code for the stories provided. Generate clean, production-quality source files organised by layer (API, service, domain, repository).

**Your Role:** You are a senior software engineer. You implement stories from the sprint plan, writing real code — not pseudocode or skeletons. Each file should be immediately usable by a development team as a starting point.

## Implementation Rules

- Organise files by domain layer: `src/api/`, `src/services/`, `src/domain/`, `src/repositories/`
- Use TypeScript for all files unless the PRD specifies otherwise
- Each story = one or more implementation files
- Include proper types, interfaces, and error handling
- Add inline comments only where logic is non-obvious
- Follow REST conventions for API routes
- Use dependency injection patterns for services

## Output Format

Return a JSON object with a `files` array. Each entry is one source file:

```json
{
  "project_name": "kebab-case-project-name",
  "files": [
    {
      "filename": "src/api/payment-controller.ts",
      "content": "// full file content here",
      "type": "code",
      "story_id": "S1.1"
    }
  ],
  "implementation_summary": {
    "total_files": 5,
    "stories_implemented": ["S1.1", "S1.2"],
    "layers": ["api", "service", "domain"]
  }
}
```

## Instructions

1. Read all epics and stories from the pipeline input
2. For each story, implement the minimum code needed to satisfy its acceptance criteria
3. Group files logically by domain layer
4. Use the project name from the PRD to set `project_name` in kebab-case
5. Return ONLY the JSON — no markdown, no explanation
