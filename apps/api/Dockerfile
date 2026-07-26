FROM node:26.5.0-alpine3.24 AS builder

WORKDIR /app

RUN npm install -g pnpm@11.15.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/foundation/package.json packages/foundation/package.json
COPY packages/identity/core/package.json packages/identity/core/package.json
COPY packages/identity/infrastructure/email/nodemailer/package.json packages/identity/infrastructure/email/nodemailer/package.json
COPY packages/identity/infrastructure/email/postmark/package.json packages/identity/infrastructure/email/postmark/package.json
COPY packages/identity/infrastructure/persitence/kysely/package.json packages/identity/infrastructure/persitence/kysely/package.json
COPY packages/identity/infrastructure/security/argon2/package.json packages/identity/infrastructure/security/argon2/package.json
COPY packages/identity/infrastructure/security/bcrypt/package.json packages/identity/infrastructure/security/bcrypt/package.json
COPY packages/identity/infrastructure/session/redis/package.json packages/identity/infrastructure/session/redis/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter api... run build
RUN pnpm --filter api --prod deploy --legacy /production

FROM gcr.io/distroless/nodejs26-debian13:debug-nonroot

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /production ./

# Just for sonarcube
USER nonroot:nonroot

EXPOSE 3000

CMD ["dist/main.mjs"]
