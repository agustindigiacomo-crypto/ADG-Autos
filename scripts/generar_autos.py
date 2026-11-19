#!/usr/bin/env python3
"""
ADG Autos — Generador de páginas por auto.

Lee el stock publicado en Google Sheets (la misma planilla que usa la web) y genera:
  - /autos/<slug>/index.html  → una página propia por auto (indexable por Google,
                                 con vista previa al compartir por WhatsApp/IG/FB)
  - /autos/<slug>/og.jpg       → imagen 1200x630 para la vista previa
  - /autos/index.html          → listado de todo el stock (página rastreable)
  - /autos/manifest.json       → id → slug (la web lo usa para el botón Compartir)
  - /sitemap.xml y /robots.txt

Autos vendidos: la página no desaparece (los links ya compartidos siguen funcionando),
se reemplaza por una página "Esta unidad ya se vendió" con el stock similar y no se indexa.

Se ejecuta solo con GitHub Actions (.github/workflows/autos.yml). No hay que tocar nada:
cargás o editás el auto en la planilla y en la próxima corrida se genera su página.

Uso local / pruebas:
    python3 scripts/generar_autos.py                     # descarga la planilla
    STOCK_CSV_FILE=stock.csv python3 scripts/generar_autos.py   # usa un CSV local
    SIN_IMAGENES=1 ...                                   # no descarga fotos
"""

import csv
import hashlib
import html
import io
import json
import os
import re
import sys
import unicodedata
import urllib.request
from datetime import datetime, timedelta, timezone

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITIO = "https://adgautos.com.ar"
CARPETA = "autos"
OG_W, OG_H = 1200, 630
TZ_AR = timezone(timedelta(hours=-3))

NEGOCIO = {
    "nombre": "ADG Autos",
    "direccion": "Belgrano 245",
    "ciudad": "San Nicolás de los Arroyos",
    "provincia": "Buenos Aires",
    "cp": "2900",
    "telefono_visible": "+54 3364 52-9314",
    "instagram": "https://www.instagram.com/adgautos/",
    "facebook": "https://www.facebook.com/profile.php?id=61557091590962",
    "google": "https://share.google/xk9UE4jlLbKKjQlUA",
}


# ------------------------------------------------------------------
# Utilidades
# ------------------------------------------------------------------
def log(msg):
    print(msg, flush=True)


def esc(s):
    return html.escape(str(s if s is not None else ""), quote=True)


def leer(ruta):
    with open(os.path.join(RAIZ, ruta), encoding="utf-8") as f:
        return f.read()


def escribir_si_cambia(ruta_rel, contenido, binario=False):
    """Escribe solo si el contenido cambió. Devuelve True si escribió."""
    ruta = os.path.join(RAIZ, ruta_rel)
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    modo = "rb" if binario else "r"
    if os.path.exists(ruta):
        with open(ruta, modo, **({} if binario else {"encoding": "utf-8"})) as f:
            if f.read() == contenido:
                return False
    with open(ruta, "wb" if binario else "w", **({} if binario else {"encoding": "utf-8"})) as f:
        f.write(contenido)
    return True


def sin_tildes(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def slugify(s):
    s = sin_tildes(str(s)).lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return re.sub(r"-+", "-", s).strip("-")


def miles(n):
    return f"{int(n):,}".replace(",", ".")


def recortar(s, n):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[: n - 1].rsplit(" ", 1)[0].rstrip(",.;:") + "…"


def capitalizar_inicio(s):
    s = (s or "").strip()
    return s[:1].upper() + s[1:] if s else s


def hoy():
    return os.environ.get("FECHA_HOY") or datetime.now(TZ_AR).strftime("%Y-%m-%d")


# ------------------------------------------------------------------
# Configuración tomada de la propia web (una sola fuente de verdad)
# ------------------------------------------------------------------
def config_sitio():
    js = leer("script.js")
    idx = leer("index.html")

    def js_str(clave):
        m = re.search(clave + r"\s*:\s*'([^']*)'", js)
        return m.group(1).strip() if m else ""

    ga = re.search(r"gtag/js\?id=(G-[A-Z0-9]+)", idx)
    css_ver = hashlib.sha1((leer("styles.css") + leer(f"{CARPETA}/autos.css")).encode()).hexdigest()[:8]
    return {
        "whatsapp": js_str("whatsapp") or "5493364529314",
        "sheet_url": js_str("sheetURL"),
        "pixel": js_str("metaPixelId"),
        "ga": ga.group(1) if ga else "",
        "css_ver": css_ver,
    }


# ------------------------------------------------------------------
# Planilla
# ------------------------------------------------------------------
def descargar(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (ADG Autos generador)"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def normalizar_foto(url):
    """Igual que normalizarUrlFoto() de script.js: devuelve el ID de Drive o la URL."""
    url = (url or "").strip()
    if not url or "PEGAR_ID" in url:
        return None
    if "drive.google.com" not in url and "googleusercontent.com/d/" not in url and not re.fullmatch(r"[A-Za-z0-9_-]{20,}", url):
        return {"tipo": "url", "valor": url}
    m = (re.search(r"/file/d/([A-Za-z0-9_-]+)", url) or re.search(r"[?&]id=([A-Za-z0-9_-]+)", url)
         or re.search(r"googleusercontent\.com/d/([A-Za-z0-9_-]+)", url))
    if m:
        return {"tipo": "drive", "valor": m.group(1)}
    if re.fullmatch(r"[A-Za-z0-9_-]{20,}", url):
        return {"tipo": "drive", "valor": url}
    return {"tipo": "url", "valor": url}


def url_foto(foto, ancho):
    if foto["tipo"] == "drive":
        return f"https://lh3.googleusercontent.com/d/{foto['valor']}=w{ancho}"
    return foto["valor"]


def parsear_stock(texto):
    texto = texto.lstrip("﻿")
    filas = list(csv.reader(io.StringIO(texto)))
    if len(filas) < 2:
        return []

    def norm(h):
        return sin_tildes((h or "").strip().lower())

    alias = {"ano": "año", "anio": "año", "year": "año"}
    headers = [alias.get(norm(h), norm(h)) for h in filas[0]]
    alias_ars = ["precio_ars", "precio_arg", "precio_ar", "precio_pesos", "precio_$", "precio$", "precioars", "precioarg"]
    alias_usd = ["precio_usd", "precio_dolar", "precio_dolares", "preciousd", "precio_u$s"]

    def numero(v):
        v = re.sub(r"[^\d.,-]", "", v or "")
        if not v:
            return 0
        # "19.600.000" o "19600000" o "19600000.5"
        if v.count(".") > 1 or (v.count(".") == 1 and len(v.split(".")[1]) == 3 and "," not in v):
            v = v.replace(".", "")
        v = v.replace(",", ".")
        try:
            return float(v)
        except ValueError:
            return 0

    autos, vistos = [], set()
    for fila in filas[1:]:
        if not any(c.strip() for c in fila):
            continue
        o = {h: (fila[i].strip() if i < len(fila) else "") for i, h in enumerate(headers)}
        if not o.get("id"):
            continue
        if (o.get("disponible") or "SI").strip().upper() != "SI":
            continue
        if o["id"] in vistos:
            log(f"  ! id repetido en la planilla: {o['id']} (se usa la primera fila)")
            continue
        vistos.add(o["id"])

        precio, moneda = 0, "ARS"
        for a in alias_ars:
            if o.get(a):
                precio, moneda = numero(o[a]), "ARS"
                break
        if not precio:
            for a in alias_usd:
                if o.get(a):
                    precio, moneda = numero(o[a]), "USD"
                    break
        if not precio and o.get("precio"):
            precio, moneda = numero(o["precio"]), "ARS"

        fotos = [normalizar_foto(o.get(f"foto_{i}")) for i in range(1, 10)]
        try:
            anio = int(float(o.get("año") or 0))
        except ValueError:
            anio = 0
        autos.append({
            "id": o["id"],
            "marca": o.get("marca", ""),
            "modelo": o.get("modelo", ""),
            "version": o.get("version", ""),
            "anio": anio,
            "km": int(numero(o.get("km"))),
            "combustible": o.get("combustible", ""),
            "transmision": o.get("transmision", ""),
            "color": o.get("color", ""),
            "precio": int(precio),
            "moneda": moneda,
            "tipo": "0km" if (o.get("tipo") or "usado").strip().lower() == "0km" else "usado",
            "destacado": (o.get("destacado") or "").strip().upper() == "SI",
            "descripcion": o.get("descripcion", ""),
            "equipamiento": [e.strip() for e in (o.get("equipamiento") or "").split(";") if e.strip()],
            "fotos": [f for f in fotos if f],
        })
    return autos


# ------------------------------------------------------------------
# Datos derivados de cada auto
# ------------------------------------------------------------------
def slug_auto(a):
    base = slugify(f"{a['marca']} {a['modelo']} {a['anio'] or ''}") or "auto"
    return f"{base}-{slugify(a['id']) or 'x'}"


def url_auto(slug):
    return f"{SITIO}/{CARPETA}/{slug}/"


def nombre_corto(a):
    return f"{a['marca']} {a['modelo']}".strip()


def nombre_largo(a):
    partes = [a["marca"], a["modelo"], a["version"]]
    if a["tipo"] == "0km":
        partes.append("0km")
    elif a["anio"]:
        partes.append(str(a["anio"]))
    return " ".join(p for p in partes if p).strip()


def precio_texto(a):
    if a["tipo"] == "0km" or not a["precio"]:
        return None
    return f"{'USD' if a['moneda'] == 'USD' else '$'} {miles(a['precio'])}"


def km_texto(a):
    return "0 km" if not a["km"] else f"{miles(a['km'])} km"


def hash_auto(a):
    return hashlib.sha1(json.dumps(a, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:12]


def link_wa(numero, texto):
    return f"https://wa.me/{numero}?text={urllib.request.quote(texto)}"


# ------------------------------------------------------------------
# Imagen de vista previa
# ------------------------------------------------------------------
def generar_og(a, slug, manifest_prev):
    """Devuelve la URL absoluta de la imagen OG del auto (o la genérica)."""
    generica = f"{SITIO}/img/og-home.jpg"
    if not a["fotos"]:
        return generica, ""
    fuente = url_foto(a["fotos"][0], 1600)
    ruta_rel = f"{CARPETA}/{slug}/og.jpg"
    ruta = os.path.join(RAIZ, ruta_rel)
    previo = (manifest_prev.get("autos", {}).get(a["id"]) or {})
    if os.path.exists(ruta) and previo.get("og_src") == fuente and previo.get("slug") == slug:
        return f"{SITIO}/{ruta_rel}", fuente
    if os.environ.get("SIN_IMAGENES"):
        return (f"{SITIO}/{ruta_rel}", fuente) if os.path.exists(ruta) else (generica, "")
    try:
        from PIL import Image, ImageOps
        datos = descargar(fuente, timeout=40)
        im = Image.open(io.BytesIO(datos))
        im = ImageOps.exif_transpose(im).convert("RGB")
        # recorte centrado a 1,91:1, apenas corrido hacia abajo (el auto suele estar en el centro-bajo)
        w, h = im.size
        objetivo = OG_W / OG_H
        if w / h > objetivo:
            nw = int(h * objetivo)
            x = (w - nw) // 2
            im = im.crop((x, 0, x + nw, h))
        else:
            nh = int(w / objetivo)
            y = min(max(0, int((h - nh) * 0.6)), h - nh)
            im = im.crop((0, y, w, y + nh))
        im = im.resize((OG_W, OG_H), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=80, optimize=True, progressive=True)
        escribir_si_cambia(ruta_rel, buf.getvalue(), binario=True)
        return f"{SITIO}/{ruta_rel}", fuente
    except Exception as e:  # sin foto no se frena nada: se usa la genérica y se reintenta la próxima vez
        log(f"  ! no se pudo generar la imagen de {slug}: {e}")
        return (f"{SITIO}/{ruta_rel}", previo.get("og_src", "")) if os.path.exists(ruta) else (generica, "")


# ------------------------------------------------------------------
# Plantillas
# ------------------------------------------------------------------
def head_comun(cfg, titulo, descripcion, canonical, og_img, og_titulo=None, robots="index,follow", extra=""):
    ga = ""
    if cfg["ga"]:
        ga = f"""<script async src="https://www.googletagmanager.com/gtag/js?id={cfg['ga']}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}gtag('js',new Date());gtag('config','{cfg['ga']}');</script>"""
    pixel = ""
    if cfg["pixel"]:
        pixel = f"""<script>!function(f,b,e,v,n,t,s){{if(f.fbq)return;n=f.fbq=function(){{n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)}};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','{esc(cfg['pixel'])}');fbq('track','PageView');</script>
<noscript><img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id={esc(cfg['pixel'])}&ev=PageView&noscript=1"></noscript>"""
    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{esc(titulo)}</title>
<meta name="description" content="{esc(descripcion)}">
<meta name="robots" content="{robots}">
<link rel="canonical" href="{esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="ADG Autos">
<meta property="og:locale" content="es_AR">
<meta property="og:url" content="{esc(canonical)}">
<meta property="og:title" content="{esc(og_titulo or titulo)}">
<meta property="og:description" content="{esc(descripcion)}">
<meta property="og:image" content="{esc(og_img)}">
<meta property="og:image:secure_url" content="{esc(og_img)}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="{OG_W}">
<meta property="og:image:height" content="{OG_H}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(og_titulo or titulo)}">
<meta name="twitter:description" content="{esc(descripcion)}">
<meta name="twitter:image" content="{esc(og_img)}">
<meta name="theme-color" content="#0a0a0a">
{ga}
{pixel}
<link rel="icon" type="image/png" href="/img/favicon.png">
<link rel="shortcut icon" href="/img/favicon.ico">
<link rel="apple-touch-icon" href="/img/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Barlow+Condensed:wght@600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<link rel="stylesheet" href="/styles.css?v={cfg['css_ver']}">
<link rel="stylesheet" href="/{CARPETA}/autos.css?v={cfg['css_ver']}">
{extra}
</head>"""


def navbar():
    return """<nav class="navbar scrolled" id="navbar">
    <div class="container nav-content">
        <a href="/" class="brand-logo" aria-label="ADG Autos - Inicio">
            <img src="/img/logo-adg.png" alt="ADG Autos" class="brand-logo-img">
        </a>
        <ul class="nav-links" id="navLinks">
            <li><a href="/">Inicio</a></li>
            <li><a href="/autos/">Stock</a></li>
            <li><a href="/#zerokm">0km</a></li>
            <li><a href="/#simulador">Simulador</a></li>
            <li><a href="/#tasacion">Tasación</a></li>
            <li><a href="/#contacto">Contacto</a></li>
        </ul>
        <button class="mobile-menu-btn" id="menuBtn" aria-label="Menú"><i class="fas fa-bars"></i></button>
    </div>
</nav>"""


def footer(cfg):
    wa = cfg["whatsapp"]
    return f"""<a href="{link_wa(wa, 'Hola! Me interesa consultar sobre un vehículo')}" class="whatsapp-float" target="_blank" rel="noopener" aria-label="Contactar por WhatsApp" data-origen="boton_flotante">
    <i class="fab fa-whatsapp"></i>
</a>
<footer class="footer">
    <div class="container">
        <div class="footer-grid">
            <div>
                <a href="/" class="brand-logo"><img src="/img/logo-adg.png" alt="ADG Autos" class="brand-logo-img"></a>
                <p class="footer-desc">Concesionario de vehículos 0km y usados seleccionados en San Nicolás. Peritaje, escáner electrónico y gestoría propia en cada operación.</p>
                <div class="footer-social">
                    <a href="{NEGOCIO['instagram']}" target="_blank" rel="noopener" aria-label="Instagram"><i class="fab fa-instagram"></i></a>
                    <a href="{NEGOCIO['facebook']}" target="_blank" rel="noopener" aria-label="Facebook"><i class="fab fa-facebook-f"></i></a>
                    <a href="https://wa.me/{wa}" aria-label="WhatsApp"><i class="fab fa-whatsapp"></i></a>
                </div>
            </div>
            <div class="footer-col">
                <h4>Navegación</h4>
                <ul>
                    <li><a href="/">Inicio</a></li>
                    <li><a href="/autos/">Stock disponible</a></li>
                    <li><a href="/#zerokm">0km</a></li>
                    <li><a href="/#simulador">Simulador</a></li>
                    <li><a href="/#tasacion">Tasación</a></li>
                </ul>
            </div>
            <div class="footer-col">
                <h4>Oficina</h4>
                <ul>
                    <li><a href="{NEGOCIO['google']}" target="_blank" rel="noopener">{NEGOCIO['direccion']}</a></li>
                    <li><a href="{NEGOCIO['google']}" target="_blank" rel="noopener">San Nicolás, BA</a></li>
                    <li><a href="/#contacto">Lun a Vie 9:30 a 18:30</a></li>
                    <li><a href="/#contacto">Sábados con cita previa</a></li>
                </ul>
            </div>
            <div class="footer-col">
                <h4>Contacto</h4>
                <ul>
                    <li><a href="https://wa.me/{wa}">{NEGOCIO['telefono_visible']}</a></li>
                    <li><a href="{NEGOCIO['instagram']}" target="_blank" rel="noopener">@adgautos</a></li>
                </ul>
            </div>
        </div>
        <div class="footer-bottom">© {hoy()[:4]} ADG Autos | San Nicolás de los Arroyos</div>
    </div>
</footer>"""


def script_pagina(cfg, auto_id=None, extra_eventos=""):
    """JS chico: menú mobile, galería, compartir y medición (GA4 + Píxel)."""
    return f"""<script>
(function(){{
  function ev(n,p){{try{{if(typeof gtag==='function')gtag('event',n,p||{{}});}}catch(e){{}}}}
  function px(n,p){{try{{if(typeof fbq==='function')fbq('track',n,p||{{}});}}catch(e){{}}}}
  var nav=document.getElementById('navLinks'),btn=document.getElementById('menuBtn');
  if(btn&&nav){{btn.addEventListener('click',function(){{nav.classList.toggle('active');var i=btn.querySelector('i');i.className=nav.classList.contains('active')?'fas fa-times':'fas fa-bars';}});}}
  document.addEventListener('click',function(e){{
    var a=e.target.closest('a[href*="wa.me/"]');
    if(a){{var o=a.getAttribute('data-origen')||'pagina_auto';ev('click_whatsapp',{{origen:o{", auto_id:'" + esc(auto_id) + "'" if auto_id else ""}}});px('Contact'{", {content_ids:['" + esc(auto_id) + "'],content_type:'vehicle'}" if auto_id else ""});}}
  }});
  {extra_eventos}
  // Galería: scroll-snap + flechas + miniaturas + contador
  var track=document.getElementById('galTrack');
  if(track){{
    var slides=track.children,n=slides.length,cont=document.getElementById('galCount'),thumbs=document.querySelectorAll('.ap-thumb');
    function idx(){{return Math.round(track.scrollLeft/track.clientWidth);}}
    function ir(i){{i=(i+n)%n;track.scrollTo({{left:i*track.clientWidth,behavior:'smooth'}});}}
    function marcar(){{var i=idx();if(cont)cont.textContent=(i+1)+' / '+n;thumbs.forEach(function(t,k){{t.classList.toggle('active',k===i);}});}}
    track.addEventListener('scroll',function(){{window.requestAnimationFrame(marcar);}},{{passive:true}});
    var p=document.getElementById('galPrev'),s=document.getElementById('galNext');
    if(p)p.addEventListener('click',function(){{ir(idx()-1);}});
    if(s)s.addEventListener('click',function(){{ir(idx()+1);}});
    thumbs.forEach(function(t,k){{t.addEventListener('click',function(){{ir(k);}});}});
    document.addEventListener('keydown',function(e){{if(e.key==='ArrowLeft')ir(idx()-1);if(e.key==='ArrowRight')ir(idx()+1);}});
  }}
  // Compartir
  var sh=document.getElementById('btnCompartir');
  if(sh){{sh.addEventListener('click',function(){{
    var d={{title:sh.getAttribute('data-titulo'),text:sh.getAttribute('data-texto'),url:location.href.split('#')[0].split('?')[0]}};
    ev('compartir_auto',{{auto_id:sh.getAttribute('data-id')}});
    if(navigator.share){{navigator.share(d).catch(function(){{}});return;}}
    var t=document.getElementById('apToast');
    function ok(){{if(t){{t.classList.add('show');setTimeout(function(){{t.classList.remove('show');}},2200);}}}}
    if(navigator.clipboard){{navigator.clipboard.writeText(d.url).then(ok,function(){{prompt('Copiá el link:',d.url);}});}}else{{prompt('Copiá el link:',d.url);}}
  }});}}
}})();
</script>"""


def card_html(a, slug):
    precio = precio_texto(a)
    if a["tipo"] == "0km":
        precio_html = "Consultar<small>Financiación disponible</small>"
    elif precio:
        precio_html = f"{esc(precio)}<small>Peritada</small>"
    else:
        precio_html = "Consultar<small>Peritada</small>"
    foto = url_foto(a["fotos"][0], 800) if a["fotos"] else "/img/og-home.jpg"
    subt = " / ".join(x for x in [a["version"], a["transmision"], a["combustible"]] if x)
    return f"""<a class="car-card" href="/{CARPETA}/{slug}/">
    <div class="car-image">
        <span class="car-badge {'new' if a['tipo'] == '0km' else ''}">{'0km' if a['tipo'] == '0km' else 'Usado'}</span>
        <img src="{esc(foto)}" alt="{esc(nombre_largo(a))}" loading="lazy" width="800" height="600">
    </div>
    <div class="car-info">
        <h3 class="car-title">{esc(nombre_corto(a))}</h3>
        <p class="car-subtitle">{esc(subt)}</p>
        <div class="car-specs">
            <span class="car-spec"><i class="far fa-calendar"></i> {esc(a['anio'] or '')}</span>
            <span class="car-spec"><i class="fas fa-tachometer-alt"></i> {esc(km_texto(a))}</span>
            <span class="car-spec"><i class="fas fa-gas-pump"></i> {esc(a['combustible'])}</span>
        </div>
        <div class="car-footer">
            <div class="car-price">{precio_html}</div>
            <span class="car-btn">Ver más</span>
        </div>
    </div>
</a>"""


def similares(a, autos, slugs, n=3):
    otros = [x for x in autos if x["id"] != a["id"]]
    ref = a.get("precio") or 0

    def clave(x):
        mismo_tipo = 0 if x["tipo"] == a["tipo"] else 1
        dist = abs((x.get("precio") or 0) - ref) if ref and x.get("precio") else 10**12
        return (mismo_tipo, dist, -(x["anio"] or 0))

    return [(x, slugs[x["id"]]) for x in sorted(otros, key=clave)[:n]]


def json_ld(obj):
    return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False).replace("</", "<\\/") + "</script>"


def vendedor_ld():
    return {
        "@type": "AutoDealer",
        "name": NEGOCIO["nombre"],
        "url": SITIO + "/",
        "telephone": "+5493364529314",
        "address": {
            "@type": "PostalAddress",
            "streetAddress": NEGOCIO["direccion"],
            "addressLocality": NEGOCIO["ciudad"],
            "addressRegion": NEGOCIO["provincia"],
            "postalCode": NEGOCIO["cp"],
            "addressCountry": "AR",
        },
    }


def pagina_auto(a, slug, autos, slugs, og_img, cfg):
    url = url_auto(slug)
    es0 = a["tipo"] == "0km"
    precio = precio_texto(a)
    largo = nombre_largo(a)

    # Textos para Google y para la vista previa
    if es0:
        titulo = f"{largo} | Precio y financiación | ADG Autos San Nicolás"
        og_titulo = f"{largo} · Consultá precio y financiación"
        desc_base = f"{largo} con financiación y tu usado como parte de pago."
    else:
        titulo = f"{largo} · {km_texto(a)} | ADG Autos San Nicolás"
        og_titulo = f"{nombre_corto(a)} {a['anio'] or ''} · {km_texto(a)}" + (f" · {precio}" if precio else "")
        og_titulo = re.sub(r"\s+", " ", og_titulo)
        desc_base = "Usado peritado y escaneado. " + " · ".join(x for x in [a["transmision"], a["combustible"], a["color"]] if x) + "."
    texto_auto = capitalizar_inicio(a["descripcion"]).rstrip()
    if texto_auto and texto_auto[-1] not in ".!?…":
        texto_auto += "."
    descripcion = recortar(f"{desc_base} {texto_auto} ADG Autos, San Nicolás de los Arroyos.", 200)

    # Galería
    fotos = a["fotos"]
    if fotos:
        carga = ['fetchpriority="high"'] + ['loading="lazy"'] * (len(fotos) - 1)
        slides = "\n".join(
            f'<div class="ap-slide"><img src="{esc(url_foto(f, 1600))}" alt="{esc(largo)} - foto {i + 1}" '
            f'{carga[i]} width="1600" height="1600"></div>'
            for i, f in enumerate(fotos))
        thumbs = "\n".join(
            f'<button class="ap-thumb{" active" if i == 0 else ""}" type="button" aria-label="Ver foto {i + 1}">'
            f'<img src="{esc(url_foto(f, 240))}" alt="" loading="lazy" width="240" height="240"></button>'
            for i, f in enumerate(fotos))
        flechas = ("""<button class="ap-arrow prev" id="galPrev" type="button" aria-label="Foto anterior"><i class="fas fa-chevron-left"></i></button>
<button class="ap-arrow next" id="galNext" type="button" aria-label="Foto siguiente"><i class="fas fa-chevron-right"></i></button>
<span class="ap-count" id="galCount">1 / """ + str(len(fotos)) + "</span>") if len(fotos) > 1 else ""
        galeria = f"""<div class="ap-gallery">
    <div class="ap-track" id="galTrack">{slides}</div>
    {flechas}
</div>
{f'<div class="ap-thumbs">{thumbs}</div>' if len(fotos) > 1 else ''}"""
    else:
        galeria = '<div class="ap-gallery ap-gallery-empty"><i class="fas fa-car"></i><span>Fotos a pedido por WhatsApp</span></div>'

    # Ficha técnica
    specs = [("Año", a["anio"] or "—"), ("Kilometraje", km_texto(a)), ("Combustible", a["combustible"] or "—"),
             ("Transmisión", a["transmision"] or "—")]
    if a["color"]:
        specs.append(("Color", a["color"]))
    specs_html = "".join(
        f'<div class="modal-spec"><span class="modal-spec-label">{esc(k)}</span><span class="modal-spec-value">{esc(v)}</span></div>'
        for k, v in specs)
    equip_html = ""
    if a["equipamiento"]:
        items = "".join(f'<div class="modal-equipment-item"><i class="fas fa-check"></i> {esc(capitalizar_inicio(e))}</div>'
                        for e in a["equipamiento"])
        equip_html = f'<div class="modal-equipment"><h2>Equipamiento destacado</h2><div class="modal-equipment-grid">{items}</div></div>'
    desc_html = ""
    if a["descripcion"]:
        desc_html = f'<div class="modal-description"><h2>Descripción</h2><p>{esc(capitalizar_inicio(a["descripcion"]))}</p></div>'

    msg = f"Hola! Me interesa el {largo} que vi en la web: {url}"
    wa = link_wa(cfg["whatsapp"], msg)
    if es0:
        precio_bloque = '<div class="modal-price">Consultar precio</div><p class="ap-price-note">Precio y bonificaciones del mes, financiación oficial y tu usado como parte de pago.</p>'
    elif precio:
        precio_bloque = f'<div class="modal-price">{esc(precio)}</div>'
    else:
        precio_bloque = '<div class="modal-price">Consultar precio</div>'

    simular = ""
    if not es0 and a["precio"] and a["moneda"] == "ARS":
        simular = f'<a class="btn btn-light" href="/?simular={a["precio"]}#simulador"><i class="fas fa-calculator"></i> Simular crédito</a>'

    badges = f"""<span class="modal-badge {'new' if es0 else ''}">{'0km' if es0 else 'Usado'}</span>""" + (
        "" if es0 else '<span class="modal-badge"><i class="fas fa-clipboard-check"></i> Peritada</span>'
                       '<span class="modal-badge"><i class="fas fa-microchip"></i> Escaneada</span>')

    garantias = ("" if es0 else """<ul class="ap-trust">
    <li><i class="fas fa-clipboard-check"></i> Peritaje mecánico antes de ingresar al stock</li>
    <li><i class="fas fa-microchip"></i> Escaneo electrónico de centralitas y sensores</li>
    <li><i class="fas fa-file-signature"></i> Transferencia y trámites con gestoría propia</li>
    <li><i class="fas fa-calendar-check"></i> Te lo mostramos con turno, sin apuro</li>
</ul>""")

    otros = similares(a, autos, slugs)
    otros_html = ""
    if otros:
        otros_html = f"""<section class="ap-related">
    <div class="container">
        <h2 class="ap-h2">Otras unidades en stock</h2>
        <div class="catalog-grid">{''.join(card_html(x, s) for x, s in otros)}</div>
        <div class="ap-center"><a class="btn btn-dark" href="/{CARPETA}/"><i class="fas fa-car"></i> Ver todo el stock</a></div>
    </div>
</section>"""

    # Datos estructurados
    ld_car = {
        "@context": "https://schema.org",
        "@type": "Car",
        "name": largo,
        "url": url,
        "brand": {"@type": "Brand", "name": a["marca"]},
        "model": a["modelo"],
        "itemCondition": "https://schema.org/NewCondition" if es0 else "https://schema.org/UsedCondition",
        "image": [url_foto(f, 1600) for f in fotos[:5]] or [og_img],
        "description": descripcion,
    }
    if a["version"]:
        ld_car["vehicleConfiguration"] = a["version"]
    if a["anio"]:
        ld_car["vehicleModelDate"] = str(a["anio"])
    ld_car["mileageFromOdometer"] = {"@type": "QuantitativeValue", "value": a["km"], "unitCode": "KMT"}
    if a["combustible"]:
        ld_car["fuelType"] = a["combustible"]
    if a["transmision"]:
        ld_car["vehicleTransmission"] = a["transmision"]
    if a["color"]:
        ld_car["color"] = a["color"]
    if precio:
        ld_car["offers"] = {
            "@type": "Offer", "price": a["precio"], "priceCurrency": "USD" if a["moneda"] == "USD" else "ARS",
            "availability": "https://schema.org/InStock", "url": url, "seller": vendedor_ld(),
        }
    ld_bc = {
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Inicio", "item": SITIO + "/"},
            {"@type": "ListItem", "position": 2, "name": "Stock", "item": f"{SITIO}/{CARPETA}/"},
            {"@type": "ListItem", "position": 3, "name": largo, "item": url},
        ],
    }

    eventos = (f"ev('ver_auto',{{auto_id:'{esc(a['id'])}',auto_marca:'{esc(a['marca'])}',auto_modelo:'{esc(a['modelo'])}',auto_tipo:'{a['tipo']}',origen:'pagina_auto'}});"
               f"px('ViewContent',{{content_ids:['{esc(a['id'])}'],content_type:'vehicle',content_name:'{esc(largo)}'"
               + (f",value:{a['precio']},currency:'{'USD' if a['moneda'] == 'USD' else 'ARS'}'" if precio else "") + "});")

    preload = f'<link rel="preload" as="image" href="{esc(url_foto(fotos[0], 1600))}">' if fotos else ""
    return f"""{head_comun(cfg, titulo, descripcion, url, og_img, og_titulo, extra=preload + json_ld(ld_car) + json_ld(ld_bc))}
<body class="auto-page">
{navbar()}
<main class="ap-main">
    <div class="container">
        <nav class="ap-breadcrumb" aria-label="Ruta"><a href="/">Inicio</a><i class="fas fa-chevron-right"></i><a href="/{CARPETA}/">Stock</a><i class="fas fa-chevron-right"></i><span>{esc(nombre_corto(a))}</span></nav>
        <div class="ap-layout">
            <div class="ap-media">{galeria}</div>
            <div class="ap-info">
                <div class="modal-badges">{badges}</div>
                <h1 class="modal-title">{esc(nombre_corto(a))}</h1>
                <p class="modal-subtitle">{esc(a['version'])}{(' · ' + esc(a['anio'])) if (a['anio'] and not es0) else ''}</p>
                {precio_bloque}
                <div class="ap-cta">
                    <a class="btn btn-wa" href="{esc(wa)}" target="_blank" rel="noopener" data-origen="pagina_auto"><i class="fab fa-whatsapp"></i> Consultar por WhatsApp</a>
                    <div class="ap-cta-row">
                        {simular}
                        <button class="btn btn-light" id="btnCompartir" type="button" data-id="{esc(a['id'])}" data-titulo="{esc(largo)} - ADG Autos" data-texto="Mirá este {esc(largo)} en ADG Autos"><i class="fas fa-share-alt"></i> Compartir</button>
                    </div>
                </div>
                <div class="modal-specs">{specs_html}</div>
                {desc_html}
                {equip_html}
                {garantias}
            </div>
        </div>
    </div>
</main>
{otros_html}
<div class="ap-toast" id="apToast" role="status">Link copiado</div>
{footer(cfg)}
{script_pagina(cfg, a['id'], eventos)}
</body>
</html>
"""


def pagina_vendido(info, autos, slugs, cfg):
    slug = info["slug"]
    url = url_auto(slug)
    titulo_auto = info.get("titulo") or "Esta unidad"
    ref = {"id": info.get("id", ""), "tipo": info.get("tipo", "usado"), "precio": info.get("precio", 0), "anio": 0}
    otros = similares(ref, autos, slugs, n=3)
    msg = f"Hola! Vi que el {titulo_auto} ya se vendió. Si entra algo parecido, avisame."
    otros_html = "".join(card_html(x, s) for x, s in otros)
    return f"""{head_comun(cfg, f"{titulo_auto} (vendido) | ADG Autos", f"El {titulo_auto} ya se vendió. Mirá las unidades disponibles en ADG Autos, San Nicolás.", url, f"{SITIO}/img/og-home.jpg", f"{titulo_auto} · Vendido", robots="noindex,follow")}
<body class="auto-page">
{navbar()}
<main class="ap-main">
    <div class="container">
        <div class="ap-sold">
            <span class="modal-badge">Vendido</span>
            <h1 class="modal-title">{esc(titulo_auto)}</h1>
            <p class="ap-sold-text">Esta unidad ya se vendió. Si buscás algo parecido, escribinos y te avisamos cuando entre.</p>
            <div class="ap-sold-cta">
                <a class="btn btn-wa" href="{esc(link_wa(cfg['whatsapp'], msg))}" target="_blank" rel="noopener" data-origen="pagina_vendido"><i class="fab fa-whatsapp"></i> Avisame si entra uno parecido</a>
                <a class="btn btn-dark" href="/{CARPETA}/"><i class="fas fa-car"></i> Ver stock disponible</a>
            </div>
        </div>
    </div>
</main>
{f'<section class="ap-related"><div class="container"><h2 class="ap-h2">Disponibles ahora</h2><div class="catalog-grid">{otros_html}</div></div></section>' if otros_html else ''}
{footer(cfg)}
{script_pagina(cfg)}
</body>
</html>
"""


def pagina_redireccion(destino):
    return f"""<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>ADG Autos</title>
<meta name="robots" content="noindex,follow">
<link rel="canonical" href="{esc(destino)}">
<meta http-equiv="refresh" content="0; url={esc(destino)}">
<script>location.replace({json.dumps(destino)});</script>
</head><body><a href="{esc(destino)}">Ver el auto</a></body></html>
"""


def pagina_listado(autos, slugs, cfg):
    usados = [a for a in autos if a["tipo"] != "0km"]
    nuevos = [a for a in autos if a["tipo"] == "0km"]
    usados.sort(key=lambda a: (not a["destacado"], -(a["anio"] or 0)))

    def bloque(titulo, lista):
        if not lista:
            return ""
        return f"""<h2 class="ap-h2">{titulo} <span class="ap-h2-count">{len(lista)}</span></h2>
<div class="catalog-grid ap-list-grid">{''.join(card_html(a, slugs[a['id']]) for a in lista)}</div>"""

    ld = {
        "@context": "https://schema.org", "@type": "ItemList",
        "itemListElement": [{"@type": "ListItem", "position": i + 1, "url": url_auto(slugs[a["id"]]), "name": nombre_largo(a)}
                            for i, a in enumerate(usados + nuevos)],
    }
    desc = f"{len(usados)} usados peritados y escaneados y {len(nuevos)} 0km con financiación. Stock actualizado de ADG Autos en San Nicolás de los Arroyos."
    return f"""{head_comun(cfg, "Autos usados y 0km en stock en San Nicolás | ADG Autos", desc, f"{SITIO}/{CARPETA}/", f"{SITIO}/img/og-home.jpg", "Stock disponible · ADG Autos San Nicolás", extra=json_ld(ld))}
<body class="auto-page">
{navbar()}
<main class="ap-main">
    <div class="container">
        <nav class="ap-breadcrumb" aria-label="Ruta"><a href="/">Inicio</a><i class="fas fa-chevron-right"></i><span>Stock</span></nav>
        <header class="ap-list-header">
            <h1 class="modal-title">Stock disponible</h1>
            <p class="modal-subtitle">Usados peritados y escaneados, y 0km de todas las marcas. San Nicolás de los Arroyos.</p>
        </header>
        {bloque("Usados", usados)}
        {bloque("0km", nuevos)}
    </div>
</main>
{footer(cfg)}
{script_pagina(cfg)}
</body>
</html>
"""


def sitemap(autos, slugs, manifest):
    urls = [(SITIO + "/", hoy(), "1.0"), (f"{SITIO}/{CARPETA}/", hoy(), "0.9")]
    for a in autos:
        urls.append((url_auto(slugs[a["id"]]), manifest["autos"][a["id"]]["lastmod"], "0.8"))
    # la fecha de la home/listado solo cambia si cambió el stock (evita commits en cada corrida)
    firma = manifest.get("firma_stock_fecha", hoy())
    urls[0] = (urls[0][0], firma, urls[0][2])
    urls[1] = (urls[1][0], firma, urls[1][2])
    cuerpo = "\n".join(f"  <url><loc>{esc(u)}</loc><lastmod>{d}</lastmod><priority>{p}</priority></url>" for u, d, p in urls)
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{cuerpo}\n</urlset>\n'


# ------------------------------------------------------------------
# Principal
# ------------------------------------------------------------------
def main():
    cfg = config_sitio()
    if os.environ.get("STOCK_CSV_FILE"):
        with open(os.environ["STOCK_CSV_FILE"], encoding="utf-8") as f:
            texto = f.read()
    else:
        if not cfg["sheet_url"]:
            log("No hay sheetURL en script.js")
            return 1
        try:
            texto = descargar(cfg["sheet_url"]).decode("utf-8")
        except Exception as e:
            log(f"No se pudo descargar la planilla: {e}. No se modifica nada.")
            return 1

    autos = parsear_stock(texto)
    if not autos:
        # protección: una planilla vacía o mal publicada no puede borrar el sitio
        log("La planilla no tiene autos disponibles (o no se pudo leer). No se modifica nada.")
        return 1
    log(f"Autos disponibles: {len(autos)}")

    ruta_manifest = os.path.join(RAIZ, CARPETA, "manifest.json")
    prev = {}
    if os.path.exists(ruta_manifest):
        with open(ruta_manifest, encoding="utf-8") as f:
            prev = json.load(f)
    prev.setdefault("autos", {})
    prev.setdefault("vendidos", {})
    prev.setdefault("redirecciones", {})

    slugs = {a["id"]: slug_auto(a) for a in autos}
    nuevo = {"version": 1, "autos": {}, "vendidos": dict(prev["vendidos"]), "redirecciones": dict(prev["redirecciones"])}
    cambios = []

    for a in autos:
        slug = slugs[a["id"]]
        h = hash_auto(a)
        anterior = prev["autos"].get(a["id"]) or {}
        lastmod = anterior.get("lastmod") if anterior.get("hash") == h and anterior.get("slug") == slug else hoy()
        og_img, og_src = generar_og(a, slug, prev)
        nuevo["autos"][a["id"]] = {"slug": slug, "hash": h, "lastmod": lastmod, "og_src": og_src,
                                   "titulo": nombre_largo(a), "tipo": a["tipo"], "precio": a["precio"]}
        # si volvió a estar disponible, deja de figurar como vendido / redirección
        nuevo["vendidos"].pop(slug, None)
        nuevo["redirecciones"].pop(slug, None)
        # cambió el slug (se editó marca/modelo/año): el link viejo redirige al nuevo
        if anterior.get("slug") and anterior["slug"] != slug:
            nuevo["redirecciones"][anterior["slug"]] = slug
            cambios.append(f"redirección {anterior['slug']} → {slug}")

    for slug_viejo, destino in list(nuevo["redirecciones"].items()):
        # una redirección apunta siempre al slug vigente de ese auto; si el auto se vendió, pasa a "vendido"
        id_dest = next((i for i, d in nuevo["autos"].items() if d["slug"] == destino), None)
        if id_dest is None:
            del nuevo["redirecciones"][slug_viejo]
            titulo = next((d.get("titulo") for d in prev["autos"].values() if d.get("slug") == destino), "Esta unidad")
            nuevo["vendidos"].setdefault(slug_viejo, {"slug": slug_viejo, "titulo": titulo, "desde": hoy()})

    # Vendidos: estaban publicados y ya no
    for id_prev, d in prev["autos"].items():
        if id_prev not in nuevo["autos"]:
            nuevo["vendidos"][d["slug"]] = {"slug": d["slug"], "id": id_prev, "titulo": d.get("titulo", "Esta unidad"),
                                           "tipo": d.get("tipo", "usado"), "precio": d.get("precio", 0), "desde": hoy()}
            cambios.append(f"vendido: {d['slug']}")
            og = os.path.join(RAIZ, CARPETA, d["slug"], "og.jpg")
            if os.path.exists(og):
                os.remove(og)

    # Firma del stock: fecha de último cambio (para sitemap)
    firma = hashlib.sha1(json.dumps({i: d["hash"] for i, d in sorted(nuevo["autos"].items())}).encode()).hexdigest()[:12]
    if prev.get("firma_stock") == firma:
        nuevo["firma_stock"], nuevo["firma_stock_fecha"] = firma, prev.get("firma_stock_fecha", hoy())
    else:
        nuevo["firma_stock"], nuevo["firma_stock_fecha"] = firma, hoy()

    # Escribir páginas
    escritos = 0
    for a in autos:
        slug = slugs[a["id"]]
        og_img = f"{SITIO}/{CARPETA}/{slug}/og.jpg" if nuevo["autos"][a["id"]]["og_src"] and os.path.exists(
            os.path.join(RAIZ, CARPETA, slug, "og.jpg")) else f"{SITIO}/img/og-home.jpg"
        escritos += escribir_si_cambia(f"{CARPETA}/{slug}/index.html", pagina_auto(a, slug, autos, slugs, og_img, cfg))
    for slug, info in nuevo["vendidos"].items():
        escritos += escribir_si_cambia(f"{CARPETA}/{slug}/index.html", pagina_vendido(info, autos, slugs, cfg))
    for viejo, destino in nuevo["redirecciones"].items():
        escritos += escribir_si_cambia(f"{CARPETA}/{viejo}/index.html", pagina_redireccion(url_auto(destino)))
    escritos += escribir_si_cambia(f"{CARPETA}/index.html", pagina_listado(autos, slugs, cfg))
    escritos += escribir_si_cambia("sitemap.xml", sitemap(autos, slugs, nuevo))
    escritos += escribir_si_cambia("robots.txt", f"User-agent: *\nAllow: /\n\nSitemap: {SITIO}/sitemap.xml\n")
    escritos += escribir_si_cambia(f"{CARPETA}/manifest.json",
                                   json.dumps(nuevo, ensure_ascii=False, indent=1, sort_keys=True) + "\n")

    for c in cambios:
        log("  · " + c)
    log(f"Archivos actualizados: {escritos}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
