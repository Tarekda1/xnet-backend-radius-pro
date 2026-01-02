# Use Node.js LTS version
FROM ghcr.io/library/node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json and lock file
COPY package*.json ./

# Force clean install
RUN npm ci

# Ensure node-routeros is available
RUN npm list node-routeros || npm install node-routeros

# Copy the rest of the app
COPY . .

# Build TypeScript
RUN npm run build

# Expose app port
EXPOSE 3000

# Run the app
CMD ["npm", "start"]
