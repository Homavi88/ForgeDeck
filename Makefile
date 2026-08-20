.PHONY: install backend frontend test up down migrate

backend:
	cd backend && PYTHONPATH=..:. python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

frontend:
	cd frontend && npm run dev

test:
	cd backend && PYTHONPATH=..:. python3 -m pytest -q

up:
	docker compose up --build

down:
	docker compose down

migrate:
	cd backend && PYTHONPATH=..:. python3 -m alembic upgrade head

backend:
	cd backend && PYTHONPATH=..:../ai_agents:../workers:. ../.venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

frontend:
	cd frontend && npm run dev

test:
	cd backend && PYTHONPATH=..:. ../.venv/bin/pytest -q

up:
	docker compose up --build

down:
	docker compose down

migrate:
	cd backend && PYTHONPATH=..:. alembic upgrade head
