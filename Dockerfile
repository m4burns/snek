FROM node:latest

WORKDIR /snek
COPY package.json ./
COPY package-lock.json ./
RUN npm install

COPY server.js ./

EXPOSE 8888

CMD [ "node", "server.js" ]
