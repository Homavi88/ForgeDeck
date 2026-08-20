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

`frontend/src/store/useStudio.ts` — единственный store сессии: project, library, decks, mixer, drums, notes, clips, AI chat, queue, collab overlays.

`bootAudio()` создаёт синглтон `getEngine()` (`AudioEngine.ts`). Флаг, чтобы не вешать граф дважды.

Autosave: `StudioPage` debounce ~2.2s на mixer/bpm/clips/… плюс Ctrl+S.

Undo/redo: снимки в `history` / `future` (не весь engine).

Auth token: `localStorage` через `api/client.ts`; `decodeUrl` подставляет Bearer, иначе стемы/файлы 401.

## Компоненты по режимам

`StudioPage` переключает `mode`:

- `dj` — `DeckPanel` ×2, `MixerPanel`, `LibraryBrowser`
- `session` — `SessionPanel` (8 сцен)
- `arrange` — `TimelinePanel`
- `drums` — `DrumMachinePanel`
- `synth` — `SynthPanel` + piano roll
- `sampler` — `SamplerPanel`

Справа всегда `AIPanel`. Сверху `TopBar` (BPM, Rec, Bounce, MIDI, mic).

## Коллаб

Хук `useProjectSync(projectId)` открывает WS и шлёт `state` при изменении bpm/mixer/drums/…. Входящий state не эхается (`applying` ref). Edit lock: кнопки на деке и drum grid.

## Клавиатура сейчас

- Space — play/pause (не в input)
- Ctrl/Cmd+S — save
- Ctrl/Cmd+Z / Shift+Z — undo/redo

Остальное — мышь (см. [roadmap.md](roadmap.md)).

## Сборка

`npm run build` = `tsc --noEmit && vite build`. Плагин копирует Rubber Band processor в `public/worklets/`. Docker frontend: nginx раздаёт `dist` и проксирует API.

Пакет называется `forgedeck-web`. Зависимость `rubberband-web@0.2.1` (GPL).
