# WhatsApp gateway: Node + Chromium for whatsapp-web.js (Puppeteer)
FROM node:20-bookworm-slim

# Install Chromium (required for Puppeteer / whatsapp-web.js)
RUN apt-get update && apt-get install -y chromium

# Additional Chromium dependencies for headless in Docker
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use the system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

# Session data persisted via volume mount at /app/session
ENV WA_SESSION_PATH=/app/session
ENV PORT=3000
EXPOSE 3000

CMD ["node", "src/index.js"]
