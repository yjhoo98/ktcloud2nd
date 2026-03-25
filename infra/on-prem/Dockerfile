FROM python:3.9-slim

WORKDIR /app

# 필수 라이브러리 설치 (kafka-python)
RUN pip install --no-cache-dir kafka-python

COPY vehicle_simulator.py .

CMD ["python", "vehicle_simulator.py"]