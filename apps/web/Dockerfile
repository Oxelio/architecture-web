FROM node:26.4.0-trixie-slim AS build
WORKDIR /repo

RUN npm install -g pnpm@11.12.0
ENV CI=true
ENV NODE_ENV=development

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY commitlint.config.js eslint.config.mjs ./
COPY apps ./apps
COPY bounded-contexts ./bounded-contexts
COPY foundation ./foundation
COPY infrastructure ./infrastructure

RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm --filter ./apps/web build

FROM nginx:alpine AS production
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
