# Seasonality SaaS Backend Dockerfile
# Multi-stage build for optimized production image

# =====================================================
# Stage 1: Dependencies
# =====================================================
FROM node:20-alpine AS deps

WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache libc6-compat

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (need devDependencies for prisma)
RUN npm ci

# Generate Prisma client (needs a dummy DATABASE_URL for generation)
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

# Remove devDependencies after prisma generate
RUN npm prune --production

# =====================================================
# Stage 2: Production
# =====================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 expressjs

# Set environment
ENV NODE_ENV=production
ENV PORT=3001

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma

# Copy application code
COPY --chown=expressjs:nodejs . .

# Create logs directory
RUN mkdir -p logs && chown expressjs:nodejs logs

# Switch to non-root user
USER expressjs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Start application
CMD ["node", "src/app.js"]
