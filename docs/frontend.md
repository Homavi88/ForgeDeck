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
| `/settings` | Electronic styles (Apply → `applyStylePack`), FX/MIDI пресеты, **смена пароля**, подсказки |
| `/share/:token` | публичный микс |

## Состояние студии

`frontend/src/store/useStudio.ts` — единственный store сессии: project, library, decks, mixer, drums, notes, clips, AI chat, queue, collab overlays, toasts, PFL, layout (AI/library/fullscreen). `applyStylePack(pack, parts?)` бутит аудио, ставит BPM/key, drums (`emptySteps()` merge), synth, FX wet на A (B ≈ 0.65) и drums/synth, `writeNotes`; `parts` `"drums"` / `"synth"` — частичное применение. Тост при успехе, режим студии не переключает.

`bootAudio()` создаёт синглтон `getEngine()` (`AudioEngine.ts`). Флаг, чтобы не вешать граф дважды.

Graph extras: `prodLanes` (user audio tracks shared by Arrange **and** Session), `selectedMixId`, mixer keys beyond A/B/drums/synth (`busId` routes extra lanes into another extra lane), `bypass` per insert, `insertOrder` (serial ChannelStrip devices), `arrangeZoom` / `arrangeSnap`, `frozenLanes` (pre-freeze clips per mixer id), `bounceRange` (`startBar` / `lengthBars`, omitted = full mix), `bounceFormat` / `bounceNormalize` / `echoOutBounce`, `tempoMap`, `loopOn`, `countInBars`. Clip JSON: `fadeInBars` / `fadeOutBars`, `gain` / `reverse` / `transpose` / `audioOffsetSec` / `crossfadeBars`, `frozen`, fractional `startBar`. Session graph `session[]` slots are filled to **12** scenes × every lane via `ensureSessionClips` (`followBars` optional). `Mixer.addLane(id)` кормит master (не xfader). Arrange/Session UI: `ProductionMixer` + `InsertRack` (reorder = live graph). Freeze/Flatten/Unfreeze live in the Arrange toolbar and Console. **Renders** menu lists Bounce/Rec/exports.

Graph DJ extras: `crossfader`, `xfaderCurve` (`smooth` | `sharp` | `cut`), mixer strip `eqKill`.

Autosave: `StudioPage` debounce ~2.2s на mixer/bpm/clips/`frozenLanes`/`bounceRange`/… плюс Ctrl+S / кнопка Save (`snapshot_label`: Autosave vs Manual save). `PUT` шлёт `expected_revision`; 409 на autosave не затирает другую вкладку (тост), ручной Save перезаписывает. Параллельные save ставятся в очередь. **History** в TopBar: список restore points, Pin, Restore (сначала «Before restore»). Undo/redo в памяти — не то же самое, что серверные snapshots.

Undo/redo: снимки в `history` / `future` (не весь engine; не путать с `ProjectSnapshot`).

Auth token: `localStorage` через `api/client.ts`; `decodeUrl` подставляет Bearer, иначе стемы/файлы 401. Style packs: `api.presets.styles()` / `style(id)` — `GET /api/presets/styles`, без токена.

Layout AI/library: `localStorage` ключ `fd_layout`.

## Язык (i18n)

`frontend/src/i18n/` — словари `en.ts` (тип `Dict`) и `ru.ts`. Zustand `useI18n` + `t(path, vars)`. Компоненты подписываются на `useI18n((s) => s.locale)`, чтобы смена языка перерисовала UI.

Переключатель `LanguageSelect`: в `Shell` (маркетинг / projects / library / settings / login) и в `TopBar` (студия без Shell). На `/share/:token` тоже. Сохранение: `localStorage` ключ `fd_locale`. Если нет сохранённого: `navigator.language` начинается с `ru` → `ru`, иначе `en`. Имя продукта **ForgeDeck** не переводится. DJ-термины (Cue, Play, PFL, BPM, Camelot) в русском словаре оставлены где привычнее. `PowerOffButton` берёт `quit.button` / `quit.confirm` / `quit.goodbye` из словаря (RU: **Выключить** / «Выключен. Можно закрыть вкладку.»). Сообщения quick-prompt в AI остаются на английском (для модели); подписи кнопок переводятся.

Тосты и ошибки в `useStudio` зовут `t()` в момент показа (i18n не импортирует store). Пустой AI-чат: `AIPanel` показывает `t("ai.greeting")`.

## Компоненты по режимам

`StudioPage` переключает `mode`:

- `dj` — `DeckPanel` ×2, `MixerPanel`, `LibraryBrowser` (если library открыта)
- `session` — `SessionPanel` (**12** сцен, имена, follow-bars, drop петли, Session rec / Capture + audio take, **+ Audio track**, `ProductionMixer`)
- `arrange` — `TimelinePanel` (warp-клипы, waveform, trim/fade/gain/reverse/transpose/offset/xfade, snap/zoom, loop range, tempo map point, drag на другую дорожку, drop петли/стемов, **Freeze/Flatten**, **bounce from/bars**, **export lane/all**, **рисование automation** включая pan/sends) + `ProductionMixer` / `InsertRack`
- `synth` — `SynthPanel` + FL-style piano roll (`PianoRollPanel`: patterns + ghost notes, arp/strum, **SMF import/export**; `StylePackSelect` synth-only)
- `drums` — `DrumMachinePanel` (paint + velocity graph; drop стема на пад; `StylePackSelect` drums-only)
- `sampler` — `SamplerPanel` (стемы на пады)

`AIPanel` справа, если не спрятана. Сверху `TopBar` в **две строки**: (1) бренд, имя проекта, режимы, Play / BPM / Key / Click, Save / **History** / **Renders** / Rec / Bounce (format, LUFS, echo-out, zip); (2) Session rec, undo/redo, MIDI / **MIDI clock** / **count-in** / mic / Keys, тогглы AI / Library / Decks, язык EN/RU, Share, Выключить.

DJ-клавиши: `frontend/src/lib/djHotkeys.ts` (только `mode === "dj"`, не в INPUT). Микс-хелперы (offset, gain match): `lib/djMix.ts`. Camelot-соседи и next-crate: `frontend/src/lib/camelot.ts`. Clip warp math: `lib/clipWarp.ts`. Clip edit (snap/dup/fade): `lib/clipEdit.ts`. Automation targets/draw: `lib/automation.ts` + `audio-engine/applyAutomation.ts`. Гаммы/аккорды/arp/strum piano roll: `lib/musicTheory.ts` + `lib/pianoRoll.ts`. MIDI-паттерны и ghost: `graph.midiPatterns` / `activeMidiPatternId` / `ghostNotes` в `useStudio`. Drag трека/стема: `lib/trackDrag.ts`. Graph extras: `fxReturns`, clip `keyFollow` / `sourceBpm` / `stem` / `fadeInBars` / `fadeOutBars`.

## Коллаб

Хук `useProjectSync(projectId)` открывает WS и шлёт `state` при изменении bpm/mixer/drums/notes/`midiPatterns`/clips/`sessionClips`/`fxReturns`/`prodLanes`/automation/`frozenLanes`/…. Входящий state не эхается (`applying` ref). Edit lock: кнопки на деке и drum grid.

## Клавиатура

См. таблицу в [studio.md](studio.md). Space / Ctrl+S / undo работают во всех режимах; CDJ-клавиши — только DJ; Arrange clip keys (Del / Ctrl+D/C/V) — только `mode === "arrange"`; piano-roll keys — только Synth.

MIDI по умолчанию — карта **Pioneer-ish** (`midiMap.ts` `DEFAULT_MIDI` + backend seed `Pioneer-ish`): CC плюс notes `channel:note` (ch1=A, ch2=B hotcue/play/cue/loop/PFL). Learn в Settings или Shift+click на деке. Старые карты без канала (`"36"`) всё ещё читаются.

## Сборка

`npm run build` = `tsc --noEmit && vite build`. Плагин копирует Rubber Band processor в `public/worklets/`. Docker frontend: nginx раздаёт `dist` и проксирует API.

Пакет называется `forgedeck-web`. Зависимость `rubberband-web@0.2.1` (GPL).
