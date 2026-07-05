export const changeEmailSchema = {
  body: {
    type: "object",
    required: ["email"],
    properties: {
      email: { type: "string" },
    },
  },
} as const;
