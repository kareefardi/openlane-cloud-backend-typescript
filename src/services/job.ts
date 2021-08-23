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


    async flattenJobsDetails(jobsDetails) {
        const designs = jobsDetails.designs;
        const jobs = [];
        for (const i in designs) {
            const job = {
                designName: designs[i].designName,
                repoURL: designs[i].repoURL,
                pdkVariant: designs[i].pdkVariant
            };
            for (const key in jobsDetails) {
                const value = jobsDetails[key];
                const value_copy = JSON.parse(JSON.stringify(value));
                if (key != "designs") {
                    job[key] = value_copy;
                }
            }
            jobs.push(job);
        }
        return jobs;
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
