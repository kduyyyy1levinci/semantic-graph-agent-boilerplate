#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
for f in database/migrations/*.cypher; do
  echo "=> $f"
  docker compose -f database/docker-compose.yml exec -T neo4j \
    cypher-shell -u neo4j -p strong_password_here < "$f"
done
echo "=> Done."
