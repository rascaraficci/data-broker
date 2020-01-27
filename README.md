# Data Broker

[![License badge](https://img.shields.io/badge/license-GPL-blue.svg)](https://opensource.org/licenses/GPL-3.0)
[![Docker badge](https://img.shields.io/docker/pulls/dojot/data-broker.svg)](https://hub.docker.com/r/dojot/data-broker/)
[![Build Status](https://travis-ci.org/dojot/data-broker.svg?branch=development)](https://travis-ci.org/dojot/data-broker)
[![codecov](https://codecov.io/gh/dojot/data-broker/branch/development/graph/badge.svg)](https://codecov.io/gh/dojot/data-broker)

This repository contains the implementation for the event broker used internally by
dojot's event processing services.

## What it does

Data Broker provides two services: Kafka's topic management and real-time data. These are required
by most of the services that compose dojot, being essential to maintain the system working.

The topic management service handles Kafka's topics, used for information dissemination (e.g.
device creation events), handling the creation of runtime kafka topics that segregate information
on a tenant context basis, restricting the set of events a given service is exposed to only the
ones it is actually allowed to process.

The real-time service deals with the routing of data received via sockets that is directed to
one or more devices. This data is shown in the device information screen in the GUI.

As we are dealing with kafka queues, it is up to the consumers of the returned topics to keep track
of where the head of its processed queue is at. That allows consumers to process events at their
own pace, thus avoiding unwanted data loss in the process. Another important characteristic of the
configured topics is that, by default, they are single-partitioned without replications. This can
be changed by using endpoints. Check Data Broker's [API reference](https://dojot.github.io/data-broker/apiary_v0.3.0.html)
for more information.

## Dependencies

To successfully run Data Broker, make sure you have the following packages installed
in your machine.

### NPM packages

You don't need to install these manually, just run `npm install`.

- From @dojot:
  - adminkafka
  - dojot-module
  - dojot-module-logger
  - healthcheck
- async
- axios
- body-parser
- eslint
- express
- jest
- jshint
- kafka-node
- morgan
- node-rdkafka
- redis
- socket.io
- tsconfig
- typescript
- uuid
- winston

### Linux packages

```shell
apt-get install zlib1g zlib1g-dev
```

## Dojot dependencies

Data Broker depends on some Dojot modules to run. The minimum set of modules it needs to run
without errors is:

- Auth
- Kafka
- Redis

## Configuration

These are the environment variables used by Data Broker code.

Key                      | Purpose                                      | Default Value
------------------------ | -------------------------------------------- | -------------------
DATABROKER_CACHE_HOST    | Redis cache host address                     | "data-broker-redis"
DATABROKER_KAFKA_ADDRESS | Kafka address                                | "kafka"
DATABROKER_KAFKA_PORT    | Kafka port                                   | 9092
HC_CPU_USAGE_TIMEOUT     | Healthcheck CPU usage timeout (ms)           | 300000
HC_KAFKA_TIMEOUT         | Healthcheck Kafka timeout (ms)               | 30000
HC_MEMORY_USAGE_TIMEOUT  | Healthcheck Memory usage timeout (ms)        | 300000
HC_UPTIME_TIMEOUT        | Healthcheck Uptime timeout (ms)              | 300000
KAFKA_NUM_PARTITIONS     | Default number of partitions in Kafka topics | 1
KAFK_REPLICATION_FACTOR  | Default replication factor in Kafka topics   | 1
LOG_LEVEL                | Logger level (error, warn, info, debug)      | "info"
SERVICE_PORT             | Data Broker service port                     | 80

Some environment variables are used by Dojot libraries that Data Broker uses.

Key                        | Purpose                                                     | Default Value
-------------------------- | ----------------------------------------------------------- | -----------------------------
AUTH_URL                   | Auth host address                                           | "http://auth:5000"
DATA_BROKER_URL            | Data Broker host address                                    | "http://data-broker"
DEVICE_MANAGER_URL         | Device Manager host address                                 | "http://device-manager:5000"
DOJOT_MANAGEMENT_TENANT    | Management tenant                                           | "dojot-management"
DOJOT_MANAGEMENT_USER      | Management user                                             | "dojot-management"
DOJOT_SUBJECT_DEVICES      | Subject for device management messages                      | "dojot.device-manager.device"
DOJOT_SUBJECT_DEVICE_DATA  | Subject for device data messages                            | "device-data"
DOJOT_SUBSCRIPTION_HOLDOFF | Time (ms) before attempting to subscribe to a set of topics | 2500
DOJOT_SUBJECT_TENANCY      | Subject for tenancy messages                                | "dojot.tenancy"
KAFKA_GROUP_ID             | Kafka group ID for consumers                                | "kafka"
KAFKA_HOSTS                | List of Kafka instances                                     | "kafka:9092"

## How to run

There are two ways of running Data Broker for development: you can run using
NPM scripts or a Docker image. To accomplish this, you need a Dojot instance
already running in your machine. See [Dojot documentation](https://dojotdocs.readthedocs.io/en/stable/)
for more information on how to do this.

### Using NPM scripts

The first way to run Data Broker is building it from scratch with the provided scripts.
To build it, run:

```shell
npm run build
```

To run Data Broker using this method, you need to be in root. Enter in root before proceeding:

```shell
sudo su
```

Set the variables described in the two tables in the [Configuration](#configuration) session.
Bare in mind that the default values are the ones that Dojot uses in the
[official Docker Compose repository](https://github.com/dojot/docker-compose) and may not be
suitable for your application.

To start the service, run:

```shell
npm run subscription
```

### Using a Docker image

To generate a docker container, one may issue the following command:

```shell
docker build -t <tag> -f docker/Dockerfile .
```

Then an image tagged as `<tag>` will be made available. Do notice that a pre-built "official"
version for this component may be found at dojot's [dockerhub](https://hub.docker.com/r/dojot/data-broker/).

## Removal Notes

The Subscription service is being removed from Data Broker because of its lack of use. As a consequence,
the endpoint `/subscription` is being removed.

With the removal of subscription-engine.ts, other files needed to be excluded from the repository:

- Condition.ts
- consumer.ts
- Event.ts
- Notification.ts
- simple-tools.ts
- Subscription.ts

All their tests were removed too.

## Documentation

- [Development API docs](https://dojot.github.io/data-broker/apiary_development.html)
- [Latest API docs](https://dojot.github.io/data-broker/apiary_latest.html)

## Issues and help

If you found a problem or need help, leave an issue in the main
[Dojot repository](https://github.com/dojot/dojot) and we will help you!
