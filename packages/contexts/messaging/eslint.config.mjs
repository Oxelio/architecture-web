import config from "@architecture/eslint-config/node";
import base from "@architecture/eslint-config";
import context from "@architecture/eslint-config/context";

export default [...base, ...config, ...context];
