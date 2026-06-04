# New Project Setup

Step-by-step guide to bootstrap a new project from this ontology-first boilerplate.

**See also:** [README](../README.md) · [GUIDE](./GUIDE.md) · [VIBE-CODING](./VIBE-CODING.md) · [INCREMENTAL-SETUP](./INCREMENTAL-SETUP.md) (existing project)

---

## What you end up with

| Piece | Role |
|-------|------|
| `ontology/schema.json` | SSOT — domain rules (classes, relationships, constraints) |
| `database/graph-structure.json` | Topology only — which classes connect to which |
| Neo4j | Instance data (ABox) |
| `src/` runtime | Load ontology → AI Cypher + guardrails |
| `.cursor/rules/` | Keep Cursor Agent aligned with the ontology |

---

## Prerequisites

- Node.js 18+
- npm or yarn
- Docker Desktop (for local Neo4j)
- OpenAI API key (optional — mock mode works without it)

---

## Step 1 — Clone and install

```bash
git clone <repo-url> my-project
cd my-project
rm -rf .git && git init
npm install
cp .env.example .env
```

---

## Step 2 — Define the ontology

Replace the sample domain in `ontology/schema.json`. Every new project starts here.

### 2.1 Update metadata

```json
{
  "title": "My Shop Ontology",
  "version": "1.0.0"
}
```

### 2.2 Add classes

Classes become Neo4j node labels.

```json
"classes": {
  "Customer": {
    "description": "Registered customer",
    "properties": {
      "customerId": "Unique id (e.g. CUS001)",
      "name": "Display name",
      "email": "Contact email"
    }
  },
  "Order": {
    "description": "Purchase order",
    "properties": {
      "orderId": "Unique id (e.g. ORD001)",
      "status": "Pending, Shipped, Delivered",
      "total": "Order total amount"
    }
  },
  "Product": {
    "description": "Catalog product",
    "properties": {
      "productId": "Unique id (e.g. PRD001)",
      "name": "Product name",
      "price": "Unit price"
    }
  }
}
```

### 2.3 Add relationships

Relationships become Neo4j relationship types.

```json
"relationships": [
  {
    "source": "Customer",
    "predicate": "PLACED",
    "target": "Order",
    "description": "Customer placed an order"
  },
  {
    "source": "Order",
    "predicate": "CONTAINS",
    "target": "Product",
    "description": "Order contains a product"
  }
]
```

### 2.4 Add constraints

Constraints are enforced by `src/ontology/guardrails.ts` at runtime.

```json
"constraints": []
```

Add rules as needed. See the sample `hard-project-requires-skill` constraint in the default `schema.json` for the pattern. New `rule.type` values require a handler in `guardrails.ts` — keep business meaning in JSON.

---

## Step 3 — Update Neo4j mapping

Edit `ontology/neo4j.mapping.json` to match your schema:

```json
{
  "nodeLabels": {
    "Customer": "Customer",
    "Order": "Order",
    "Product": "Product"
  },
  "relationshipTypes": {
    "PLACED": "PLACED",
    "CONTAINS": "CONTAINS"
  },
  "propertyKeys": {
    "Customer": ["customerId", "name", "email"],
    "Order": ["orderId", "status", "total"],
    "Product": ["productId", "name", "price"]
  },
  "constraints": {
    "uniqueKeys": {
      "Customer": "customerId",
      "Order": "orderId",
      "Product": "productId"
    }
  }
}
```

---

## Step 4 — Write the seed migration

Replace `database/migrations/001_init.cypher`. Use **only** labels and relationship types declared in `schema.json`.

```cypher
CREATE CONSTRAINT customer_id IF NOT EXISTS
FOR (c:Customer) REQUIRE c.customerId IS UNIQUE;

CREATE CONSTRAINT order_id IF NOT EXISTS
FOR (o:Order) REQUIRE o.orderId IS UNIQUE;

CREATE CONSTRAINT product_id IF NOT EXISTS
FOR (p:Product) REQUIRE p.productId IS UNIQUE;

MERGE (c1:Customer {customerId: 'CUS001', name: 'Alice', email: 'alice@example.com'})
MERGE (o1:Order {orderId: 'ORD001', status: 'Pending', total: 99.99})
MERGE (p1:Product {productId: 'PRD001', name: 'Widget', price: 49.99})
MERGE (p2:Product {productId: 'PRD002', name: 'Gadget', price: 50.00})
MERGE (c1)-[:PLACED]->(o1)
MERGE (o1)-[:CONTAINS]->(p1)
MERGE (o1)-[:CONTAINS]->(p2);
```

For later changes, add new files (`002_xxx.cypher`) instead of editing old migrations on production.

---

## Step 5 — Export graph topology

```bash
npm run graph:export
```

This writes `database/graph-structure.json` from `schema.json` — classes and predicates only, no instance data.

Confirm the file contains `"id": "Customer"` style entries, not `customerId` values or person names.

---

## Step 6 — Start Neo4j and seed

```bash
npm run docker:up
```

Open http://localhost:7474 — login `neo4j` / `strong_password_here`.

Seed the graph:

```bash
docker compose -f database/docker-compose.yml exec -T neo4j \
  cypher-shell -u neo4j -p strong_password_here \
  < database/migrations/001_init.cypher
```

Verify in Neo4j Browser — **Graph** tab:

```cypher
MATCH p=()-[r]->()
RETURN p
```

Verify counts — **Table** tab:

```cypher
MATCH (n) RETURN labels(n)[0] AS type, count(*) AS count ORDER BY type
```

---

## Step 7 — Run and verify the app

Mock mode (no OpenAI key):

```bash
npm run dev
```

Query live Neo4j — set in `.env` or inline:

```env
NEO4J_EXECUTE=true
```

```bash
NEO4J_EXECUTE=true npm run dev "List products in order ORD001"
```

Expected output includes `=> Neo4j result:` with rows from the graph.

OpenAI mode — add to `.env`:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
NEO4J_EXECUTE=true
```

```bash
export $(grep -v '^#' .env | xargs) && npm run dev "Which customer placed order ORD001?"
```

---

## Step 8 — Enable vibe coding in Cursor

Create `.cursor/rules/ontology.mdc`:

```markdown
---
description: Ontology SSOT for domain and graph
globs: ontology/**,database/**,src/**
---

- Domain rules live in ontology/schema.json only.
- Neo4j labels and relationship types must match schema classes and predicates.
- Do not duplicate business constraints in TypeScript; extend schema.json constraints.
- After ontology changes: update neo4j.mapping.json, migrations, run npm run graph:export.
- graph-structure.json is topology only — no instance data.
- Instance data lives in Neo4j; query via NEO4J_EXECUTE=true npm run dev.
```

Tag these files when prompting Cursor:

| File | Use when |
|------|----------|
| `@ontology/schema.json` | Any domain change |
| `@database/graph-structure.json` | Understanding topology |
| `@database/migrations/` | Seeding or altering the graph |
| `@ontology/neo4j.mapping.json` | Syncing Neo4j mapping |

Feature workflow:

```
1. Edit ontology/schema.json
2. Update neo4j.mapping.json
3. Add migration 00x_*.cypher
4. npm run graph:export
5. Seed Neo4j and verify in Browser
6. NEO4J_EXECUTE=true npm run dev "..." to verify
7. Touch TypeScript only when adding a new constraint rule type
```

Prompt examples: [VIBE-CODING.md](./VIBE-CODING.md)

---

## Step 9 — Production build (optional)

```bash
npm run build
npm start
node dist/index.js "Your natural language question"
```

---

## Completion checklist

| # | Task | Done |
|---|------|------|
| 1 | Clone repo and `npm install` | ☐ |
| 2 | Copy `.env.example` → `.env` | ☐ |
| 3 | Write `ontology/schema.json` | ☐ |
| 4 | Update `ontology/neo4j.mapping.json` | ☐ |
| 5 | Write `database/migrations/001_init.cypher` | ☐ |
| 6 | Run `npm run graph:export` | ☐ |
| 7 | Run `npm run docker:up` and seed | ☐ |
| 8 | Verify in Neo4j Browser | ☐ |
| 9 | Run `NEO4J_EXECUTE=true npm run dev` | ☐ |
| 10 | Create `.cursor/rules/ontology.mdc` | ☐ |

---

## npm scripts

| Script | Command |
|--------|---------|
| Dev demo | `npm run dev` |
| Start Neo4j | `npm run docker:up` |
| Stop Neo4j | `npm run docker:down` |
| Neo4j logs | `npm run docker:logs` |
| Export topology | `npm run graph:export` |
| Build | `npm run build` |

---

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `OPENAI_API_KEY` | empty → mock | OpenAI API key |
| `OPENAI_MODEL` | `gpt-4o-mini` | Chat model |
| `NEO4J_URI` | `bolt://localhost:7687` | Bolt URI |
| `NEO4J_USER` | `neo4j` | Neo4j username |
| `NEO4J_PASSWORD` | `strong_password_here` | Neo4j password |
| `NEO4J_EXECUTE` | `false` | Execute generated Cypher on Neo4j |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `No records` in Neo4j | Graph not seeded — re-run Step 6 seed command |
| No graph visualization | Use `MATCH p=()-[r]->() RETURN p` and select the **Graph** tab |
| No `Neo4j result` in app output | Set `NEO4J_EXECUTE=true` |
| Cypher uses unknown labels | Check `@ontology/schema.json`; enable OpenAI for free-form questions |
| `graph-structure.json` has instance data | Re-run `npm run graph:export` — it must contain topology only |
| Docker fails to start | Open Docker Desktop, then run `npm run docker:up` again |

---

## Updating the domain later

1. Edit `ontology/schema.json` and bump `version`
2. Update `ontology/neo4j.mapping.json`
3. Add a new migration file (`002_xxx.cypher`)
4. Run `npm run graph:export`
5. Seed the new migration into Neo4j
6. Restart the app and verify

---

## Summary

```
Clone → schema.json (SSOT) → mapping + migration → graph:export
  → docker:up + seed → dev / NEO4J_EXECUTE → Cursor rules
```

**Vibe coding rule:** Business logic lives in `ontology/schema.json` only. Everything else applies from there.
