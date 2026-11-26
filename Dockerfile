# syntax=docker/dockerfile:1

# ---------- base ----------
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ---------- dependencies (full — needed to build) ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---------- build ----------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# ---------- runtime ----------
FROM base AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

# Full node_modules from deps keeps the SSR runtime (native argon2, postgres
# driver, react-router-serve) working without a second dependency graph.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY drizzle ./drizzle

EXPOSE 3000
# Migrations run automatically on boot (see app/server/bootstrap.ts).
CMD ["pnpm", "start"]
