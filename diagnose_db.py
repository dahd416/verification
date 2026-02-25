from pymongo import MongoClient
import os
import bcrypt

def diagnose():
    # Estas son las variables que el backend debería estar usando
    mongo_url = "mongodb://mongo_admin:admin_mongo@72.62.168.202:8045/?tls=false"
    db_name = "orviti_production"
    test_email = "admin@orviti.com"
    test_pass = "admin123"
    
    print(f"--- DIAGNÓSTICO DE CONEXIÓN ---")
    try:
        client = MongoClient(mongo_url)
        db = client[db_name]
        
        # 1. Probar conexión
        client.admin.command('ping')
        print("✅ Conexión física a MongoDB: OK")
        
        # 2. Verificar existencia de la DB y colecciones
        cols = db.list_collection_names()
        print(f"✅ Acceso a base de datos '{db_name}': OK")
        print(f"📦 Colecciones encontradas: {', '.join(cols)}")
        
        # 3. Buscar el usuario
        user = db.users.find_one({"email": test_email})
        if user:
            print(f"✅ Usuario {test_email} encontrado: SI")
            
            # 4. Verificar hash
            stored_hash = user.get("password_hash")
            if bcrypt.checkpw(test_pass.encode('utf-8'), stored_hash.encode('utf-8')):
                print("✅ Verificación de contraseña localmente: CORRECTA")
            else:
                print("❌ Verificación de contraseña localmente: FALLIDA")
        else:
            print(f"❌ Usuario {test_email} encontrado: NO")
            
            # 5. Listar todos los emails para ver si hay errores de dedo
            all_emails = [u.get("email") for u in db.users.find({}, {"email": 1})]
            print(f"ℹ️ Emails disponibles en la DB: {all_emails}")

    except Exception as e:
        print(f"❌ ERROR CRÍTICO: {e}")

if __name__ == "__main__":
    diagnose()
