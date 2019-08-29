FROM apiaryio/dredd:12.0.3

WORKDIR /opt/subscription-manager
EXPOSE 80

RUN apk add git python make bash gcc g++ zlib-dev --no-cache

COPY package.json .
COPY package-lock.json .
RUN npm install

COPY . .
RUN npm run-script build
RUN npm run-script build-tests


CMD ["./tests/start-test.sh"]
