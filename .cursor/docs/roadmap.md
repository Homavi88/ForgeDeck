# Roadmap (ещё не в коде)

Чеклист уже сделанного продукта: [`TODO.md`](../../TODO.md). Здесь — удобства, которые обсуждались и **намеренно не начаты**, чтобы не потерять приоритет.

DJ must-have с клавиатурой, library search, drag на деку, PFL, тостами и hide AI/library — в коде (см. [studio.md](studio.md)).

## Средний приоритет (осталось)

- Mixer/pitch слайдеры EQ/filter/gain как controlled (`value`), не `defaultValue` (UI может разъехаться после load/collab)
- MIDI learn с деки: hotcue/loop/PFL note map 1:1 как у конкретного DDJ, не только CC Pioneer-ish
- Отдельное окно/устройство для headphones без `getUserMedia` permission dance

## Не делать вид, что это баги архитектуры

- GPU Demucs без `requirements-stems.txt` и CUDA/MPS → честный HPSS
- Bounce 1:1 с live graph, не sample-identical с железом Pioneer
- Репозиторий GitHub может называться `DJ`, продукт — ForgeDeck (Settings → Rename repository)
- Split cue на одном выходе — не замена настоящей cue-паре; `setSinkId` есть не во всех браузерах

Когда пункт берёшь в работу: вычеркни здесь и после мержа добавь строку в `CHANGELOG.md`.
