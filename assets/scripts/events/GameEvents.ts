/** Базовые события игрового цикла. */
export const GameEventType = {
    LevelStarted: "levelStarted",
    TurnStarted: "turnStarted",
    TurnResolved: "turnResolved",
    LevelWon: "levelWon",
    LevelLost: "levelLost",
    Paused: "paused",
    Resumed: "resumed"
} as const;

export type GameEventType = typeof GameEventType[keyof typeof GameEventType];
