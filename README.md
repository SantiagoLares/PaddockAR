# PaddockAR

Web local de automovilismo con FastAPI, MySQL y frontend estatico.

## Estado actual

Primer paso del MVP:

- MySQL con Docker Compose
- Backend minimo con FastAPI
- Endpoint `GET /api/health`

## Requisitos

- Python 3.11+
- Docker Desktop

## Levantar MySQL

```bash
docker compose up -d mysql
```

## Levantar FastAPI

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Verificar

Abrir:

```txt
http://127.0.0.1:8000/api/health
```

La respuesta deberia indicar `status: ok` y `database: ok` cuando MySQL este disponible.

Por defecto el backend se conecta a MySQL en:

```txt
mysql+pymysql://paddockar:paddockar_pass@127.0.0.1:3307/paddockar
```
