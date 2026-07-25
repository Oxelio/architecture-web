FROM node:26.5.0-alpine3.24 AS build

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

RUN pnpm --filter web run build

FROM nginx:1.30.4-alpine-slim AS production

RUN addgroup -S nginx-user && adduser -S nginx-user -G nginx-user

COPY --from=build /app/apps/web/dist /usr/share/nginx/html

COPY apps/web/nginx.conf /etc/nginx/nginx.conf

RUN mkdir -p /var/cache/nginx /tmp \
    && chown -R nginx-user:nginx-user \
       /usr/share/nginx/html \
       /var/cache/nginx \
       /etc/nginx \
       /tmp

USER nginx-user

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
