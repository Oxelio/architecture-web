import base from "@architecture/eslint-config";
import adapter from "@architecture/eslint-config/adapter";
import node from "@architecture/eslint-config/node";

export default [...base, ...node, ...adapter];
