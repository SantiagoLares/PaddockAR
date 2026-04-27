# PaddockAR

Web local de automovilismo con FastAPI, PostgreSQL y frontend HTML/CSS/JavaScript.

## Estructura

```txt
backend/
  app/
    api/routes/        Endpoints publicos, auth y admin
    core/              Configuracion, DB y auth
    models/            Modelos SQLAlchemy
    schemas/           Schemas Pydantic
    seeds/             Seed inicial
    services/          Logica de estado de sesiones
  requirements.txt

frontend/
  index.html           Home del fin de semana
  calendar.html        Calendario por categoria
  event.html           Detalle de evento
  admin/sessions.html  Admin simple de sesiones

legacy/                Prototipo anterior y datos viejos
docker-compose.yml     PostgreSQL local
```

## Requisitos

- Python 3.11+
- Docker Desktop

## PostgreSQL

```powershell
docker compose up -d postgres
```

PostgreSQL queda publicado en:

```txt
127.0.0.1:5433
```

Credenciales locales:

```txt
database: paddockar
user: paddockar
password: paddockar_pass
```

URL local:

```txt
postgresql+psycopg2://paddockar:paddockar_pass@127.0.0.1:5433/paddockar
```

## Backend

Instalar dependencias:

```powershell
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

Levantar FastAPI:

```powershell
cd backend
..\.venv\Scripts\uvicorn app.main:app --reload
```

Tambien se puede levantar con el entrypoint de produccion:

```powershell
.\.venv\Scripts\python.exe backend\start.py
```

Healthcheck:

```txt
http://127.0.0.1:8000/api/health
```

## Seed

El seed carga categorias, circuitos, eventos y sesiones desde:

```txt
backend/app/seeds/data/initial_events.json
```

Ejecutar desde la raiz:

```powershell
.\.venv\Scripts\python.exe backend\app\seeds\seed_initial_data.py
```

## Frontend

Abrir directamente en el navegador:

```txt
frontend/index.html
frontend/calendar.html
frontend/event.html?id=1
```

## Admin

Admin de sesiones:

```txt
frontend/admin/sessions.html
```

Variables de entorno para login:

```txt
ADMIN_USERNAME
ADMIN_PASSWORD
ADMIN_TOKEN_SECRET
```

Defaults locales si no se configuran:

```txt
admin / admin
```

Endpoints admin protegidos:

```txt
POST /api/auth/login
GET /api/admin/sessions
PUT /api/admin/sessions/{id}
```

## Deploy En Render

El backend esta preparado para correr sin `docker-compose` en produccion. Docker queda solo para PostgreSQL local.

Configurar el servicio Render como Web Service apuntando al backend.

Build command:

```bash
pip install -r backend/requirements.txt
```

Start command:

```bash
cd backend && python start.py
```

Variables de entorno requeridas:

```txt
DATABASE_URL=postgresql+psycopg2://USER:PASSWORD@HOST:PORT/DATABASE
ADMIN_USERNAME=...
ADMIN_PASSWORD=...
ADMIN_TOKEN_SECRET=...
```

Render inyecta `PORT` automaticamente. Si no existe, el backend usa `8000`.

Para PostgreSQL externo, `DATABASE_URL` no debe usar `localhost`; debe apuntar al host publico/privado del proveedor de base de datos.

Tambien se aceptan URLs `postgres://` o `postgresql://`; el backend las normaliza a `postgresql+psycopg2://`.
