import { test } from "node:test";
import assert from "node:assert/strict";
import { autoScaleForPointer } from "../src/scale-mode.ts";
test("Auto switches in the outer 7% and retains its scale throughout the middle", () => {
  assert.equal(autoScaleForPointer("linear", 0.92), "linear");
  assert.equal(autoScaleForPointer("linear", 0.93), "logarithmic");
  assert.equal(autoScaleForPointer("logarithmic", 0.08), "logarithmic");
  assert.equal(autoScaleForPointer("logarithmic", 0.07), "linear");
  for (const position of [0.1, 0.2, 0.5, 0.8, 0.9]) {
    assert.equal(autoScaleForPointer("linear", position), "linear");
    assert.equal(autoScaleForPointer("logarithmic", position), "logarithmic");
  }
  for (const position of [-1, 2, NaN])
    assert.equal(autoScaleForPointer("linear", position), "linear");
});
