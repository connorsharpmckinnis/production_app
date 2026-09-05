# syntax=docker/dockerfile:1

FROM node:22-alpine AS base

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

FROM base AS dev

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

FROM base AS build

COPY . .

RUN npm run build

FROM nginx:1.27-alpine AS prod

# envsubst for runtime PORT / BACKEND_UPSTREAM templating
RUN apk add --no-cache gettext

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

COPY --from=build /app/dist /usr/share/nginx/html

# Cloud Run sets PORT (usually 8080). Compose preview can override.
ENV PORT=8080
ENV BACKEND_UPSTREAM=http://backend:8000

EXPOSE 8080

ENTRYPOINT ["/docker-entrypoint.sh"]
