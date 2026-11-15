import { getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, onSnapshot, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ADMIN_UID = "vIia3H24Mla7zkdEBdUTn0VaIkD3";
let db, auth, stop = null, tables = {}, courante = null, apercu = null, curseur = null;

const css = document.createElement("style");
css.textContent = "#decoCentre{opacity:var(--decoClarte,1)!important}#decoCentre img{max-width:92%!important;max-height:92%!important}";
document.head.appendChild(css);

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
  setInterval(majTable, 500);
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

function majTable() {
  const id = tableAffichee();
  if (id !== courante) { courante = id; apercu = null; if (curseur) curseur.value = 100; }
  const p = id && tables[id].decoPlus;
  const sauve = p && typeof p.clarte === "number" ? p.clarte : 1;
  if (curseur && apercu === null && id) curseur.value = Math.round(sauve * 100);
  document.documentElement.style.setProperty("--decoClarte", apercu !== null ? apercu : sauve);
  ajouterReglage();
}

function ajouterReglage() {
  const box = document.getElementById("decoBox");
  if (!box || document.getElementById("clarteDeco")) return;
  const l = document.createElement("div");
  l.className = "ligne";
  const t = document.createElement("span");
  t.className = "mini";
  t.textContent = "Clarté de l'image";
  curseur = document.createElement("input");
  curseur.type = "range"; curseur.id = "clarteDeco";
  curseur.min = "10"; curseur.max = "100"; curseur.step = "5"; curseur.value = "100";
  curseur.oninput = () => { apercu = Number(curseur.value) / 100; };
  l.append(t, curseur);
  const b = document.createElement("button");
  b.className = "gris";
  b.textContent = "Enregistrer la clarté";
  b.onclick = async () => {
    const m = document.getElementById("msg");
    if (!courante || auth.currentUser.uid !== ADMIN_UID) return;
    try {
      const ancien = tables[courante].decoPlus || {};
      await updateDoc(doc(db, "tables", courante), { decoPlus: { ...ancien, clarte: Number(curseur.value) / 100 } });
      apercu = null;
      if (m) m.textContent = "Clarté enregistrée.";
    } catch (e) { if (m) m.textContent = "Erreur : " + (e.code || e.message); }
  };
  const ref = document.getElementById("btnDeco");
  box.insertBefore(l, ref);
  box.insertBefore(b, ref);
}
