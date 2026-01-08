# Seasonality SaaS Backend Dockerfile
# Alpine-based build with OpenSSL 3.x support for Prisma

# =====================================================
# Stage 1: Dependencies
# =====================================================
FROM node:20-alpine AS deps

WORKDIR /app

# Install OpenSSL 3.x and build dependencies
RUN apk add --no-cache libc6-compat openssl openssl-dev

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies
RUN npm ci

# Generate Prisma client - schema.prisma has binaryTargets configured
RUN npx prisma generate

# Debug: List generated Prisma files to verify correct binary
RUN echo "=== Prisma client files ===" && \
    ls -la /app/node_modules/.prisma/client/ && \
    echo "=== Looking for query engine ===" && \
    find /app/node_modules/.prisma -name "*.node" -o -name "*.so*" 2>/dev/null | head -20

# =====================================================
# Stage 2: Production
# =====================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Install runtime dependencies - OpenSSL 3.x
RUN apk add --no-cache openssl libc6-compat

# Verify OpenSSL version
RUN echo "OpenSSL version:" && openssl version

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 expressjs

# Set environment
ENV NODE_ENV=production
ENV PORT=3001

# Copy node_modules with Prisma client from deps stage
COPY --from=deps --chown=expressjs:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=expressjs:nodejs . .

# Create logs and temp directories
RUN mkdir -p logs /tmp/seasonality-uploads && \
    chown -R expressjs:nodejs logs /tmp/seasonality-uploads

# Switch to non-root user
USER expressjs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Start application
CMD ["node", "src/app.js"]
