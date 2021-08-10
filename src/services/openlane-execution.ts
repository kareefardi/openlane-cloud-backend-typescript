import { logger, MicroService, database, config } from "../utils";
import * as shell from "shelljs";
import * as fs from "fs";
import * as chokidar from "chokidar";
import * as readline from "readline";
import { Op } from "sequelize";
import  constants from "../utils";

/**
 * @class ResourceService
 * @classdesc Resource service responsible for running and managing already running jobs
 */
export default class OpenlaneExecution extends MicroService {
    public static openlaneExecution;

    readonly config;
    private jobs: Map<any, any>;

    constructor(config) {
        super();
        this.config = config;
        this.jobs = new Map();
    }

    public static async getInstance(): Promise<OpenlaneExecution> {
        if (!this.openlaneExecution) {
            this.openlaneExecution = new OpenlaneExecution(config.openlane);
            await this.openlaneExecution.init("resources", ["resources-out"], ["resources-in"]);
            return this.openlaneExecution;
        }
        return this.openlaneExecution;
    }

    updateCPU() {
        // const cpuCount = os.cpus().length;
        // logger.warn(cpuCount);
        //  logger.warn(os.totalmem() / (1024 * 1024 * 1024));
    }

    /**
     * Create the command string for running the openlane shell script
     * @param tag
     * @param jobDetails
     * @returns {string}
     */
    RunCommandStringFactory(tag, jobDetails): string {
        const args = {};
        const jobDesignDirectoryPath = `./${this.config.directories.designs}/${jobDetails.id}-${jobDetails.designName}`;
        switch (jobDetails.type) {
            case "normal":
                args["type"] = "regular";
                args["design-dir"] = jobDesignDirectoryPath;
                args["design-name"] = `${jobDetails.designName}`;
                args["input-bucket"] = constants.INPUT_BUCKET;
                args["output-bucket"] = constants.OUTPUT_BUCKET;
                args["tag"] = tag;
                args["threads"] = 1;
                args["cpus"] = 1;
                args["memory"] = "4G";
                break;
            case "exploratory":
                args["type"] = jobDetails.type;
                args["design-dir"] = jobDesignDirectoryPath;
                args["design-name"] = `${jobDetails.designName}`;
                args["input-bucket"] = constants.INPUT_BUCKET;
                args["output-bucket"] = constants.OUTPUT_BUCKET;
                args["threads"] = 4;
                args["tag"] = tag;
                args["cpus"] = 4;
                args["memory"] = "16G";
                const regressionScriptName = this.RegressionScriptFileFactory(tag, jobDetails.regressionScript);
                args["regression-script"] = `./${this.config.directories.scripts}/${regressionScriptName}`;
                break;
            default:
        }
        let runCommand = this.config.job.executionCommand;
        for (const arg in args)
            if (args.hasOwnProperty(arg))
                runCommand += ` --${arg}=${args[arg]}`;
        return runCommand;
    }

    /**
     * Creates a regression configuration file in the scripts directory of openlane
     * @param regressionScriptFields
     * @param tag
     * @returns {string}
     */
    RegressionScriptFileFactory(tag, regressionScriptFields): string {
        let regressionScript = "";
        for (const property in regressionScriptFields) {
            if (regressionScriptFields.hasOwnProperty(property))
                if (property !== "extra")
                    regressionScript += `${property}=(${regressionScriptFields[property]})\n`;
                else if (regressionScriptFields[property] !== "")
                    regressionScript += `\n${property}="${regressionScriptFields[property]}\n"\n`;
        }
        const regressionScriptName = `${tag}-regression.config`;
        console.log(regressionScript);
        console.log(`${this.config.path}/${this.config.directories.scripts}/${regressionScriptName}`);
        fs.writeFileSync(`${this.config.path}/${this.config.directories.scripts}/${regressionScriptName}`, regressionScript);
        return regressionScriptName;
    }

    /**
     * Run a job and setup event listeners on the child process
     * @param jobDetails
     * @returns {Promise<boolean>}
     */
    async runJob(jobDetails) {
        // if (jobDetails.notificationsEnabled)
        //     this.notfication.sendPushNotification("jobs", "Your Job is now running", "");

        const self = this;

        // Generate a uuid tag for this run
        const tag = jobDetails.id;
        logger.info(`Generated tag for job run: ${tag}`);

        // Construct arguments for job type
        logger.info("Constructing args for shell script...");
        const commandString = this.RunCommandStringFactory(tag, jobDetails);
        logger.info(`Command string: ${commandString}`);

        // Initialize watcher.
        const watcher = chokidar.watch(".", {
            persistent: true,
            ignoreInitial: true,
            usePolling: true,
            awaitWriteFinish: false,
            depth: 0,
        });

        return new Promise(async resolve => {
            // Add watcher event listeners.
            watcher
                .on("error", error => logger.info(`Watcher error: ${error}`))
                .on("add", async path => {
                    if (path === `slurm-${tag}.out`) {
                        logger.info(`Directory Watcher:: File ${path} has been added`);
                        await watcher.unwatch(".");
                        watcher.add(path);

                        const fileStream = fs.createReadStream(path);
                        const rl = readline.createInterface({
                            input: fileStream,
                            crlfDelay: Infinity
                        });
                        const job = self.jobs.get(jobDetails.id);
                        for await (const line of rl) {
                            if (line.includes("running") && job && !job.running) {
                                database()["job"].update({status: "running"}, {where: {id: jobDetails.id}})
                                    .then(() => logger.info(`Job ${jobDetails.id} is running and has started execution`));

                                const keywords = line.split("] ")[1].split(" ");
                                database()["run"].create({
                                    jobId: jobDetails.id,
                                    name: keywords[1],
                                    status: "running"
                                }).then((run) => {
                                    run.currentStage = -1;
                                    const job = self.jobs.get(jobDetails.id);
                                    job.runs.push(run);
                                    job.running = true;
                                    self.jobs.set(jobDetails.id, job);
                                    logger.info(`Run ${keywords[1]} has started at ${run.createdAt}`);
                                });
                            } else if (line.includes("finished") && job) {
                                const completedAt = new Date().getTime();
                                const keywords = line.split("] ")[1].split(" ");
                                database()["run"].update({status: "completed", completedAt: completedAt}, {
                                    where: {
                                        jobId: jobDetails.id,
                                        name: keywords[1],
                                        status: {[Op.ne]: "completed"}
                                    }
                                }).then((result) => {
                                    if (result[0])
                                        logger.info(`Run ${keywords[1]} has completed at ${completedAt.toLocaleString()}`);
                                });
                            } else if (line.includes("Done") && job) {
                                logger.info(`Execution of job ${jobDetails.id} has completed`);
                                // Stop watching log file
                                await watcher.close();
                                const job = self.jobs.get(jobDetails.id);
                                clearInterval(job.intervalId);
                                this.jobs.delete(jobDetails.id);
                                job.directoryWatcher = undefined;
                                job.intervalId = undefined;
                                resolve(job);
                            }
                        }
                    }
                })
                .on("change", async (path) => {
                    if (path === `slurm-${tag}.out`) {
                        logger.info(`Directory Watcher:: File ${path} has been changed`);

                        const fileStream = fs.createReadStream(path);
                        const rl = readline.createInterface({
                            input: fileStream,
                            crlfDelay: Infinity
                        });
                        const job = self.jobs.get(jobDetails.id);
                        for await (const line of rl) {
                            if (line.includes("running") && job && !job.running) {
                                database()["job"].update({status: "running"}, {where: {id: jobDetails.id}})
                                    .then(() => logger.info(`Job ${jobDetails.id} is running and has started execution`));

                                const keywords = line.split("] ")[1].split(" ");
                                database()["run"].create({
                                    jobId: jobDetails.id,
                                    name: keywords[1],
                                    status: "running"
                                }).then((run) => {
                                    run.currentStage = -1;
                                    const job = self.jobs.get(jobDetails.id);
                                    job.runs.push(run);
                                    job.running = true;
                                    self.jobs.set(jobDetails.id, job);
                                    logger.info(`Run ${keywords[1]} has started at ${run.createdAt}`);
                                });
                            } else if (line.includes("finished") && job) {
                                const completedAt = new Date().getTime();
                                const keywords = line.split("] ")[1].split(" ");
                                database()["run"].update({status: "completed", completedAt: completedAt}, {
                                    where: {
                                        jobId: jobDetails.id,
                                        name: keywords[1],
                                        status: {[Op.ne]: "completed"}
                                    }
                                }).then((result) => {
                                    if (result[0])
                                        logger.info(`Run ${keywords[1]} has completed at ${completedAt}`);
                                });
                            } else if (line.includes("Done") && job) {
                                // Stop watching log file
                                await watcher.close();
                                const job = self.jobs.get(jobDetails.id);
                                clearInterval(job.intervalId);
                                this.jobs.delete(jobDetails.id);
                                job.directoryWatcher = undefined;
                                job.intervalId = undefined;
                                resolve(job);
                            }
                        }
                    }
                });

            await new Promise(resolve => {
                watcher.on("ready", () => {
                    // the watcher is ready to respond to changes
                    logger.info("Initial scan complete. Ready for changes");
                    logger.info("Directory watcher Ready...");
                    resolve();
                });
            });

            logger.info(`Executing openlane ${jobDetails.type} shell script...`);
            const childProcess = shell.exec(commandString, {silent: true, async: true});


            // Status Update Polling
            logger.info(`Starting run status update polling...`);
            const intervalId = setInterval(() => {
                self.statusUpdate(jobDetails.id, jobDetails.designName, resolve);
            }, 1000);

            // Save job to map
            logger.info(`Saving Job: ${jobDetails.id} to map`);

            this.jobs.set(jobDetails.id, {
                process: childProcess,
                tag: tag,
                directoryWatcher: watcher,
                stopped: false,
                runs: [],
                running: false,
                slurmJobId: undefined,
                intervalId: intervalId
            });

            // Register event listeners on both err and out pipes
            logger.info(`Registering event listeners for Job: ${jobDetails.id}`);

            // Out Pipe
            // @ts-ignore
            childProcess.stdout.on("data", (data) => {
                // Log
                logger.info(data);

                if (data.toLowerCase().includes("submitted")) {
                    const slurmJobID = parseInt(data.split(" ")[3].replace(/\n/g, ""), 10);


                    const job = self.jobs.get(jobDetails.id);
                    job.slurmJobId = slurmJobID;
                    self.jobs.set(jobDetails.id, job);

                    database()["job"].update({
                        status: "scheduled",
                        slurmJobId: slurmJobID
                    }, {where: {id: jobDetails.id}})
                        .then(() => logger.info(`Job ${jobDetails.id} has been scheduled for execution with slurm with ID ${slurmJobID}`));
                }

                // Stream
                // self.jobMonitoring.send(jobDetails.userUUID, data);
            });
            // Err Pipe
            // @ts-ignore
            childProcess.stderr.on("data", function (err) {
                // Log
                logger.error(err);

                database()["job"].update({status: "failed"}, {where: {id: jobDetails.id}})
                    .then(() => logger.info(`Job ${jobDetails.id} has been marked as failed`));

                // Stream
                // self.jobMonitoring.send(jobDetails.userUUID, data);
            });
        });
    }

    /**
     * Quits the job process
     * @param jobId
     * @returns {Promise<void>}
     */
    async quitProcess(jobId) {
        const job = this.jobs.get(jobId.toString());
        if (job) {
            return database()["job"].update({status: "stopping"}, {where: {id: jobId}}).then((result) => {
                logger.info(`Stopping Job #${jobId}`);
                job.stopped = true;
                this.jobs.set(jobId, job);
                const childProcess = shell.exec(`scancel ${job.slurmJobId}`, {
                    silent: true,
                    async: true
                });
                // @ts-ignore
                childProcess.stdout.on("data", (data) => {
                    // Log
                    logger.info(data);
                });
                // @ts-ignore
                childProcess.stderr.on("data", (err) => {
                    // Log
                    logger.error(err);
                });
                return new Promise(async resolve => {
                    childProcess.on("exit", (c) => {
                        resolve(result);
                    });
                });
            });
        } else {
            return -1;
        }
    }

    /**
     * Checks for stage changes for each run in this job
     * @param jobId
     * @param designName
     * @param resolve
     */
    statusUpdate(jobId, designName, resolve) {
        const self = this;
        const job = this.jobs.get(jobId);
        if (job) {
            if (job.stopped) {
                const job = self.jobs.get(jobId);
                job.directoryWatcher.close();
                clearInterval(job.intervalId);
                this.jobs.delete(jobId);
                job.directoryWatcher = undefined;
                job.intervalId = undefined;
                resolve(job);
            } else {
                for (let i = 0; i < job.runs.length; i++) {
                    const scanDirectoryPath = `${this.config.path}/${this.config.directories.designs}/${jobId}-${designName}/${this.config.directories.runs}/${job.runs[i].name}/${this.config.directories.logs}/`;

                    // Skip iteration if the index of the current stage of the run is equal to the last stage index
                    if (job.runs[i].currentStage === (this.config.job.stages.length - 1))
                        continue;

                    // Scan the directory of the current stage for log files
                    fs.readdir(job.runs[i].currentStage === -1 ?
                        scanDirectoryPath :
                        scanDirectoryPath + this.config.job.stages[job.runs[i].currentStage], function (err, items) {
                        // No directory yet
                        if (err) {
                            logger.error(err.message);
                            return;
                        }
                        // First Stage
                        if (items.length > 0) {
                            job.runs[i].currentStage++;
                            database()["run"].update({
                                status: `running-${self.config.job.stages[job.runs[i].currentStage]}`
                            }, {where: {id: job.runs[i].id}})
                                .then(() => {
                                    self.jobs.set(jobId, job);
                                });
                        }
                    });
                }
            }
        }
    }
}
