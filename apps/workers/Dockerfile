FROM node:20-slim

RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg curl && rm -rf /var/lib/apt/lists/* \
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy everything
COPY . .

# Install dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma client
RUN cd packages/db && npx prisma generate

WORKDIR /app/apps/workers

CMD ["node", "--dns-result-order=ipv4first", "--import", "tsx", "src/index.ts"]
