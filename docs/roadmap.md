# Roadmap (ещё не в коде)

Чеклист уже сделанного продукта: [`TODO.md`](../TODO.md). Здесь — удобства, которые обсуждались и **намеренно не начаты**, чтобы не потерять приоритет.

## Высокий приоритет (ежедневный DJ)

1. **Клавиатура деки** — выбранная A/B, Cue, hotcue 1–4, loop 1/2/4/8, beat jump, load из crate, sync.
2. **Library search / sort** — имя, BPM, Camelot, недавно добавленные; подсветка совместимых с Deck A.
3. **Drag трека на деку** — сейчас drop в library = upload, на деку только кнопки A/B.
4. **PFL / headphones** — отдельный cue-выход, не мастер.
5. **Тосты** — autosave, «анализ готов», прогресс stems/bounce (сейчас тишина или одна красная строка).
6. **Спрятать AI / library / fullscreen деки** — панель AI всегда занимает край.

## Средний приоритет

- Tap tempo
- Pitch range ±8 / ±16 / ±100
- Помнить zoom и key lock на трек
- Список недавних проектов на `/`
- Mixer/pitch слайдеры как controlled (`value`), не `defaultValue` (сейчас UI может разъехаться после load/collab)

## Не делать вид, что это баги архитектуры

- GPU Demucs без `requirements-stems.txt` и CUDA/MPS → честный HPSS
- Bounce 1:1 с live graph, не sample-identical с железом Pioneer
- Репозиторий GitHub может называться `DJ`, продукт — ForgeDeck (Settings → Rename repository)

Когда пункт берёшь в работу: вычеркни здесь и после мержа добавь строку в `CHANGELOG.md`.
