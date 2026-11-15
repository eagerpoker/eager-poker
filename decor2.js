import { getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, onSnapshot, doc, getDoc, setDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ADMIN_UID = "vIia3H24Mla7zkdEBdUTn0VaIkD3";
let db, auth, stop = null, tables = {}, courante = null, centreVu = "", dosVu = null;
const msg = t => { const m = document.getElementById("msg"); if (m) m.textContent = t; };

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

function boucle() {
  const id = tableAffichee();
  if (id !== courante) { courante = id; centreVu = ""; dosVu = null; }
  ajouterBoutons();
  appliquer();
}

async function appliquer() {
  const p = (courante && tables[courante] && tables[courante].decoPlus) || {};
  const cle = courante ? courante + "|" + (p.centreV || "") : "";
  const zone = document.getElementById("decoCentre");
  if (cle !== centreVu) {
    centreVu = cle;
    if (zone) zone.style.backgroundImage = "";
    if (courante && p.centreV) {
      try {
        const s = await getDoc(doc(db, "decor_images", courante));
        if (centreVu === cle && s.exists() && zone) {
          zone.style.backgroundImage = 'url("' + s.data().data + '")';
          zone.style.backgroundSize = "contain";
          zone.style.backgroundRepeat = "no-repeat";
          zone.style.backgroundPosition = "center";
        }
      } catch (e) {}
    }
  }
  const d = typeof p.dos === "string" && /^data:image\//.test(p.dos) ? p.dos : "";
  if (d !== dosVu) {
    dosVu = d;
    let st = document.getElementById("styleDos");
    if (!st) { st = document.createElement("style"); st.id = "styleDos"; document.head.appendChild(st); }
    st.textContent = d ? '.cc.dos{background-image:url("' + d + '")!important;background-size:cover!important;background-position:center!important}' : "";
  }
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

function verifier(f) {
  if (!courante) { msg("Entre d'abord dans une table."); return false; }
  if (!auth.currentUser || auth.currentUser.uid !== ADMIN_UID) return false;
  if (!f || !f.type.startsWith("image/")) { msg("Choisis une image."); return false; }
  return true;
}

async function poserCentre(f) {
  if (!verifier(f)) return;
  msg("Envoi de l'image…");
  try {
    let data = "";
    for (const c of [1600, 1200, 900, 700, 500]) {
      data = await lireImage(f, c, 0.85);
      if (data.length <= 900000) break;
    }
    if (data.length > 950000) throw new Error("image trop complexe");
    const v = Date.now();
    await setDoc(doc(db, "decor_images", courante), { data, v });
    await updateDoc(doc(db, "tables", courante), { "decoPlus.centreV": v });
    msg("Image du centre ajoutée.");
  } catch (e) { msg("Erreur : " + (e.code || e.message)); }
}

async function retirerCentre() {
  if (!courante || auth.currentUser.uid !== ADMIN_UID) return;
  try {
    await updateDoc(doc(db, "tables", courante), { "decoPlus.centreV": null });
    await deleteDoc(doc(db, "decor_images", courante)).catch(() => {});
    msg("Image du centre retirée.");
  } catch (e) { msg("Erreur : " + (e.code || e.message)); }
}

async function poserDos(f) {
  if (!verifier(f)) return;
  try {
    const data = await lireImage(f, 200, 0.85);
    await updateDoc(doc(db, "tables", courante), { "decoPlus.dos": data });
    msg("Dos de cartes ajouté.");
  } catch (e) { msg("Erreur : " + (e.code || e.message)); }
}

async function retirerDos() {
  if (!courante || auth.currentUser.uid !== ADMIN_UID) return;
  try {
    await updateDoc(doc(db, "tables", courante), { "decoPlus.dos": "" });
    msg("Dos de cartes retiré.");
  } catch (e) { msg("Erreur : " + (e.code || e.message)); }
}

function bouton(texte, f) {
  const b = document.createElement("button");
  b.className = "gris";
  b.textContent = texte;
  b.onclick = f;
  return b;
}

function ajouterBoutons() {
  const box = document.getElementById("decoBox");
  if (!box || document.getElementById("fichierCentre2")) return;
  const ref = document.getElementById("btnDeco");
  const fc = document.createElement("input");
  fc.type = "file"; fc.accept = "image/*"; fc.hidden = true; fc.id = "fichierCentre2";
  fc.onchange = () => { const f = fc.files[0]; fc.value = ""; poserCentre(f); };
  const fd = document.createElement("input");
  fd.type = "file"; fd.accept = "image/*"; fd.hidden = true; fd.id = "fichierDos2";
  fd.onchange = () => { const f = fd.files[0]; fd.value = ""; poserDos(f); };
  [fc, fd,
   bouton("Grande image au centre (sans limite)", () => fc.click()),
   bouton("Retirer l'image du centre", retirerCentre),
   bouton("Image pour le dos des cartes", () => fd.click()),
   bouton("Retirer l'image du dos", retirerDos)
  ].forEach(e => box.insertBefore(e, ref));
}
