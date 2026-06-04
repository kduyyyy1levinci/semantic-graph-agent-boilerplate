#!/usr/bin/env bash
set -euo pipefail
if [ -z "${1:-}" ]; then
  echo "Usage: npm run db:migrate -- database/migrations/002_name.cypher"
  exit 1
fi
cd "$(dirname "$0")/.."
echo "=> $1"
docker compose -f database/docker-compose.yml exec -T neo4j \
  cypher-shell -u neo4j -p strong_password_here < "$1"
