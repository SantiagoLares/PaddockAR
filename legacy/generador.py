import json
import os
from datetime import datetime
from jinja2 import Environment, FileSystemLoader

def generar_web():
    BASE = os.path.dirname(os.path.abspath(__file__))
    os.chdir(BASE)
    
    try:
        ruta_json = os.path.join(BASE, 'motor_data_2026.json')
        if not os.path.exists(ruta_json):
            print("❌ Error: No hay JSON. Ejecutá fetch_calendars.py")
            return

        with open(ruta_json, 'r', encoding='utf-8') as f:
            datos = json.load(f)

        # 📅 FECHA ACTUAL (Hoy es 1 de Abril de 2026)
        ahora = datetime.now()

        def es_futuro(gp):
            # Si no tiene sesiones, no podemos saber, así que lo dejamos (ej: cancelados)
            if not gp.get('sesiones'): return True 
            
            # Buscamos la fecha de la última sesión (Carrera Principal)
            try:
                # Formato día/mes: "08/03" -> le agregamos el año 2026
                ultima_sesion = gp['sesiones'][-1]['dia'] + "/2026"
                fecha_gp = datetime.strptime(ultima_sesion, "%d/%m/%Y")
                
                # Si la fecha del GP es mayor o igual a hoy, lo mostramos
                return fecha_gp >= ahora
            except:
                return True

        # Filtrar categorías: Solo lo que no pasó
        contexto = {
            "calendario_f1": [gp for gp in datos.get('f1', []) if es_futuro(gp)],
            "calendario_f2": [gp for gp in datos.get('f2', []) if es_futuro(gp)],
            "calendario_f3": [gp for gp in datos.get('f3', []) if es_futuro(gp)],
            "metadata": datos.get('metadata', {}),
        }

        # Renderizar
        env = Environment(loader=FileSystemLoader(BASE))
        template = env.get_template('template.html')
        html_final = template.render(**contexto)
        
        with open("index.html", "w", encoding='utf-8') as f:
            f.write(html_final)

        print(f"🏁 index.html actualizado. Se ocultaron los GPs pasados (Suzuka, Australia, etc.)")

    except Exception as e:
        print(f"⚠️ ERROR: {e}")

if __name__ == "__main__":
    generar_web()