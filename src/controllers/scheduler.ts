import { Scheduler } from "../services";
import { logger, database } from "../utils";


export const schedulerJobQueueController = async (data) => {
    let jobDetails = JSON.parse(data.value).message;
    const scheduler = await Scheduler.getInstance();

    await database()["job"].update({status: "preparing-workflow"}, {where: {id: jobDetails.id}});

    jobDetails = await database()["job"].findByPk(jobDetails.id);

    await scheduler.addJobToQueue(jobDetails)
        .then(() => logger.info(`Scheduler Service:: Scheduled new job to enter workflow [${jobDetails.id}]`))
        .catch(async () => await database()["job"].update({status: "failed"}, {where: {id: jobDetails.id}}));

};

export const schedulerJobRequeueController = async (data) => {
    const jobDetails = JSON.parse(data.value).message;
    console.dir(jobDetails);
    const scheduler = await Scheduler.getInstance();
    await scheduler.addJobToQueue(jobDetails);
};
