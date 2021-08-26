import { logger, statusCode, database, config } from "../utils";
import { Job, OpenlaneExecution } from "../services";
import * as fs from "fs";
import * as path from "path";
import * as mime from "mime";
import * as csv from "csv-parser";


export const jobController = async (req, res) => {
    const userUUID = req.userUUID;
    const jobDetails = req.body.job;

    logger.info("Job Service::  Received job request");

    // TODO:Missing step validate repository

    const jobsDetails = await Job.flattenJobsDetails(jobDetails);
    console.log(jobDetails)
    for (const index in jobsDetails) {
        const jobService = await Job.getInstance();
        const jobDetails = jobsDetails[index];
        let job = await jobService.createJob(userUUID, jobDetails);
        job = job.get({ plain: true });

        if (jobDetails["regressionScript"]) {
            job.regressionScript = jobDetails["regressionScript"];
            console.log(job);
        }

        await jobService.publish(job)
            .then(() => logger.info(`Job Service:: Published new job [${job.id}]`));
        res.status(statusCode.CREATED_201).send();
    }

};

export const jobCancelController = async (req, res) => {
    const userUUID = req.userUUID;
    const jobId = req.params.jobId;

    const openlaneExecution = await OpenlaneExecution.getInstance();

    await database()["job"].findByPk(jobId)
        .then(async (result) => {
            if (result) {
                if (result.userUUID !== userUUID)
                    res.status(statusCode.UNAUTHORIZED_401).send();

                await openlaneExecution.quitProcess(jobId).then((result) => {
                    if (result === -1)
                        res.status(statusCode.NOT_FOUND_404).send();
                    else
                        res.status(statusCode.OK_200).send();
                });
            } else
                res.status(statusCode.NOT_FOUND_404).send();
        }).catch((err) => {
            logger.error(err);
            res.status(statusCode.INTERNAL_SERVER_ERROR_500).send();
        });
};

export const jobDeleteController = async (req, res) => {
    const userUUID = req.userUUID;
    const jobId = req.params.jobId;

    await database()["job"].findByPk(jobId)
        .then(async (result) => {
            if (result) {
                if (result.userUUID !== userUUID)
                    res.status(statusCode.UNAUTHORIZED_401).send();

                await database()["job"].destroy({where: {id: jobId, userUUID: userUUID}})
                    .then((result) => {
                        if (result) {
                            res.status(statusCode.OK_200).send();
                        } else {
                            res.status(statusCode.NOT_FOUND_404).send();
                        }
                    }).catch((err) => {
                        logger.error(err);
                        res.status(statusCode.INTERNAL_SERVER_ERROR_500).send();
                    });
            } else
                res.status(statusCode.NOT_FOUND_404).send();
        }).catch((err) => {
            logger.error(err);
            res.status(statusCode.INTERNAL_SERVER_ERROR_500).send();
        });
};

export const jobsGetController = async (req, res) => {
    const userUUID = req.userUUID;
    const limit = req.query.limit | 500;
    const offset = req.query.offset | 0;

    database()["job"].findAndCountAll({
        where: {
            userUUID: userUUID
        },
        limit,
        offset
    }).then((result) => {
        res.status(statusCode.OK_200).json(result);
    }).catch((err) => {
        logger.error(err);
        res.status(statusCode.INTERNAL_SERVER_ERROR_500).send();
    });
};

export const jobGetController = async (req, res) => {
    const userUUID = req.userUUID;
    const jobId = req.params.jobId;

    database()["job"].findOne({
        include: "runs",
        where: {
            userUUID: userUUID,
            id: jobId
        }
    }).then((result) => {
        res.status(statusCode.OK_200).json(result);
    }).catch((err) => {
        logger.error(err);
        res.status(statusCode.INTERNAL_SERVER_ERROR_500).send();
    });
};

export const jobReportGetController = async (req, res) => {
    const userUUID = req.userUUID;
    const jobId = req.params.jobId;

    database()["job"].findOne({
        where: {
            id: jobId
        }
    }).then((result) => {
        if (result) {
            if (result.userUUID !== userUUID)
                res.status(statusCode.UNAUTHORIZED_401).send();

            try {
                const results: any = [];
                fs.createReadStream(`./${config.openlane.job.outDirectories.reports}/${jobId}.csv`)
                    .pipe(csv())
                    .on("data", (data) => results.push(data))
                    .on("end", () => {
                        console.log(results);
                        res.status(statusCode.OK_200).json(results);
                    });
            } catch (err) {
                logger.error(err);
                res.status(statusCode.INTERNAL_SERVER_ERROR_500).send();
            }
        } else
            res.status(statusCode.NOT_FOUND_404).send();
    }).catch((err) => {
        logger.error(err);
        res.status(statusCode.INTERNAL_SERVER_ERROR_500).send();
    });
};

export const jobDownloadGetController = async (req, res) => {
    const userUUID = req.userUUID;
    const jobId = req.params.jobId;
    const runName = req.params.runName;

    database()["run"].findOne({
        include: "job",
        where: {
            jobId: jobId,
            name: runName
        }
    }).then((result) => {
        if (result) {
            if (result.job.userUUID !== userUUID)
                res.status(statusCode.UNAUTHORIZED_401).send();

            try {
                const file = `./${config.openlane.job.outDirectories.downloads}/${userUUID}-${jobId}-${runName}.zip`;
                const filename = path.basename(file);
                const mimetype = mime.getType(file);
                res.setHeader("Content-disposition", "attachment; filename=" + filename);
                res.setHeader("Content-type", mimetype);
                const filestream = fs.createReadStream(file);
                filestream.pipe(res);
            } catch (e) {
                logger.error(e.message);
                res.status(statusCode.INTERNAL_SERVER_ERROR_500).send();
            }
        } else
            res.status(statusCode.NOT_FOUND_404).send();
    }).catch((err) => {
        console.dir(err);
        logger.error(err.message);
        res.status(statusCode.INTERNAL_SERVER_ERROR_500).send();
    });
};
