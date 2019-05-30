import "jest";
import { KafkaFactory } from "../src/KafkaFactory";
import { KafkaProducer } from "../src/producer";
jest.mock("kafka-node");
jest.mock("@dojot/adminkafka");
jest.mock("../src/KafkaFactory");

describe("Producer", () => {

    it("should create a producer", (done) => {
        const kafkaFactory = new KafkaFactory("test");
        const producer = new KafkaProducer(kafkaFactory, () => { return; });

        expect(kafkaFactory.client).toHaveBeenCalled();
        expect(kafkaFactory.dojotProducer).toHaveBeenCalled();
        expect(kafkaFactory.kafkaProducer).toHaveBeenCalled();

        done();
    });
});
