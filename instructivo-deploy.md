# 🌐 Cómo subir ADG Autos online (Netlify + dominio propio)

Guía completa para poner tu web en Internet con tu propio dominio.

---

## 💰 Costos reales

| Concepto | Costo | Frecuencia |
|----------|-------|------------|
| Hosting en Netlify | **GRATIS** | Para siempre |
| SSL (candadito de seguridad) | **GRATIS** | Incluido en Netlify |
| Dominio `adgautos.com.ar` | ~$5.000 ARS | 1 vez por año |
| Dominio `adgautos.com` | ~USD 12 | 1 vez por año |
| **Total primer año** | **~$5.000 ARS** | |

> 💡 Te recomiendo `.com.ar` porque es más barato y apunta directamente al mercado argentino.

---

## 🚀 PASO 1 — Subir el sitio a Netlify (5 minutos, GRATIS)

### 1.1 Crear cuenta en Netlify

1. Entrá a [netlify.com](https://netlify.com).
2. Click en **"Sign up"**.
3. Usá tu cuenta de Gmail o GitHub (lo más rápido).

### 1.2 Subir el sitio

1. Una vez dentro, vas a ver un dashboard.
2. En la esquina superior derecha, click en **"Add new site"** → **"Deploy manually"**.
3. Se abre un recuadro que dice "Drag and drop your site folder here".
4. **Arrastrá la carpeta completa** de ADG Autos (la que contiene `index.html`, `styles.css`, `script.js` y la carpeta `img/`) a ese recuadro.
5. Netlify la sube y en ~30 segundos te da un link tipo: `https://ubicuous-crumble-12345.netlify.app`
6. **Abrí ese link**. Tu sitio está online. 🎉

### 1.3 Probar que todo funciona

Con ese link ya podés:
- Mostrárselo a quien quieras
- Usarlo desde el celular
- Compartirlo por WhatsApp

Pero el link es feo. Vamos a ponerle el dominio propio.

---

## 🏷️ PASO 2 — Comprar el dominio (10 minutos, ~$5.000 ARS/año)

### Opción A: Dominio .com.ar (recomendado)

1. Entrá a [nic.ar](https://nic.ar).
2. Creá una cuenta (necesitás tu CUIT o DNI).
3. En el buscador, probá: **adgautos.com.ar**.
4. Si está disponible, agregalo al carrito.
5. Pagá con tarjeta o transferencia. Queda activo en unas horas.

### Opción B: Dominio .com (internacional)

1. Entrá a [namecheap.com](https://namecheap.com) o [godaddy.com](https://godaddy.com).
2. Buscá **adgautos.com** o **adgautos.com.ar**.
3. Pagá con tarjeta (USD 12-15 por año).
4. Queda activo en minutos.

---

## 🔗 PASO 3 — Conectar el dominio a Netlify (10 minutos)

### 3.1 En Netlify

1. Entrá a tu sitio en Netlify.
2. Andá a **"Site configuration"** → **"Domain management"**.
3. Click en **"Add custom domain"**.
4. Escribí: `adgautos.com.ar` (o el dominio que hayas comprado).
5. Netlify te muestra 2 opciones: **Netlify DNS** o **External DNS**. Elegí **External DNS** (es más simple).
6. Netlify te muestra los datos que tenés que configurar en NIC.ar:
   - Un **registro A** con IP (algo como `75.2.60.5`)
   - Un **CNAME** con valor (algo como `tuSitio.netlify.app`)

### 3.2 En NIC.ar (o donde compraste el dominio)

1. Entrá al panel de NIC.ar.
2. Buscá tu dominio → "Editar DNS" o "Configurar DNS".
3. Agregá los 2 registros que te dio Netlify:
   - **Tipo A**: Nombre `@`, valor la IP que te dio Netlify.
   - **Tipo CNAME**: Nombre `www`, valor `tuSitio.netlify.app`.
4. Guardá.

> ⏰ Los cambios de DNS tardan entre 10 minutos y 24 horas en propagarse. Generalmente están listos en 1-2 horas.

### 3.3 Activar HTTPS (candado verde)

1. Volvé a Netlify → **"Domain management"**.
2. Bajá hasta **"HTTPS"**.
3. Click en **"Provision certificate"**. Netlify lo hace automático.
4. En ~5 minutos tu dominio tiene candado verde (SSL activo).

---

## 🔄 PASO 4 — Actualizar la web en el futuro

Cuando quieras cambiar algo del código (no de los autos, eso es con Google Sheets):

1. Editás el archivo local.
2. Entrás a tu sitio en Netlify.
3. Andás a **"Deploys"**.
4. Arrastrás de nuevo la carpeta con los cambios.
5. Netlify reemplaza la versión anterior.

> 💡 **Alternativa más pro**: si usás GitHub, conectás Netlify a tu repo y cada vez que hacés un `git push`, Netlify actualiza la web sola. Pero para empezar, drag & drop está perfecto.

---

## ⚙️ Configuración antes de subir

Antes de arrastrar la carpeta a Netlify, **editá `script.js`**:

1. Abrilo con cualquier editor (incluso Bloc de notas).
2. Arriba de todo vas a ver:
   ```javascript
   const CONFIG = {
       whatsapp: '5493364529314',
       sheetURL: '',
       usarDemoSiFalla: true
   };
   ```
3. Cambiá `sheetURL` por el link que sacaste de Google Sheets (ver `INSTRUCTIVO-SHEETS.md`).
4. Si cambiaste de número, actualizá `whatsapp` también.
5. Guardá.

---

## 🆘 Problemas frecuentes

**"Mi dominio no funciona después de 24 horas."**
- Verificá en NIC.ar que los registros DNS estén bien cargados (a veces se pone un punto al final por accidente).
- Probá entrar a [whatsmydns.net](https://whatsmydns.net) y pegá tu dominio para ver si ya se propagó.

**"El candadito sigue tachado."**
- Esperá al menos 1 hora después de agregar el dominio.
- Si sigue, en Netlify click en "Renew certificate".

**"Quiero agregar un subdominio tipo stock.adgautos.com.ar."**
- Se puede, pero para arrancar no hace falta. Si lo querés, avisame y te paso el paso.

**"Puedo usar Gmail con @adgautos.com.ar?"**
- Sí, pero es otro servicio aparte (Google Workspace, unos USD 6/mes). Netlify solo te da la web, no el email. Para el email podés usar [Zoho Mail](https://zoho.com/mail) que tiene plan gratuito para 1-5 usuarios con dominio propio.

---

## 📋 Checklist final

Antes de poner el dominio real, verificá:

- [ ] La web carga bien en el link `.netlify.app`.
- [ ] Los autos aparecen (o los de demo, si todavía no cargaste la planilla).
- [ ] El botón de WhatsApp abre el chat con tu número.
- [ ] El formulario de tasación envía bien el mensaje por WhatsApp.
- [ ] El simulador calcula bien.
- [ ] Se ve bien en el celular (probalo con tu celu).
- [ ] Las fotos cargan (si no, revisá los permisos de Drive).

Cuando todo esté OK, conectás el dominio y quedó listo para producción.

---

## 💡 Próximos pasos recomendados

Una vez que el sitio esté online con tu dominio:

1. **Google Analytics** (gratis): para saber cuánta gente visita, de dónde viene, qué autos ve más.
2. **Google Search Console**: para que Google empiece a mostrar tu web en búsquedas tipo "concesionaria San Nicolás".
3. **Meta Pixel** (si hacés publicidad en Instagram/Facebook): para medir qué anuncios funcionan.
4. **WhatsApp Business API**: para que las consultas lleguen más ordenadas a tu celular.

Todos esto es para más adelante, cuando la web esté funcionando y quieras escalar la captación de clientes.
