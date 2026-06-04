import express from "express";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, "db.json");
const COLLECTIONS = [
  "employees",
  "projects",
  "skills",
  "employeeSkills",
  "projectSkills",
  "assignments",
  "timeLogs"
];

async function readDb() {
  const raw = await readFile(DB_PATH, "utf8");
  return JSON.parse(raw);
}

async function writeDb(db) {
  await writeFile(DB_PATH, `${JSON.stringify(db, null, 2)}\n`, "utf8");
}

function nextId(items) {
  if (items.length === 0) return 1;
  return Math.max(...items.map((item) => Number(item.id) || 0)) + 1;
}

function nextTimeLogId(items) {
  const prefix = "TL-";
  const numbers = items
    .map((item) => String(item.timeLogId ?? ""))
    .filter((id) => id.startsWith(prefix))
    .map((id) => Number(id.slice(prefix.length)))
    .filter((n) => Number.isFinite(n));
  const next = numbers.length === 0 ? 1 : Math.max(...numbers) + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

function employeeSkillIds(db, employeeId) {
  return (db.employeeSkills ?? [])
    .filter((row) => row.employeeId === employeeId)
    .map((row) => row.skillId);
}

function projectRequiredSkillIds(db, projectId) {
  return (db.projectSkills ?? [])
    .filter((row) => row.projectId === projectId)
    .map((row) => row.skillId);
}

function hasAssignment(db, employeeId, projectId) {
  return (db.assignments ?? []).some(
    (row) => Number(row.employeeId) === employeeId && Number(row.projectId) === projectId
  );
}

function validateAssignToProject(db, employeeId, projectId) {
  const employee = (db.employees ?? []).find((row) => row.id === employeeId);
  if (!employee) {
    return { valid: false, status: 404, reason: "Employee not found" };
  }

  const project = (db.projects ?? []).find((row) => row.id === projectId);
  if (!project) {
    return { valid: false, status: 404, reason: "Project not found" };
  }

  if (hasAssignment(db, employeeId, projectId)) {
    return {
      valid: false,
      status: 422,
      reason: "Ontology constraint violated: Employee is already assigned to this project.",
      constraintId: "assign-unique-project"
    };
  }

  if (project.difficulty === "Hard") {
    const empSkills = new Set(employeeSkillIds(db, employeeId));
    const required = projectRequiredSkillIds(db, projectId);
    const overlap = required.some((skillId) => empSkills.has(skillId));
    if (!overlap) {
      const names = required
        .map((skillId) => (db.skills ?? []).find((s) => s.id === skillId)?.name)
        .filter(Boolean);
      return {
        valid: false,
        status: 422,
        reason: `Ontology constraint violated: This project is Hard; the employee lacks required skills (${names.join(", ")}) and cannot be assigned.`,
        constraintId: "hard-project-requires-skill"
      };
    }
  }

  return { valid: true };
}

function validateViewProject(db, employeeId, projectId) {
  if (!hasAssignment(db, employeeId, projectId)) {
    return {
      valid: false,
      reason:
        "Ontology constraint violated: Employee is not assigned to this project and cannot view it.",
      constraintId: "view-projects-requires-assignment"
    };
  }
  return { valid: true };
}

async function createAssignment(db, employeeId, projectId) {
  const check = validateAssignToProject(db, employeeId, projectId);
  if (!check.valid) {
    return {
      status: check.status,
      body: {
        error: check.reason,
        ...(check.constraintId ? { constraintId: check.constraintId } : {})
      }
    };
  }

  const items = db.assignments ?? [];
  const item = { id: nextId(items), employeeId, projectId };
  items.push(item);
  db.assignments = items;
  await writeDb(db);
  return { status: 201, body: item };
}

function projectsForEmployee(db, employeeId) {
  const projectIds = new Set(
    (db.assignments ?? [])
      .filter((row) => Number(row.employeeId) === employeeId)
      .map((row) => Number(row.projectId))
  );
  return (db.projects ?? []).filter((row) => projectIds.has(row.id));
}

function validateLogTime(db, employeeId, projectId, hours) {
  const numeric = Number(hours);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return {
      valid: false,
      reason: "Ontology constraint violated: hours must be greater than zero.",
      constraintId: "log-time-positive-hours"
    };
  }

  const assigned = hasAssignment(db, employeeId, projectId);
  if (!assigned) {
    return {
      valid: false,
      reason:
        "Ontology constraint violated: Employee is not assigned to this project and cannot log time.",
      constraintId: "log-time-requires-assignment"
    };
  }

  return { valid: true };
}

async function createTimeLogEntry(db, { employeeId, projectId, workDate, hours, note }) {
  const employee = (db.employees ?? []).find((row) => row.id === employeeId);
  if (!employee) {
    return { status: 404, body: { error: "Employee not found" } };
  }

  const project = (db.projects ?? []).find((row) => row.id === projectId);
  if (!project) {
    return { status: 404, body: { error: "Project not found" } };
  }

  const check = validateLogTime(db, employeeId, projectId, hours);
  if (!check.valid) {
    return { status: 422, body: { error: check.reason, constraintId: check.constraintId } };
  }

  if (!workDate || typeof workDate !== "string") {
    return { status: 400, body: { error: "workDate is required (YYYY-MM-DD)" } };
  }

  const items = db.timeLogs ?? [];
  const item = {
    id: nextId(items),
    timeLogId: nextTimeLogId(items),
    employeeId,
    projectId,
    workDate,
    hours: Number(hours),
    note: note ?? ""
  };
  items.push(item);
  db.timeLogs = items;
  await writeDb(db);
  return { status: 201, body: item };
}

function createCollectionRouter(collectionName) {
  const router = express.Router();

  router.get("/", async (_req, res, next) => {
    try {
      const db = await readDb();
      res.json(db[collectionName] ?? []);
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const db = await readDb();
      const items = db[collectionName] ?? [];
      const item = items.find((row) => String(row.id) === req.params.id);
      if (!item) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.json(item);
    } catch (err) {
      next(err);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      const db = await readDb();
      const body = req.body;
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        res.status(400).json({ error: "Invalid body" });
        return;
      }

      if (collectionName === "timeLogs") {
        const result = await createTimeLogEntry(db, {
          employeeId: Number(body.employeeId),
          projectId: Number(body.projectId),
          workDate: body.workDate,
          hours: body.hours,
          note: body.note
        });
        res.status(result.status).json(result.body);
        return;
      }

      const items = db[collectionName] ?? [];
      const item = { ...body, id: body.id ?? nextId(items) };
      items.push(item);
      db[collectionName] = items;
      await writeDb(db);
      res.status(201).json(item);
    } catch (err) {
      next(err);
    }
  });

  router.put("/:id", async (req, res, next) => {
    try {
      const db = await readDb();
      const items = db[collectionName] ?? [];
      const index = items.findIndex((row) => String(row.id) === req.params.id);
      if (index === -1) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const body = req.body;
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        res.status(400).json({ error: "Invalid body" });
        return;
      }
      const item = { ...body, id: Number(req.params.id) };
      items[index] = item;
      db[collectionName] = items;
      await writeDb(db);
      res.json(item);
    } catch (err) {
      next(err);
    }
  });

  router.patch("/:id", async (req, res, next) => {
    try {
      const db = await readDb();
      const items = db[collectionName] ?? [];
      const index = items.findIndex((row) => String(row.id) === req.params.id);
      if (index === -1) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const body = req.body;
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        res.status(400).json({ error: "Invalid body" });
        return;
      }
      const item = { ...items[index], ...body, id: items[index].id };
      items[index] = item;
      db[collectionName] = items;
      await writeDb(db);
      res.json(item);
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:id", async (req, res, next) => {
    try {
      const db = await readDb();
      const items = db[collectionName] ?? [];
      const index = items.findIndex((row) => String(row.id) === req.params.id);
      if (index === -1) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const [removed] = items.splice(index, 1);
      db[collectionName] = items;
      await writeDb(db);
      res.json(removed);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

const app = express();
const port = Number(process.env.EXAMPLE_API_PORT) || 3000;

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/employees/:id/projects", async (req, res, next) => {
  try {
    const db = await readDb();
    const employeeId = Number(req.params.id);
    const employee = (db.employees ?? []).find((row) => row.id === employeeId);
    if (!employee) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }
    res.json(projectsForEmployee(db, employeeId));
  } catch (err) {
    next(err);
  }
});

app.get("/employees/:id/projects/:projectId", async (req, res, next) => {
  try {
    const db = await readDb();
    const employeeId = Number(req.params.id);
    const projectId = Number(req.params.projectId);
    const employee = (db.employees ?? []).find((row) => row.id === employeeId);
    if (!employee) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }
    const project = (db.projects ?? []).find((row) => row.id === projectId);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const check = validateViewProject(db, employeeId, projectId);
    if (!check.valid) {
      res.status(403).json({ error: check.reason, constraintId: check.constraintId });
      return;
    }
    res.json(project);
  } catch (err) {
    next(err);
  }
});

app.post("/employees/:id/assignments", async (req, res, next) => {
  try {
    const db = await readDb();
    const employeeId = Number(req.params.id);
    const projectId = Number(req.body?.projectId);
    if (!Number.isFinite(projectId)) {
      res.status(400).json({ error: "projectId is required" });
      return;
    }
    const result = await createAssignment(db, employeeId, projectId);
    res.status(result.status).json(result.body);
  } catch (err) {
    next(err);
  }
});

app.delete("/employees/:id/assignments/:projectId", async (req, res, next) => {
  try {
    const db = await readDb();
    const employeeId = Number(req.params.id);
    const projectId = Number(req.params.projectId);
    const items = db.assignments ?? [];
    const index = items.findIndex(
      (row) => row.employeeId === employeeId && row.projectId === projectId
    );
    if (index === -1) {
      res.status(404).json({ error: "Assignment not found" });
      return;
    }
    const [removed] = items.splice(index, 1);
    db.assignments = items;
    await writeDb(db);
    res.json(removed);
  } catch (err) {
    next(err);
  }
});

app.get("/employees/:id/logtime", async (req, res, next) => {
  try {
    const db = await readDb();
    const employeeId = Number(req.params.id);
    const employee = (db.employees ?? []).find((row) => row.id === employeeId);
    if (!employee) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }
    const logs = (db.timeLogs ?? []).filter((row) => row.employeeId === employeeId);
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

app.post("/employees/:id/logtime", async (req, res, next) => {
  try {
    const db = await readDb();
    const employeeId = Number(req.params.id);
    const { projectId, workDate, hours, note } = req.body ?? {};
    const result = await createTimeLogEntry(db, {
      employeeId,
      projectId: Number(projectId),
      workDate,
      hours,
      note
    });
    res.status(result.status).json(result.body);
  } catch (err) {
    next(err);
  }
});

app.get("/projects/:id/logtime", async (req, res, next) => {
  try {
    const db = await readDb();
    const projectId = Number(req.params.id);
    const project = (db.projects ?? []).find((row) => row.id === projectId);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const logs = (db.timeLogs ?? []).filter((row) => row.projectId === projectId);
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

app.get("/projects", async (req, res, next) => {
  try {
    const db = await readDb();
    const rawEmployeeId = req.query.employeeId;
    if (rawEmployeeId === undefined || rawEmployeeId === "") {
      res.json(db.projects ?? []);
      return;
    }
    const employeeId = Number(rawEmployeeId);
    const employee = (db.employees ?? []).find((row) => row.id === employeeId);
    if (!employee) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }
    res.json(projectsForEmployee(db, employeeId));
  } catch (err) {
    next(err);
  }
});

app.get("/projects/:id", async (req, res, next) => {
  try {
    const db = await readDb();
    const projectId = Number(req.params.id);
    const project = (db.projects ?? []).find((row) => row.id === projectId);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const rawEmployeeId = req.query.employeeId;
    if (rawEmployeeId === undefined || rawEmployeeId === "") {
      res.json(project);
      return;
    }
    const employeeId = Number(rawEmployeeId);
    const employee = (db.employees ?? []).find((row) => row.id === employeeId);
    if (!employee) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }
    const check = validateViewProject(db, employeeId, projectId);
    if (!check.valid) {
      res.status(403).json({ error: check.reason, constraintId: check.constraintId });
      return;
    }
    res.json(project);
  } catch (err) {
    next(err);
  }
});

for (const name of COLLECTIONS) {
  if (name === "projects") continue;
  app.use(`/${name}`, createCollectionRouter(name));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(port, () => {
  console.log(`Example API http://localhost:${port}`);
  console.log(`Collections: ${COLLECTIONS.map((c) => `/${c}`).join(", ")}`);
  console.log("Projects (employee): GET /employees/:id/projects");
  console.log("Assign: POST /employees/:id/assignments  { projectId }");
  console.log("Projects (scoped): GET /projects?employeeId=:id  GET /projects/:id?employeeId=:id");
  console.log("Log time: POST /employees/:id/logtime  { projectId, workDate, hours, note? }");
});
