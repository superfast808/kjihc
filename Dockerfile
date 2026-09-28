# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY artifacts/api-server/package.json artifacts/api-server/package.json
COPY artifacts/kjihc/package.json artifacts/kjihc/package.json
COPY lib/api-client-react/package.json lib/api-client-react/package.json
COPY lib/api-spec/package.json lib/api-spec/package.json
COPY lib/api-zod/package.json lib/api-zod/package.json
COPY lib/db/package.json lib/db/package.json
COPY scripts/package.json scripts/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS source
COPY . .

FROM source AS api-build
RUN pnpm --filter @workspace/api-server run build

FROM source AS web-build
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_CLERK_PROXY_URL=/api/__clerk
ARG BASE_PATH=/
ENV NODE_ENV=production
ENV PORT=5000
ENV BASE_PATH=$BASE_PATH
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PROXY_URL=$VITE_CLERK_PROXY_URL
RUN pnpm --filter @workspace/kjihc run build

FROM node:24-bookworm-slim AS api
ENV NODE_ENV=production
ENV PORT=5000
WORKDIR /app
COPY --from=api-build /app /app
EXPOSE 5000
CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]

FROM nginx:1.27-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /app/artifacts/kjihc/dist/public /usr/share/nginx/html
EXPOSE 80
