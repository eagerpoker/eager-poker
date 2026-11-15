import { getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, onSnapshot, doc, getDoc, setDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ADMIN_UID = "vIia3H24Mla7zkdEBdUTn0VaIkD3";
let db, auth, stop = null, tables = {}, courante = null;
let editant = false, items = [], ajoutes = [], sel = null, barreEl = null, fichier = null;
const cache = {};
const msg = t => { const m = document.getElementById("msg"); if (m) m.textContent = t; };

const couche = document.createElement("div");
couche.id = "fondImages";
couche.style.cssText = "position:fixed;left:0;top:0;right:0;bottom:0;z-index:-1;pointer-events:none;overflow:hidden;display:none";
document.body.appendChild(couche);

const attente = setInterval(() => {
  if (!getApps().length) return;
  clearInterval(attente);
  auth = getAuth(getApps()[0]);
  db = getFirestore(getApps()[0]);
  onAuthStateChanged(auth, user => {
    if (stop) { stop(); stop = null; }
    tables = {};
    if (!user) return;
    stop = onSnapshot(collection(db, "tables"), snap => {
      tables = {};
      snap.docs.forEach(d => { tables[d.id] = d.data(); });
    }, () => {});
  });
  setInterval(boucle, 500);
}, 300);

function tableAffichee() {
  const vue = document.getElementById("tableView");
  const titre = document.getElementById("titreTable");
  if (!vue || vue.style.display === "none" || !titre) return null;
  const txt = titre.textContent || "";
  let meilleur = null;
  Object.keys(tables).forEach(id => {
    const n = tables[id].name || "";
    if (n && txt.startsWith(n) && (!meilleur || n.length > tables[meilleur].name.length)) meilleur = id;
  });
  return meilleur;
}

function valider(l) {
  return (Array.isArray(l) ? l : []).filter(i => i && typeof i.id === "string" && typeof i.x === "number" && typeof i.y === "number" && typeof i.w === "number");
}

function boucle() {
  const id = tableAffichee();
  if (id !== courante) {
    if (editant) quitterEdition();
    courante = id;
    couche.textContent = "";
  }
  couche.style.display = id ? "block" : "none";
  if (!id) return;
  ajouterBouton();
  if (!editant) rendre(valider((tables[id].decoPlus || {}).fond));
}

function creerImg(it) {
  const el = document.createElement("img");
  el.dataset.id = it.id;
  el.alt = "";
  el.draggable = false;
  el.style.cssText = "position:absolute;transform:translate(-50%,-50%);height:auto;touch-action:none;user-select:none;-webkit-user-select:none";
  el.addEventListener("pointerdown", e => {
    if (!editant) return;
    e.preventDefault();
    sel = it.id;
    const cur = items.find(i => i.id === it.id);
    if (!cur) return;
    const sx = e.clientX, sy = e.clientY, ox = cur.x, oy = cur.y;
    el.setPointerCapture(e.pointerId);
    el.onpointermove = ev => {
      cur.x = ox + (ev.clientX - sx) / window.innerWidth * 100;
      cur.y = oy + (ev.clientY - sy) / window.innerHeight * 100;
      rendre(items);
    };
    el.onpointerup = el.onpointercancel = () => { el.onpointermove = null; };
  });
  return el;
}

function charger(it, el) {
  const cle = it.id + "|" + it.v;
  if (el.dataset.k === cle) return;
  el.dataset.k = cle;
  if (cache[cle]) { el.src = cache[cle]; return; }
  getDoc(doc(db, "decor_images", courante + "_f_" + it.id)).then(s => {
    if (s.exists()) { cache[cle] = s.data().data; if (el.dataset.k === cle) el.src = cache[cle]; }
  }).catch(() => {});
}

function rendre(liste) {
  const ids = new Set(liste.map(i => i.id));
  Array.from(couche.children).forEach(el => { if (!ids.has(el.dataset.id)) el.remove(); });
  liste.forEach(it => {
    let el = couche.querySelector('[data-id="' + it.id + '"]');
    if (!el) { el = creerImg(it); couche.appendChild(el); }
    el.style.left = it.x + "%";
    el.style.top = it.y + "%";
    el.style.width = it.w + "%";
    el.style.pointerEvents = editant ? "auto" : "none";
    el.style.outline = editant && sel === it.id ? "2px dashed #f4b400" : "none";
    charger(it, el);
  });
}

function lireImage(file, cote, qualite) {
  return new Promise((ok, ko) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const r = Math.min(1, cote / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * r);
      c.height = Math.round(img.height * r);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      let data = c.toDataURL("image/webp", qualite);
      if (!data.startsWith("data:image/webp")) data = c.toDataURL("image/jpeg", qualite);
      ok(data);
    };
    img.onerror = () => { URL.revokeObjectURL(url); ko(new Error("image illisible")); };
    img.src = url;
  });
}

async function ajouterFichier(f) {
  if (!f || !f.type.startsWith("image/")) { msg("Choisis une image."); return; }
  const tid = courante;
  msg("Envoi de l'image…");
  try {
    let data = "";
    for (const c of [1600, 1200, 900, 700, 500]) {
      data = await lireImage(f, c, 0.85);
      if (data.length <= 900000) break;
    }
    if (data.length > 950000) throw new Error("image trop complexe");
    const id = Date.now().toString(36) + Math.floor(Math.random() * 100);
    const v = Date.now();
    await setDoc(doc(db, "decor_images", tid + "_f_" + id), { data, v });
    if (!editant || tid !== courante) return;
    cache[id + "|" + v] = data;
    items.push({ id, v, x: 50, y: 50, w: 40 });
    ajoutes.push(id);
    sel = id;
    rendre(items);
    msg("Image ajoutée. Déplace-la avec le doigt.");
  } catch (e) { msg("Erreur : " + (e.code || e.message)); }
}

function taille(f) {
  const cur = items.find(i => i.id === sel);
  if (!cur) { msg("Touche d'abord une image."); return; }
  cur.w = Math.max(5, Math.min(200, cur.w * f));
  rendre(items);
}

function supprimer() {
  if (!sel) { msg("Touche d'abord une image."); return; }
  items = items.filter(i => i.id !== sel);
  sel = null;
  rendre(items);
}

async function finir(enregistrer) {
  const tid = courante;
  try {
    const sauvees = valider((tables[tid].decoPlus || {}).fond);
    if (enregistrer) {
      await updateDoc(doc(db, "tables", tid), {
        "decoPlus.fond": items.map(i => ({ id: i.id, v: i.v, x: Math.round(i.x * 10) / 10, y: Math.round(i.y * 10) / 10, w: Math.round(i.w * 10) / 10 }))
      });
      const gardes = new Set(items.map(i => i.id));
      for (const s of sauvees) if (!gardes.has(s.id)) await deleteDoc(doc(db, "decor_images", tid + "_f_" + s.id)).catch(() => {});
      msg("Fond enregistré.");
    } else {
      for (const id of ajoutes) await deleteDoc(doc(db, "decor_images", tid + "_f_" + id)).catch(() => {});
      msg("Modifications annulées.");
    }
  } catch (e) { msg("Erreur : " + (e.code || e.message)); return; }
  quitterEdition();
}

function barre() {
  if (barreEl) return barreEl;
  const b = document.createElement("div");
  b.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:60;display:none;flex-wrap:wrap;justify-content:center;gap:4px;padding:8px;background:#0b3d2ef2";
  [["Ajouter une image", () => fichier.click()], ["Plus grand", () => taille(1.15)], ["Plus petit", () => taille(1 / 1.15)],
   ["Supprimer", supprimer], ["Enregistrer", () => finir(true)], ["Annuler", () => finir(false)]].forEach(a => {
    const x = document.createElement("button");
    x.textContent = a[0];
    x.onclick = a[1];
    x.style.cssText = "width:auto;max-width:none;margin:0;padding:9px 11px;font-size:13px";
    b.appendChild(x);
  });
  fichier = document.createElement("input");
  fichier.type = "file"; fichier.accept = "image/*"; fichier.hidden = true;
  fichier.onchange = () => { const f = fichier.files[0]; fichier.value = ""; ajouterFichier(f); };
  b.appendChild(fichier);
  document.body.appendChild(b);
  barreEl = b;
  return b;
}

function entrerEdition() {
  if (!courante || !auth.currentUser || auth.currentUser.uid !== ADMIN_UID) return;
  items = valider((tables[courante].decoPlus || {}).fond).map(i => ({ ...i }));
  ajoutes = []; sel = null; editant = true;
  couche.style.zIndex = "50";
  barre().style.display = "flex";
  rendre(items);
  msg("Mode placement : touche une image pour la déplacer.");
}

function quitterEdition() {
  editant = false; sel = null; items = []; ajoutes = [];
  couche.style.zIndex = "-1";
  if (barreEl) barreEl.style.display = "none";
}

function ajouterBouton() {
  const box = document.getElementById("decoBox");
  if (!box || document.getElementById("btnFondPlacer")) return;
  const b = document.createElement("button");
  b.id = "btnFondPlacer";
  b.className = "gris";
  b.textContent = "Placer des images de fond";
  b.onclick = entrerEdition;
  box.insertBefore(b, document.getElementById("btnDeco"));
      }
