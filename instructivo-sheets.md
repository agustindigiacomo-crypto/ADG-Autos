# 📋 Cómo cargar autos en ADG Autos (Google Sheets)

Esta guía te enseña a cargar y editar los autos del stock en tu web **sin tocar código**.

---

## 🎯 Resumen: cómo funciona

1. Tenés una planilla de Google Sheets donde cargás cada auto.
2. La web lee esa planilla automáticamente cada vez que alguien entra.
3. Cuando agregás, editás o borrás un auto en la planilla, **la web se actualiza sola** (tardá unos minutos en reflejarse).
4. Las fotos las subís a Google Drive y pegás los links en la planilla.

---

## 🚀 PASO 1 — Crear la planilla

1. Entrá a [sheets.google.com](https://sheets.google.com) con tu cuenta de Google.
2. Crear una planilla nueva en blanco.
3. Ponele de nombre: **ADG Autos — Stock**.
4. Copiá y pegá exactamente estos encabezados en la **fila 1** (cada uno en su celda, de A1 a X1):

```
id | marca | modelo | version | año | km | combustible | transmision | color | precio_usd | tipo | destacado | descripcion | equipamiento | foto_1 | foto_2 | foto_3 | foto_4 | foto_5 | foto_6 | foto_7 | foto_8 | foto_9 | disponible
```

> 💡 Más fácil: descargá el archivo `plantilla-stock.csv` que te pasé y abrilo en Google Sheets (Archivo → Importar). Te quedan los encabezados ya puestos y con un auto de ejemplo.

---

## 📝 PASO 2 — Cargar un auto (fila por fila)

Cada fila = un auto. Completá así:

| Columna | Qué va | Ejemplo |
|---------|--------|---------|
| **id** | Número único del auto | `001` |
| **marca** | Marca | `Chevrolet` |
| **modelo** | Modelo | `Cruze` |
| **version** | Versión o trim | `RS 5P` |
| **año** | Año | `2022` |
| **km** | Kilómetros (solo el número) | `31000` |
| **combustible** | Nafta, Diésel, GNC, Híbrido | `Nafta` |
| **transmision** | Manual, Automática, CVT, Tiptronic | `Automática` |
| **color** | Color | `Gris` |
| **precio_usd** | Precio en USD (número). Poné `0` si querés que muestre "Consultar" | `22500` |
| **tipo** | `0km` o `usado` | `usado` |
| **destacado** | `SI` para que aparezca en destacados, `NO` para que no | `SI` |
| **descripcion** | Texto libre sobre el auto (1-3 renglones) | `Cruze RS impecable, único dueño...` |
| **equipamiento** | Lista separada por **punto y coma** (;) | `Techo panorámico;Cuero;Llantas 17` |
| **foto_1 a foto_9** | Links públicos de las fotos (ver Paso 3) | `https://drive.google.com/uc?...` |
| **disponible** | `SI` (se muestra) o `NO` (oculto, ej: ya vendido) | `SI` |

> ⚠️ Importante: **respetar exactamente los nombres de las columnas** (minúsculas, sin tildes salvo en `año`, sin espacios extra).

---

## 📸 PASO 3 — Subir las fotos (Google Drive)

### Opción A: Usar Google Drive (GRATIS, recomendada)

1. Entrá a [drive.google.com](https://drive.google.com).
2. Creá una carpeta llamada **ADG Autos - Fotos**.
3. Dentro de ella, creá una subcarpeta por cada auto: `001 - Cruze RS 2022`, `002 - Hilux 2021`, etc.
4. Subí las 9 fotos de ese auto a su carpeta (en orden).
5. **Hacé pública la carpeta**:
   - Click derecho en la carpeta → Compartir
   - Click en "Acceso general" → "Cualquier persona con el enlace"
   - Asegurate que diga **"Lector"** (no editor)
6. Para cada foto, sacá el link público:
   - Click derecho en la foto → "Obtener enlace"
   - Vas a ver algo tipo: `https://drive.google.com/file/d/1AbCdEfG_HiJkLmNoPqRsTuVwXyZ/view?usp=drive_link`
   - **Copiá solo el ID** (la parte entre `/d/` y `/view`): `1AbCdEfG_HiJkLmNoPqRsTuVwXyZ`
   - En la planilla, pegá: `https://drive.google.com/uc?export=view&id=1AbCdEfG_HiJkLmNoPqRsTuVwXyZ`

### Opción B: Usar Imgur (alternativa más simple)

1. Entrá a [imgur.com](https://imgur.com) (sin cuenta hace falta).
2. Subí las fotos.
3. Click derecho en la imagen → "Copiar dirección de la imagen".
4. El link termina en `.jpg` o `.png`. Pegalo tal cual en la columna `foto_X`.

### Opción C: Mantener en Instagram

Si ya las tenés en tu Instagram, se puede, pero es más complicado porque Instagram bloquea el acceso directo. Mejor usá Drive.

---

## 🔗 PASO 4 — Conectar la planilla a la web

Una sola vez, cuando terminás de cargar los primeros autos:

1. En tu planilla de Google Sheets, andá a: **Archivo → Compartir → Publicar en la web**.
2. Se abre un cuadro. Configurá:
   - Enlace: **Hoja 1** (o el nombre que tenga tu hoja de stock)
   - Formato: **Valores separados por comas (.csv)**
3. Click en **"Publicar"**.
4. Confirmá (te va a preguntar si estás seguro).
5. Copiá el link que te da. Va a ser algo así:
   ```
   https://docs.google.com/spreadsheets/d/e/2PACX-1vXXXXXXXXXXXXXXX/pub?gid=0&single=true&output=csv
   ```
6. Abrí el archivo `script.js` de la web, y pegá ese link acá:
   ```javascript
   const CONFIG = {
       whatsapp: '5493364529314',
       sheetURL: 'PEGAR_ACÁ_EL_LINK',  // <--- acá
       sheetConfigURL: '',
       usarDemoSiFalla: true
   };
   ```
7. Guardá y subí el archivo a Netlify (o donde esté hosteada la web).

> ✅ **Listo**. A partir de ahora, cada vez que modifiques la planilla, la web se actualiza sola en unos minutos.

---

## 💰 PASO 4B — Pestaña "Config" (tasas del simulador de crédito)

El simulador de crédito usa tasas que vos controlás desde la misma planilla.

### 4B.1 Crear la pestaña Config

1. En tu Google Sheets, abajo de todo hacé click en el **"+"** para agregar una hoja nueva.
2. Renombrala como **Config**.
3. Copiá y pegá esto en las celdas A1 a B4:

| clave | valor |
|---|---|
| tna_prendario | 87.1 |
| plazo_max_prendario | 60 |
| anticipo_min | 20 |

> 💡 O descargá el archivo `plantilla-config.csv` que te pasé y copiá el contenido.

**Qué significa cada valor:**
- `tna_prendario`: **Tasa Nominal Anual para créditos prendarios** de usados. Por ejemplo, 87.1 = 87,1% TNA.
  > Esta es la única tasa del simulador. Los 0km no se simulan automáticamente porque cada marca tiene su propio plan.
- `plazo_max_prendario`: plazo máximo en meses para prendario (uso interno).
- `anticipo_min`: % mínimo de anticipo que suele pedir la financiera (uso interno).

### 4B.2 Publicar la pestaña Config

1. **Archivo → Compartir → Publicar en la web** (igual que con el stock).
2. Esta vez en "Enlace" seleccioná la hoja **Config** específicamente.
3. Formato: **Valores separados por comas (.csv)**.
4. Click en **Publicar**.
5. Copiá el link que te da.
6. Pegalo en `script.js` en la variable `sheetConfigURL`:
   ```javascript
   const CONFIG = {
       whatsapp: '5493364529314',
       sheetURL: 'LINK_DEL_STOCK',
       sheetConfigURL: 'LINK_DE_LA_PESTAÑA_CONFIG',  // <--- acá
       usarDemoSiFalla: true
   };
   ```

### 4B.3 Uso diario

Cuando la financiera te avisa que cambió la tasa:
1. Abrí el Sheets desde el celular o la compu.
2. Cambiás el número en la columna "valor" (ejemplo: `tna_prendario` de 87.1 a 92).
3. Listo. En unos minutos la web del simulador usa la nueva tasa.

**No hace falta tocar código para esto.**

---

## 🔄 PASO 5 — Uso diario

### Agregar un auto nuevo
1. Abrí la planilla.
2. Agregá una fila nueva al final.
3. Completá todas las columnas.
4. Subí las 9 fotos a una carpeta nueva en Drive.
5. Pegá los links en las columnas foto_1 a foto_9.
6. En unos minutos aparece en la web.

### Cambiar el precio de un auto
1. Buscá el auto en la planilla.
2. Modificá la columna `precio_usd`.
3. Listo.

### Marcar un auto como vendido
Tenés 2 opciones:
- **Ocultarlo de la web**: poné `NO` en la columna `disponible`. El auto sigue en la planilla pero no aparece.
- **Borrarlo**: eliminá la fila entera.

> 💡 Recomendación: **no borres los autos vendidos**, ponelos en `disponible = NO`. Así tenés el histórico de todo lo que vendiste.

### Destacar un auto en la home
Poné `SI` en la columna `destacado`. Los destacados salen en el carrusel arriba del catálogo.

---

## ❓ Problemas frecuentes

**Cargué un auto pero no aparece en la web.**
- Verificá que `disponible` esté en `SI`.
- Esperá unos minutos (Google Sheets tarda 1-5 min en actualizar el CSV público).
- Refrescá la web con Ctrl+F5 (Cmd+Shift+R en Mac).

**Las fotos no cargan.**
- Verificá que la carpeta de Drive esté compartida como "Cualquiera con el enlace".
- Verificá que el link tenga el formato: `https://drive.google.com/uc?export=view&id=XXXXX`.
- Probá abrir el link directamente en el navegador en modo incógnito para confirmar.

**Aparece un mensaje de error al cargar la web.**
- Esto pasa si la columna `año` tiene letras o la planilla está mal formada. Revisá que cada columna tenga el tipo de dato correcto.

**Quiero editar un auto pero tengo miedo de romper la web.**
- Relajá, no pasa nada. La web nunca queda rota por una edición. En el peor caso, ese auto no se muestra y los demás sí.
- Si tenés dudas, podés poner `disponible = NO` mientras arreglás los datos, y cuando esté bien lo volvés a `SI`.

---

## 📞 ¿Algo no funciona?

Avisame y te ayudo. Cualquier cambio en la estructura de las columnas tengo que replicarlo en el código, así que si querés agregar o sacar columnas, avisame primero.

---

## 🔗 Página propia de cada auto (automático)

Cada auto disponible tiene su propia página, por ejemplo `adgautos.com.ar/autos/chevrolet-captiva-2015-6/`.
Esa es la página que conviene compartir por WhatsApp, Instagram o Marketplace: muestra foto, precio y km en la vista previa, y Google la puede encontrar.

- **No hay que hacer nada**: GitHub la genera solo cada 30 minutos leyendo esta misma planilla.
- **Para que aparezca al toque**: en GitHub → pestaña **Actions** → **Páginas de autos** → **Run workflow**.
- El botón **Compartir** de la web ya usa ese link. Si el auto es recién cargado y todavía no tiene página, comparte el link viejo (`?auto=ID`), que sigue funcionando.
- **Cuando un auto se vende** (`disponible = NO`): su página no se borra; pasa a decir "Esta unidad ya se vendió" con autos parecidos y un botón de WhatsApp para pedir que le avisen. Así ningún link viejo queda roto.
- **No cambies el `id`** de un auto ya publicado: es lo que identifica su página.
- La foto de la vista previa es `foto_1`. Si la cambiás, la vista previa se actualiza sola (WhatsApp puede tardar en refrescarla porque la guarda un tiempo).
- Todo el stock también queda listado en `adgautos.com.ar/autos/`.
