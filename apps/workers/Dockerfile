FROM node:20-slim

RUN apt-get update && apt-get install -y python3 yt-dlp && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy everything
COPY . .

# Install dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma client
RUN cd packages/db && npx prisma generate

WORKDIR /app/apps/workers

CMD ["npx", "tsx", "src/index.ts"]
