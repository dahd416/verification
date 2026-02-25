import bcrypt
from pymongo import MongoClient
import os

def reset_admin_password():
    email = "admin@orviti.com"
    new_password = "admin123"
    mongo_url = "mongodb://mongo_admin:admin_mongo@72.62.168.202:8045/?tls=false"
    db_name = "orviti_production"
    
    print(f"Generando nuevo hash para la contraseña...")
    # Generar hash compatible con el backend
    salt = bcrypt.gensalt(rounds=12)
    password_hash = bcrypt.hashpw(new_password.encode('utf-8'), salt).decode('utf-8')
    
    print(f"Conectando a {db_name} para actualizar a {email}...")
    try:
        client = MongoClient(mongo_url)
        db = client[db_name]
        users_col = db["users"]
        
        result = users_col.update_one(
            {"email": email},
            {"$set": {"password_hash": password_hash}}
        )
        
        if result.modified_count > 0:
            print(f"\n✅ ¡Éxito! La contraseña de {email} ha sido reseteada.")
            print(f"Nueva contraseña: {new_password}")
        else:
            print(f"\n⚠️ No se realizó ningún cambio. Verifica si el email es correcto.")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    reset_admin_password()
