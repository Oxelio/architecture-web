FROM node:26.5.0-alpine3.24 AS builder

WORKDIR /app

RUN npm install -g pnpm@11.15.1

COPY package.json pnpm-lock.yaml .npmrc pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build
RUN pnpm prune --prod

FROM gcr.io/distroless/nodejs26-debian13:debug-nonroot

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Just for sonarcube
USER nonroot:nonroot

EXPOSE 3000

CMD ["dist/main.mjs"]