export const changePasswordSchema = {
  body: {
    type: "object",
    required: ["password"],
    properties: {
      password: { type: "string", minLength: 8 },
    },
  },
} as const;
