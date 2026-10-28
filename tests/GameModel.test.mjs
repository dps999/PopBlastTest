import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GameModel } from "../assets/scripts/gameplay/GameModel.ts";

describe("GameModel", () => {
    it("starts with the supplied number of moves and zero score", () => {
        const model = new GameModel(12);
        const state = model.getState();

        assert.equal(state.getMovesLeft(), 12);
        assert.equal(state.getScore(), 0);
    });

    it("spends one move", () => {
        const model = new GameModel(3);

        model.spendMove();

        assert.equal(model.getState().getMovesLeft(), 2);
    });

    it("does not spend moves below zero", () => {
        const model = new GameModel(1);

        model.spendMove();
        model.spendMove();

        assert.equal(model.getState().getMovesLeft(), 0);
    });

    it("calculates and accumulates rewards using the configured tile price", function rewards() {
        const model = new GameModel(5, 25);

        assert.equal(model.addScoreForRemovedTiles(4), 100);
        assert.equal(model.addScoreForRemovedTiles(1), 25);

        assert.equal(model.getState().getScore(), 125);
    });

    it("preserves score and returns zero when no tiles are removed", function noRemoval() {
        const model = new GameModel();
        assert.equal(model.addScoreForRemovedTiles(2), 20);
        assert.equal(model.addScoreForRemovedTiles(0), 0);
        assert.equal(model.addScoreForRemovedTiles(-1), 0);
        assert.equal(model.getScore(), 20);
    });

    it("validates the configured tile price", function scoreConfiguration() {
        assert.throws(function zeroPrice() { new GameModel(0, 0); });
        assert.throws(function negativePrice() { new GameModel(0, -1); });
        assert.throws(function fractionalPrice() { new GameModel(0, 1.5); });
        assert.throws(function infinitePrice() { new GameModel(0, Infinity); });
        assert.throws(function nanPrice() { new GameModel(0, NaN); });
    });
});
