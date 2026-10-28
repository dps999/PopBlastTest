import BoardView from "../board/BoardView";
import { GameConfig } from "./GameConfig";
import { GameFactory } from "./GameFactory";

const { ccclass, property } = cc._decorator;

@ccclass
export default class GameBootstrap extends cc.Component {
    @property(GameConfig)
    private config: GameConfig = new GameConfig();

    @property(BoardView)
    private boardView: BoardView = null;

    @property(cc.Prefab)
    private tilePrefab: cc.Prefab = null;

    @property([cc.SpriteFrame])
    private colorSprites: cc.SpriteFrame[] = [];

    /** Порядок: ряд, столбец, радиус, всё поле. */
    @property([cc.SpriteFrame])
    private superTileSprites: cc.SpriteFrame[] = [];

    protected start(): void {
        GameFactory.createBoard(this.boardView, this.tilePrefab, this.colorSprites, this.config, this.superTileSprites);
    }
}
