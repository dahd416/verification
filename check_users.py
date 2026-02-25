from pymongo import MongoClient
import os

def check_users():
    mongo_url = "mongodb://mongo_admin:admin_mongo@72.62.168.202:8045/?tls=false"
    db_name = "orviti_production"
    
    print(f"Conectando a {db_name}...")
    try:
        client = MongoClient(mongo_url)
        db = client[db_name]
        users_col = db["users"]
        
        users = list(users_col.find())
        print(f"\nSe encontraron {len(users)} usuarios:\n")
        print(f"{'Email':<30} | {'Nombre':<20} | {'Rol':<10}")
        print("-" * 65)
        
        for user in users:
            email = user.get("email", "N/A")
            name = user.get("name", "N/A")
            role = user.get("role", "N/A")
            print(f"{email:<30} | {name:<20} | {role:<10}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_users()
