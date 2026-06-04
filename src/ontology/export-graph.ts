import * as fs from "fs";
import * as path from "path";
import { loadOntology } from "./load.js";

const OUTPUT_PATH = path.join(process.cwd(), "database", "graph-structure.json");

type GraphStructure = {
  exportedAt: string;
  ontologySource: string;
  ontologyTitle: string;
  ontologyVersion: string;
  nodeCount: number;
  relationshipCount: number;
  nodes: Array<{ id: string; description: string }>;
  relationships: Array<{
    source: string;
    predicate: string;
    target: string;
    description: string;
  }>;
};

function main(): void {
  const ontologyPath = path.join(process.cwd(), "ontology", "schema.json");
  const ontology = loadOntology();

  const nodes = Object.entries(ontology.classes).map(([id, def]) => ({
    id,
    description: def.description
  }));

  const relationships = ontology.relationships.map((rel) => ({
    source: rel.source,
    predicate: rel.predicate,
    target: rel.target,
    description: rel.description
  }));

  const structure: GraphStructure = {
    exportedAt: new Date().toISOString(),
    ontologySource: "ontology/schema.json",
    ontologyTitle: ontology.title,
    ontologyVersion: ontology.version,
    nodeCount: nodes.length,
    relationshipCount: relationships.length,
    nodes,
    relationships
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(structure, null, 2), "utf8");
  console.log(`=> Graph structure: ${OUTPUT_PATH}`);
  console.log(`   ${nodes.length} classes, ${relationships.length} relationships`);
  console.log(`   Source: ${ontologyPath}`);
}

main();
