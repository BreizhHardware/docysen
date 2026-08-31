FROM python:3.12-slim

WORKDIR /app
COPY apps/tagging-worker/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/tagging-worker/src ./src

CMD ["python", "-m", "src.main"]
