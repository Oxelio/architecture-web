FROM node:26.5.0-alpine3.24 AS build

WORKDIR /app

RUN npm install -g pnpm@11.12.0

COPY package.json pnpm-lock.yaml .npmrc ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

FROM nginx:1.30.4-alpine-slim AS production

RUN addgroup -S nginx-user && adduser -S nginx-user -G nginx-user

COPY --from=build /app/dist /usr/share/nginx/html

COPY ./nginx.conf /etc/nginx/nginx.conf

RUN mkdir -p /var/cache/nginx /tmp \
    && chown -R nginx-user:nginx-user \
       /usr/share/nginx/html \
       /var/cache/nginx \
       /etc/nginx \
       /tmp

USER nginx-user

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]