.PHONY: dev backend frontend install clean

dev:
	@trap 'kill 0' EXIT; \
	$(MAKE) backend & \
	$(MAKE) frontend & \
	wait

backend:
	python hindsight/manage.py runserver

frontend:
	cd frontend && npm run dev

install:
	pip install -r hindsight/requirements.txt
	cd frontend && npm install

clean:
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -delete