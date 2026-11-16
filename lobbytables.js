import { getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, query, orderBy, getDocs, doc, onSnapshot, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ADMIN_UID = "vIia3H24Mla7zkdEBdUTn0VaIkD3";
let db, auth, estAdmin = false, stop = null, config = { entrees: [] }, occupe = false, dernierNorm = 0, cible = null, fichier = null;
const memoire = {};
const msg = t => { const m = document.getElementById("msg"); if (m) m.textContent = t; };

const css = document.createElement("style");
css.textContent = "#liste{display:flex;flex-direction:column}#liste .carte{position:relative;width:100%;box-sizing:border-box}";
document.head.appendChild(css);

const init = setInterval(() => {
  if (!getApps().length) return;
  clearInterval(init);
  auth = getAuth(getApps()[0]);
  db = getFirestore(getApps()[0]);
  onAuthStateChanged(auth, user => {
    if (stop) { stop(); stop = null; }
    config = { entrees: [] };
    estAdmin = !!user && user.uid === ADMIN_UID;
    if (!user) return;
    stop = onSnapshot(doc(db, "decor_images", "_lobby"), s => {
      const d = s.exists() ? s.data() : null;
      config = { entrees: d && Array.isArray(d.entrees) ? d.entrees : [] };
      appliquer();
    }, () => {});
  });
  setInterval(appliquer, 500);
}, 300);

function cartes() {
  const l = document.getElementById("liste");
  if (!l) return [];
  return Array.from(l.children).filter(c => c.classList && c.classList.contains("carte"));
}
function nomCarte(c) { const h = c.querySelector("h3"); return h ? h.textContent : ""; }

function appliquer() {
  if (!db) return;
  const cs = cartes();
  if (!cs.length) return;
  const files = {};
  config.entrees.forEach((e, k) => { (files[e.nom] = files[e.nom] || []).push(k); });
  let inconnues = 0;
  cs.forEach((c, i) => {
    const nom = nomCarte(c);
    const k = files[nom] && files[nom].length ? files[nom].shift() : null;
    if (k === null) inconnues++;
    c.style.order = k !== null ? k : 1000 + i;
    const e = k !== null ? config.entrees[k] : null;
    c._entree = e;
    photoCarte(c, e);
    if (estAdmin) { controles(c); editeurPhoto(c); }
  });
  if (estAdmin && config.entrees.length && inconnues && Date.now() - dernierNorm > 15000) {
    dernierNorm = Date.now();
    lireTables().then(t => sauver(ordreActuel(t))).catch(() => {});
  }
}

function photoCarte(c, e) {
  let im = c.querySelector(".photoTable");
  const v = e && e.v ? e.id + "|" + e.v : "";
  const h = c.querySelector("h3");
  if (!v) { if (im) { im.remove(); if (h) h.style.paddingRight = ""; } return; }
  if (!im) {
    im = document.createElement("img");
    im.className = "photoTable";
    im.alt = "";
    im.style.cssText = "position:absolute;top:10px;right:10px;width:64px;height:64px;border-radius:12px;object-fit:cover;border:2px solid #f4b400";
    c.insertBefore(im, c.firstChild);
    if (h) h.style.paddingRight = "76px";
  }
  if (im.dataset.k !== v) {
    im.dataset.k = v;
    if (memoire[v]) im.src = memoire[v];
    else getDoc(doc(db, "decor_images", e.id + "_photo")).then(s => {
      if (s.exists()) { memoire[v] = s.data().data; if (im.dataset.k === v) im.src = memoire[v]; }
    }).catch(() => {});
  }
}

function bouton(texte, fn) {
  const b = document.createElement("button");
  b.className = "gris";
  b.textContent = texte;
  b.onclick = fn;
  return b;
}

function controles(c) {
  if (c.querySelector(".rangBtns")) return;
  const admin = Array.from(c.querySelectorAll("button")).some(b => b.textContent === "Modifier" || b.textContent === "Fermer");
  if (!admin) return;
  const r = document.createElement("div");
  r.className = "rangBtns";
  r.append(bouton("⬆ Monter", () => deplacer(c, -1)), bouton("⬇ Descendre", () => deplacer(c, 1)), bouton("⭐ En premier", () => deplacer(c, -999)));
  c.appendChild(r);
}

function editeurPhoto(c) {
  const p = c.querySelector(".boite");
  if (!p || p.querySelector(".photoTableLigne")) return;
  const l = document.createElement("div");
  l.className = "ligne photoTableLigne";
  const t = document.createElement("span");
  t.className = "mini";
  t.textContent = "Photo de la table";
  const b = document.createElement("div");
  b.className = "btns";
  b.append(bouton("Insérer", () => choisirPhoto(c)), bouton("Retirer", () => retirerPhoto(c)));
  l.append(t, b);
  p.insertBefore(l, p.firstChild);
}

async function lireTables() {
  const sn = await getDocs(query(collection(db, "tables"), orderBy("createdAt", "desc")));
  return sn.docs.map(d => ({ id: d.id, nom: d.data().name || "" }));
}

function ordreActuel(tables) {
  const parId = {};
  tables.forEach(t => { parId[t.id] = t; });
  const res = [], vus = new Set();
  config.entrees.forEach(e => {
    if (parId[e.id] && !vus.has(e.id)) { vus.add(e.id); res.push({ id: e.id, nom: parId[e.id].nom, v: e.v || 0 }); }
  });
  tables.forEach(t => { if (!vus.has(t.id)) res.push({ id: t.id, nom: t.nom, v: 0 }); });
  return res;
}

function sauver(liste) {
  return setDoc(doc(db, "decor_images", "_lobby"), { entrees: liste.map(x => ({ id: x.id, nom: x.nom, v: x.v || 0 })) });
}

function trouver(tables) {
  if (!cible) return null;
  let t = tables[cible.idx];
  if (!t || t.nom !== cible.nom) t = tables.find(x => x.nom === cible.nom);
  return t || null;
}

function viser(c) { cible = { nom: nomCarte(c), idx: cartes().indexOf(c) }; }

async function deplacer(c, delta) {
  if (occupe) return;
  viser(c);
  occupe = true;
  try {
    const tables = await lireTables();
    const t = trouver(tables);
    if (!t) { msg("Table introuvable."); return; }
    const liste = ordreActuel(tables);
    const k = liste.findIndex(x => x.id === t.id);
    const n = Math.max(0, Math.min(liste.length - 1, delta === -999 ? 0 : k + delta));
    if (n === k) return;
    const x = liste.splice(k, 1)[0];
    liste.splice(n, 0, x);
    await sauver(liste);
    msg("Ordre enregistré.");
  } catch (e) { msg("Erreur : " + (e.code || e.message)); }
  finally { occupe = false; }
}

function compresser(file) {
  return new Promise((ok, ko) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let cote = 480, q = 0.8;
      for (let i = 0; i < 6; i++) {
        const r = Math.min(1, cote / Math.max(img.width, img.height));
        const cv = document.createElement("canvas");
        cv.width = Math.max(1, Math.round(img.width * r));
        cv.height = Math.max(1, Math.round(img.height * r));
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        let d = cv.toDataURL("image/webp", q);
        if (d.indexOf("data:image/webp") !== 0) d = cv.toDataURL("image/jpeg", q);
        if (d.length <= 150000) return ok(d);
        cote = Math.round(cote * 0.8);
        q = Math.max(0.5, q - 0.06);
      }
      ko(new Error("image trop lourde"));
    };
    img.onerror = () => { URL.revokeObjectURL(url); ko(new Error("image illisible")); };
    img.src = url;
  });
}

function choisirPhoto(c) {
  viser(c);
  if (!fichier) {
    fichier = document.createElement("input");
    fichier.type = "file";
    fichier.accept = "image/*";
    fichier.style.display = "none";
    fichier.onchange = () => { const f = fichier.files[0]; fichier.value = ""; if (f) poserPhoto(f); };
    document.body.appendChild(fichier);
  }
  fichier.click();
}

async function poserPhoto(f) {
  if (occupe) return;
  occupe = true;
  try {
    msg("Envoi de la photo…");
    const tables = await lireTables();
    const t = trouver(tables);
    if (!t) throw new Error("table introuvable");
    if (f.type.indexOf("image/") !== 0) throw new Error("choisis une image");
    const data = await compresser(f);
    const v = Date.now();
    await setDoc(doc(db, "decor_images", t.id + "_photo"), { data, v });
    const liste = ordreActuel(tables);
    liste.find(x => x.id === t.id).v = v;
    await sauver(liste);
    memoire[t.id + "|" + v] = data;
    msg("Photo de la table enregistrée.");
  } catch (e) { msg("Erreur : " + (e.code || e.message)); }
  finally { occupe = false; }
}

async function retirerPhoto(c) {
  if (occupe) return;
  viser(c);
  occupe = true;
  try {
    const tables = await lireTables();
    const t = trouver(tables);
    if (!t) throw new Error("table introuvable");
    await deleteDoc(doc(db, "decor_images", t.id + "_photo")).catch(() => {});
    const liste = ordreActuel(tables);
    liste.find(x => x.id === t.id).v = 0;
    await sauver(liste);
    msg("Photo retirée.");
  } catch (e) { msg("Erreur : " + (e.code || e.message)); }
  finally { occupe = false; }
  }setInterval(() => {
  cartes().forEach(c => {
    const avec = !!c.querySelector(".photoTable");
    [c.querySelector("h3"), c.querySelector(":scope > small"), c.querySelector(":scope > div")].forEach(x => {
      if (x) x.style.paddingRight = avec ? "76px" : "";
    });
  });
}, 500);
