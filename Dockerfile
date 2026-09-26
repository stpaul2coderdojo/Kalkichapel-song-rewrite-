# Production Dockerfile for Quantum Hybrid File System on Render
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source files
COPY . .

# Build Vite client and bundle server with esbuild
RUN npm run build

# Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=10000

# Copy package manifests and production artifacts
COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Non-root security user
USER node

EXPOSE 10000

CMD ["node", "dist/server.cjs"]
