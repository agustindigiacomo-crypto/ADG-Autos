/**
 * ADG Autos — Panel de stock (Google Apps Script, vinculado a la planilla "ADG Autos - Stock")
 *
 * App web privada (solo la cuenta de Agustín) para:
 *   - Cargar un auto nuevo desde el celular: datos + fotos → carpeta en Drive + fila en la planilla
 *   - Cambiar precio / km, destacarlo, marcarlo vendido o volver a publicarlo
 *
 * La web (adgautos.com.ar) lee la planilla publicada: los cambios aparecen en unos minutos
 * en el catálogo y en hasta 30 minutos en la página propia de cada auto.
 */

const PANEL = {
  HOJA_STOCK: 'Hoja 1',
  CARPETA_FOTOS: 'ADG Autos - Fotos', // carpeta raíz donde va una subcarpeta por auto
  MAX_FOTOS: 9,
  WEB: 'https://adgautos.com.ar'
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Panel')
    .setTitle('ADG Autos · Panel')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setFaviconUrl('https://adgautos.com.ar/img/favicon.png');
}

/* ---------------- Planilla ---------------- */

function hoja_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PANEL.HOJA_STOCK);
  if (!sh) throw new Error('No encuentro la pestaña "' + PANEL.HOJA_STOCK + '" en la planilla.');
  return sh;
}

function norm_(s) {
  return String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Mapa nombre de columna → número de columna (1-based). Tolera "año", "ano", "anio", "precio_arg"...
function columnas_(sh) {
  const encabezados = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const col = {};
  encabezados.forEach(function (h, i) {
    let k = norm_(h);
    if (k === 'ano' || k === 'anio' || k === 'year') k = 'anio';
    if (/^precio(_arg|_ars|_ar|_pesos|\$)?$/.test(k)) k = 'precio';
    col[k] = i + 1;
  });
  ['id', 'marca', 'modelo', 'disponible'].forEach(function (k) {
    if (!col[k]) throw new Error('Falta la columna "' + k + '" en la planilla.');
  });
  return col;
}

function siNo_(v) {
  return norm_(v) === 'si';
}

function idDriveDe_(url) {
  const m = String(url || '').match(/\/d\/([A-Za-z0-9_-]+)/) || String(url || '').match(/[?&]id=([A-Za-z0-9_-]+)/);
  return m ? m[1] : '';
}

function filaPorId_(sh, col, id) {
  const ids = sh.getRange(2, col.id, Math.max(sh.getLastRow() - 1, 1), 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === String(id).trim()) return i + 2;
  }
  throw new Error('No encuentro el auto con id ' + id + ' en la planilla.');
}

/** Lista para la pantalla "Mi stock". */
function listarStock() {
  const sh = hoja_();
  const col = columnas_(sh);
  const n = sh.getLastRow() - 1;
  if (n < 1) return { autos: [], marcas: [] };
  const datos = sh.getRange(2, 1, n, sh.getLastColumn()).getValues();
  const get = function (fila, k) { return col[k] ? fila[col[k] - 1] : ''; };
  const autos = [];
  const marcas = {};
  datos.forEach(function (f) {
    const id = String(get(f, 'id')).trim();
    if (!id) return;
    const marca = String(get(f, 'marca')).trim();
    if (marca) marcas[marca] = true;
    const fotoId = idDriveDe_(get(f, 'foto_1'));
    autos.push({
      id: id,
      marca: marca,
      modelo: String(get(f, 'modelo')).trim(),
      version: String(get(f, 'version')).trim(),
      anio: String(get(f, 'anio')).trim(),
      km: Number(String(get(f, 'km')).replace(/\D/g, '')) || 0,
      precio: Number(String(get(f, 'precio')).replace(/[^\d]/g, '')) || 0,
      tipo: norm_(get(f, 'tipo')) === '0km' ? '0km' : 'usado',
      destacado: siNo_(get(f, 'destacado')),
      disponible: get(f, 'disponible') === '' ? true : siNo_(get(f, 'disponible')),
      foto: fotoId ? 'https://lh3.googleusercontent.com/d/' + fotoId + '=w400' : ''
    });
  });
  autos.sort(function (a, b) { return (Number(b.id) || 0) - (Number(a.id) || 0); });
  return { autos: autos, marcas: Object.keys(marcas).sort() };
}

/** Cambios rápidos desde "Mi stock": precio, km, destacado, disponible. */
function actualizarAuto(id, cambios) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = hoja_();
    const col = columnas_(sh);
    const fila = filaPorId_(sh, col, id);
    if (cambios.hasOwnProperty('precio') && col.precio) sh.getRange(fila, col.precio).setValue(Number(cambios.precio) || 0);
    if (cambios.hasOwnProperty('km') && col.km) sh.getRange(fila, col.km).setValue(Number(cambios.km) || 0);
    if (cambios.hasOwnProperty('destacado') && col.destacado) sh.getRange(fila, col.destacado).setValue(cambios.destacado ? 'SI' : 'NO');
    if (cambios.hasOwnProperty('disponible')) sh.getRange(fila, col.disponible).setValue(cambios.disponible ? 'SI' : 'NO');
    SpreadsheetApp.flush();
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/* ---------------- Alta de un auto ---------------- */

function carpetaRaiz_() {
  const it = DriveApp.getFoldersByName(PANEL.CARPETA_FOTOS);
  if (it.hasNext()) return it.next();
  const f = DriveApp.createFolder(PANEL.CARPETA_FOTOS);
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return f;
}

function pad3_(n) {
  return ('000' + n).slice(-3);
}

/**
 * Paso 1: reserva el id, crea la carpeta y deja la fila cargada como NO disponible
 * (así la web no la muestra hasta que estén las fotos).
 */
function iniciarAlta(d) {
  if (!d || !d.marca || !d.modelo) throw new Error('Faltan marca o modelo.');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = hoja_();
    const col = columnas_(sh);
    const n = Math.max(sh.getLastRow() - 1, 0);
    const ids = n ? sh.getRange(2, col.id, n, 1).getValues().map(function (r) { return Number(r[0]) || 0; }) : [];
    const id = (ids.length ? Math.max.apply(null, ids) : 0) + 1;

    const nombre = [pad3_(id), d.marca, d.modelo, d.version, d.tipo === '0km' ? '0km' : d.anio]
      .filter(String).join(' ').replace(/\s+/g, ' ').trim();
    const carpeta = carpetaRaiz_().createFolder(nombre);
    carpeta.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const fila = new Array(sh.getLastColumn()).fill('');
    const set = function (k, v) { if (col[k]) fila[col[k] - 1] = v; };
    set('id', id);
    set('marca', d.marca);
    set('modelo', d.modelo);
    set('version', d.version || '');
    set('anio', Number(d.anio) || '');
    set('km', d.tipo === '0km' ? 0 : (Number(d.km) || 0));
    set('combustible', d.combustible || '');
    set('transmision', d.transmision || '');
    set('color', d.color || '');
    set('precio', d.tipo === '0km' ? 0 : (Number(d.precio) || 0));
    set('tipo', d.tipo === '0km' ? '0km' : 'usado');
    set('destacado', d.destacado ? 'SI' : 'NO');
    set('descripcion', d.descripcion || '');
    set('equipamiento', (d.equipamiento || []).join(';'));
    set('disponible', 'NO');
    sh.appendRow(fila);
    SpreadsheetApp.flush();
    return { id: id, carpetaId: carpeta.getId() };
  } finally {
    lock.releaseLock();
  }
}

/** Paso 2 (una vez por foto): guarda la foto ya achicada en el celular. */
function subirFoto(carpetaId, orden, dataUrl) {
  const m = String(dataUrl || '').match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!m) throw new Error('Foto inválida.');
  const nombre = ('0' + orden).slice(-2) + '.jpg';
  const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], nombre);
  const archivo = DriveApp.getFolderById(carpetaId).createFile(blob);
  archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/file/d/' + archivo.getId() + '/view';
}

/** Paso 3: guarda los links de las fotos y publica el auto. */
function confirmarAlta(id, fotos) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = hoja_();
    const col = columnas_(sh);
    const fila = filaPorId_(sh, col, id);
    for (let i = 1; i <= PANEL.MAX_FOTOS; i++) {
      if (col['foto_' + i]) sh.getRange(fila, col['foto_' + i]).setValue((fotos || [])[i - 1] || '');
    }
    sh.getRange(fila, col.disponible).setValue('SI');
    SpreadsheetApp.flush();
    return { ok: true, url: PANEL.WEB + '/?auto=' + id };
  } finally {
    lock.releaseLock();
  }
}

/** Si algo falla a mitad de camino: borra la fila y manda la carpeta a la papelera. */
function cancelarAlta(id, carpetaId) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    try {
      const sh = hoja_();
      const col = columnas_(sh);
      const fila = filaPorId_(sh, col, id);
      if (!siNo_(sh.getRange(fila, col.disponible).getValue())) sh.deleteRow(fila);
    } catch (e) { /* la fila no llegó a crearse */ }
    try { if (carpetaId) DriveApp.getFolderById(carpetaId).setTrashed(true); } catch (e) { }
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}
