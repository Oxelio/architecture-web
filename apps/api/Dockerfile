FROM node:26.5.0-alpine3.24 AS builder

WORKDIR /app

RUN npm install -g pnpm@11.15.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY bounded-contexts/identity/package.json bounded-contexts/identity/package.json
COPY foundation/package.json foundation/package.json
COPY infrastructure/identity/email/nodemailer/package.json infrastructure/identity/email/nodemailer/package.json
COPY infrastructure/identity/email/postmark/package.json infrastructure/identity/email/postmark/package.json
COPY infrastructure/identity/persitence/kysely/package.json infrastructure/identity/persitence/kysely/package.json
COPY infrastructure/identity/security/argon2/package.json infrastructure/identity/security/argon2/package.json
COPY infrastructure/identity/security/bcrypt/package.json infrastructure/identity/security/bcrypt/package.json
COPY infrastructure/identity/session/redis/package.json infrastructure/identity/session/redis/package.json
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
