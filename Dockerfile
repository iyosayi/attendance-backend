# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Create directories for logs and uploads
RUN mkdir -p logs uploads

# Expose port 3000
EXPOSE 3000

# Set default environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start the application
CMD ["node", "dist/server.js"]

