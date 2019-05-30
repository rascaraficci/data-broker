import "jest";
import { KafkaProducer } from "../src/producer";
import { KafkaFactory } from "../src/KafkaFactory";
jest.mock('kafka-node');
jest.mock('@dojot/adminkafka');
jest.mock('../src/KafkaFactory');

describe("Producer", () => {

    it("should create a producer", (done) => {
        const kafkaFactory = new KafkaFactory("test");
        const producer = new KafkaProducer(kafkaFactory, () => {});

        expect(kafkaFactory.client).toHaveBeenCalled();
        expect(kafkaFactory.dojotProducer).toHaveBeenCalled();
        expect(kafkaFactory.kafkaProducer).toHaveBeenCalled();

        done();
    });
});
