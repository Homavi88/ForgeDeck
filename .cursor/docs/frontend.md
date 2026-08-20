# Frontend

Vite + React 18 + TypeScript + Tailwind + Zustand. Корень: `frontend/`.

Dev-прокси: `/api` и `/ws` → `localhost:8000` (`vite.config.ts`).

## Маршруты

| URL | Страница |
| --- | --- |
| `/` | Home |
| `/login` | JWT / demo |
| `/projects` | список + создать |
| `/projects/:id` | студия |
| `/library` | файлы пользователя |
| `/settings` | Electronic styles (Apply → `applyStylePack`), FX/MIDI пресеты, подсказки |
| `/share/:token` | публичный микс |

## Состояние студии

`frontend/src/store/useStudio.ts` — единственный store сессии: project, library, decks, mixer, drums, notes, clips, AI chat, queue, collab overlays, toasts, PFL, layout (AI/library/fullscreen). `applyStylePack(pack, parts?)` бутит аудио, ставит BPM/key, drums (`emptySteps()` merge), synth, FX wet на A (B ≈ 0.65) и drums/synth, `writeNotes`; `parts` `"drums"` / `"synth"` — частичное применение. Тост при успехе, режим студии не переключает.

`bootAudio()` создаёт синглтон `getEngine()` (`AudioEngine.ts`). Флаг, чтобы не вешать граф дважды.

Graph DJ extras: `crossfader`, `xfaderCurve` (`smooth` | `sharp` | `cut`), mixer strip `eqKill`.

Autosave: `StudioPage` debounce ~2.2s на mixer/bpm/clips/… плюс Ctrl+S; graph пишется одним `PUT`. Паттерн `Main` больше не дублируется отдельным POST на каждый save. Успешный save даёт тост «Saved».

Undo/redo: снимки в `history` / `future` (не весь engine).

Auth token: `localStorage` через `api/client.ts`; `decodeUrl` подставляет Bearer, иначе стемы/файлы 401. Style packs: `api.presets.styles()` / `style(id)` — `GET /api/presets/styles`, без токена.

Layout AI/library: `localStorage` ключ `fd_layout`.

## Язык (i18n)

`frontend/src/i18n/` — словари `en.ts` (тип `Dict`) и `ru.ts`. Zustand `useI18n` + `t(path, vars)`. Компоненты подписываются на `useI18n((s) => s.locale)`, чтобы смена языка перерисовала UI.

Переключатель `LanguageSelect`: в `Shell` (маркетинг / projects / library / settings / login) и в `TopBar` (студия без Shell). На `/share/:token` тоже. Сохранение: `localStorage` ключ `fd_locale`. Если нет сохранённого: `navigator.language` начинается с `ru` → `ru`, иначе `en`. Имя продукта **ForgeDeck** не переводится. DJ-термины (Cue, Play, PFL, BPM, Camelot) в русском словаре оставлены где привычнее. `PowerOffButton` берёт `quit.button` / `quit.confirm` / `quit.goodbye` из словаря (RU: **Выключить** / «Выключен. Можно закрыть вкладку.»). Сообщения quick-prompt в AI остаются на английском (для модели); подписи кнопок переводятся.

Тосты и ошибки в `useStudio` зовут `t()` в момент показа (i18n не импортирует store). Пустой AI-чат: `AIPanel` показывает `t("ai.greeting")`.

## Компоненты по режимам

`StudioPage` переключает `mode`:

- `dj` — `DeckPanel` ×2, `MixerPanel`, `LibraryBrowser` (если library открыта)
- `session` — `SessionPanel` (8 сцен, drop петли, Session rec / Capture)
- `arrange` — `TimelinePanel` (warp-клипы, drop петли/стемов)
- `drums` — `DrumMachinePanel` (paint + velocity graph; drop стема на пад; dropdown **Load style drums** — только паттерн из style pack)
- `synth` — `SynthPanel` + FL-style piano roll (`PianoRollPanel`: patterns + ghost notes, arp/strum; dropdown **Load style synth** — params + notes)
- `sampler` — `SamplerPanel` (стемы на пады)

`AIPanel` справа, если не спрятана. Сверху `TopBar` в **две строки**: (1) бренд, имя проекта, режимы (горизонтальный скролл, `whitespace-nowrap`), Play / BPM / Key / Click, Save / Rec / Bounce; (2) Session rec, undo/redo, MIDI / mic / Keys, тогглы AI / Library / Decks (подсветка = включено, без «Hide …»), язык EN/RU, Share, Выключить. Library открыта в DJ / Session / Arrange / Sampler. `ToastHost` + `HeadphonesMonitor` + `KeymapHelp`.

DJ-клавиши: `frontend/src/lib/djHotkeys.ts` (только `mode === "dj"`, не в INPUT). Микс-хелперы (offset, gain match): `lib/djMix.ts`. Camelot-соседи и next-crate: `frontend/src/lib/camelot.ts`. Clip warp math: `lib/clipWarp.ts`. Гаммы/аккорды/arp/strum piano roll: `lib/musicTheory.ts` + `lib/pianoRoll.ts`. MIDI-паттерны и ghost: `graph.midiPatterns` / `activeMidiPatternId` / `ghostNotes` в `useStudio`. Drag трека/стема: `lib/trackDrag.ts`. Graph extras: `fxReturns`, clip `keyFollow` / `sourceBpm` / `stem`.

## Коллаб

Хук `useProjectSync(projectId)` открывает WS и шлёт `state` при изменении bpm/mixer/drums/notes/`midiPatterns`/clips/`sessionClips`/`fxReturns`/…. Входящий state не эхается (`applying` ref). Edit lock: кнопки на деке и drum grid.

## Клавиатура

См. таблицу в [studio.md](studio.md). Space / Ctrl+S / undo работают во всех режимах; CDJ-клавиши — только DJ.

MIDI по умолчанию — карта **Pioneer-ish** (`midiMap.ts` `DEFAULT_MIDI` + backend seed `Pioneer-ish`).

## Сборка

`npm run build` = `tsc --noEmit && vite build`. Плагин копирует Rubber Band processor в `public/worklets/`. Docker frontend: nginx раздаёт `dist` и проксирует API.

Пакет называется `forgedeck-web`. Зависимость `rubberband-web@0.2.1` (GPL).
