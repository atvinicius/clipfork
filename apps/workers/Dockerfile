FROM node:20-slim AS base

RUN apt-get update && apt-get install -y python3 yt-dlp && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY apps/workers/package.json apps/workers/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/db/ packages/db/
COPY packages/shared/ packages/shared/
COPY apps/workers/ apps/workers/

# Generate Prisma client
RUN cd packages/db && npx prisma generate

# Build
RUN pnpm turbo build --filter=@ugc/workers...

WORKDIR /app/apps/workers

CMD ["node", "dist/index.js"]
