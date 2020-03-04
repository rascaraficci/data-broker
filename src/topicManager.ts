/* jslint node: true */
"use strict";

import { logger } from "@dojot/dojot-module-logger";
import uuid = require("uuid/v4");
import { KafkaFactory } from "./KafkaFactory";
import { KafkaProducer } from "./producer";
import { QueuedTopic } from "./QueuedTopic";
import { ClientWrapper, IAutoScheme } from "./RedisClientWrapper";
import { RedisManager } from "./redisManager";
import { kafka } from "./config";

const TAG = { filename: "TopicManager" };

type TopicCallback = (error?: any, topic?: string) => void;

// TODO this should also handle kafka ACL configuration
class TopicManager {
  private redis: ClientWrapper;
  private service: string;
  private getSet: string;
  private producer: KafkaProducer;
  private producerReady: boolean;
  private topicQueue: QueuedTopic[];

  constructor(service: string) {
    if ((service === undefined) || service.length === 0) {
      throw new Error("a valid service id must be supplied");
    }

    this.service = service;
    this.redis = RedisManager.getClient();
    this.getSet = __dirname + "/lua/setGet.lua";
    this.producerReady = false;
    this.topicQueue = [];
    logger.debug("Creating Kafka Producer...", TAG);
    this.producer = new KafkaProducer(new KafkaFactory(), () => {
      this.producerReady = true;
      if (this.topicQueue.length) {
        for (const request of this.topicQueue) {
          this.handleRequest(request);
        }
      }
    });
    logger.debug("... Kafka Producer created.", TAG);
  }

  /**
   * Create a topic for the given `subject`.
   *
   * @param subject
   * @param callback
   */
  public createTopic(subject: string, callback: TopicCallback): void {
    logger.debug(`Retrieving/creating topic...`, TAG);
    logger.debug(`Subject: ${subject}`, TAG);

    try {
      const topic = this.createTopicName(subject);
      const request = { topic, subject, callback };

      if (this.producerReady) {
        logger.debug("Handling all pending requests...", TAG);
        this.handleRequest(request);
        logger.debug("... all pending requests were handled.", TAG);
      } else {
        logger.debug("Producer is not yet ready.", TAG);
        logger.debug("Adding to the pending requests queue...", TAG);
        this.topicQueue.push(request);
        logger.debug("... topic was added to queue.", TAG);
      }

    } catch (error) {
      logger.debug("... topic could not be created/retrieved.", TAG);
      logger.error(`An exception was thrown: ${error}`, TAG);
      callback(error);
    }
  }

  /**
   * Close the producer connection.
   */
  public destroy(): void {
    logger.debug("Closing down this topic manager...", TAG);
    this.producer.close();
    logger.debug("... topic manager was closed.", TAG);
  }

  /**
   * Verify the validity of the passed topic.
   * @param topic
   */
  private assertTopic(topic: string): void {
    if ((topic === undefined) || topic.length === 0) {
      throw new Error("a valid subject must be provided");
    }
  }

  /**
   * Create the topic for the passed subject.
   *
   * @param subject
   *
   * @returns the topic in the format `ti:<tenant>:<subject>`.
   */
  private createTopicName(subject: string): string {
    this.assertTopic(subject);
    return this.service + "." + subject;
  }

  /**
   * Create the topic for a request.
   * @param request
   */
  private handleRequest(request: QueuedTopic) {
    const profileConfigs: IAutoScheme = {
      num_partitions: kafka.numPartitions,
      replication_factor: kafka.replicationFactor,
    };

    this.producer.createTopic(request.topic, profileConfigs, request.callback);
  }
}

export { TopicCallback, TopicManager };
