import { MicroService, config } from "../utils";
import { exec, rm } from "shelljs";

/**
 * Business Logic function:
 * take cheese from a box an squeeze it
 */
export default class Git extends MicroService {
    public static git;
    readonly reposPath;
    readonly config;

    constructor(config) {
        super();
        this.config = config;
        this.reposPath = `${this.config.path}/${this.config.directories.designs}`;
    }

    public static async getInstance(): Promise<Git> {
        if (!this.git) {
            this.git = new Git(config.openlane);
            await this.git.init("git", ["git-out"], ["git-in"]);
            return this.git;
        }
        return this.git;
    }


    svnFormat(repoURL) {
        const subFolderKeyword = "tree/master";
        let formatedUrl = "";
        if (repoURL.search(subFolderKeyword) > 0) {
            formatedUrl = repoURL.replace(subFolderKeyword, "trunk");
        } else {
            formatedUrl = repoURL.concat("/trunk");
        }
        return formatedUrl;
    }
    async cloneRepo(repoURL, jobId, designName) {
        const formatedUrl = this.svnFormat(repoURL);
        exec(`svn export ${formatedUrl} ${this.reposPath}/${jobId}-${designName}`);

        // const data = fs.readFileSync(`${this.reposPath}/${jobId}-${designName}/config.tcl`, 'utf-8');
        // let newValue = data.replace(/^(set ::env\(DESIGN_NAME\) ").+(")/gm, `$1${jobId}-${designName}$2`);
        // newValue = newValue.replace(/^(set ::env\(VERILOG_FILES\) \[glob \$::env\(OPENLANE_ROOT\)\/designs\/).+(\/src\/\*\.v])$/gm, `$1${jobId}-${designName}$2`);
        // fs.writeFileSync(`${this.reposPath}/${jobId}-${designName}/config.tcl`, newValue, 'utf-8');
    }

    async deleteRepo(jobId, designName) {
        rm("-rf", `${this.reposPath}/${jobId}-${designName}`);
    }
}
