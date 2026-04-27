import requests
import json
from datetime import datetime, timedelta

def obtener_sesiones_openf1(year="2026"):
    # Endpoint oficial de OpenF1 para sesiones
    url = f"https://api.openf1.org/v1/sessions?year={year}"
    print(f"📡 Sincronizando con servidores FIA (OpenF1) para {year}...")
    
    try:
        response = requests.get(url, timeout=10)
        if response.status_code != 200:
            print(f"⚠️ Servidor OpenF1 no disponible (Status {response.status_code})")
            return None
        
        data = response.json()
        if not data:
            print(f"⚠️ No hay sesiones activas en la API para {year} todavía.")
            return None

        # Organizamos los datos por Gran Premio (Location)
        gps = {}
        for s in data:
            sede = s['location']
            if sede not in gps:
                gps[sede] = {
                    "sede": sede,
                    "circuito": s['circuit_short_name'],
                    "estado": "proximo",
                    "sesiones": []
                }
            
            # Convertimos horario UTC a ARG (GMT-3)
            start_utc = datetime.fromisoformat(s['date_start'].replace('Z', '+00:00'))
            start_arg = start_utc - timedelta(hours=3)
            
            gps[sede]["sesiones"].append({
                "dia": start_arg.strftime('%d/%m'),
                "hora": start_arg.strftime('%H:%M'),
                "actividad": s['session_name'],
                "is_feature": "Race" in s['session_name']
            })
        
        return list(gps.values())

    except Exception as e:
        print(f"❌ Error de conexión con OpenF1: {e}")
        return None

def main():
    # Intentamos traer F1 real de OpenF1
    f1_data = obtener_sesiones_openf1("2026")
    
    # Si la API falla o está vacía (común fuera de semana de carrera), 
    # usamos los datos que ya sabemos de F2/F3 para que no quede vacío.
    db = {
        "metadata": {
            "ultima_actualizacion": datetime.now().strftime('%d/%m/%Y %H:%M'),
            "fuente": "OpenF1 API / FIA Live Timing"
        },
        "f1": f1_data if f1_data else [], 
        "f2": [
            {
                "categoria": "F2", "piloto": "N. Varrone", "sede": "Imola", "circuito": "Enzo e Dino Ferrari",
                "estado": "proximo", "sesiones": [
                    {"dia": "15/05", "hora": "11:00", "actividad": "Sprint Race", "is_feature": False},
                    {"dia": "17/05", "hora": "05:00", "actividad": "Feature Race", "is_feature": True}
                ]
            }
        ],
        "f3": [
            {
                "categoria": "F3", "piloto": "M. Colnaghi", "sede": "Imola", "circuito": "Enzo e Dino Ferrari",
                "estado": "proximo", "sesiones": [
                    {"dia": "16/05", "hora": "04:30", "actividad": "Sprint Race", "is_feature": False},
                    {"dia": "17/05", "hora": "03:15", "actividad": "Feature Race", "is_feature": True}
                ]
            }
        ]
    }

    # Si OpenF1 trajo la F1, le asignamos el piloto automáticamente
    if db["f1"]:
        for gp in db["f1"]:
            gp["categoria"] = "F1"
            gp["piloto"] = "F. Colapinto"

    with open('motor_data_2026.json', 'w', encoding='utf-8') as f:
        json.dump(db, f, indent=2, ensure_ascii=False)
    
    print(f"🏁 motor_data_2026.json actualizado. F1 detectadas: {len(db['f1'])}")

if __name__ == "__main__":
    main()