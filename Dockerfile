FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* bun.lock* .npmrc* ./
RUN if [ -f package-lock.json ]; then npm ci --legacy-peer-deps; else npm install --legacy-peer-deps; fi

COPY . .

ENV NODE_ENV=production
RUN npm run build

EXPOSE 3000

CMD ["node", "server.ts"]
