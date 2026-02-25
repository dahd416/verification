from pymongo import MongoClient
import os

def fix_urls():
    # Configuración
    mongo_url = "mongodb://mongo_admin:admin_mongo@72.62.168.202:8045/?tls=false"
    db_name = "orviti_production"
    
    # Dominios a buscar y reemplazar
    old_domains = [
        "https://cert-studio-3.preview.emergentagent.com",
        "https://cert-studio-4.preview.emergentagent.com"
    ]
    new_domain = "https://certificados.orviti.com"
    
    # Alternativa si el dominio principal no carga
    # new_domain = "https://certificados-backend.xdkfvz.easypanel.host"

    print(f"--- CORRECCIÓN DE URLs EN BASE DE DATOS ---")
    try:
        client = MongoClient(mongo_url)
        db = client[db_name]
        
        collections_to_check = ["settings", "templates", "organizations", "diplomas"]
        
        for coll_name in collections_to_check:
            print(f"\nProcesando colección: {coll_name}...")
            collection = db[coll_name]
            count = 0
            
            # Buscar todos los documentos
            cursor = collection.find()
            for doc in cursor:
                doc_id = doc["_id"]
                updated = False
                
                # Convertir doc a string para búsqueda rápida, luego iterar campos
                doc_str = str(doc)
                if any(old in doc_str for old in old_domains):
                    # Iterar campos del documento
                    new_doc = {}
                    for key, value in doc.items():
                        if isinstance(value, str):
                            original_value = value
                            for old in old_domains:
                                if old in value:
                                    value = value.replace(old, new_domain)
                                    updated = True
                            new_doc[key] = value
                        else:
                            new_doc[key] = value
                    
                    if updated:
                        collection.replace_one({"_id": doc_id}, new_doc)
                        count += 1
            
            print(f"✅ Se actualizaron {count} documentos en {coll_name}")

        print("\n--- PROCESO FINALIZADO ---")
        print(f"Nota: Si no ves los cambios, asegúrate de que {new_domain} sea la URL correcta de tu backend.")

    except Exception as e:
        print(f"❌ ERROR: {e}")

if __name__ == "__main__":
    fix_urls()
