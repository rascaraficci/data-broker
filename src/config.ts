const kafka = {
  consumer: {
    autoCommit : true,
    fetchMaxBytes : 1048576,
    fetchMaxWaitMs : 1000,
    group : "subscription-engine",
    id : "consumer-1",
  },
  kafkaAddress: process.env.DATABROKER_KAFKA_ADDRESS || "kafka",
  kafkaPort: process.env.DATABROKER_KAFKA_PORT || 9092,
  zookeeper: process.env.DATABROKER_ZOOKEEPER_HOST || "zookeeper:2181",
};

const broker = {
  ingestion: ["device-data", "device_data"],
};

const cache = {
  redis : process.env.DATABROKER_CACHE_HOST || "data-broker-redis",
};

const healthcheck = {
  timeout: {
    cpu: Number(process.env.HC_CPU_USAGE_TIMEOUT) || 300000,
    kafka: Number(process.env.HC_KAFKA_TIMEOUT) || 30000,
    memory: Number(process.env.HC_MEMORY_USAGE_TIMEOUT) || 300000,
    mongodb: Number(process.env.HC_MONGODB_TIMEOUT) || 30000,
    uptime: Number(process.env.HC_UPTIME_TIMEOUT) || 300000,
  },
};

export { kafka, broker, cache, healthcheck};
