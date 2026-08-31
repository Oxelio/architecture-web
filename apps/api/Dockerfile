FROM node:26.8.1-alpine3.24 AS builder

WORKDIR /app

RUN npm install -g pnpm@11.15.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/foundation/package.json packages/foundation/package.json
COPY packages/iam/package.json packages/iam/package.json
COPY packages/iam-email-nodemailer/package.json packages/iam-email-nodemailer/package.json
COPY packages/iam-email-postmark/package.json packages/iam-email-postmark/package.json
COPY packages/iam-persistence-kysely/package.json packages/iam-persistence-kysely/package.json
COPY packages/iam-password-argon2/package.json packages/iam-password-argon2/package.json
COPY packages/iam-password-bcrypt/package.json packages/iam-password-bcrypt/package.json
COPY packages/iam-session-redis/package.json packages/iam-session-redis/package.json
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
