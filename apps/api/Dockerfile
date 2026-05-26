# ---------- Base ----------
FROM node:26.2.0-trixie-slim AS base

WORKDIR /repo

RUN npm install -g pnpm@11.3.0

# ---------- Dependencies ----------
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json

RUN pnpm install --filter ./apps/api... --frozen-lockfile --ignore-scripts

# ---------- Build ----------
FROM deps AS build

COPY apps/api/tsconfig.json apps/api/tsconfig.json
COPY apps/api/src apps/api/src

RUN pnpm --filter ./apps/api build
RUN pnpm --filter ./apps/api deploy --prod --legacy /out

# ---------- Production ----------
FROM node:26.2.0-trixie-slim AS production

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /out ./

EXPOSE 80

CMD ["node", "dist/index.js"]
