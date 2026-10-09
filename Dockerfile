FROM python:3.12-slim
WORKDIR /app
COPY hindsight/requirements.txt hindsight/
RUN pip install --no-cache-dir -r hindsight/requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "hindsight/manage.py", "runserver", "0.0.0.0:8000"]