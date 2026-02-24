#!/usr/bin/env python3
"""
ORVITI Academy - Script de Migración de Datos
=============================================

Este script exporta todos los datos de la base de datos actual
y los archivos multimedia para migrar a producción.

Uso:
    python migration_export.py --export    # Exportar datos
    python migration_export.py --import    # Importar datos en producción
"""

import os
import sys
import json
import shutil
import argparse
from datetime import datetime
from pathlib import Path

# Intentar importar dependencias
try:
    from pymongo import MongoClient
    from dotenv import load_dotenv
except ImportError:
    print("Error: Instala las dependencias con: pip install pymongo python-dotenv")
    sys.exit(1)

# Configuración
SCRIPT_DIR = Path(__file__).parent
BACKEND_DIR = SCRIPT_DIR / "backend"
UPLOADS_DIR = BACKEND_DIR / "uploads"
EXPORT_DIR = SCRIPT_DIR / "migration_export"

# Colecciones a exportar
COLLECTIONS = [
    "users",
    "organizations", 
    "courses",
    "templates",
    "recipients",
    "diplomas",
    "email_templates",
    "settings",
    "scan_logs"
]

def load_env(production=False):
    """Cargar variables de entorno"""
    if production:
        env_file = BACKEND_DIR / ".env.production"
    else:
        env_file = BACKEND_DIR / ".env"
    
    if env_file.exists():
        load_dotenv(env_file, override=True)
    else:
        print(f"⚠️ Archivo no encontrado: {env_file}")
    
    return {
        "mongo_url": os.environ.get("MONGO_URL", "mongodb://localhost:27017"),
        "db_name": os.environ.get("DB_NAME", "test_database")
    }

def export_data():
    """Exportar todos los datos de MongoDB y archivos"""
    print("=" * 60)
    print("ORVITI Academy - Exportación de Datos")
    print("=" * 60)
    
    # Crear directorio de exportación
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    export_path = EXPORT_DIR / timestamp
    export_path.mkdir(parents=True, exist_ok=True)
    
    # Conectar a MongoDB
    env = load_env()
    print(f"\n📦 Conectando a MongoDB: {env['mongo_url']}")
    print(f"📦 Base de datos: {env['db_name']}")
    
    client = MongoClient(env["mongo_url"])
    db = client[env["db_name"]]
    
    # Exportar cada colección
    print("\n📄 Exportando colecciones...")
    data_dir = export_path / "data"
    data_dir.mkdir(exist_ok=True)
    
    export_summary = {
        "timestamp": timestamp,
        "source_db": env["db_name"],
        "collections": {}
    }
    
    for collection_name in COLLECTIONS:
        docs = list(db[collection_name].find())
        count = len(docs)
        
        # Convertir ObjectId a string
        for doc in docs:
            if "_id" in doc:
                doc["_id"] = str(doc["_id"])
        
        # Guardar como JSON
        output_file = data_dir / f"{collection_name}.json"
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(docs, f, ensure_ascii=False, indent=2, default=str)
        
        export_summary["collections"][collection_name] = count
        print(f"   ✅ {collection_name}: {count} documentos")
    
    # Exportar archivos multimedia
    print("\n📁 Exportando archivos multimedia...")
    uploads_export = export_path / "uploads"
    
    if UPLOADS_DIR.exists():
        shutil.copytree(UPLOADS_DIR, uploads_export)
        files_count = len(list(uploads_export.iterdir()))
        export_summary["uploads_count"] = files_count
        print(f"   ✅ {files_count} archivos copiados")
    else:
        uploads_export.mkdir(exist_ok=True)
        export_summary["uploads_count"] = 0
        print("   ⚠️ No se encontró directorio de uploads")
    
    # Guardar resumen
    summary_file = export_path / "export_summary.json"
    with open(summary_file, "w", encoding="utf-8") as f:
        json.dump(export_summary, f, ensure_ascii=False, indent=2)
    
    print("\n" + "=" * 60)
    print("✅ EXPORTACIÓN COMPLETADA")
    print("=" * 60)
    print(f"\n📂 Archivos exportados en: {export_path}")
    print("\nPara migrar a producción:")
    print("1. Copia la carpeta 'migration_export' al servidor de producción")
    print("2. Configura las variables de entorno en producción")
    print("3. Ejecuta: python migration_export.py --import")
    
    return export_path

def import_data(import_path=None, production=False):
    """Importar datos a MongoDB de producción"""
    print("=" * 60)
    print("ORVITI Academy - Importación de Datos")
    print("=" * 60)
    
    # Buscar la exportación más reciente si no se especifica
    if import_path is None:
        if not EXPORT_DIR.exists():
            print("❌ Error: No se encontró directorio de exportación")
            sys.exit(1)
        
        exports = sorted(EXPORT_DIR.iterdir(), reverse=True)
        if not exports:
            print("❌ Error: No hay exportaciones disponibles")
            sys.exit(1)
        
        import_path = exports[0]
    else:
        import_path = Path(import_path)
    
    print(f"\n📂 Importando desde: {import_path}")
    
    # Verificar que existe el resumen
    summary_file = import_path / "export_summary.json"
    if not summary_file.exists():
        print("❌ Error: No se encontró export_summary.json")
        sys.exit(1)
    
    with open(summary_file, "r", encoding="utf-8") as f:
        summary = json.load(f)
    
    print(f"📅 Exportación del: {summary['timestamp']}")
    print(f"📦 Base de datos origen: {summary['source_db']}")
    
    # Conectar a MongoDB de producción
    env = load_env(production=production)
    print(f"\n🎯 MongoDB destino: {env['mongo_url'][:50]}...")
    print(f"🎯 Base de datos destino: {env['db_name']}")
    
    # Confirmar importación
    confirm = input("\n⚠️ ¿Deseas continuar con la importación? (yes/no): ")
    if confirm.lower() != "yes":
        print("❌ Importación cancelada")
        sys.exit(0)
    
    client = MongoClient(env["mongo_url"])
    db = client[env["db_name"]]
    
    # Importar colecciones
    print("\n📄 Importando colecciones...")
    data_dir = import_path / "data"
    
    for collection_name in COLLECTIONS:
        json_file = data_dir / f"{collection_name}.json"
        if not json_file.exists():
            print(f"   ⚠️ {collection_name}: archivo no encontrado, saltando...")
            continue
        
        with open(json_file, "r", encoding="utf-8") as f:
            docs = json.load(f)
        
        if docs:
            # Limpiar colección existente (opcional)
            # db[collection_name].delete_many({})
            
            # Insertar documentos (sin _id para evitar conflictos)
            for doc in docs:
                doc.pop("_id", None)
            
            # Usar upsert basado en 'id' si existe
            for doc in docs:
                if "id" in doc:
                    db[collection_name].update_one(
                        {"id": doc["id"]},
                        {"$set": doc},
                        upsert=True
                    )
                else:
                    db[collection_name].insert_one(doc)
            
            print(f"   ✅ {collection_name}: {len(docs)} documentos importados")
        else:
            print(f"   ⚠️ {collection_name}: sin datos")
    
    # Importar archivos multimedia
    print("\n📁 Importando archivos multimedia...")
    uploads_import = import_path / "uploads"
    
    if uploads_import.exists() and any(uploads_import.iterdir()):
        UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
        
        for file in uploads_import.iterdir():
            dest = UPLOADS_DIR / file.name
            if not dest.exists():
                shutil.copy2(file, dest)
        
        files_count = len(list(uploads_import.iterdir()))
        print(f"   ✅ {files_count} archivos importados")
    else:
        print("   ⚠️ No hay archivos multimedia para importar")
    
    print("\n" + "=" * 60)
    print("✅ IMPORTACIÓN COMPLETADA")
    print("=" * 60)

def main():
    parser = argparse.ArgumentParser(description="ORVITI Academy - Herramienta de Migración")
    parser.add_argument("--export", action="store_true", help="Exportar datos")
    parser.add_argument("--import", dest="do_import", action="store_true", help="Importar datos")
    parser.add_argument("--production", action="store_true", help="Usar configuración de producción (.env.production)")
    parser.add_argument("--path", type=str, help="Ruta específica de importación")
    
    args = parser.parse_args()
    
    if args.export:
        export_data()
    elif args.do_import:
        import_data(args.path, production=args.production)
    else:
        parser.print_help()
        print("\nEjemplos:")
        print("  python migration_export.py --export                    # Exportar datos actuales")
        print("  python migration_export.py --import                    # Importar usando .env")
        print("  python migration_export.py --import --production       # Importar usando .env.production")

if __name__ == "__main__":
    main()
