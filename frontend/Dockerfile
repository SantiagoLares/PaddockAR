FROM python:3.11-slim

WORKDIR /srv/frontend

COPY . .

EXPOSE 8080

CMD ["python", "-m", "http.server", "8080", "--bind", "0.0.0.0"]
