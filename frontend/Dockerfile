FROM oven/bun:1-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package.json bun.lockb* bun.lock* ./
RUN bun install

# Copy source code
COPY . .

# Expose Next.js port
EXPOSE 3000

# Set environment to development
ENV NODE_ENV=development

# Start Next.js in development mode
CMD ["bun", "run", "dev"]
