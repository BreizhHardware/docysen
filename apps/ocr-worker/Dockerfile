FROM python:3.12-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends poppler-utils tesseract-ocr tesseract-ocr-fra \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY apps/ocr-worker/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/ocr-worker/src ./src

CMD ["python", "-m", "src.main"]
