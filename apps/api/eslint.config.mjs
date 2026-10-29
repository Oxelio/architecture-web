import base from "@architecture/eslint-config";
import node from "@architecture/eslint-config/node";
import architecture from "@architecture/eslint-config/architecture";
import boundaries from "@architecture/eslint-config/api-boundaries";

export default [...base, ...node, ...architecture, ...boundaries];
