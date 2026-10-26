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

    it("adds score points cumulatively", () => {
        const model = new GameModel(5);

        model.addScore(100);
        model.addScore(25);

        assert.equal(model.getState().getScore(), 125);
    });
});
