FROM node:24.21.0-bookworm-slim AS base

WORKDIR /app

FROM base AS dependencies

COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS development

ENV NODE_ENV=development

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]

FROM base AS production-dependencies

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM base AS production

ENV NODE_ENV=production

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json app.js ./
COPY --chown=node:node src ./src

USER node

EXPOSE 3000

CMD ["npm", "start"]
