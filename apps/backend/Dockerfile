# Seasonality SaaS Backend Dockerfile
# Debian-based build for better compatibility

# =====================================================
# Stage 1: Dependencies
# =====================================================
FROM node:20-bookworm AS deps

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies and temporarily relax TLS validation for corporate MITM proxies
RUN npm config set strict-ssl false && \
    npm ci --no-audit --progress=false --fetch-retries=5 --fetch-timeout=600000 && \
    npm install prisma@5.22.0 --no-save --no-audit --progress=false --fetch-retries=5 --fetch-timeout=600000

# Generate Prisma client (TLS workaround for in-house cert interception)
RUN NODE_TLS_REJECT_UNAUTHORIZED=0 npx prisma generate

# Debug: List generated Prisma files
RUN echo "=== Prisma client files ===" && \
    ls -la /app/node_modules/.prisma/client/ && \
    echo "=== Looking for query engine ===" && \
    find /app/node_modules/.prisma -name "*.node" -o -name "*.so*" 2>/dev/null | head -20

# =====================================================
# Stage 2: Production
# =====================================================
FROM node:20-bookworm AS runner

WORKDIR /app

# Create non-root user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs expressjs

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
