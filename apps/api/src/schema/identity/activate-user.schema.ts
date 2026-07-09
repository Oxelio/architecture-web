import { Type } from "@sinclair/typebox";

export const ActivateUserParamsSchema = Type.Object({
  userId: Type.String(),
});

export const activateUserSchema = {
  params: ActivateUserParamsSchema,
};
