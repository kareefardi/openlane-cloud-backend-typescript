import {

    Model,
    HasManyGetAssociationsMixin,
    HasManyAddAssociationMixin,
    HasManyHasAssociationMixin,
    Association,
    HasManyCountAssociationsMixin,
    HasManyCreateAssociationMixin,
    Optional,
} from "sequelize";
import { Run } from "./run";


// These are all the attributes in the User model
interface JobAttributes {
    id: string;
    userUUID: string;
    repoURL: string;
    designName: string;
    config: string;
    type: string;
    pdkVariant: string;
    notificationsEnabled: boolean;
    status: string;
    slurmJobId: number | null;
    completedAt: Date | null;
}

interface JobCreationAttributes extends Optional<JobAttributes, "id" | "type" | "pdkVariant" | "notificationsEnabled" | "status" | "slurmJobId" |"completedAt"> {
}

export class Job extends Model<JobAttributes, JobCreationAttributes>
    implements JobAttributes {
    public id!: string;
    public userUUID!: string;
    public repoURL!: string;
    public designName!: string;
    public config!: string;
    public pdkVariant!: string;
    public type!: string;
    public notificationsEnabled!: boolean;
    public status!: string;
    public slurmJobId!: number | null;
    public completedAt!: Date | null;

    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    public getRuns!: HasManyGetAssociationsMixin<Run>;
    public addRuns!: HasManyAddAssociationMixin<Run, number>;
    public hasRun!: HasManyHasAssociationMixin<Run, number>;
    public countRuns!: HasManyCountAssociationsMixin;
    public createRuns!: HasManyCreateAssociationMixin<Run>;

    public readonly runs?: Run[]; // Note this is optional since it's only populated when explicitly requested in code

    public static associations: {
        runs: Association<Job, Run>;
    };

    static associate(models) {
        models["job"].hasMany(models["run"], {
            sourceKey: "id",
            foreignKey: "jobId",
            as: "runs",
        });
    }
}


export function JobModel(sequelize, DataTypes) {
    Job.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            userUUID: {
                type: DataTypes.UUID,
                allowNull: false
            },
            repoURL: {
                type: new DataTypes.STRING(1024),
                allowNull: false,
            },
            config: {
                type: new DataTypes.STRING(512),
                allowNull: false,
            },
            designName: {
                type: new DataTypes.STRING(512),
                allowNull: false,
            },
            pdkVariant: {
                type: DataTypes.ENUM(
                    "sky130_fd_sc_hd",
                    "sky130_fd_sc_hs",
                    "sky130_fd_sc_ms",
                    "sky130_fd_sc_ls",
                    "sky130_fd_sc_hdll",
                ),
                defaultValue: "sky130_fd_sc_hd"
            },
            notificationsEnabled: {
                type: DataTypes.BOOLEAN,
                defaultValue: true
            },
            type: {
                type: DataTypes.ENUM(
                    "normal",
                    "exploratory"
                ),
                defaultValue: "normal"
            },
            status: {
                type: DataTypes.ENUM(
                    "published",
                    "preparing-workflow",
                    "cloning",
                    "scheduling",
                    "scheduled",
                    "running",
                    "archiving",
                    "completed",
                    "stopping",
                    "stopped",
                    "failed"
                ),
                defaultValue: "published"
            },
            slurmJobId: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            completedAt: {
                type: DataTypes.DATE,
                allowNull: true,
            }
        },
        {
            tableName: "jobs",
            sequelize,
        }
    );
    return Job;
}

