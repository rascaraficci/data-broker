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
  numPartitions: Number(process.env.KAFKA_NUM_PARTITIONS) || 10,
  replicationFactor: Number(process.env.KAFKA_REPLICATION_FACTOR) || 1,
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
    uptime: Number(process.env.HC_UPTIME_TIMEOUT) || 300000,
  },
};

const service = {
  port: Number(process.env.SERVICE_PORT) || 80,
};

const logging = {
  level: process.env.LOG_LEVEL || "info",
};

export { kafka, broker, cache, logging, healthcheck, service };
