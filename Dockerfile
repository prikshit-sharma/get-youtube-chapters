FROM node:lts-alpine3.20
WORKDIR /get-youtube-chapters
COPY . .
RUN npm install
RUN npm run test
CMD ["npm", "run", "test"]

# DO NOT CHANGE ANY BELOW CODE
WORKDIR /
RUN apk update && apk add bash git
COPY run_tests.sh ./
RUN chmod +x /run_tests.sh
ENTRYPOINT ["/bin/bash", "-s"]