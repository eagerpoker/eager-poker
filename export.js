import { getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, collection, query, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ADMIN_UID = "vIia3H24Mla7zkdEBdUTn0VaIkD3";
const $ = id => document.getElementById(id);
const CLE = "exportDemandesDrive";
let auth = null, db = null;
let cfg = null, dems = [];
let stopCfg = null, stopDem = null, stopGest = null, minuteur = null, attente = null;
let occupe = false, zoneStatut = null;

function lireMemo() {
  try { return JSON.parse(localStorage.getItem(CLE) || "{}"); } catch (e) { return {}; }
}
function ecrireMemo(o) {
  try { localStorage.setItem(CLE, JSON.stringify(o)); } catch (e) {}
}
function signature(d) {
  return [d.statut || "", d.montant || 0, d.traitePar || "", d.code || ""].join("|");
}
function ligneDe(d) {
  const t = d.createdAt && d.createdAt.toDate ? d.createdAt.toDate() : null;
  return {
    id: d.id,
    date: t ? t.toLocaleString("fr-FR") : "",
    name: d.name || "",
    contact: d.contact || d.email || "",
    type: d.type === "retour" ? "Retour" : "Demande",
    code: d.code || "",
    montant: d.montant || 0,
    statut: d.statut || "",
    par: d.traitePar || ""
  };
}
function majStatut(txt) {
  const ab = $("adminBox");
  if (!ab) return;
  if (!zoneStatut) {
    zoneStatut = document.createElement("div");
    zoneStatut.className = "mini";
    zoneStatut.style.cssText = "margin-top:10px;word-break:normal";
    ab.appendChild(zoneStatut);
  }
  zoneStatut.textContent = txt;
}

async function synchroniser() {
  if (occupe || !cfg || !cfg.url || !cfg.secret || !dems.length) return;
  const memo = lireMemo();
  const aEnvoyer = dems.filter(d => d.createdAt && memo[d.id] !== signature(d));
  if (!aEnvoyer.length) return;
  occupe = true;
  try {
    for (let i = 0; i < aEnvoyer.length; i += 25) {
      const lot = aEnvoyer.slice(i, i + 25);
      const r = await fetch(cfg.url, {
        method: "POST",
        body: JSON.stringify({ secret: cfg.secret, lignes: lot.map(ligneDe) })
      });
      const t = (await r.text()).trim();
      if (t !== "ok") throw new Error(t || "réponse vide");
      lot.forEach(d => { memo[d.id] = signature(d); });
      ecrireMemo(memo);
    }
    majStatut("Export Google Drive : à jour (" + new Date().toLocaleTimeString("fr-FR") + ")");
  } catch (e) {
    majStatut("Export Google Drive : échec (" + (e.message || "réseau") + "). Nouvelle tentative automatique.");
  }
  occupe = false;
}
function planifier() {
  clearTimeout(attente);
  attente = setTimeout(synchroniser, 2000);
}

function demarrerExport() {
  if (stopCfg) return;
  stopCfg = onSnapshot(
    doc(db, "config", "export"),
    s => {
      cfg = s.exists() ? s.data() : null;
      if (!cfg) majStatut("Export Google Drive : non configuré (document config/export manquant).");
      else planifier();
    },
    e => majStatut("Export Google Drive : accès refusé (" + e.code + ").")
  );
  stopDem = onSnapshot(
    query(collection(db, "demandes"), orderBy("createdAt", "desc"), limit(300)),
    snap => {
      dems = snap.docs.map(x => ({ id: x.id, ...x.data() }));
      planifier();
    },
    () => {}
  );
  minuteur = setInterval(synchroniser, 60000);
}
function arreter() {
  [stopCfg, stopDem].forEach(f => { if (f) f(); });
  stopCfg = stopDem = null;
  if (minuteur) { clearInterval(minuteur); minuteur = null; }
  clearTimeout(attente);
  if (zoneStatut) { zoneStatut.remove(); zoneStatut = null; }
  dems = [];
  cfg = null;
}

function demarrer() {
  const app = getApp();
  auth = getAuth(app);
  db = getFirestore(app);
  onAuthStateChanged(auth, user => {
    if (stopGest) { stopGest(); stopGest = null; }
    arreter();
    if (!user) return;
    if (user.uid === ADMIN_UID) demarrerExport();
    else {
      stopGest = onSnapshot(
        doc(db, "gestionnaires", user.uid),
        s => { if (s.exists()) demarrerExport(); else arreter(); },
        () => {}
      );
    }
  });
}
function attendre(n) {
  if (getApps().length && $("adminBox")) demarrer();
  else if (n < 300) setTimeout(() => attendre(n + 1), 100);
}
attendre(0);
