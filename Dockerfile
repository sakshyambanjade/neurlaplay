FROM node:20-bookworm-slim AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:20-bookworm-slim AS server-deps
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci

FROM node:20-bookworm-slim
WORKDIR /app/server

ENV NODE_ENV=production
ENV PORT=3001
ENV PAPER_WORKSPACE_ROOT=/app/paper
ENV PAPER_DATA_ROOT=/data/paper

COPY --from=server-deps /app/server/node_modules ./node_modules
COPY server/ ./
COPY --from=client-builder /app/client/dist ./public
COPY paper /app/paper

RUN mkdir -p /data/paper

EXPOSE 3001

CMD ["npm", "run", "start"]
