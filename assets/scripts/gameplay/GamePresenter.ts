import {IInitializable}  from "../core/GameFactory";

export interface GameState{
    getMovesLeft(): number;
    getScore(): number;
}

export interface IGameModel{
    spendMove(): void;
    addScore(points: number): void;
    getState() : GameState;
}

export interface IGameView{
    render(state: GameState): void;
}

export class GamePresenter{
    private readonly model: IGameModel;
    private readonly view: IGameView;

    constructor(model: IGameModel, view: IGameView){
        this.model = model;
        this.view = view;
    }

    public start(): void{
        const state = this.model.getState();
        this.view.render(state);
    }
}