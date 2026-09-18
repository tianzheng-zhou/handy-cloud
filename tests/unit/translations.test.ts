import { expect, test } from "bun:test";
import {
  interpolationVariables,
  validate,
} from "../../scripts/check-translations";

test("translation validation rejects missing keys and altered interpolation variables", () => {
  expect(
    validate(
      { message: "{{name}}: {{count, number}}", nested: { value: "ok" } },
      { message: "{{name}}", extra: "oops" },
    ),
  ).toEqual([
    "Interpolation variables differ: message",
    "Missing/invalid: nested.value",
    "Extra: extra",
  ]);
  expect(
    interpolationVariables("{{- html}} {{ count, number }} {{count}}"),
  ).toEqual(["count", "html"]);
  expect(validate({ text: "{{a}} {{b}}" }, { text: "{{b}} {{a}}" })).toEqual(
    [],
  );
});
