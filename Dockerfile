FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy app files
COPY . .

# Create data directory
RUN mkdir -p data

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"] 