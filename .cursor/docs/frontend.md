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
| `/settings` | FX/MIDI пресеты, подсказки |
| `/share/:token` | публичный микс |

## Состояние студии

`frontend/src/store/useStudio.ts` — единственный store сессии: project, library, decks, mixer, drums, notes, clips, AI chat, queue, collab overlays, toasts, PFL, layout (AI/library/fullscreen).

`bootAudio()` создаёт синглтон `getEngine()` (`AudioEngine.ts`). Флаг, чтобы не вешать граф дважды.

Autosave: `StudioPage` debounce ~2.2s на mixer/bpm/clips/… плюс Ctrl+S; успешный save даёт тост «Saved».

Undo/redo: снимки в `history` / `future` (не весь engine).

Auth token: `localStorage` через `api/client.ts`; `decodeUrl` подставляет Bearer, иначе стемы/файлы 401.

Layout AI/library: `localStorage` ключ `fd_layout`.

## Компоненты по режимам

`StudioPage` переключает `mode`:

- `dj` — `DeckPanel` ×2, `MixerPanel`, `LibraryBrowser` (если library открыта)
- `session` — `SessionPanel` (8 сцен)
- `arrange` — `TimelinePanel`
- `drums` — `DrumMachinePanel`
- `synth` — `SynthPanel` + piano roll
- `sampler` — `SamplerPanel`

`AIPanel` справа, если не спрятана. Сверху `TopBar` (BPM, Rec, Bounce, MIDI, mic, Hide AI / Library / Decks, Keys). `ToastHost` + `HeadphonesMonitor` + `KeymapHelp`.

DJ-клавиши: `frontend/src/lib/djHotkeys.ts` (только `mode === "dj"`, не в INPUT). Camelot-соседи: `frontend/src/lib/camelot.ts` (как `harmony.compatible_camelot`). Drag трека: `lib/trackDrag.ts`.

## Коллаб

Хук `useProjectSync(projectId)` открывает WS и шлёт `state` при изменении bpm/mixer/drums/…. Входящий state не эхается (`applying` ref). Edit lock: кнопки на деке и drum grid.

## Клавиатура

См. таблицу в [studio.md](studio.md). Space / Ctrl+S / undo работают во всех режимах; CDJ-клавиши — только DJ.

MIDI по умолчанию — карта **Pioneer-ish** (`midiMap.ts` `DEFAULT_MIDI` + backend seed `Pioneer-ish`).

## Сборка

`npm run build` = `tsc --noEmit && vite build`. Плагин копирует Rubber Band processor в `public/worklets/`. Docker frontend: nginx раздаёт `dist` и проксирует API.

Пакет называется `forgedeck-web`. Зависимость `rubberband-web@0.2.1` (GPL).
