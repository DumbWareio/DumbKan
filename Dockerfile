FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"] 