MATCH (e1:Employee {empId: 'EMP001'})
SET
  e1.email = 'an.nguyen@example.com',
  e1.title = 'Senior Developer',
  e1.status = 'Active',
  e1.bio = 'Full-stack developer focused on graph data platforms.';

MATCH (e2:Employee {empId: 'EMP002'})
SET
  e2.email = 'binh.tran@example.com',
  e2.title = 'Product Designer',
  e2.status = 'Active',
  e2.bio = 'UI/UX designer for marketing and product surfaces.';
