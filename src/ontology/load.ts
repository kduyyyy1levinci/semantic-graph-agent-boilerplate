import * as fs from "fs";
import * as path from "path";
import type { OntologySchema } from "./types.js";

const DEFAULT_PATH = path.join(process.cwd(), "ontology", "schema.json");

export function loadOntology(filePath: string = DEFAULT_PATH): OntologySchema {
  const resolved = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  const raw = fs.readFileSync(resolved, "utf8");
  const parsed = JSON.parse(raw) as OntologySchema;

  if (!parsed.classes || !parsed.relationships || !parsed.constraints) {
    throw new Error(`Invalid ontology at ${resolved}: missing classes, relationships, or constraints`);
  }

  return parsed;
}

export function getClassLabels(ontology: OntologySchema): string[] {
  return Object.keys(ontology.classes);
}

export function getRelationshipPredicates(ontology: OntologySchema): string[] {
  return ontology.relationships.map((r) => r.predicate);
}
