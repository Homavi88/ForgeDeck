# AI Producer

Панель справа в студии. Чат → preview actions → пользователь жмёт Apply или Reject. Apply без подтверждения не должен менять проект.

## Поток

```
UI chatAI  →  POST /api/ai/chat
           →  AgentOrchestrator.build_context + provider.complete
           →  { message, actions[], conversation_id }

UI applyAI →  POST /api/ai/apply
           →  для каждого action: TOOL_REGISTRY[type](...)
           →  фронт дотягивает engine (cues, drums, notes, stems…)
```

Контекст: project, bpm, key, deck A/B ids, analysis текущего трека.

## Провайдеры

`ai_agents/orchestrator.py` → `get_provider()`:

| `AI_PROVIDER` | Условие | Класс |
| --- | --- | --- |
| `openai` / `openai-compatible` | есть `OPENAI_API_KEY` | JSON tool-calling |
| `anthropic` | есть `ANTHROPIC_API_KEY` | Messages API, тот же SYSTEM prompt |
| иначе | — | `MockProducer` (keywords в тексте) |

Модель: `AI_MODEL`. Для anthropic дефолт, если в env ещё `mock-producer-v1`: `claude-3-5-haiku-latest`.

Промпт: `ai_agents/providers/openai.py` `SYSTEM` — ответ **только JSON** `{message, actions, reasoning}`.

## Tools

Реестр: `ai_agents/tools.py` `TOOL_REGISTRY`.

`analyze_audio`, `create_cue_point`, `create_loop`, `create_drum_pattern`, `create_synth_preset`, `suggest_transition`, `apply_mixer_settings`, `create_arrangement`, `apply_automation`, `export_mix`, `suggest_compatible_tracks`, `create_bassline`, `create_melody`, `create_chord_progression`, `separate_stems`.

Новый tool:

1. Функция в `tools.py` + запись в `TOOL_REGISTRY`
2. Ветка в `MockProducer.complete` (иначе mock никогда не вызовет)
3. Обработка `result` в `useStudio.applyAI`
4. Строка в этом файле

`separate_stems` идёт в тот же GPU/CPU/HPSS путь, что и кнопка Split stems.

## Apply на клиенте

`useStudio.applyAI` мапит типы actions на engine (hotcues, drumSteps, notes, automation, load stems…). Если добавил tool, который должен сразу звучать — допиши эту ветку, иначе в БД будет, а дека нет.
