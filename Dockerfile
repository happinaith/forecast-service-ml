# Базовый образ с уже установленным TensorFlow (CPU)
FROM tensorflow/tensorflow:2.15.0

# Отключаем буферизацию вывода Python
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY src ./src
COPY static ./static
COPY run_simple.py .


EXPOSE 8000

# Если запуск через run_simple.py:
#CMD ["python", "run_simple.py"]

# Если у тебя FastAPI-приложение в src.main:app — вариант:
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]