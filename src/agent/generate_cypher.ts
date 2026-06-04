import OpenAI from "openai";
import type { OntologySchema } from "../ontology/load.js";

export type CypherGenerationResult = {
  cypher: string;
};
import { buildCypherSystemInstruction } from "./prompt_templates.js";

function mockCypherFromPrompt(userPrompt: string): CypherGenerationResult {
  const normalized = userPrompt.toLowerCase();

  if (normalized.includes("emp001") && normalized.includes("skill")) {
    return {
      cypher: "MATCH (e:Employee {empId: 'EMP001'})-[:HAS_SKILL]->(s:Skill) RETURN s.name"
    };
  }

  if (
    normalized.includes("emp001") &&
    (normalized.includes("project") || normalized.includes("assigned"))
  ) {
    return {
      cypher:
        "MATCH (e:Employee {empId: 'EMP001'})-[:ASSIGNED_TO]->(p:Project) RETURN p.projectId, p.title, p.difficulty"
    };
  }

  if (normalized.includes("assigned") || normalized.includes("assignment")) {
    return {
      cypher:
        "MATCH (e:Employee)-[:ASSIGNED_TO]->(p:Project) RETURN e.name, p.title, p.difficulty"
    };
  }

  return { cypher: "MATCH (n) RETURN labels(n) AS label, n LIMIT 5" };
}

function parseModelJson(text: string): CypherGenerationResult {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const payload = fenced ? fenced[1].trim() : trimmed;
  const parsed = JSON.parse(payload) as CypherGenerationResult;

  if (!parsed.cypher || typeof parsed.cypher !== "string") {
    throw new Error("Model response missing cypher field");
  }

  return parsed;
}

export async function generateCypherQuery(
  ontology: OntologySchema,
  userPrompt: string
): Promise<CypherGenerationResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.log(`[AI Mock] Reading ontology for: "${userPrompt}"`);
    return mockCypherFromPrompt(userPrompt);
  }

  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: buildCypherSystemInstruction(ontology) },
      { role: "user", content: userPrompt }
    ]
  });

  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error("OpenAI returned an empty response");
  }

  return parseModelJson(text);
}
