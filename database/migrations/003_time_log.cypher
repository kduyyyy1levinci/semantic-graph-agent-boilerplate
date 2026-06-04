CREATE CONSTRAINT time_log_time_log_id IF NOT EXISTS
FOR (t:TimeLog) REQUIRE t.timeLogId IS UNIQUE;

MATCH (e1:Employee {empId: 'EMP001'})
MATCH (e2:Employee {empId: 'EMP002'})
MATCH (p1:Project {projectId: 'PRJ-2026'})
MATCH (p2:Project {projectId: 'PRJ-LANDING'})
MERGE (e1)-[:ASSIGNED_TO]->(p1)
MERGE (e2)-[:ASSIGNED_TO]->(p2);

MERGE (tl1:TimeLog {
  timeLogId: 'TL-001',
  workDate: '2026-06-01',
  hours: 4,
  note: 'Graph schema review'
})
MERGE (e1)-[:LOGGED]->(tl1)
MERGE (tl1)-[:FOR_PROJECT]->(p1);
