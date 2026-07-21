FROM node:26.5.0-alpine3.24 AS builder

WORKDIR /app

RUN npm install -g pnpm@11.15.1

COPY package.json pnpm-lock.yaml .npmrc pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build


FROM node:26.5.0-alpine3.24 AS production

WORKDIR /app

ENV NODE_ENV=production

RUN npm install -g pnpm@11.15.1

COPY package.json pnpm-lock.yaml .npmrc pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist

RUN chown -R node:node /app

USER node

EXPOSE 3000

CMD ["node", "dist/main.mjs"]