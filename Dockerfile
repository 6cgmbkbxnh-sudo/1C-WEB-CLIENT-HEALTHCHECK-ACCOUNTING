FROM mcr.microsoft.com/playwright:v1.61.1-jammy

# Install 1C web client dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-dejavu \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for better caching
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --only=production

# Install Playwright browsers
RUN npx playwright install --with-deps firefox

# Copy application files
COPY run-healthcheck.js ./
COPY zabbix_sender.js ./

# Run the healthcheck
CMD ["node", "run-healthcheck.js"]
