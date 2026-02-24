# Guía de Despliegue en Easypanel (Hostinger VPS)

Esta guía te ayudará a desplegar la plataforma ORVITI utilizando Easypanel.

## Requisitos Previos

1. Tener Easypanel instalado en tu VPS de Hostinger.
2. Tener el código fuente de la plataforma en un repositorio de GitHub (o Git análogo).

## Pasos en Easypanel

### 1. Crear un Nuevo Proyecto
- Entra a tu panel de Easypanel.
- Haz clic en **"Create New Project"** y asígnale un nombre (ej. `orviti-academy`).

### 2. Agregar Servicios

#### A. Base de Datos (MongoDB)
- Dentro del proyecto, haz clic en **"Add Service"** -> **"Database"** -> **"MongoDB"**.
- Easypanel configurará automáticamente una instancia de MongoDB.
- **Importante:** Anota la URL de conexión interna que te proporcione Easypanel.

#### B. API (Backend)
- Haz clic en **"Add Service"** -> **"App"**.
- En la pestaña **"Source"** (Github):
  - **Owner**: `dahd416`
  - **Repository**: `verification`
  - **Branch**: `master`
  - **Ruta de compilación**: `/backend`  <-- **¡CRÍTICO!** Cambia `/` por `/backend`
- En la pestaña **"Build"**:
  - **Tipo de Compilación**: `Dockerfile`
  - **Archivo**: `Dockerfile` (Ya no necesitas poner backend/Dockerfile si la ruta es /backend)
- **Variables de Entorno:** Configura las siguientes en la pestaña "Env Vars":
  - `MONGO_URL`: La URL de conexión de MongoDB de Easypanel.
  - `DB_NAME`: `orviti_production`
  - `JWT_SECRET`: Una clave larga aleatoria.
- **Puertos:** Configura el puerto de escucha como `8001`.

#### C. Web (Frontend)
- Haz clic en **"Add Service"** -> **"App"**.
- En la pestaña **"Source"** (Github):
  - **Owner**: `dahd416`
  - **Repository**: `verification`
  - **Branch**: `master`
  - **Ruta de compilación**: `/frontend` <-- **¡CRÍTICO!** Cambia `/` por `/frontend`
- En la pestaña **"Build"**:
  - **Tipo de Compilación**: `Dockerfile`
  - **Archivo**: `Dockerfile`
- **Variables de Entorno:**
  - `REACT_APP_BACKEND_URL`: La URL pública de tu API (ej. `https://api.tudominio.com`).


- **Puertos:** Easypanel mapeará automáticamente el puerto `80` del contenedor al dominio que elijas.

### 3. Configurar Dominios
- En la configuración de cada servicio (Frontend y Backend), ve a la pestaña **"Domains"**.
- Asocia tus dominios o subdominios correspondientes. Easypanel gestionará automáticamente el certificado SSL (Let's Encrypt).

## Notas Adicionales

- **Persistencia:** Si necesitas que los archivos subidos persistan, asegúrate de configurar un "Volume" en Easypanel que apunte a `/app/backend/uploads` dentro del servicio de Backend.
- **Logs:** Puedes ver los logs de cada servicio en tiempo real desde el panel de Easypanel para depurar cualquier error durante el inicio.
