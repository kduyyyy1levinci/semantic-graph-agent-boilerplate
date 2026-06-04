# Vibe Coding với Ontology + Graph — Step by Step

Hướng dẫn thực hành từ setup đến vibe code với Cursor. Mỗi bước có **prompt mẫu** copy-paste được.

**Liên quan:** [README](../README.md) · [GUIDE](./GUIDE.md) · [ARCHITECTURE](./ARCHITECTURE.md)

---

## Nguyên tắc

| Quy tắc | Ý nghĩa |
|---------|---------|
| **SSOT** | Business logic chỉ sửa trong `ontology/schema.json` |
| **Define trước, Apply sau** | Sửa ontology → mapping → migration → code |
| **Tag ontology khi chat** | Luôn `@ontology/schema.json` khi nhờ Cursor Agent |
| **Verify bằng runtime + graph** | `yarn dev` + Neo4j Browser, không đoán |
| **Agent đọc topology graph** | `npm run graph:export` → `@database/graph-structure.json` (chỉ quan hệ, không có instance data) |

---

## Graph structure vs instance data

| File | Nội dung | Dùng khi |
|------|----------|----------|
| `ontology/schema.json` | SSOT đầy đủ (classes, rels, constraints) | Luật domain + AI + guardrails |
| `database/graph-structure.json` | **Topology only** — class nào nối class nào | Agent cần hình dung graph quan hệ |
| Neo4j (live) / `yarn dev` | **Instance data** — EMP001, An Nguyen... | Query data thật, verify assignment |

`graph-structure.json` **không chứa** empId, tên người, hay seed data. Export từ `schema.json`, không đọc Neo4j.

```bash
npm run graph:export
```

Prompt Cursor:

```
@ontology/schema.json @database/graph-structure.json

Vẽ mermaid diagram topology graph. Không dùng instance data.
```

Instance data (ai có skill gì) → `NEO4J_EXECUTE=true yarn dev "..."` hoặc Neo4j Browser.

---

## Phase 0 — Chuẩn bị (một lần)

### Step 0.1 — Cài dependencies

```bash
npm install
cp .env.example .env
```

### Step 0.2 — (Optional) Tạo Cursor rule

Tạo file `.cursor/rules/ontology.mdc`:

```markdown
---
description: Ontology SSOT — domain rules for graph and AI
globs: ontology/**,database/**,src/**
---

- Domain rules live in ontology/schema.json only.
- Neo4j labels and relationship types must match schema classes and predicates.
- Do not duplicate business constraints in TypeScript; add to schema.json constraints.
- After ontology changes, update neo4j.mapping.json and database/migrations/.
- Before implementing features, check schema.json for allowed entities and relationships.
```

**Prompt Cursor (tạo rule):**

```
Tạo file .cursor/rules/ontology.mdc với rule: domain logic chỉ sửa trong ontology/schema.json,
Neo4j labels/relationships phải khớp schema, sau khi sửa ontology phải cập nhật neo4j.mapping.json và migrations.
```

---

## Phase 1 — Chạy graph Neo4j

### Step 1.1 — Start Neo4j

```bash
npm run docker:up
```

- Browser: http://localhost:7474
- Login: `neo4j` / `strong_password_here`

### Step 1.2 — Seed graph

```bash
docker compose -f database/docker-compose.yml exec -T neo4j \
  cypher-shell -u neo4j -p strong_password_here \
  < database/migrations/001_init.cypher
```

### Step 1.3 — Verify trong Neo4j Browser

**Query thống kê (tab Table):**

```cypher
MATCH (n) RETURN labels(n)[0] AS type, count(*) AS count ORDER BY type
```

Kỳ vọng: 2 Employee, 2 Project, 4 Skill.

**Query xem graph (tab Graph):**

```cypher
MATCH p=(e:Employee)-[r]->(n)
RETURN p
```

> Query `count(*)` chỉ hiện bảng số liệu, không vẽ graph. Dùng query `RETURN p` và chọn tab **Graph**.

### Step 1.4 — Query qua app

```bash
NEO4J_EXECUTE=true yarn dev "List all skills for employee EMP001"
```

Kỳ vọng có dòng `=> Neo4j result:` với Java, Neo4j.

---

## Phase 2 — Hiểu ontology hiện tại

### Step 2.1 — Đọc SSOT

Mở `ontology/schema.json`:

| Section | Vai trò |
|---------|---------|
| `classes` | Entity types → Neo4j labels |
| `relationships` | Cạnh được phép → Neo4j rel types |
| `constraints` | Business rules → guardrails |

### Step 2.2 — Prompt hiểu domain

```
@ontology/schema.json

Giải thích domain hiện tại: có những entity nào, quan hệ nào, constraint nào?
Vẽ ER diagram bằng mermaid.
```

### Step 2.3 — Prompt map ontology → Neo4j

```
@ontology/schema.json @ontology/neo4j.mapping.json @database/migrations/001_init.cypher

Kiểm tra 3 file này có đồng bộ không? Liệt kê chỗ lệch nếu có.
```

---

## Phase 3 — Sửa ontology (Define)

Mỗi feature mới: **sửa schema.json trước**, chưa code TypeScript.

### Step 3.1 — Thêm class mới

**Prompt:**

```
@ontology/schema.json

Thêm class Department với properties:
- deptId: mã phòng ban
- name: tên phòng ban

Chỉ sửa schema.json, chưa sửa file khác.
```

### Step 3.2 — Thêm relationship

**Prompt:**

```
@ontology/schema.json

Thêm relationship Employee BELONGS_TO Department.
Chỉ sửa schema.json.
```

### Step 3.3 — Thêm constraint

**Prompt:**

```
@ontology/schema.json

Thêm constraint: Employee chỉ ASSIGNED_TO Project Hard nếu có ít nhất 1 skill overlap
(dùng rule type skillOverlap giống constraint hard-project-requires-skill hiện có).
Chỉ sửa schema.json.
```

### Step 3.4 — Checklist sau khi sửa ontology

**Prompt:**

```
@ontology/schema.json

Tôi vừa sửa ontology. Liệt kê các file khác cần cập nhật theo thứ tự ưu tiên.
```

Kỳ vọng Agent trả lời:

1. `ontology/neo4j.mapping.json`
2. `database/migrations/00x_*.cypher`
3. `yarn dev` verify
4. Neo4j seed + query

---

## Phase 4 — Apply ontology (Mapping + Migration)

### Step 4.1 — Cập nhật Neo4j mapping

**Prompt:**

```
@ontology/schema.json @ontology/neo4j.mapping.json

Cập nhật neo4j.mapping.json cho khớp schema.json (nodeLabels, relationshipTypes, propertyKeys, uniqueKeys).
```

### Step 4.2 — Tạo migration mới

**Prompt:**

```
@ontology/schema.json @database/migrations/001_init.cypher

Tạo file database/migrations/002_department.cypher:
- Constraint unique deptId cho Department
- MERGE dept Engineering
- MERGE Employee EMP001 BELONGS_TO dept Engineering

Chỉ dùng labels và relationship types đã khai báo trong schema.json.
```

### Step 4.3 — Chạy migration

```bash
docker compose -f database/docker-compose.yml exec -T neo4j \
  cypher-shell -u neo4j -p strong_password_here \
  < database/migrations/002_department.cypher
```

### Step 4.4 — Verify graph

**Neo4j Browser:**

```cypher
MATCH p=(d:Department)<-[:BELONGS_TO]-(e:Employee)
RETURN p
```

**Terminal:**

```bash
NEO4J_EXECUTE=true yarn dev "Which department does employee EMP001 belong to?"
```

---

## Phase 5 — Vibe code hàng ngày

### Workflow chuẩn

```
1. Mô tả feature / thay đổi domain
2. Sửa ontology/schema.json  (prompt Step 3.x)
3. Cập nhật mapping + migration  (prompt Step 4.x)
4. Seed + verify graph
5. (Optional) Implement code TypeScript nếu cần rule type mới
6. yarn dev verify
```

### Step 5.1 — Feature mới từ đầu

**Prompt:**

```
@ontology/schema.json

Tôi muốn thêm tính năng Task:
- class Task (taskId, title, status: Todo/InProgress/Done)
- Employee ASSIGNED_TO Task
- Task thuộc Project qua PART_OF

Bước 1: chỉ cập nhật schema.json. Chưa viết code hay migration.
```

Sau khi schema xong:

```
@ontology/schema.json @ontology/neo4j.mapping.json @database/migrations/

Bước 2: cập nhật mapping và tạo migration 003_task.cypher với 2 task sample gắn PRJ-2026.
```

### Step 5.2 — Implement sau khi ontology đã xong

**Prompt:**

```
@ontology/schema.json @src/ontology/guardrails.ts

Constraint mới cần rule type "employeeMustBelongToDepartment" trước khi ASSIGN_TO_PROJECT.
Thêm handler trong guardrails.ts nhưng giữ ý nghĩa business trong schema.json constraints.
```

### Step 5.3 — Review code Agent vừa viết

**Prompt:**

```
@ontology/schema.json @database/migrations/003_task.cypher

Review migration này: có label hoặc relationship type nào không có trong schema.json không?
```

### Step 5.4 — Debug query sai ontology

**Prompt:**

```
@ontology/schema.json

Query này có vi phạm ontology không? Sửa cho đúng.
MATCH (e:Staff)-[:KNOWS]->(s:Skill) RETURN e, s
```

### Step 5.5 — Test guardrail

Sửa tạm `mockActionData` trong `src/index.ts`, rồi:

```bash
yarn dev
```

**Prompt giải thích kết quả:**

```
@ontology/schema.json @src/index.ts @src/ontology/guardrails.ts

Giải thích tại sao guardrail demo REJECTED hoặc VALID với mockActionData hiện tại.
```

---

## Phase 6 — Query graph bằng ngôn ngữ tự nhiên

### Step 6.1 — Mock mode (không cần OpenAI)

```bash
yarn dev "List all skills for employee EMP001"
yarn dev "List employees assigned to projects"
```

Mock chỉ match vài pattern (`emp001`+`skill`, `assigned`). Câu khác trả query generic.

### Step 6.2 — OpenAI mode

Thêm vào `.env`:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
NEO4J_EXECUTE=true
```

```bash
export $(grep -v '^#' .env | xargs) && yarn dev "Which skills does project PRJ-2026 require?"
```

**Prompt tinh chỉnh Cypher:**

```
@ontology/schema.json

User hỏi: "Ai đủ skill để làm project Hard?"
Viết Cypher chỉ dùng labels và relationships trong schema.json.
```

---

## Phase 7 — Copy sang project mới

### Step 7.1 — Prompt setup project mới

```
@ontology/project/apply.template.json

Hướng dẫn copy boilerplate ontology sang project [TÊN PROJECT] domain [MÔ TẢ DOMAIN].
Liệt kê file cần copy và thứ tự điền schema.json.
```

### Step 7.2 — Prompt viết ontology domain mới

```
@ontology/schema.template.json

Domain: [MÔ TẢ, ví dụ e-commerce với Product, Order, Customer].
Điền classes, relationships, constraints vào schema.json.
Constraints: Order phải có ít nhất 1 Product; Customer PLACED Order.
```

---

## Prompt nhanh — Cheat sheet

| Mục đích | Prompt |
|----------|--------|
| Hiểu domain | `@ontology/schema.json` Giải thích entity, rel, constraint |
| Thêm entity | `@ontology/schema.json` Thêm class X với properties... Chỉ sửa schema |
| Thêm rel | `@ontology/schema.json` Thêm relationship A PREDICATE B |
| Sync mapping | `@ontology/schema.json @ontology/neo4j.mapping.json` Cập nhật mapping |
| Tạo migration | `@ontology/schema.json` Tạo migration 00x, chỉ dùng labels đã khai báo |
| Review drift | `@ontology/schema.json @database/` Kiểm tra migration khớp schema |
| Review Cypher | `@ontology/schema.json` Query này có hợp ontology không? |
| Thêm constraint | `@ontology/schema.json` Thêm constraint action WHEN rule... |
| Implement handler | `@ontology/schema.json @src/ontology/guardrails.ts` Rule type mới, logic trong JSON |

---

## Troubleshooting

| Triệu chứng | Nguyên nhân | Cách xử lý |
|-------------|-------------|------------|
| `No records` khi count nodes | Graph chưa seed | Chạy lại Step 1.2 |
| Không thấy hình graph | Query trả aggregate/table | Dùng `MATCH p=()-[r]->() RETURN p`, tab Graph |
| Không có `Neo4j result` | Thiếu `NEO4J_EXECUTE=true` | Export env hoặc prefix lệnh |
| Cypher dùng label lạ | AI/mock drift | Kiểm tra `@ontology/schema.json`, bật OpenAI |
| Guardrail luôn REJECTED | mockActionData cố định trong index.ts | Sửa data test hoặc hiểu đây là demo |
| Assignment query rỗng | Chưa có ASSIGNED_TO edge | MERGE assignment trong Browser hoặc migration |

**Prompt debug:**

```
@ontology/schema.json @src/index.ts @database/migrations/

[T mô tả lỗi]. Kiểm tra ontology, migration và runtime có đồng bộ không.
```

---

## Tóm tắt lộ trình 30 phút

| Phút | Việc | Prompt / Lệnh |
|------|------|---------------|
| 0–5 | Setup + docker | `npm run docker:up` + seed |
| 5–10 | Xem graph | Browser: `MATCH p=(e:Employee)-[r]->(n) RETURN p` |
| 10–15 | Query app | `NEO4J_EXECUTE=true yarn dev "..."` |
| 15–20 | Hiểu ontology | `@ontology/schema.json` Giải thích domain |
| 20–30 | Thêm Department | Prompt Step 3.1 → 4.2 → verify |

---

**Workflow một dòng:** Sửa `schema.json` → mapping → migration → seed → `yarn dev` → Cursor luôn tag `@ontology/schema.json`.
