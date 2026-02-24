# ORVITI Academy - Guía de Despliegue a Producción

## 📋 Requisitos Previos

### Servidor
- **Sistema Operativo:** Ubuntu 22.04+ o similar
- **RAM:** Mínimo 2GB (recomendado 4GB)
- **Almacenamiento:** 20GB+ (para archivos multimedia)
- **Python:** 3.11+
- **Node.js:** 18+

### Base de Datos
- **MongoDB:** 6.0+ (puede ser local o MongoDB Atlas)

---

## 🔧 Paso 1: Configurar MongoDB

### Opción A: MongoDB Atlas (Recomendado para producción)
1. Crear cuenta en [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Crear un cluster gratuito o de pago
3. Crear usuario de base de datos
4. Obtener la cadena de conexión (formato: `mongodb+srv://usuario:password@cluster.mongodb.net`)

### Opción B: MongoDB Local
```bash
# Instalar MongoDB
sudo apt update
sudo apt install -y mongodb

# Iniciar servicio
sudo systemctl start mongodb
sudo systemctl enable mongodb

# Crear usuario de producción
mongosh
> use orviti_production
> db.createUser({
    user: "orviti_admin",
    pwd: "TU_PASSWORD_SEGURA",
    roles: [{role: "readWrite", db: "orviti_production"}]
  })
```

---

## 🔧 Paso 2: Configurar Variables de Entorno

### Backend (`/app/backend/.env`)
```env
# MongoDB - CAMBIAR ESTOS VALORES
MONGO_URL="mongodb://orviti_admin:TU_PASSWORD@localhost:27017/orviti_production?authSource=orviti_production"
DB_NAME="orviti_production"

# Seguridad - GENERAR UNA CLAVE SEGURA DE 32+ CARACTERES
JWT_SECRET="CAMBIAR_POR_CLAVE_SEGURA_DE_32_CARACTERES_MINIMO"

# URLs de producción
FRONTEND_URL="https://certificaciones.orviti.com"

# CORS - Restringir en producción
CORS_ORIGINS="https://certificaciones.orviti.com"
```

### Frontend (`/app/frontend/.env`)
```env
REACT_APP_BACKEND_URL=https://certificaciones.orviti.com
```

---

## 🔧 Paso 3: Migrar Datos

### En el servidor de desarrollo (actual):
```bash
cd /app
python migration_export.py --export
```

Esto creará una carpeta `/app/migration_export/TIMESTAMP/` con:
- `data/` - Archivos JSON de cada colección
- `uploads/` - Archivos multimedia
- `export_summary.json` - Resumen de la exportación

### Copiar al servidor de producción:
```bash
scp -r /app/migration_export usuario@servidor-produccion:/app/
```

### En el servidor de producción:
```bash
cd /app
# Asegurarse de que .env está configurado con MongoDB de producción
python migration_export.py --import
```

---

## 🔧 Paso 4: Configurar Nginx (Proxy Inverso)

### Instalar Nginx:
```bash
sudo apt install nginx
```

### Configuración (`/etc/nginx/sites-available/orviti`):
```nginx
server {
    listen 80;
    server_name certificaciones.orviti.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name certificaciones.orviti.com;

    # SSL - Usar certbot para certificados Let's Encrypt
    ssl_certificate /etc/letsencrypt/live/certificaciones.orviti.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/certificaciones.orviti.com/privkey.pem;

    # Frontend (React)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Aumentar límite para subida de archivos
        client_max_body_size 10M;
    }
}
```

### Activar y reiniciar:
```bash
sudo ln -s /etc/nginx/sites-available/orviti /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Obtener certificado SSL:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d certificaciones.orviti.com
```

---

## 🔧 Paso 5: Configurar Servicios con Systemd

### Backend (`/etc/systemd/system/orviti-backend.service`):
```ini
[Unit]
Description=ORVITI Academy Backend
After=network.target mongodb.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/app/backend
Environment="PATH=/app/backend/venv/bin"
ExecStart=/app/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Frontend (`/etc/systemd/system/orviti-frontend.service`):
```ini
[Unit]
Description=ORVITI Academy Frontend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/app/frontend
ExecStart=/usr/bin/yarn start
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### Activar servicios:
```bash
sudo systemctl daemon-reload
sudo systemctl enable orviti-backend orviti-frontend
sudo systemctl start orviti-backend orviti-frontend
```

---

## 🔧 Paso 6: Configurar Backups

### Script de backup (`/app/scripts/backup.sh`):
```bash
#!/bin/bash
BACKUP_DIR="/backups/orviti"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup MongoDB
mongodump --uri="$MONGO_URL" --out="$BACKUP_DIR/db_$DATE"

# Backup uploads
tar -czf "$BACKUP_DIR/uploads_$DATE.tar.gz" /app/backend/uploads

# Mantener solo últimos 7 días
find $BACKUP_DIR -mtime +7 -delete
```

### Programar con cron:
```bash
crontab -e
# Agregar:
0 2 * * * /app/scripts/backup.sh
```

---

## ✅ Lista de Verificación Pre-Producción

- [ ] MongoDB configurado y accesible
- [ ] Variables de entorno actualizadas (JWT_SECRET, MONGO_URL, etc.)
- [ ] Datos migrados correctamente
- [ ] SSL/HTTPS configurado
- [ ] Nginx configurado como proxy
- [ ] Servicios systemd activos
- [ ] Backups automatizados
- [ ] Dominio DNS apuntando al servidor
- [ ] Firewall configurado (puertos 80, 443)
- [ ] Usuario de prueba creado para verificación

---

## 🔒 Seguridad Adicional

1. **Firewall:**
```bash
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

2. **Cambiar contraseña del usuario admin** después de la migración

3. **Configurar rate limiting** en Nginx para prevenir ataques

4. **Monitoreo:** Considerar Uptime Robot, Pingdom o similar

---

## 📞 Soporte

Si tienes problemas durante el despliegue:
1. Revisar logs: `journalctl -u orviti-backend -f`
2. Verificar MongoDB: `mongosh --eval "db.adminCommand('ping')"`
3. Verificar Nginx: `sudo nginx -t`
