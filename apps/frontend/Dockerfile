# Seasonality SaaS Frontend - Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build arguments
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Expose port
EXPOSE 3000

# Development command (production would use npm run build && npm start)
CMD ["npm", "run", "dev"]
