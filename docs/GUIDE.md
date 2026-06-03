# Usage Guide

Step-by-step instructions to run and extend the ontology-first semantic graph agent.

**Related:** [Architecture & Flow](./ARCHITECTURE.md) · [README](../README.md)

---

## Prerequisites

- **Node.js** 18+
- **npm**
- **Docker** (optional, for local Neo4j)
- **OpenAI API key** (optional; mock Cypher works without it)

---

## Quick start (5 minutes)

### 1. Install

```bash
git clone <your-repo-url>
cd ontology
npm install
cp .env.example .env
```

### 2. Run demo (no Neo4j, no OpenAI)

```bash
npm run dev
```

Expected:

- Ontology-aligned Cypher for employee EMP001 skills
- Guardrail **REJECTED** for Hard project assignment without matching skills

### 3. Custom question

```bash
npm run dev "List employees assigned to projects"
```

---

## Environment variables

Edit `.env`:

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `OPENAI_API_KEY` | No | empty → mock | Live Cypher via OpenAI |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | Chat model |
| `NEO4J_URI` | No | `bolt://localhost:7687` | Bolt connection |
| `NEO4J_USER` | No | `neo4j` | Neo4j username |
| `NEO4J_PASSWORD` | No | `strong_password_here` | Must match Docker auth |
| `NEO4J_EXECUTE` | No | `false` | Run generated Cypher on Neo4j |

---

## Step 1 — Define or change the ontology

**File:** `ontology/schema.json`

### Add a class

```json
"Ticket": {
  "description": "Support ticket",
  "properties": {
    "ticketId": "Unique id",
    "title": "Short title"
  }
}
```

### Add a relationship

```json
{
  "source": "Employee",
  "predicate": "OWNS_TICKET",
  "target": "Ticket",
  "description": "Employee owns a ticket"
}
```

### Add a constraint

Use existing `skillOverlap` pattern or extend `src/ontology/guardrails.ts` for new `rule.type` values. Keep the **meaning** of the rule in `schema.json`.

### Checklist after editing schema

- [ ] Update `ontology/neo4j.mapping.json` (`nodeLabels`, `relationshipTypes`, `propertyKeys`, `uniqueKeys`)
- [ ] Add Cypher in `database/migrations/` (new file recommended)
- [ ] Run `npm run dev` to verify prompts and guardrails
- [ ] If using Neo4j, run migration and test in Browser

---

## Step 2 — Neo4j local setup

### Start database

```bash
cd database
docker compose up -d
```

- **Browser UI:** http://localhost:7474  
- **Bolt:** `bolt://localhost:7687`  
- **Auth:** `neo4j` / `strong_password_here` (see `database/docker-compose.yml`)

### Seed the graph

1. Open Neo4j Browser  
2. Copy the full contents of `database/migrations/001_init.cypher`  
3. Execute  

Verify:

```cypher
MATCH (e:Employee {empId: 'EMP001'})-[:HAS_SKILL]->(s:Skill)
RETURN e.name, collect(s.name) AS skills
```

### Run app against Neo4j

In `.env`:

```env
NEO4J_EXECUTE=true
```

```bash
npm run dev "List all skills for employee EMP001"
```

You should see JSON rows from Neo4j after the Cypher line.

### Stop Neo4j

```bash
cd database
docker compose down
```

Data persists in Docker volume `neo4j_data` unless you remove volumes.

---

## Step 3 — OpenAI (live Cypher)

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

```bash
npm run dev "Which skills does project PRJ-2026 require?"
```

The model receives the full ontology in the system prompt and must return JSON: `{ "cypher": "..." }`.

If the key is missing, `[AI Mock]` handles a few keyword patterns only.

---

## Step 4 — Production build

```bash
npm run build
npm start
```

Pass a prompt:

```bash
node dist/index.js "MATCH path preview for EMP001 skills"
```

---

## Using with Cursor (or another IDE)

Cursor **does not replace** the runtime in `src/`. It helps you edit files consistently.

### Recommended workflow

1. Open this repo in Cursor  
2. Edit `ontology/schema.json` (or ask Agent with `@ontology/schema.json`)  
3. Update mapping + migrations  
4. Terminal in Cursor: `npm run dev`  
5. Optional: Neo4j Browser for visual inspection  

### Optional Cursor rule

Create `.cursor/rules/ontology.mdc` (or project rules):

```markdown
---
description: Ontology SSOT for graph and domain logic
globs: ontology/**,database/**,src/**
---

- Domain rules live in ontology/schema.json only.
- Neo4j labels and relationship types must match schema.json classes and predicates.
- Do not duplicate business constraints in TypeScript; extend schema.json constraints.
- After ontology changes, update ontology/neo4j.mapping.json and database/migrations/.
```

| What Cursor rules do | What they do not do |
|----------------------|---------------------|
| Guide Agent while coding | Execute Cypher on Neo4j |
| Reduce label/rel drift | Enforce guardrails at runtime |
| Point edits at SSOT | Replace `loadOntology()` in Node |

---

## Copy to a new project

See `ontology/project/apply.template.json`.

1. Copy listed folders/files into the target repo  
2. Rename `ontology/schema.template.json` → `ontology/schema.json`  
3. Fill domain classes, relationships, constraints  
4. Align `neo4j.mapping.json` and migrations  
5. `npm install` && configure `.env`  

---

## Common tasks

### Task: Assign employee to project (manual, after guardrail)

Guardrail check (conceptual data):

```typescript
validateAction(ontology, "ASSIGN_TO_PROJECT", {
  employeeSkills: ["Java", "Neo4j"],
  projectSkills: ["Java", "Neo4j"],
  projectDifficulty: "Hard"
});
```

If valid, in Neo4j Browser:

```cypher
MATCH (e:Employee {empId: 'EMP001'})
MATCH (p:Project {projectId: 'PRJ-2026'})
MERGE (e)-[:ASSIGNED_TO]->(p)
```

### Task: Query required skills for a Hard project

```bash
npm run dev "What skills does project PRJ-2026 require?"
```

Or in Browser:

```cypher
MATCH (p:Project {projectId: 'PRJ-2026'})-[:REQUIRES_SKILL]->(s:Skill)
RETURN s.name
```

### Task: Add a new constraint for another action

1. Add entry under `constraints` in `schema.json` with unique `id` and `action`  
2. Implement evaluation in `src/ontology/guardrails.ts` if `rule.type` is new  
3. Call `validateAction(ontology, "YOUR_ACTION", data)` before writes  

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `Connection refused` on Neo4j | Docker not running | `docker compose up -d` in `database/` |
| Auth failed | Password mismatch | Align `.env` with `NEO4J_AUTH` in compose |
| Empty Neo4j result | Seed not run | Execute `001_init.cypher` |
| Mock always used | No API key | Set `OPENAI_API_KEY` |
| Invalid JSON from OpenAI | Model ignored format | Retry or use `gpt-4o-mini` + json_object mode |
| Guardrail always rejects | Skills arrays don't overlap | Pass skill **names** or **ids** consistently in `data` |
| Unknown labels in Cypher | Ontology / AI drift | Regenerate after fixing `schema.json`; restrict prompt |

---

## File cheat sheet

| I want to… | Edit / run |
|------------|------------|
| Change domain rules | `ontology/schema.json` |
| Change graph shape in DB | `database/migrations/*.cypher` |
| Change Neo4j label mapping | `ontology/neo4j.mapping.json` |
| Change AI instructions | `src/agent/prompt_templates.ts` (loader still uses live JSON) |
| Change validation logic | `src/ontology/guardrails.ts` + `constraints` in JSON |
| Change connection | `.env`, `src/neo4j/client.ts` |
| Run demo | `npm run dev` |

---

## Recommended order of work

```text
1. ontology/schema.json     ← SSOT
2. ontology/neo4j.mapping.json
3. database/migrations/*.cypher
4. docker compose up + run migration
5. .env (OPENAI_*, NEO4J_*)
6. npm run dev
7. (optional) Cursor rules
```

For architecture rationale, see [ARCHITECTURE.md](./ARCHITECTURE.md).
