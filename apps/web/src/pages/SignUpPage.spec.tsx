import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";

import { SignUpPage } from "./SignUpPage";

const formState = vi.hoisted(() => ({
  loginError: undefined as { message: string } | undefined,
}));

vi.mock("react-hook-form", () => ({
  useForm: () => ({
    register: (name: string) => ({ name }),
    handleSubmit: () => undefined,
    formState: { errors: { loginValue: formState.loginError } },
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function renderSignUpPage() {
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SignUpPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

it("associates the identifier with its alert only when it has an error", () => {
  const initial = renderSignUpPage();
  expect(initial).toContain('aria-invalid="false"');
  expect(initial).not.toContain("aria-describedby");

  const message = "auth.invalidEmail";
  formState.loginError = { message };
  const invalid = renderSignUpPage();
  const descriptionId = /aria-describedby="([^"]+)"/u.exec(invalid)?.[1];

  expect(descriptionId).toBeDefined();
  expect(invalid).toContain('aria-invalid="true"');
  expect(invalid).toContain(`id="${descriptionId}" role="alert"`);
  expect(invalid).toContain(message);
});
