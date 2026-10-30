# Добавление игровых элементов

Настройки сцены: `assets/scenes/GamePlay.fire` → `GameBootstrap` (`GameConfig`). Версия проекта — Cocos Creator 2.4.15.

## Супер тайлы

- Добавьте стратегию-наследника `SuperTileStrategy` в `assets/scripts/superTiles/`; `collectTargets` заполняет переданный массив индексов и возвращает их количество.
- Создайте префаб с одним компонентом стратегии. Настройте `spriteFrame`, `minimumGroupSize` и нужные параметры.
- Зарегистрируйте префаб в `GameBootstrap.superTilePrefabs`.
- При равном пороге создания стратегия выбирается случайно. Анимированные стратегии должны использовать общий `activationEffectPrefab`; новые типы анимации регистрируются в `BoardEffectType`, `BoardEffectAnimationDispatcher` и `BoardTileRenderer`.

## Бустеры

- Реализуйте наследника `BoosterEffect`: `targetCount`, `execute` и при необходимости `canSelect`/`validate`.
- Префаб в `assets/prefabs/boosters/` должен содержать ровно один `BoosterConfig` и один `BoosterEffect`, без `Sprite`. В `BoosterConfig` задаются `icon` и `initialCount`.
- Добавьте префаб в `GameBootstrap.boosterPrefabs`; порядок определяет порядок кнопок. Для динамических кнопок нужен `BoostersView.buttonPrefab` с `BoosterButton`.
- Для удаления используйте `context.targets` и `board.processRemoval`; для обмена — `board.processSwap`.
