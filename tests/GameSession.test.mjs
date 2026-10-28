import assert from "node:assert/strict";
import { it } from "node:test";
import { loadGameModule } from "./helpers/CocosComponents.mjs";
import { GameEventType } from "../assets/scripts/events/GameEvents.ts";
import { GamePhase } from "../assets/scripts/gameplay/GameStateContracts.ts";

const { GameSession } = await import(await loadGameModule("gameplay/GameSession.ts"));

class StateObserver {
    entered = [];
    exited = [];
    pauses = [];

    onStateEntered(phase) {
        this.entered[this.entered.length] = phase;
    }

    onStateExited(phase) {
        this.exited[this.exited.length] = phase;
    }

    onPauseChanged(paused) {
        this.pauses[this.pauses.length] = paused;
    }
}

class PreparingObserver extends StateObserver {
    session = null;

    onStateEntered(phase) {
        super.onStateEntered(phase);
        if (phase === GamePhase.Preparing) {
            this.session.handleEvent(GameEventType.LevelStarted);
        }
    }
}

function preparationAndTurns() {
    const observer = new StateObserver();
    const session = new GameSession(observer);
    assert.equal(session.getPhase(), null);
    assert.equal(session.canAcceptInput(), false);
    assert.equal(session.handleEvent(GameEventType.LevelStarted), false);
    assert.equal(session.start(), true);
    assert.equal(session.getPhase(), GamePhase.Preparing);
    assert.equal(session.start(), false);
    assert.equal(session.handleEvent(GameEventType.TurnStarted), false);
    assert.equal(session.handleEvent(GameEventType.LevelStarted), true);
    assert.equal(session.canAcceptInput(), true);
    assert.equal(session.handleEvent(GameEventType.LevelStarted), false);
    assert.equal(session.handleEvent(GameEventType.TurnResolved), false);
    assert.equal(session.handleEvent(GameEventType.TurnStarted), true);
    assert.equal(session.getPhase(), GamePhase.Resolving);
    assert.equal(session.canAcceptInput(), false);
    assert.equal(session.handleEvent(GameEventType.TurnStarted), false);
    assert.equal(session.handleEvent(GameEventType.TurnResolved), true);
    assert.equal(session.canAcceptInput(), true);
    assert.deepEqual(observer.entered, ["preparing", "playing", "resolving", "playing"]);
    assert.deepEqual(observer.exited, ["preparing", "playing", "resolving"]);
}

function pauseDoesNotReenter() {
    const observer = new StateObserver();
    const session = new GameSession(observer);
    session.start();
    assert.equal(session.handleEvent(GameEventType.Paused), false);
    session.handleEvent(GameEventType.LevelStarted);
    session.handleEvent(GameEventType.TurnStarted);
    assert.equal(session.handleEvent(GameEventType.Paused), true);
    assert.equal(session.isPaused(), true);
    assert.equal(session.getPhase(), GamePhase.Resolving);
    assert.equal(session.handleEvent(GameEventType.Paused), false);
    assert.equal(session.handleEvent(GameEventType.TurnStarted), false);
    assert.equal(session.handleEvent(GameEventType.Resumed), true);
    assert.equal(session.handleEvent(GameEventType.Resumed), false);
    assert.equal(session.getPhase(), GamePhase.Resolving);
    assert.equal(session.canAcceptInput(), false);
    assert.deepEqual(observer.entered, ["preparing", "playing", "resolving"]);
    assert.deepEqual(observer.exited, ["preparing", "playing"]);
    assert.deepEqual(observer.pauses, [true, false]);
    session.handleEvent(GameEventType.TurnResolved);
    session.handleEvent(GameEventType.Paused);
    assert.equal(session.canAcceptInput(), false);
    assert.equal(session.handleEvent(GameEventType.TurnStarted), false);
    session.handleEvent(GameEventType.Resumed);
    assert.equal(session.canAcceptInput(), true);
}

function completionWhilePaused() {
    const session = new GameSession();
    session.start();
    session.handleEvent(GameEventType.LevelStarted);
    session.handleEvent(GameEventType.TurnStarted);
    session.handleEvent(GameEventType.Paused);
    assert.equal(session.handleEvent(GameEventType.TurnResolved), true);
    assert.equal(session.getPhase(), GamePhase.Playing);
    assert.equal(session.isPaused(), true);
    assert.equal(session.canAcceptInput(), false);
    session.handleEvent(GameEventType.LevelWon);
    assert.equal(session.getPhase(), GamePhase.Won);
    assert.equal(session.isPaused(), false);
    assert.equal(session.canAcceptInput(), false);
}

function verifyTerminal(event, expectedPhase) {
    const session = new GameSession();
    session.start();
    session.handleEvent(GameEventType.LevelStarted);
    session.handleEvent(GameEventType.TurnStarted);
    assert.equal(session.handleEvent(event), true);
    assert.equal(session.getPhase(), expectedPhase);
    assert.equal(session.canAcceptInput(), false);
    assert.equal(session.handleEvent(GameEventType.TurnResolved), false);
    assert.equal(session.handleEvent(GameEventType.LevelWon), false);
    assert.equal(session.handleEvent(GameEventType.LevelLost), false);
    assert.equal(session.handleEvent(GameEventType.Paused), false);
    assert.equal(session.handleEvent(GameEventType.LevelStarted), false);
    assert.equal(session.start(), true);
    assert.equal(session.getPhase(), GamePhase.Preparing);
    session.handleEvent(GameEventType.LevelStarted);
    assert.equal(session.canAcceptInput(), true);
}

function terminalStatesAndRestart() {
    verifyTerminal(GameEventType.LevelWon, GamePhase.Won);
    verifyTerminal(GameEventType.LevelLost, GamePhase.Lost);
}

function stopAndIsolation() {
    const first = new GameSession();
    const second = new GameSession();
    first.start();
    first.handleEvent(GameEventType.LevelStarted);
    first.handleEvent(GameEventType.Paused);
    assert.equal(second.getPhase(), null);
    assert.equal(second.isPaused(), false);
    first.stop();
    assert.equal(first.getPhase(), null);
    assert.equal(first.isPaused(), false);
    assert.equal(first.canAcceptInput(), false);
    assert.equal(first.handleEvent(GameEventType.TurnResolved), false);
    assert.equal(first.start(), true);
    assert.equal(first.getPhase(), GamePhase.Preparing);
}

function transitionFromLifecycleNotification() {
    const observer = new PreparingObserver();
    const session = new GameSession(observer);
    observer.session = session;
    session.start();
    assert.equal(session.getPhase(), GamePhase.Playing);
    assert.deepEqual(observer.entered, ["preparing", "playing"]);
    assert.deepEqual(observer.exited, ["preparing"]);
}

it("prepares a session and accepts only legal turn transitions", preparationAndTurns);
it("pauses without repeating state lifecycle methods", pauseDoesNotReenter);
it("keeps input closed if a pending turn completes while paused", completionWhilePaused);
it("locks terminal states and requires preparation before a restart", terminalStatesAndRestart);
it("stops cleanly and isolates different sessions", stopAndIsolation);
it("defers transitions requested from lifecycle notifications", transitionFromLifecycleNotification);
