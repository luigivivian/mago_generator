.PHONY: api front dev kill restart

api:
	@lsof -ti:8000 | xargs kill -9 2>/dev/null; sleep 1; true
	~/.pyenv/versions/3.12.8/bin/python3 -m src.api --port 8000

front:
	cd memelab && npm run dev

dev:
	@make kill 2>/dev/null; true
	~/.pyenv/versions/3.12.8/bin/python3 -m src.api --port 8000 &
	cd memelab && npm run dev

restart:
	@make kill 2>/dev/null; true
	@sleep 1
	~/.pyenv/versions/3.12.8/bin/python3 -m src.api --port 8000 &
	@echo "API restarted on :8000"

kill:
	@lsof -ti:8000 | xargs kill -9 2>/dev/null; true
	@lsof -ti:3000 | xargs kill -9 2>/dev/null; true
	@echo "Ports 8000 and 3000 freed"
