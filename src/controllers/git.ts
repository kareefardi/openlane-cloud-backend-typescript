import { Git } from "../services";
import { logger, database } from "../utils";


export const gitController = async (data) => {
    let jobDetails = JSON.parse(data.value).message;

    const git = await Git.getInstance();

    await database()["job"].update({status: "cloning"}, {where: {id: jobDetails.id}});

    await git.cloneRepo(jobDetails.repoURL, jobDetails.id, jobDetails.designName)
        .then(() => logger.info("Cloning Done"));

    jobDetails = await database()["job"].findByPk(jobDetails.id);
    console.log("A7EEEEĘ");
    await git.publish("git-out", jobDetails);
};
