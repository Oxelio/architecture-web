import base from "@architecture/eslint-config";
import architecture from "@architecture/eslint-config/architecture";
import node from "@architecture/eslint-config/node";
import react from "@architecture/eslint-config/react-vite";

export default [...base, ...node, ...react, ...architecture];
