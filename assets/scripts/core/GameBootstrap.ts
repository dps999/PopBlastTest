import BoardView from "../board/BoardView";
import { GameFactory } from "./GameFactory";

const { ccclass, property } = cc._decorator;

@ccclass
export default class GameBootstrap extends cc.Component {
    @property(BoardView)
    private boardView: BoardView = null;

    @property(cc.Prefab)
    private tilePrefab: cc.Prefab = null;

    @property([cc.SpriteFrame])
    private colorSprites: cc.SpriteFrame[] = [];

    protected start(): void {
        GameFactory.createBoard(this.boardView, this.tilePrefab, this.colorSprites);
    }
}
