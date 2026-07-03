# ---------- Base ----------
FROM node:26.3.1-trixie-slim AS base

WORKDIR /repo

RUN npm install -g pnpm@11.3.0

# ---------- Dependencies ----------
FROM base AS deps

ENV CI=true

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY . .

RUN pnpm install --filter ./apps/api... --frozen-lockfile --ignore-scripts

# ---------- Build ----------
FROM deps AS build

WORKDIR /repo/apps/api
RUN pnpm --filter ./apps/api build

# ---------- Production ----------
FROM node:26.3.1-trixie-slim AS production

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /repo/apps/api/dist ./dist
COPY --from=deps /repo/node_modules ./node_modules
COPY apps/api/package.json ./package.json

EXPOSE 80

CMD ["node", "dist/main.js"]
