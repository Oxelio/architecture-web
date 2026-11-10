import config from "@architecture/eslint-config/node";
import base from "@architecture/eslint-config";
import { forContext } from "@architecture/eslint-config/context";

export default [...base, ...config, ...forContext("audit")];
