import type { GuardrailResult, OntologyConstraint, OntologySchema } from "./types.js";

function matchesWhen(
  when: OntologyConstraint["when"],
  data: Record<string, unknown>
): boolean {
  return Object.entries(when).every(([field, condition]) => {
    return data[field] === condition.equals;
  });
}

function evaluateSkillOverlap(
  constraint: OntologyConstraint,
  data: Record<string, unknown>
): GuardrailResult {
  const employeeSkills = data[constraint.rule.employeeSkillsField];
  const projectSkills = data[constraint.rule.projectSkillsField];

  if (!Array.isArray(employeeSkills) || !Array.isArray(projectSkills)) {
    return {
      valid: false,
      reason: `Missing ${constraint.rule.employeeSkillsField} or ${constraint.rule.projectSkillsField} for constraint ${constraint.id}`,
      constraintId: constraint.id
    };
  }

  const hasOverlap = employeeSkills.some((skill) => projectSkills.includes(skill));
  if (!hasOverlap) {
    const message = constraint.rejectMessage.replace(
      "{projectSkills}",
      projectSkills.join(", ")
    );
    return { valid: false, reason: message, constraintId: constraint.id };
  }

  return { valid: true };
}

export function validateAction(
  ontology: OntologySchema,
  actionType: string,
  data: Record<string, unknown>
): GuardrailResult {
  const applicable = ontology.constraints.filter((c) => c.action === actionType);

  for (const constraint of applicable) {
    if (!matchesWhen(constraint.when, data)) {
      continue;
    }

    if (constraint.rule.type === "skillOverlap") {
      const result = evaluateSkillOverlap(constraint, data);
      if (!result.valid) {
        return result;
      }
    }
  }

  return { valid: true };
}
