import { logger } from "../utils";
import { database } from "../utils";
import KafkaProducer from "../../kafka";

/**
 * Business Logic function:
 * take cheese from a box an squeeze it
 */
export default class Job {
    public static job;
    private jobProducer: any;

    constructor() {
    }

    public static async getInstance(): Promise<Job> {
        if (!this.job) {
            this.job = new Job();
            this.job.jobProducer = await KafkaProducer.initialize("PRODUCER", {
                host: "localhost:9092",
                topic: "job-out",
                partition: 0
            });

            this.job.jobProducer.on("error", function (err) {
                logger.error("ERROR:: Job Kafka: " + err);
            });
            return this.job;
        }
        return this.job;
    }


    async createJob(userUUID, jobDetails) {
        const job = await database()["job"].create({
            userUUID: userUUID,
            designName: jobDetails.designName,
            repoURL: jobDetails.repoURL,
            type: jobDetails.type,
            pdkVariant: jobDetails.pdkVariant,
            notificationsEnabled: jobDetails.notificationsEnabled,
            status: "published"
        });

        return job;
    }


    async flattenJobs(jobsDetails) {
        var designs = jobsDetails.designs
        let jobs = [];
        for (var design in designs) {
            var job = {
                designName: design.designName,
                repoURL: design.repoURL,
                pdkVariant: design.pdkVariant
            }
            for (var key in jobsDetails) {
                var value = jobsDetails[key]
                if (key != "designs") {
                    job[key] = value
                }
            }
            jobs.push(job)
        }
        return jobs
    }

    async publish(msg) {
        try {
            await this.jobProducer.publish({
                message: msg,
            });
        } catch (e) {
            throw new Error(e);
        }
    }

}
