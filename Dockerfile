# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY . .
RUN pnpm run build

FROM base AS production-deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/config.js ./config.js
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
EXPOSE 8081
CMD ["node", "-r", "./config.js", "./dist/server.js"]
