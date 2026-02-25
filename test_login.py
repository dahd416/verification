import requests
import json

def test_production_login():
    url = "https://certificados-backend.xdkfvz.easypanel.host/api/auth/login"
    payload = {
        "email": "admin@orviti.com",
        "password": "admin123"
    }
    headers = {
        "Content-Type": "application/json"
    }
    
    print(f"Probando login en: {url}")
    print(f"Payload: {json.dumps(payload)}")
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ LOGIN EXITOSO DESDE EL SCRIPT")
        else:
            print("❌ LOGIN FALLIDO DESDE EL SCRIPT")
            
    except Exception as e:
        print(f"Error al conectar: {e}")

if __name__ == "__main__":
    test_production_login()
