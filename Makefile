.PHONY: dev backend frontend install clean test down manage shell

dev:
	docker compose up --build

down:
	docker compose down

manage:
	docker compose exec backend python hindsight/manage.py $(cmd)

shell:
	docker compose exec backend bash

backend:
	docker compose up backend

frontend:
	docker compose up frontend

test:
	docker compose run --rm backend python hindsight/manage.py test retros --verbosity=2

install:
	docker compose run --rm backend pip install -r hindsight/requirements.txt
	docker compose run --rm frontend npm install

clean:
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -delete