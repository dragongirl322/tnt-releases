FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV SQLITE_PATH=/data/tnt.sqlite

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

RUN mkdir -p /data && chown -R node:node /data /app

USER node

EXPOSE 3000

CMD ["npm", "start"]
