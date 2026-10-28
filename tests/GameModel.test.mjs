import assert from "node:assert/strict";
import { it } from "node:test";
import { GameModel } from "../assets/scripts/gameplay/GameModel.ts";

it("starts with configured moves, target and zero score", function initialState() {
    const model = new GameModel(12, 25, 800);
    assert.strictEqual(model.getState(), model);
    assert.equal(model.getMovesLeft(), 12);
    assert.equal(model.getScore(), 0);
    assert.equal(model.getTargetScore(), 800);
    assert.equal(model.isWon(), false);
    assert.equal(model.isLost(), false);
});

it("applies scoring and moves together using the configured tile price", function normalTurns() {
    const model = new GameModel(5, 25);
    model.applyTurn(4, true);
    model.applyTurn(1, true);
    assert.equal(model.getScore(), 125);
    assert.equal(model.getMovesLeft(), 3);
});

it("supports free booster removals and zero-score teleports", function boosters() {
    const model = new GameModel(5);
    model.applyTurn(4, false);
    model.applyTurn(0, false);
    assert.equal(model.getScore(), 40);
    assert.equal(model.getMovesLeft(), 5);
});

it("wins at the exact target on the last move and ignores later actions", function winPriority() {
    const model = new GameModel(1, 10, 500);
    model.applyTurn(50, true);
    assert.equal(model.isWon(), true);
    assert.equal(model.isLost(), false);
    assert.equal(model.getMovesLeft(), 0);
    model.applyTurn(5, true);
    assert.equal(model.getScore(), 500);
    assert.equal(model.getMovesLeft(), 0);
});

it("wins when exceeding the target without spending a move", function boosterVictory() {
    const model = new GameModel(3, 10, 500);
    model.applyTurn(51, false);
    assert.equal(model.isWon(), true);
    assert.equal(model.isLost(), false);
    assert.equal(model.getMovesLeft(), 3);
});

it("loses below the target and never spends below zero", function loss() {
    const model = new GameModel(1);
    model.applyTurn(2, true);
    model.applyTurn(100, true);
    assert.equal(model.isLost(), true);
    assert.equal(model.isWon(), false);
    assert.equal(model.getScore(), 20);
    assert.equal(model.getMovesLeft(), 0);
});

it("validates all numeric configuration and removal counts without partial mutation", function validation() {
    const invalid = [0, -1, 1.5, Infinity, NaN];
    for (let i = 0; i < invalid.length; i++) {
        const value = invalid[i];
        assert.throws(function moves() { new GameModel(value); });
        assert.throws(function price() { new GameModel(20, value); });
        assert.throws(function target() { new GameModel(20, 10, value); });
    }
    const model = new GameModel();
    assert.throws(function removal() { model.applyTurn(-1, true); });
    assert.equal(model.getScore(), 0);
    assert.equal(model.getMovesLeft(), 20);
});
