import * as EventEmitter from "events";
import { DataTypes, Sequelize, } from "sequelize";

import constants from "./utils/constants";
import { logger } from "../../src/utils";

export default class SequelizeDB extends EventEmitter {
    connection;
    private db: any;
    private force_drop: boolean;

    constructor(config) {
        super();
        this.db = {};
        this.force_drop = config.force_drop;
        
        logger.info(`SQLITE_CONNECTOR :: Connecting to SQLITE database`);
        this.connection = new Sequelize({
            dialect: "sqlite",
            storage: config.database,
            logging: false,
            // logging: msg => logger.debug(msg),
            pool: {
                max: config.connectionLimit,
                min: 0,
                acquire: 30000,
                idle: 10000
            }
        });
    }

    async initializeDriver() {
        try {
            await this.connection.authenticate();
            logger.info("Connection to sqlite has been established successfully.");
            this.emit(constants.EventEnums.CONNECTION_SUCCESS.toString(), this.connection);
        } catch (error) {
            logger.error("Unable to connect to the sqlite database:", error);
            this.emit(constants.EventEnums.CONNECTION_ERROR.toString(), error);
        }
        // logger.error(`MONGO_CONNECTOR :: There was an disconnected in mongodb ${error}`);
        // _this.emit(constants.EventEnums.CONNECTION_END.toString(), error);
    }

    async loadModels() {
        const models = await import( "../../src/models");
        Object.keys(models.default).forEach(modelName => {
            this.db[modelName] = models.default[modelName](this.connection, DataTypes);
        });
        Object.keys(models.default).forEach(modelName => {
            if (this.db[modelName].associate) {
                this.db[modelName].associate(this.db);
            }
        });

        await this.connection.sync({force: this.force_drop});

        this.db["sequelize"] = this.connection;
    }

    getSequelizeInstance() {
        return this.db;
    }
}
