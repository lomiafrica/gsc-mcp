FROM node:22-bookworm-slim

WORKDIR /app
RUN useradd --create-home --uid 10001 appuser
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build
USER appuser
ENV GSC_MCP_TRANSPORT=http
ENV NODE_ENV=production
EXPOSE 3344
CMD ["node", "dist/http-entry.js"]
