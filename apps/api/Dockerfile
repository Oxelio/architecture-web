FROM node:26.5.0-trixie-slim AS builder

WORKDIR /repo

ENV CI=true
ENV NODE_ENV=development

RUN npm install -g pnpm@11.12.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

COPY apps ./apps
COPY bounded-contexts ./bounded-contexts
COPY foundation ./foundation
COPY infrastructure ./infrastructure

RUN pnpm install --frozen-lockfile

RUN pnpm --filter foundation build
RUN pnpm --filter identity build
RUN pnpm --filter identity-persistence-kysely build
RUN pnpm --filter identity-password-argon2 build
RUN pnpm --filter identity-session-redis build
RUN pnpm --filter identity-email-nodemailer build

RUN pnpm --filter api build


FROM node:26.5.0-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache libc6-compat

COPY --from=builder /repo/apps/api/package.json ./package.json
COPY --from=builder /repo/apps/api/dist ./dist
COPY --from=builder /repo/node_modules ./node_modules

RUN chown -R node:node /app

USER node

EXPOSE 3000

CMD ["node", "dist/main.mjs"]