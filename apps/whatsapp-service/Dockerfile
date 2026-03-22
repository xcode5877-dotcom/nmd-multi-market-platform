FROM ghcr.io/puppeteer/puppeteer:21.6.1

USER root

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN chmod -R 777 /app

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

CMD ["node", "src/index.js"]
