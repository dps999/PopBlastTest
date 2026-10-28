import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { BoardModel } from "../assets/scripts/board/BoardModel.ts";
import { BoardEngine } from "../assets/scripts/board/BoardEngine.ts";
import { BoardController } from "../assets/scripts/board/BoardController.ts";
import { BoosterController } from "../assets/scripts/boosters/BoosterController.ts";
import { BoosterModel } from "../assets/scripts/boosters/BoosterModel.ts";
import { GameInputController } from "../assets/scripts/gameplay/GameInputController.ts";
import { GameModel } from "../assets/scripts/gameplay/GameModel.ts";
import { GamePresenter } from "../assets/scripts/gameplay/GamePresenter.ts";
import { ThresholdCreationStrategy } from "../assets/scripts/superTiles/SuperTileStrategies.ts";
import { loadGameModule, RowEffectStrategy, ColumnEffectStrategy } from "./helpers/CocosComponents.mjs";

const { default: GameView } = await import(await loadGameModule("gameplay/GameView.ts"));
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
    public readonly presenter: GamePresenter;
    public readonly boosters: BoosterController;
    public readonly input: GameInputController;

    constructor(pointsPerTile: number = 10) {
        this.gameModel = new GameModel(3, pointsPerTile);
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
        this.presenter = new GamePresenter(this.gameModel, this.gameView);
        this.input = new GameInputController(board, this.boosters, this.presenter);
        this.presenter.start();
        this.input.init();
    }
}

it("starts the HUD at zero and scores a group once before rendering its removal", function ordinaryGroup() {
    const fixture = new ScoringFixture(7);
    assert.equal(fixture.label.string, "0");
    assert.equal(fixture.label.writes, 1);
    const cells = fixture.boardModel.getCells();
    cells.fill(2);
    cells[0] = 0;
    cells[1] = 0;
    cells[2] = 0;
    cells[3] = 1;
    fixture.input.onCellClicked(0);
    assert.equal(fixture.gameModel.getScore(), 21);
    assert.equal(fixture.label.string, "21");
    assert.equal(fixture.label.writes, 2);
    assert.equal(fixture.boardView.removals, 1);
    assert.equal(fixture.boardView.scoreAtRemoval, "21");
    fixture.input.onCellClicked(3);
    fixture.input.onCellClicked(-1);
    assert.equal(fixture.gameModel.getScore(), 21);
    assert.equal(fixture.label.writes, 2);
    assert.equal(fixture.gameModel.getMovesLeft(), 3);
});

it("excludes the newly created super tile and adds its later activation to the total", function transformation() {
    const fixture = new ScoringFixture();
    const cells = fixture.boardModel.getCells();
    cells.fill(2);
    cells.fill(0, 0, 5);
    fixture.input.onCellClicked(0);
    assert.equal(cells[0], 3);
    assert.equal(fixture.gameModel.getScore(), 40);
    assert.equal(fixture.label.string, "40");
    fixture.input.onCellClicked(0);
    assert.equal(fixture.gameModel.getScore(), 90);
    assert.equal(fixture.label.string, "90");
    assert.equal(fixture.label.writes, 3);
});

it("counts overlapping super tile chains once per removed cell", function superTileChain() {
    const fixture = new ScoringFixture();
    const cells = fixture.boardModel.getCells();
    cells.fill(0);
    cells[12] = 3;
    cells[13] = 4;
    fixture.input.onCellClicked(12);
    assert.equal(fixture.gameModel.getScore(), 90);
    assert.equal(fixture.label.string, "90");
    assert.equal(fixture.label.writes, 2);
});

it("scores a bomb and its super tile chain through the same presenter", function bomb() {
    const fixture = new ScoringFixture();
    const cells = fixture.boardModel.getCells();
    cells.fill(0);
    cells[12] = 3;
    cells[13] = 4;
    fixture.boosters.selectBooster(0);
    fixture.input.onCellClicked(-1);
    assert.equal(fixture.label.string, "0");
    fixture.input.onCellClicked(12);
    // Square (9), row (2 extra), column (2 extra).
    assert.equal(fixture.gameModel.getScore(), 130);
    assert.equal(fixture.label.string, "130");
    assert.equal(fixture.label.writes, 2);
    assert.equal(fixture.boardView.removals, 1);
    assert.equal(fixture.boosters.isActive(), false);
});

it("does not award points for teleport selection, cancellation or the completed swap", function teleport() {
    const fixture = new ScoringFixture();
    const cells = fixture.boardModel.getCells();
    cells[0] = 0;
    cells[24] = 1;
    fixture.boosters.selectBooster(1);
    fixture.input.onCellClicked(0);
    assert.equal(fixture.boardView.selected, 0);
    assert.equal(fixture.label.writes, 1);
    fixture.input.onCellClicked(0);
    assert.equal(fixture.boardView.selected, -1);
    fixture.input.onCellClicked(0);
    fixture.input.onCellClicked(24);
    assert.equal(cells[0], 1);
    assert.equal(cells[24], 0);
    assert.equal(fixture.gameModel.getScore(), 0);
    assert.equal(fixture.label.writes, 1);
});

it("links the bootstrap to the existing score view and configures ten points per tile", function sceneWiring() {
    const scene = JSON.parse(readFileSync(new URL("../assets/scenes/GamePlay.fire", import.meta.url), "utf8"));
    const bootstrap = scene.find(hasBoardView);
    const view = scene[bootstrap.gameView.__id__];
    const label = scene[view.scoreLabel.__id__];
    assert.equal(label.__type__, "cc.Label");
    assert.equal(scene[label.node.__id__]._name, "Score");
    assert.equal(scene[bootstrap.config.__id__].pointsPerTile, 10);
});

function hasBoardView(value): boolean {
    return !!value.boardView;
}
