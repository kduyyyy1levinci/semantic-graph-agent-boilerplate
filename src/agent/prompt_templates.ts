import type { OntologySchema } from "../ontology/types.js";
import { getClassLabels, getRelationshipPredicates } from "../ontology/load.js";

export function buildCypherSystemInstruction(ontology: OntologySchema): string {
  const labels = getClassLabels(ontology).join(", ");
  const predicates = getRelationshipPredicates(ontology).join(", ");

  return [
    "You are a senior data engineer specializing in Neo4j Graph Database.",
    "Your task is to convert the user's question into a single Cypher query.",
    "",
    "You MUST rely entirely on the Ontology model below for allowed Labels and Relationships:",
    JSON.stringify(ontology, null, 2),
    "",
    "STRICT RULES:",
    `1. Use only Labels (${labels}) and relationships (${predicates}).`,
    "2. Do not invent new relationship types or labels.",
    '3. Return JSON only: { "cypher": "QUERY" }. No explanation outside JSON.'
  ].join("\n");
}
