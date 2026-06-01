# PaddockAR

PaddockAR es una agenda compacta de automovilismo enfocada en horarios de Argentina. Permite consultar la actividad del fin de semana, carreras destacadas, categorias, eventos, sesiones, estados en vivo y resultados desde un frontend liviano conectado a una API en FastAPI.

Proyecto independiente. Los datos estan sujetos a cambios.

## Demo

- Frontend: https://paddockar.com.ar/
- API health: https://paddockar.onrender.com/api/health

La web publica usa `https://paddockar.com.ar/`. La API de produccion sigue separada en Render y responde desde `https://paddockar.onrender.com`.

## Stack

- Backend: FastAPI, SQLAlchemy, Pydantic, Uvicorn
- Base de datos: PostgreSQL
- Frontend: HTML, CSS, JavaScript vanilla
- Infra local: Docker Compose
- Deploy: Render

## Funcionalidades

- Agenda del fin de semana con sesiones agrupadas por dia y evento
- Categorias principales: F1, F2, MotoGP, WEC, TC y Turismo Nacional
- Estados dinamicos: proximo, en vivo, finalizado y cancelado
- Destacado de sesiones en vivo y bloque "Ahora"
- Countdown de proxima carrera
- Sidebar de categorias con filtro persistente en URL
- Calendario por categoria
- Vista de categoria y detalle de evento
- Panel admin para sesiones, eventos y resultados
- Resultados por sesion
- Auto refresh en la home
- Skeleton loading, empty states y errores con reintento
- Favicon y meta tags basicos para compartir

## Estructura

```txt
backend/
  app/
    api/routes/        Endpoints publicos, auth y admin
    core/              Configuracion, base de datos y auth
    models/            Modelos SQLAlchemy
    schemas/           Schemas Pydantic
    seeds/             Seed inicial y datos fuente
    services/          Logica de negocio
  requirements.txt
  start.py
  .env.example

frontend/
  index.html
  calendar.html
  category.html
  event.html
  admin/
  assets/
    css/
    img/
    js/

docker-compose.yml
README.md
```

## Como correr local

### Requisitos

- Python 3.11+
- Docker Desktop

### Opcion A: stack completo con Docker

```powershell
docker compose up --build -d
```

Servicios:

```txt
Frontend: http://127.0.0.1:5500/index.html
API: http://127.0.0.1:8000/api/health
PostgreSQL: 127.0.0.1:5433
```

La primera vez Docker construye dos imagenes locales:

- `backend/` para FastAPI
- `frontend/` para servir los archivos estaticos

### Opcion B: PostgreSQL con Docker + app local

#### 1. Levantar PostgreSQL

```powershell
docker compose up -d postgres
```

La base local queda publicada en `127.0.0.1:5433`.

Credenciales locales:

```txt
database: paddockar
user: paddockar
password: paddockar_pass
```

#### 2. Instalar dependencias

```powershell
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

#### 3. Variables de entorno

Podes cargar estas variables o crear un `.env` compatible con `backend/.env.example`:

```txt
DATABASE_URL=postgresql+psycopg2://paddockar:paddockar_pass@127.0.0.1:5433/paddockar
PORT=8000
LOG_LEVEL=INFO
ADMIN_USERNAME=soquetonadmin
ADMIN_PASSWORD=123456781
ADMIN_TOKEN_SECRET=change-this-secret
```

#### 4. Levantar API

```powershell
cd backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Health check local:

```txt
http://127.0.0.1:8000/api/health
```

#### 5. Abrir frontend

Servir la carpeta `frontend` en un puerto libre, por ejemplo `5500`:

```powershell
.\.venv\Scripts\python.exe -m http.server 5500 --bind 127.0.0.1 -d frontend
```

Abrir:

```txt
http://127.0.0.1:5500/index.html
```

## Seeds

El seed carga categorias, circuitos, eventos y sesiones desde:

```txt
backend/app/seeds/data/categories.json
backend/app/seeds/data/calendars/*.json
```

Ejecutar desde la raiz del proyecto:

```powershell
.\.venv\Scripts\python.exe backend\app\seeds\seed_initial_data.py
```

Cargar una categoria puntual:

```powershell
.\.venv\Scripts\python.exe backend\app\seeds\seed_initial_data.py --calendar f1_2026
```

## Upgrade manual de schema en produccion

Si Render quedo apuntando a una base con schema viejo, podes ejecutar un upgrade seguro que crea tablas faltantes y agrega columnas nuevas en `sessions` sin borrar datos:

```powershell
cd backend
python -m app.scripts.upgrade_production_schema
```

## Import manual de standings F1

El importador de F1 es manual y no toca otras categorias. Por defecto usa el fallback JSON:

```powershell
cd backend
python -m app.scripts.import_f1_standings
```

Archivo fallback:

```txt
backend/app/seeds/data/standings/f1_2026.json
```

Opcionalmente, el script ya deja preparado un modo `official` o `auto` para intentar parsear Formula1.com mas adelante.

## Import manual de standings F2

El importador de F2 es manual y no toca otras categorias. Por defecto usa el fallback JSON:

```powershell
cd backend
python -m app.scripts.import_f2_standings
```

Archivo fallback:

```txt
backend/app/seeds/data/standings/f2_2026.json
```

Opcionalmente, el script deja preparados los modos `official` y `auto`, pero el flujo estable sigue siendo `fallback`.

## Import manual de standings F3

El importador de F3 es manual y no toca otras categorias. Por defecto usa el fallback JSON:

```powershell
cd backend
python -m app.scripts.import_f3_standings
```

Archivo fallback:

```txt
backend/app/seeds/data/standings/f3_2026.json
```

Opcionalmente, el script deja preparados los modos `official` y `auto`, pero el flujo estable sigue siendo `fallback`.

## Admin local

Credenciales por defecto:

```txt
usuario: soquetonadmin
password: 123456781
```

Paneles:

```txt
frontend/admin/sessions.html
frontend/admin/events.html
frontend/admin/results.html
```

## Roadmap

- Mejorar fuentes de datos y automatizar actualizaciones
- Busqueda global de eventos, circuitos y categorias
- Permisos admin mas granulares
- Mejoras en resultados y estadisticas
- Optimizacion de cache y consultas
- Mas categorias y campeonatos
- Mejoras de SEO y previews sociales

## Nota

PaddockAR es un proyecto independiente. No esta afiliado oficialmente con campeonatos, equipos ni organizadores. Los horarios y datos pueden cambiar.
