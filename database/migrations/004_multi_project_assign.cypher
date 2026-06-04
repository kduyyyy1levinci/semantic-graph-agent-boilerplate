MATCH (e1:Employee {empId: 'EMP001'})
MATCH (p2:Project {projectId: 'PRJ-LANDING'})
MERGE (e1)-[:ASSIGNED_TO]->(p2);
