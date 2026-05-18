# 🚗 ADG Autos - Sitio web

Sitio web completo y funcional para ADG Autos.

## 📁 Contenido de la carpeta

```
adg-v2/
├── index.html                 ← La web principal
├── styles.css                 ← Estilos
├── script.js                  ← Lógica (editá CONFIG aquí)
├── plantilla-stock.csv        ← Plantilla para Google Sheets
├── img/                       ← Imágenes (logo + fotos de ejemplo)
├── INSTRUCTIVO-SHEETS.md      ← Cómo cargar autos
└── INSTRUCTIVO-DEPLOY.md      ← Cómo subir el sitio online
```

## 🚀 Orden sugerido para arrancar

1. **Probá localmente primero**: abrí `index.html` con doble click. La web funciona con autos de demo (los 6 que puse de ejemplo).

2. **Leé `INSTRUCTIVO-SHEETS.md`**: te explica paso a paso cómo armar tu Google Sheets con los autos reales y cómo sacar las fotos de Drive.

3. **Cargá 2-3 autos en tu planilla** como prueba y confirmá que la web los levanta bien.

4. **Leé `INSTRUCTIVO-DEPLOY.md`**: te explica cómo subir el sitio a Netlify (gratis) y cómo conectar tu dominio propio (adgautos.com.ar).

## ⚡ Funcionalidades del sitio

- ✅ Catálogo dinámico que se actualiza solo desde Google Sheets
- ✅ Filtros por tipo (0km/usado), marca, año, precio máximo
- ✅ Búsqueda por texto libre (ej: "Cruze")
- ✅ Página de detalle de cada auto con galería de hasta 9 fotos
- ✅ Compartir auto por WhatsApp con link directo al modelo
- ✅ Simulador de crédito prendario (cuota francesa)
- ✅ Formulario de tasación de usado (cliente envía datos → WhatsApp)
- ✅ Formulario de contacto general (WhatsApp)
- ✅ WhatsApp flotante siempre visible
- ✅ 100% responsive (celular + tablet + desktop)
- ✅ Animaciones y transiciones suaves
- ✅ Sin dependencias de servidor (solo frontend)

## ⚙️ Configuración mínima antes de publicar

Editá `script.js` al inicio del archivo:

```javascript
const CONFIG = {
    whatsapp: '5493364529314',           // Tu WhatsApp sin +, espacios ni guiones
    sheetURL: 'TU_LINK_DE_GOOGLE_SHEETS',  // Ver INSTRUCTIVO-SHEETS.md
    usarDemoSiFalla: true                  // Dejalo en true siempre
};
```

## 🆘 Soporte

Cualquier cambio, duda o problema, escribime y te ayudo. No toques la estructura de columnas de la planilla sin avisarme antes (si querés agregar campos, puedo modificar el código para que los lea).
