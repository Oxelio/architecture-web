FROM node:26.4.0-trixie-slim AS build
WORKDIR /repo
RUN npm install -g pnpm@11.3.0
ENV CI=true
ENV NODE_ENV=development
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps ./apps
COPY bounded-contexts ./bounded-contexts
COPY foundation ./foundation
COPY infrastructure ./infrastructure
COPY commitlint.config.js eslint.config.mjs ./
RUN pnpm install --frozen-lockfile --ignore-scripts \
    && pnpm --filter @architecture/foundation build \
    && pnpm --filter @architecture/identity build \
    && pnpm --filter @architecture/identity-persistence-kysely build \
    && pnpm --filter @architecture/identity-password-argon2 build \
    && pnpm --filter @architecture/identity-session-redis build \
    && pnpm --filter @architecture/identity-email-nodemailer build \
    && pnpm --filter api build

FROM node:26-alpine AS production
WORKDIR /repo
RUN npm install -g pnpm@11.3.0
ENV CI=true
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps ./apps
COPY bounded-contexts ./bounded-contexts
COPY foundation ./foundation
COPY infrastructure ./infrastructure
COPY commitlint.config.js eslint.config.mjs ./
RUN pnpm install --filter ./apps/api... --prod --frozen-lockfile --ignore-scripts \
    && rm -rf /app/* /app/.[!.]* /app/..?* 2>/dev/null || true \
    && pnpm --filter ./apps/api deploy --prod --legacy --ignore-scripts /app
COPY --from=build /repo/apps/api/dist /app/dist
COPY --from=build /repo/foundation/dist /app/node_modules/@architecture/foundation/dist
COPY --from=build /repo/bounded-contexts/identity/dist /app/node_modules/@architecture/identity/dist
COPY --from=build /repo/infrastructure/identity/persitence/kysely/dist /app/node_modules/@architecture/identity-persistence-kysely/dist
COPY --from=build /repo/infrastructure/identity/security/argon2/dist /app/node_modules/@architecture/identity-password-argon2/dist
COPY --from=build /repo/infrastructure/identity/session/redis/dist /app/node_modules/@architecture/identity-session-redis/dist
COPY --from=build /repo/infrastructure/identity/email/nodemailer/dist /app/node_modules/@architecture/identity-email-nodemailer/dist
RUN chown -R node:node /app
USER node
WORKDIR /app
EXPOSE 3000
CMD ["node", "dist/main.js"]
