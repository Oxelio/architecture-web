FROM node:26.5.0-alpine3.24 AS build

WORKDIR /app

RUN npm install -g pnpm@11.12.0

COPY package.json pnpm-lock.yaml .npmrc ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

FROM nginx:1.30.4-alpine-slim AS production

RUN addgroup -S nginx-user && adduser -S nginx-user -G nginx-user

WORKDIR /app

COPY --from=build /app/dist /usr/share/nginx/html
COPY ./nginx.conf /etc/nginx/conf.d/default.conf

RUN mkdir -p /var/cache/nginx /var/run \
    && chown -R nginx-user:nginx-user \
    /usr/share/nginx/html \
    /var/cache/nginx \
    /var/run \
    /etc/nginx

USER nginx-user

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
