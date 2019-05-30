import "jest";
import { KafkaFactory } from "../src/KafkaFactory";
jest.mock('kafka-node');
jest.mock('@dojot/adminkafka');
import kafka = require("kafka-node");
import kafkaDojot = require("@dojot/adminkafka");


describe("KafkaFactory", () => {

    beforeEach(() => {
       jest.resetAllMocks();
    });

    it("should a create kafka client", (done) => {
       let factory = new KafkaFactory("host");
       let client = factory.client();
       expect(kafka.KafkaClient).toHaveBeenCalledTimes(1);
       done();
    });

    it("should a create kafka client when there is not a host", (done) => {
        let factory = new KafkaFactory();
        let client = factory.client();
        expect(kafka.KafkaClient).toHaveBeenCalledTimes(1);
        done();
     });

    it("should create a dojot producer", (done) => {
        let factory = new KafkaFactory("host");
        let producer = factory.dojotProducer();
        expect(kafkaDojot.Admin).toHaveBeenCalledTimes(1);
        done();
    });
    
    it("should create a kafka producer", (done) => {
        let factory = new KafkaFactory("host");
        let client = factory.client();
        let producer = factory.kafkaProducer(client, () => {});
        expect(kafka.HighLevelProducer).toHaveBeenCalledTimes(1);
        expect(producer.on).toHaveBeenCalledTimes(1);
        done();
    });
    
});
