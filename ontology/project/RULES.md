# Ontology workflow rules

User sends `Yêu cầu: ...` and **Follow the rules file**. Requirement is only the `Yêu cầu` line.

**Stack:** `ontology/schema.json` (SSOT) → `neo4j.mapping.json` → `database/migrations/00X.cypher` → Docker Neo4j → verify with `npm run dev`.

## Workflow

1. **schema.json** — classes, relationships, constraints; bump `version`
2. **neo4j.mapping.json** — align with schema
3. **database/migrations/00X_name.cypher** — labels and relationship types from schema only
4. Do not edit `src/` unless a new `constraint.rule.type` is required (`guardrails.ts`)

## Invariants

- Business logic only in `schema.json`
- `graph-structure.json` is topology only (run `npm run graph:export` after schema change)

## Neo4j seed (two situations)

| Situation | Command |
|-----------|---------|
| **New task** — graph already has data | `npm run db:migrate -- database/migrations/00X_from_this_task.cypher` |
| **Empty / reset DB** — run all migrations once | `npm run db:seed` |

Many `.cypher` files = history in git. Day to day you apply **only the new file**, not re-run 001…00N every time.

## Reply

1. Files changed (paths)
2. `schema.json` diff summary
3. Full migration Cypher
4. Commands:

```bash
npm run graph:export
npm run db:migrate -- database/migrations/00X_name.cypher
NEO4J_EXECUTE=true npm run dev "<verification question>"
```

Use `npm run db:seed` instead of `db:migrate` only when the user needs a fresh graph from scratch.
