const HOST = process.env.HOST || "0.0.0.0";

const INPUT_BUCKET = process.env.INPUT_BUCKET;

const OUTPUT_BUCKET = process.env.OUTPUT_BUCKET;

const ENVIRONMENTS = {
    "dev" : "dev",
    "test" : "test",
    "stage" : "stage",
    "prod" : "production",
};

const ENV = (process.env.ENV || process.env.NODE_ENV) || ENVIRONMENTS.dev;

const PORT = process.env.PORT || 3030;

const REDIS_SERVER_TYPE = {
    REDIS: "REDIS",
    REDIS_SENTINEL: "REDIS_SENTINEL",
    REDIS_CLUSTER: "REDIS_CLUSTER"
};

const CONNECTIONS  = {
    "REDIS" : "REDIS",
    "SQLITE": "SQLITE"
};

export default {
    ENVIRONMENTS,
    INPUT_BUCKET,
    OUTPUT_BUCKET,
    ENV,
    PORT,
    HOST,
    CONNECTIONS,
    REDIS_SERVER_TYPE
};

