import { generateCypherQuery } from "./agent/generate_cypher.js";
import { loadOntology } from "./ontology/load.js";
import { validateAction } from "./ontology/guardrails.js";
import { createDriver, runReadQuery } from "./neo4j/client.js";

async function main(): Promise<void> {
  const ontology = loadOntology();
  const driver = createDriver();
  const session = driver.session();

  try {
    const userPrompt =
      process.argv[2] || "List all skills for employee EMP001";
    const { cypher } = await generateCypherQuery(ontology, userPrompt);

    console.log(`=> Ontology-aligned Cypher:\n   ${cypher}\n`);

    if (process.env.NEO4J_EXECUTE === "true") {
      const rows = await runReadQuery(session, cypher);
      console.log("=> Neo4j result:", JSON.stringify(rows, null, 2));
    }

    console.log("--- Assignment guardrail demo (Hard project) ---");
    const mockActionData = {
      employeeSkills: ["HTML", "CSS"],
      projectSkills: ["Java", "Neo4j"],
      projectDifficulty: "Hard"
    };

    const check = validateAction(ontology, "ASSIGN_TO_PROJECT", mockActionData);
    if (!check.valid) {
      console.error(`🛑 REJECTED: ${check.reason}`);
    } else {
      console.log("✅ VALID: Proceed with Neo4j write.");
    }
  } catch (error) {
    console.error("Runtime error:", error);
    process.exitCode = 1;
  } finally {
    await session.close();
    await driver.close();
  }
}

main();
