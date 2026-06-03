# Architecture & Flow

Ontology-first semantic graph agent: one rule file drives the graph, runtime AI, and (optionally) IDE behavior.

**Related:** [Usage Guide](./GUIDE.md) · [README](../README.md)

---

## Design principles

| Principle | Meaning |
|-----------|---------|
| **SSOT** | `ontology/schema.json` is the only place for domain rules |
| **Define before apply** | Edit ontology → update graph mapping → run apply layer |
| **Same vocabulary everywhere** | Labels/relationships in Neo4j match `classes` / `relationships` in JSON |
| **IDE-agnostic runtime** | Neo4j + OpenAI + guardrails work without Cursor; Cursor is an optional editor layer |

---

## Four layers

```mermaid
flowchart TB
  subgraph L1 ["Layer 1 — Law (SSOT)"]
    S[ontology/schema.json]
  end
  subgraph L2 ["Layer 2 — Physical graph"]
    M[ontology/neo4j.mapping.json]
    CY[database/migrations/*.cypher]
    N[(Neo4j)]
  end
  subgraph L3 ["Layer 3 — Runtime apply"]
    LD[src/ontology/load.ts]
    PT[src/agent/prompt_templates.ts]
    GC[src/agent/generate_cypher.ts]
    GR[src/ontology/guardrails.ts]
    NJ[src/neo4j/client.ts]
  end
  subgraph L4 ["Layer 4 — IDE (optional)"]
    CR[Cursor rules → schema.json]
  end

  S --> M
  S --> CY
  M --> N
  CY --> N
  S --> LD
  LD --> PT
  LD --> GR
  PT --> GC
  GC --> NJ
  GR -.->|blocks invalid writes| N
  NJ -->|read Cypher| N
  S -.->|guides edits| CR
```

| Layer | Responsibility | Failure mode if skipped |
|-------|----------------|-------------------------|
| 1 | Classes, relationships, constraints | Ad-hoc labels and invented edges in Neo4j/AI |
| 2 | Persist and query graph data | No real graph or schema drift |
| 3 | Load rules, generate Cypher, enforce constraints | Ontology is documentation only |
| 4 | Keep vibe-code edits aligned with SSOT | Human/Agent edits bypass rules during coding |

---

## Repository map

```
ontology/
  schema.json                 # Layer 1 — canonical ontology
  schema.template.json        # Empty starter for new projects
  neo4j.mapping.json          # Layer 2 — ontology → Neo4j
  instance.schema.json        # Optional JSON-LD instance validation
  template/ + profiles/       # Optional extended vocab (vibe-code JSON-LD)
  project/apply.template.json # Copy checklist for new repos

database/
  docker-compose.yml          # Local Neo4j
  migrations/001_init.cypher  # Constraints + seed data

src/
  ontology/load.ts            # Parse schema.json
  ontology/guardrails.ts      # Evaluate constraints
  ontology/types.ts
  agent/prompt_templates.ts   # OpenAI system prompt from ontology
  agent/generate_cypher.ts    # OpenAI or mock → { cypher }
  neo4j/client.ts             # Bolt driver + read queries
  index.ts                    # Demo orchestration
```

---

## Data model (sample domain)

From `ontology/schema.json` (Project Management):

```mermaid
erDiagram
  Employee ||--o{ Skill : HAS_SKILL
  Employee ||--o{ Project : ASSIGNED_TO
  Project ||--o{ Skill : REQUIRES_SKILL
  Employee {
    string empId
    string name
    string role
  }
  Project {
    string projectId
    string title
    string difficulty
  }
  Skill {
    string skillId
    string name
  }
```

**Constraint (business):** `ASSIGN_TO_PROJECT` to a `Hard` project requires skill overlap between employee skills and project required skills (`hard-project-requires-skill`).

---

## Ontology file shape

```json
{
  "classes": { "...": { "description", "properties" } },
  "relationships": [{ "source", "predicate", "target", "description" }],
  "constraints": [{ "id", "action", "when", "rule", "rejectMessage" }]
}
```

| Section | Neo4j | Runtime |
|---------|-------|---------|
| `classes` | Node labels | Allowed labels in AI prompt |
| `relationships` | Relationship types | Allowed predicates in AI prompt |
| `constraints` | Not stored in DB by default | `validateAction()` before writes |

---

## End-to-end flows

### Flow A — Define ontology (Step 1)

```mermaid
sequenceDiagram
  participant Dev as Developer
  participant S as schema.json
  participant M as neo4j.mapping.json
  participant CY as migrations/*.cypher

  Dev->>S: Add/edit classes, relationships, constraints
  Dev->>M: Align labels, rel types, unique keys
  Dev->>CY: MERGE nodes/edges using only declared names
  Note over S,CY: Order matters: schema first
```

### Flow B — Natural language query (read path)

```mermaid
sequenceDiagram
  participant U as User / CLI
  participant I as index.ts
  participant L as loadOntology
  participant S as schema.json
  participant AI as OpenAI / mock
  participant NJ as Neo4j

  U->>I: userPrompt (argv or default)
  I->>L: loadOntology()
  L->>S: read file
  I->>AI: system prompt = ontology JSON
  AI-->>I: { cypher }
  alt NEO4J_EXECUTE=true
    I->>NJ: session.run(cypher)
    NJ-->>I: records
  else NEO4J_EXECUTE=false
    I-->>U: print cypher only
  end
```

### Flow C — Guarded write (validation path)

```mermaid
sequenceDiagram
  participant App as Application
  participant G as guardrails.ts
  participant S as schema.json
  participant NJ as Neo4j

  App->>G: validateAction(action, data)
  G->>S: constraints for action
  alt rule fails
    G-->>App: { valid: false, reason }
  else rule passes
    G-->>App: { valid: true }
    App->>NJ: MERGE / CREATE (future)
  end
```

Current demo (`src/index.ts`) prints validation result only; it does not yet persist `ASSIGNED_TO` to Neo4j after success.

### Flow D — Cursor / vibe code (optional)

```mermaid
flowchart LR
  S[schema.json]
  CR[Cursor rules]
  Dev[Developer + Agent]
  Code[src + migrations]

  S --> CR
  CR --> Dev
  Dev --> Code
  Code -.->|must stay consistent| S
```

Cursor does **not** replace Flow B or C. It reduces drift while editing files.

---

## Neo4j mapping

`ontology/neo4j.mapping.json` documents the physical graph contract:

| Ontology | Neo4j |
|----------|--------|
| class name | `nodeLabels` → `:Label` |
| `predicate` | `relationshipTypes` → `[:TYPE]` |
| property keys | node properties |
| `uniqueKeys` | `CREATE CONSTRAINT ... REQUIRE ... IS UNIQUE` |

Seed script `001_init.cypher` implements constraints and sample ABox data aligned with the PM sample ontology.

---

## Technology choices

| Component | Choice | Role |
|-----------|--------|------|
| Ontology format | JSON (`schema.json`) | Human-readable, easy to embed in LLM prompts |
| Graph DB | Neo4j 5.x | Property graph, Cypher |
| LLM | OpenAI (`gpt-4o-mini` default) | NL → Cypher with `response_format: json_object` |
| Runtime | Node.js + TypeScript ESM | Load ontology, orchestrate demo |
| Optional | JSON-LD templates under `ontology/template/` | Reusable vocab for other projects |

---

## Deployment modes

| Mode | Layers active | Use case |
|------|---------------|----------|
| **Documentation** | 1 only | Shared domain language, no graph |
| **Graph manual** | 1 + 2 | Neo4j Browser + migrations, no agent |
| **Agent read** | 1 + 2 + 3 (query) | NL → Cypher → Neo4j |
| **Agent full** | 1 + 2 + 3 (query + write + guardrails) | Production-style (write path to be extended) |
| **Vibe code** | All + 4 | Cursor rules + SSOT while coding |

This repository ships **mode Agent read** demo plus guardrail **simulation** for writes.

---

## Extension points

1. **New domain** — Replace `classes` / `relationships` / `constraints` in `schema.json`; update mapping and migrations.
2. **New constraint types** — Add `rule.type` in JSON + handler in `guardrails.ts` (keep business meaning in JSON).
3. **Persist after guardrail** — On `valid: true`, run parameterized Cypher `MERGE` for `ASSIGNED_TO`, etc.
4. **HTTP API** — Wrap `loadOntology`, `generateCypherQuery`, `validateAction` in Express/Fastify.
5. **Cursor** — `.cursor/rules` pointing agents at `ontology/schema.json` (see [Usage Guide](./GUIDE.md)).

---

## Anti-patterns

- Duplicating business rules in TypeScript without a matching `constraints` entry in `schema.json`.
- Neo4j labels or relationship types not declared in the ontology.
- Relying only on IDE rules without runtime load of `schema.json` for production queries.
- Editing AI prompts with a static copy of the ontology instead of `loadOntology()` at runtime.

---

## Versioning & change protocol

When the domain changes:

1. Bump `version` in `schema.json` (convention).
2. Update `neo4j.mapping.json`.
3. Add a new migration file (do not silently mutate production graph semantics).
4. Restart Node process so `loadOntology()` picks up changes.
5. Re-run tests / `npm run dev` and Neo4j smoke queries.
