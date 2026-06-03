CREATE CONSTRAINT employee_emp_id IF NOT EXISTS
FOR (e:Employee) REQUIRE e.empId IS UNIQUE;

CREATE CONSTRAINT project_project_id IF NOT EXISTS
FOR (p:Project) REQUIRE p.projectId IS UNIQUE;

CREATE CONSTRAINT skill_skill_id IF NOT EXISTS
FOR (s:Skill) REQUIRE s.skillId IS UNIQUE;

MERGE (e1:Employee {empId: 'EMP001', name: 'An Nguyen', role: 'Developer'})
MERGE (e2:Employee {empId: 'EMP002', name: 'Binh Tran', role: 'Designer'})
MERGE (p1:Project {projectId: 'PRJ-2026', title: 'Graph Platform', difficulty: 'Hard'})
MERGE (p2:Project {projectId: 'PRJ-LANDING', title: 'Marketing Site', difficulty: 'Easy'})
MERGE (s1:Skill {skillId: 'SKL-JAVA', name: 'Java'})
MERGE (s2:Skill {skillId: 'SKL-NEO4J', name: 'Neo4j'})
MERGE (s3:Skill {skillId: 'SKL-HTML', name: 'HTML'})
MERGE (s4:Skill {skillId: 'SKL-CSS', name: 'CSS'})
MERGE (e1)-[:HAS_SKILL]->(s1)
MERGE (e1)-[:HAS_SKILL]->(s2)
MERGE (e2)-[:HAS_SKILL]->(s3)
MERGE (e2)-[:HAS_SKILL]->(s4)
MERGE (p1)-[:REQUIRES_SKILL]->(s1)
MERGE (p1)-[:REQUIRES_SKILL]->(s2);
