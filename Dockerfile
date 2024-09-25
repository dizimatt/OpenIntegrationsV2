FROM node:19-bullseye

WORKDIR /app

#production: uncomment these line
# COPY package*.json ./

# COPY . .
# RUN npm install

EXPOSE 8000

#production: replace CMD with following:
# CMD ["node", "src/server.js"]
CMD ["/bin/bash", "-c", "npm install; npm run dev"]

