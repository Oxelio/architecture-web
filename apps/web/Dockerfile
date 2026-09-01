FROM node:26.8.1-alpine3.24 AS build

WORKDIR /app

RUN npm install -g pnpm@11.15.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter web run build

FROM nginx:1.31.3-alpine3.24-slim AS production

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
