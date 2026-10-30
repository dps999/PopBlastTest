## Pop Blast Test

Игра поддерживает поворот экрана

Настройки игры: `assets/scenes/GamePlay.fire` → `GameBootstrap` (`GameConfig`). .

# Добавление игровых элементов
## Супер-тайлы

1. Создайте наследника `SuperTileStrategy`, реализуйте `collectTargets`.
2. Создайте префаб со стратегией, настройте параметры.
3. Добавьте в `GameBootstrap.superTilePrefabs`.

При равных порогах выбор случайный. Новые анимации регистрируются в `BoardEffectType`, `BoardEffectAnimationDispatcher` и `BoardTileRenderer`.

## Бустеры

1. Создайте наследника `BoosterEffect`, реализуйте `targetCount` и `execute`.
2. Создайте префаб с `BoosterConfig` и `BoosterEffect`, настройте иконку и количество.
3. Добавьте в `GameBootstrap.boosterPrefabs`.

Удаление — `board.processRemoval`, обмен — `board.processSwap`.