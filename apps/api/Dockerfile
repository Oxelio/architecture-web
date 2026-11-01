FROM node:26.8.1-alpine3.24 AS builder

WORKDIR /app

RUN npm install -g --ignore-scripts corepack@0.35.0 && corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

COPY packages/ packages/

RUN corepack install

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
