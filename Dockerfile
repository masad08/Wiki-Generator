# Use Node.js for both frontend and backend
FROM node:18-alpine as base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package.json files for both frontend and backend
COPY app/frontend/package.json app/frontend/package-lock.json* ./app/frontend/
COPY app/backend/package.json app/backend/package-lock.json* ./app/backend/

# Install dependencies for backend
WORKDIR /app/app/backend
RUN npm ci

# Install dependencies for frontend
WORKDIR /app/app/frontend
RUN npm ci

# Build the app
FROM base AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app .

# Copy the rest of the code
COPY . .

# Build the backend
WORKDIR /app/app/backend
RUN npm run build

# Build the frontend
WORKDIR /app/app/frontend
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

# Create all necessary empty directories
RUN mkdir -p created_wikis
RUN mkdir -p app/frontend/data/tables
RUN mkdir -p data/tables

# Copy built backend
COPY --from=builder /app/app/backend/dist ./app/backend/dist
COPY --from=builder /app/app/backend/package.json ./app/backend/package.json

# Copy built frontend
COPY --from=builder /app/app/frontend/.next ./app/frontend/.next
COPY --from=builder /app/app/frontend/public ./app/frontend/public
COPY --from=builder /app/app/frontend/package.json ./app/frontend/package.json

# Copy start script
COPY docker-start.sh ./
RUN chmod +x docker-start.sh

# Set the working directory to run both frontend and backend
WORKDIR /app

# Start the app
CMD ["./docker-start.sh"]

# Expose ports for frontend and backend
EXPOSE 3000 3001 