FROM node:20-alpine

WORKDIR /app

# Install curl for fetching the parser
RUN apk add --no-cache curl

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy app files
COPY . .

# Fetch parser and transform it for browser use
RUN curl -o public/dumbdateparser.js https://raw.githubusercontent.com/DumbWareio/DumbDateParser/main/src/index.js && \
    echo "window.DumbDateParser = (function() {" > public/dumbdateparser.tmp.js && \
    cat public/dumbdateparser.js | sed 's/export default.*$/return DumbDateParser;})();/' >> public/dumbdateparser.tmp.js && \
    mv public/dumbdateparser.tmp.js public/dumbdateparser.js

# Create data directory
RUN mkdir -p data

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"] 