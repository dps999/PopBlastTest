import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { BoardModel } from "../assets/scripts/board/BoardModel.ts";
import { BoardEngine } from "../assets/scripts/board/BoardEngine.ts";
import { BoardController } from "../assets/scripts/board/BoardController.ts";
import { BoosterController } from "../assets/scripts/boosters/BoosterController.ts";
import { BoosterModel } from "../assets/scripts/boosters/BoosterModel.ts";
const { GameController } = await import(await loadGameModule("gameplay/GameController.ts"));
const { GameSession } = await import(await loadGameModule("gameplay/GameSession.ts"));
import { GameModel } from "../assets/scripts/gameplay/GameModel.ts";
import { ThresholdCreationStrategy } from "../assets/scripts/superTiles/SuperTileStrategies.ts";
import { loadGameModule, RowEffectStrategy, ColumnEffectStrategy } from "./helpers/CocosComponents.mjs";

const { default: GameView } = await import(await loadGameModule("gameplay/GameView.ts"));
const { default: GameOverPopupView } = await import(await loadGameModule("gameplay/GameOverPopupView.ts"));
const { default: BombBoosterStrategy } = await import(await loadGameModule("boosters/BombBoosterStrategy.ts"));
const { default: TeleportBoosterStrategy } = await import(await loadGameModule("boosters/TeleportBoosterStrategy.ts"));

class ScoreLabel {
    private value: string = "999";
    public writes: number = 0;

    public get string(): string {
        return this.value;
    }

    public set string(value: string) {
        this.value = value;
        this.writes++;
    }
}

class BoardViewStub {
    public selected: number = -1;
    public removals: number = 0;
    public scoreAtRemoval: string = "";
    private readonly label: ScoreLabel;

    constructor(label: ScoreLabel) {
        this.label = label;
    }

    public initRender(): void {}
    public transformTile(): void {}
    public swapTiles(): void {}
    public fallTiles(): void {}
    public renderButton(): void {}
    public setInputLocked(_locked: boolean): void {}
    public waitForAnimations(): Promise<boolean> { return Promise.resolve(true); }
    public mergeTiles(): void { this.removeTiles(); }

    public setSelectedCell(index: number): void {
        this.selected = index;
    }

    public removeTiles(): void {
        this.removals++;
        this.scoreAtRemoval = this.label.string;
    }
}

class SpawnStub {
    public spawn(cells: number[], indices?: number[]): number {
        let count = 0;
        for (let i = 0; i < cells.length; i++) {
            if (cells[i] < 0) {
                cells[i] = i % 3;
                if (indices) {
                    indices[count] = i;
                }
                count++;
            }
        }
        return count;
    }
}

class ScoringFixture {
    public readonly boardModel: BoardModel = new BoardModel(5, 5);
    public readonly gameModel: GameModel;
    public readonly label: ScoreLabel = new ScoreLabel();
    public readonly boardView: BoardViewStub = new BoardViewStub(this.label);
    public readonly gameView = new GameView();
    public readonly movesLabel: ScoreLabel = new ScoreLabel();
    public readonly session = new GameSession();
    public readonly lostPopup = { count: 0, show(): void { this.count++; } };
    public readonly wonPopup = { count: 0, show(): void { this.count++; } };
    public readonly boosters: BoosterController;
    public readonly input: GameController;

    constructor(pointsPerTile: number = 10, moves: number = 3, target: number = 500) {
        this.gameModel = new GameModel(moves, pointsPerTile, target);
        const row = new RowEffectStrategy();
        row.minimumGroupSize = 5;
        const column = new ColumnEffectStrategy();
        column.minimumGroupSize = 7;
        const creation = new ThresholdCreationStrategy([row, column], 3);
        const engine = new BoardEngine(this.boardModel, 5, 25, creation);
        const board = new BoardController(this.boardModel, this.boardView, engine, new SpawnStub());
        const definitions = [
            { effect: new BombBoosterStrategy(), initialCount: 3, icon: null },
            { effect: new TeleportBoosterStrategy(), initialCount: 3, icon: null }
        ];
        this.boosters = new BoosterController(definitions, new BoosterModel(definitions),
            this.boardModel, engine, this.boardView, this.boardView, 5, 25);
        Reflect.set(this.gameView, "scoreLabel", this.label);
        Reflect.set(this.gameView, "movesLabel", this.movesLabel);
        Reflect.set(this.gameView, "lostPopup", this.lostPopup);
        Reflect.set(this.gameView, "wonPopup", this.wonPopup);
        this.input = new GameController(board, this.boosters, this.gameModel, this.session, this.gameView);
        this.input.init();
    }
}

it("starts the HUD at zero and scores a group once after its animation pipeline", async function ordinaryGroup(): Promise<void> {
    const fixture = new ScoringFixture(7, 3, 750);
    assert.equal(fixture.label.string, "0/750");
    assert.equal(fixture.label.writes, 1);
    const cells = fixture.boardModel.getCells();
    cells.fill(2);
    cells[0] = 0;
    cells[1] = 0;
    cells[2] = 0;
    cells[3] = 1;
    const turn = fixture.input.onCellClicked(0);
    assert.equal(fixture.gameModel.getScore(), 21);
    assert.equal(fixture.gameModel.getMovesLeft(), 2);
    assert.equal(fixture.label.string, "0/750");
    await fixture.input.onCellClicked(4);
    assert.equal(fixture.boardView.removals, 1);
    await turn;
    assert.equal(fixture.gameModel.getScore(), 21);
    assert.equal(fixture.label.string, "21/750");
    assert.equal(fixture.label.writes, 2);
    assert.equal(fixture.boardView.removals, 1);
    assert.equal(fixture.boardView.scoreAtRemoval, "0/750");
    await fixture.input.onCellClicked(3);
    await fixture.input.onCellClicked(-1);
    assert.equal(fixture.gameModel.getScore(), 21);
    assert.equal(fixture.label.writes, 2);
    assert.equal(fixture.gameModel.getMovesLeft(), 2);
});

it("excludes the newly created super tile and adds its later activation to the total", async function transformation(): Promise<void> {
    const fixture = new ScoringFixture();
    const cells = fixture.boardModel.getCells();
    cells.fill(2);
    cells.fill(0, 0, 5);
    await fixture.input.onCellClicked(0);
    assert.equal(cells[0], 3);
    assert.equal(fixture.gameModel.getScore(), 40);
    assert.equal(fixture.label.string, "40/500");
    await fixture.input.onCellClicked(0);
    assert.equal(fixture.gameModel.getScore(), 90);
    assert.equal(fixture.label.string, "90/500");
    assert.equal(fixture.label.writes, 3);
});

it("counts overlapping super tile chains once per removed cell", async function superTileChain(): Promise<void> {
    const fixture = new ScoringFixture();
    const cells = fixture.boardModel.getCells();
    cells.fill(0);
    cells[12] = 3;
    cells[13] = 4;
    await fixture.input.onCellClicked(12);
    assert.equal(fixture.gameModel.getScore(), 90);
    assert.equal(fixture.label.string, "90/500");
    assert.equal(fixture.label.writes, 2);
});

it("scores a bomb and its super tile chain through the same game model", async function bomb(): Promise<void> {
    const fixture = new ScoringFixture();
    const cells = fixture.boardModel.getCells();
    cells.fill(0);
    cells[12] = 3;
    cells[13] = 4;
    fixture.boosters.selectBooster(0);
    await fixture.input.onCellClicked(-1);
    assert.equal(fixture.label.string, "0/500");
    await fixture.input.onCellClicked(12);
    // Square (9), row (2 extra), column (2 extra).
    assert.equal(fixture.gameModel.getScore(), 130);
    assert.equal(fixture.label.string, "130/500");
    assert.equal(fixture.label.writes, 2);
    assert.equal(fixture.boardView.removals, 1);
    assert.equal(fixture.boosters.isActive(), false);
});

it("does not award points for teleport selection, cancellation or the completed swap", async function teleport(): Promise<void> {
    const fixture = new ScoringFixture();
    const cells = fixture.boardModel.getCells();
    cells[0] = 0;
    cells[24] = 1;
    fixture.boosters.selectBooster(1);
    await fixture.input.onCellClicked(0);
    assert.equal(fixture.boardView.selected, 0);
    assert.equal(fixture.label.writes, 1);
    await fixture.input.onCellClicked(0);
    assert.equal(fixture.boardView.selected, -1);
    await fixture.input.onCellClicked(0);
    await fixture.input.onCellClicked(24);
    assert.equal(cells[0], 1);
    assert.equal(cells[24], 0);
    assert.equal(fixture.gameModel.getScore(), 0);
    assert.equal(fixture.label.writes, 2);
    assert.equal(fixture.gameModel.getMovesLeft(), 3);
});

it("links the bootstrap to the existing score view and configures ten points per tile", function sceneWiring() {
    const scene = JSON.parse(readFileSync(new URL("../assets/scenes/GamePlay.fire", import.meta.url), "utf8"));
    const bootstrap = scene.find(hasBoardView);
    const view = scene[bootstrap.gameView.__id__];
    const label = scene[view.scoreLabel.__id__];
    assert.equal(label.__type__, "cc.Label");
    assert.equal(scene[label.node.__id__]._name, "Score");
    const movesLabel = scene[view.movesLabel.__id__];
    assert.equal(movesLabel.__type__, "cc.Label");
    assert.equal(scene[movesLabel.node.__id__]._name, "Moves");
    assert.equal(scene[scene[movesLabel.node.__id__]._parent.__id__]._name, "bg_moves");
    assert.ok(Number.isInteger(scene[bootstrap.config.__id__].initialMoves));
    assert.ok(scene[bootstrap.config.__id__].initialMoves > 0);
    assert.equal(scene[bootstrap.config.__id__].targetScore, 500);
    assert.equal(scene[bootstrap.config.__id__].pointsPerTile, 10);
    const lost = scene[view.lostPopup.__id__];
    const won = scene[view.wonPopup.__id__];
    assert.notStrictEqual(lost, won);
    assert.equal(lost.__type__, won.__type__);
    assert.notDeepEqual(lost.node, won.node);
    assert.equal(scene[lost.node.__id__].__type__, "cc.Node");
    assert.equal(scene[won.node.__id__].__type__, "cc.Node");
    assert.equal(scene[lost.scoreLabel.__id__].__type__, "cc.Label");
    assert.equal(scene[lost.movesLabel.__id__].__type__, "cc.Label");
    assert.equal(scene[won.scoreLabel.__id__].__type__, "cc.Label");
    assert.equal(scene[won.movesLabel.__id__].__type__, "cc.Label");
    assert.equal(scene[lost.node.__id__]._active, false);
    assert.equal(scene[won.node.__id__]._active, false);
});

function hasBoardView(value): boolean {
    return !!value.boardView;
}


it("loses after the last animated turn and keeps board and boosters blocked", async function lastMove(): Promise<void> {
    const fixture = new ScoringFixture(10, 1);
    fixture.boardModel.getCells().fill(0);
    const turn = fixture.input.onCellClicked(0);
    assert.equal(fixture.session.getPhase(), "resolving");
    assert.equal(fixture.gameModel.getMovesLeft(), 0);
    assert.equal(fixture.lostPopup.count, 0);
    await turn;
    assert.equal(fixture.session.getPhase(), "lost");
    assert.equal(fixture.lostPopup.count, 1);
    assert.equal(fixture.movesLabel.string, "0");
    const score = fixture.gameModel.getScore();
    fixture.boosters.selectBooster(0);
    assert.equal(fixture.boosters.isActive(), false);
    await fixture.input.onCellClicked(0);
    assert.equal(fixture.gameModel.getScore(), score);
    assert.equal(fixture.lostPopup.count, 1);
});

it("wins on the last move instead of losing", async function lastMoveWin(): Promise<void> {
    const fixture = new ScoringFixture(100, 1, 500);
    fixture.boardModel.getCells().fill(0);
    await fixture.input.onCellClicked(0);
    assert.equal(fixture.session.getPhase(), "won");
    assert.equal(fixture.gameModel.getMovesLeft(), 0);
    assert.equal(fixture.wonPopup.count, 1);
    assert.equal(fixture.lostPopup.count, 0);
    fixture.boosters.selectBooster(0);
    assert.equal(fixture.boosters.isActive(), false);
    await fixture.input.onCellClicked(0);
    assert.equal(fixture.wonPopup.count, 1);
});

it("allows a bomb to win without spending a move", async function bombWin(): Promise<void> {
    const fixture = new ScoringFixture(100);
    fixture.boardModel.getCells().fill(0);
    fixture.boosters.selectBooster(0);
    await fixture.input.onCellClicked(12);
    assert.equal(fixture.gameModel.getMovesLeft(), 3);
    assert.equal(fixture.session.getPhase(), "won");
    assert.equal(fixture.wonPopup.count, 1);
});

it("retains accepted score and move when animation is cancelled", async function cancelledAnimation(): Promise<void> {
    const fixture = new ScoringFixture();
    fixture.boardModel.getCells().fill(0);
    fixture.boardView.waitForAnimations = cancelledWait;
    await fixture.input.onCellClicked(0);
    assert.ok(fixture.gameModel.getScore() > 0);
    assert.equal(fixture.gameModel.getMovesLeft(), 2);
    assert.equal(fixture.session.getPhase(), null);
    assert.equal(fixture.label.string, "0/500");
    assert.equal(fixture.wonPopup.count + fixture.lostPopup.count, 0);
    await fixture.input.onCellClicked(0);
    assert.equal(fixture.gameModel.getMovesLeft(), 2);
});

it("does not touch views when the session stops during an awaited turn", async function stoppedSession(): Promise<void> {
    const fixture = new ScoringFixture();
    fixture.boardModel.getCells().fill(0);
    const turn = fixture.input.onCellClicked(0);
    fixture.session.stop();
    await turn;
    assert.equal(fixture.label.writes, 1);
    assert.equal(fixture.gameModel.getMovesLeft(), 2);
    assert.equal(fixture.session.getPhase(), null);
});

it("stops input on animation errors without undoing the accepted turn", async function animationError(): Promise<void> {
    const fixture = new ScoringFixture();
    fixture.boardModel.getCells().fill(0);
    fixture.boardView.waitForAnimations = rejectedWait;
    await assert.rejects(fixture.input.onCellClicked(0), /animation failed/);
    assert.equal(fixture.gameModel.getMovesLeft(), 2);
    assert.ok(fixture.gameModel.getScore() > 0);
    assert.equal(fixture.session.getPhase(), null);
    fixture.boosters.selectBooster(0);
    assert.equal(fixture.boosters.isActive(), false);
});

function cancelledWait(): Promise<boolean> {
    return Promise.resolve(false);
}

function rejectedWait(): Promise<boolean> {
    return Promise.reject(new Error("animation failed"));
}


it("renders result values and closing the popup keeps the session terminal", async function resultView(): Promise<void> {
    const fixture = new ScoringFixture(100, 1);
    const popup = new GameOverPopupView();
    const score = new ScoreLabel();
    const moves = new ScoreLabel();
    Reflect.set(popup, "node", { active: false });
    Reflect.set(popup, "scoreLabel", score);
    Reflect.set(popup, "movesLabel", moves);
    Reflect.set(fixture.gameView, "wonPopup", popup);
    fixture.boardModel.getCells().fill(0);
    await fixture.input.onCellClicked(0);
    assert.equal(popup.node.active, true);
    assert.equal(score.string, fixture.gameModel.getScore().toString() + "/500");
    assert.equal(moves.string, "0");
    popup.hide();
    assert.equal(popup.node.active, false);
    assert.equal(fixture.session.getPhase(), "won");
    await fixture.input.onCellClicked(0);
    assert.equal(popup.node.active, false);
    assert.equal(fixture.gameModel.getMovesLeft(), 0);
});
