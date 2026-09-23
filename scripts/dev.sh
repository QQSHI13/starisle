#!/usr/bin/env bash
# dev: backend (:3000) + Vite dev server (:5173); both die together
cd "$(dirname "$0")/.."
bun src/server/node.ts &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT
bunx vite
