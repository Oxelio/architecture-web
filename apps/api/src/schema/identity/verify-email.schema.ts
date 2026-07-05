export const verifyEmailSchema = {
  querystring: {
    type: "object",
    required: ["token"],
    properties: {
      token: { type: "string" },
    },
  },
} as const;
