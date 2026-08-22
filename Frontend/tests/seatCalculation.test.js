import assert from "node:assert/strict";
import test from "node:test";
import { calculateSeatUpdate } from "../src/utils/seatCalculation.js";
test("calculates occupied and available seats", () => {
    assert.deepEqual(calculateSeatUpdate(30, 5, 2, 50), {
        occupiedSeats: 33,
        availableSeats: 17,
    });
});
test("rejects negative passenger counts", () => {
    assert.throws(() => calculateSeatUpdate(30, -1, 0, 50), /cannot be negative/);
});
test("rejects occupancy below zero or above capacity", () => {
    assert.throws(() => calculateSeatUpdate(2, 0, 3, 50), /cannot exceed/);
    assert.throws(() => calculateSeatUpdate(48, 3, 0, 50), /exceed the bus capacity/);
});
test("rejects non-integer passenger updates", () => {
    assert.throws(() => calculateSeatUpdate(20, 1.5, 0, 50), /whole numbers/);
});
