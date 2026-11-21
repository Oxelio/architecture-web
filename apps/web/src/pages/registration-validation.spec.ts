import { zodResolver } from "@hookform/resolvers/zod";
import { createFormControl } from "react-hook-form";
import { expect, it, vi } from "vitest";
import { z } from "zod";

it("reports a Zod 4 login identifier error and submits after correction", async () => {
  const invalidEmail = "Email invalide";
  const schema = z
    .object({
      loginKind: z.enum(["email", "username"]),
      loginValue: z.string().min(1),
    })
    .refine(
      ({ loginKind, loginValue }) =>
        loginKind !== "email" || z.email().safeParse(loginValue).success,
      { path: ["loginValue"], message: invalidEmail },
    );
  const form = createFormControl<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { loginKind: "email", loginValue: "invalid-address" },
  });
  const onValid = vi.fn();
  const onInvalid = vi.fn();
  const submit = form.handleSubmit(onValid, onInvalid);

  await expect(submit()).resolves.toBeUndefined();
  expect(onValid).not.toHaveBeenCalled();
  expect(onInvalid).toHaveBeenCalledWith(
    expect.objectContaining({
      loginValue: expect.objectContaining({ message: invalidEmail }),
    }),
    undefined,
  );

  form.setValue("loginValue", "member@example.invalid");
  await submit();
  expect(onValid).toHaveBeenCalledExactlyOnceWith(
    { loginKind: "email", loginValue: "member@example.invalid" },
    undefined,
  );
  expect(onInvalid).toHaveBeenCalledOnce();
});
