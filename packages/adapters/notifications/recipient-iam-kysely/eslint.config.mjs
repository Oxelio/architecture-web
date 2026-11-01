import base from "@architecture/eslint-config";
import node from "@architecture/eslint-config/node";
import adapter from "@architecture/eslint-config/adapter";
export default [...base, ...node, ...adapter];
