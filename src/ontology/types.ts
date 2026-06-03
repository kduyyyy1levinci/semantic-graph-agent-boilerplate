export type OntologyClassDef = {
  description: string;
  properties: Record<string, string>;
};

export type OntologyRelationship = {
  source: string;
  predicate: string;
  target: string;
  description: string;
};

export type SkillOverlapRule = {
  type: "skillOverlap";
  employeeSkillsField: string;
  projectSkillsField: string;
};

export type ConstraintWhen = Record<string, { equals: string }>;

export type OntologyConstraint = {
  id: string;
  description: string;
  action: string;
  when: ConstraintWhen;
  rule: SkillOverlapRule;
  rejectMessage: string;
};

export type OntologySchema = {
  $schema?: string;
  title: string;
  version: string;
  classes: Record<string, OntologyClassDef>;
  relationships: OntologyRelationship[];
  constraints: OntologyConstraint[];
};

export type GuardrailResult = {
  valid: boolean;
  reason?: string;
  constraintId?: string;
};

export type CypherGenerationResult = {
  cypher: string;
};
