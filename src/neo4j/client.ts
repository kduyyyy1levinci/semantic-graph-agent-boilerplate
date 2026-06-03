import neo4j, { type Driver, type Session } from "neo4j-driver";

export function createDriver(): Driver {
  const uri = process.env.NEO4J_URI || "bolt://localhost:7687";
  const user = process.env.NEO4J_USER || "neo4j";
  const password = process.env.NEO4J_PASSWORD || "strong_password_here";

  return neo4j.driver(uri, neo4j.auth.basic(user, password));
}

export async function runReadQuery(session: Session, cypher: string): Promise<unknown[]> {
  const result = await session.run(cypher);
  return result.records.map((record) => record.toObject());
}
