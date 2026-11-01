import { expect, it } from "vitest";

import { formatValue } from "./AdminSecurityCenter";

it.each([
  [null, "—"],
  [undefined, "—"],
  [[], "—"],
  ["", ""],
  ["email", "email"],
  [42, "42"],
  [false, "false"],
  [true, "true"],
  [["email", "username"], "email, username"],
  [{ min: 8, max: 128 }, '{"min":8,"max":128}'],
  [[{ min: 8 }], '{"min":8}'],
  [1n, "1"],
  [Symbol("setting"), "Symbol(setting)"],
  [() => undefined, "—"],
])(
  "formats catalog value %s without default object stringification",
  (value, expected) => {
    expect(formatValue(value)).toBe(expected);
  },
);
