import kafkaDojot = require("@dojot/adminkafka");
import { logger } from "@dojot/dojot-module-logger";
import kafka = require("kafka-node");
import config = require("./config");

export class KafkaFactory{
    private _host?: string;

    constructor(host?: string){
        this._host = host;
    }

    client(): kafka.KafkaClient{
        logger.debug("Creating new Kafka producer...", {filename: "producer"});
        const kafkaHost = this._host ? this._host : config.kafka.kafkaAddress + ":" + config.kafka.kafkaPort.toString();
        logger.debug("Creating Kafka client...", {filename: "producer"});
        return new kafka.KafkaClient({kafkaHost});
    }

    dojotProducer(): kafkaDojot.Admin{
        logger.debug("... Kafka client was created.", {filename: "producer"});
        logger.debug("Creating Kafka HighLevenProducer...", {filename: "producer"});
        return new kafkaDojot.Admin(config.kafka.kafkaAddress, Number(config.kafka.kafkaPort));
    }

    kafkaProducer(client: kafka.KafkaClient, init: () => void): kafka.HighLevelProducer{
        let producer = new kafka.HighLevelProducer(client, { requireAcks: 1 });
        logger.debug("... HighLevelProducer was created.", {filename: "producer"});
        producer.on("ready", init);
        logger.debug("... Kafka producer was created.", {filename: "producer"});
        return producer;
    }

}