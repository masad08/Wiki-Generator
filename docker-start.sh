#!/bin/sh

# Start the backend
cd /app/app/backend && node dist/index.js &

# Start the frontend
cd /app/app/frontend && npx next start

# Keep the container running
wait 