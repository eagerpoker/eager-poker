import { getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, collection, query, where, onSnapshot, runTransaction, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ADMIN_UID = "vIia3H24Mla7zkdEBdUTn0VaIkD3";
const $ = id => document.getElementById(id);
const DELAI_ESSAI = 120000;
const DUREE_MAX = 24 * 3600 * 1000;

let auth = null, db = null, moi = null;
let cfg = null, pend = [];
let stopCfg = null, stopPend = null, stopGest = null, minuteur = null, attente = null;
let occupe = false, zone = null;
const essais = {};

function majZone(txt) {
  const ab = $("adminBox");
  if (!ab) return;
  if (!zone) {
    zone = document.createElement("div");
    zone.className = "mini";
    zone.style.cssText = "margin-top:8px;word-break:normal";
    ab.appendChild(zone);
  }
  zone.textContent = "Validation automatique (Exodus) : " + txt;
}

async function verifier(d) {
  const r = await fetch(cfg.url, {
    method: "POST",
    body: JSON.stringify({ secret: cfg.secret, action: "verifier", id: d.id, code: d.code })
  });
  return JSON.parse(await r.text());
}

async function accepter(d, jetons) {
  await runTransaction(db, async tx => {
    const dref = doc(db, "demandes", d.id);
    const s = await tx.get(dref);
    if (!s.exists() || s.data().statut !== "en_attente") throw new Error("deja");
    if (s.data().uid === moi && moi !== ADMIN_UID) throw new Error("propre");
    const uref = doc(db, "users", s.data().uid);
    const u = await tx.get(uref);
    const chips = u.exists() ? (u.data().chips || 0) : 0;
    tx.update(uref, { chips: chips + jetons });
    tx.update(dref, { statut: "acceptee", montant: jetons, traiteLe: serverTimestamp(), traitePar: moi, auto: true });
  });
}

async function traiterUn() {
  if (occupe || !cfg || !cfg.url || !cfg.secret) return;
  const maintenant = Date.now();
  const cand = pend.filter(d =>
    d.type !== "retour" && d.code && !d.autoRaison && d.createdAt &&
    (d.uid !== moi || moi === ADMIN_UID) &&
    maintenant - d.createdAt.toMillis() < DUREE_MAX &&
    (!essais[d.id] || maintenant - essais[d.id] > DELAI_ESSAI)
  );
  if (!cand.length) return;
  const d = cand[0];
  occupe = true;
  essais[d.id] = maintenant;
  try {
    const rep = await verifier(d);
    if (rep.ok) {
      await accepter(d, rep.jetons);
      majZone(rep.jetons + " jetons donnés à " + (d.name || "un joueur") + " (" + new Date().toLocaleTimeString("fr-FR") + ").");
    } else if (rep.raison === "plafond") {
      await updateDoc(doc(db, "demandes", d.id), { montant: rep.jetons, autoRaison: "plafond" });
      majZone("montant au-dessus du plafond pour " + (d.name || "un joueur") + " : à valider à la main (" + rep.jetons + " proposés).");
    } else if (rep.raison === "deja" || rep.raison === "ambigu") {
      await updateDoc(doc(db, "demandes", d.id), { autoRaison: rep.raison });
      majZone("code " + (rep.raison === "deja" ? "déjà utilisé" : "ambigu") + " pour " + (d.name || "un joueur") + " : à valider à la main.");
    } else if (rep.raison === "introuvable") {
      majZone("code de " + (d.name || "un joueur") + " pas encore trouvé, nouvel essai dans 2 minutes.");
    } else {
      majZone("réponse inattendue (" + rep.raison + ").");
    }
  } catch (e) {
    majZone("erreur (" + (e.message || "réseau") + ").");
  }
  occupe = false;
}

function planifier() {
  clearTimeout(attente);
  attente = setTimeout(traiterUn, 1500);
}

function demarrerAuto() {
  if (stopCfg) return;
  stopCfg = onSnapshot(doc(db, "config", "export"), s => {
    cfg = s.exists() ? s.data() : null;
    planifier();
  }, () => {});
  stopPend = onSnapshot(query(collection(db, "demandes"), where("statut", "==", "en_attente")), snap => {
    pend = snap.docs.map(x => ({ id: x.id, ...x.data() }));
    planifier();
  }, () => {});
  minuteur = setInterval(traiterUn, 20000);
}
function arreter() {
  [stopCfg, stopPend].forEach(f => { if (f) f(); });
  stopCfg = stopPend = null;
  if (minuteur) { clearInterval(minuteur); minuteur = null; }
  clearTimeout(attente);
  if (zone) { zone.remove(); zone = null; }
  pend = [];
  cfg = null;
}

function demarrer() {
  const app = getApp();
  auth = getAuth(app);
  db = getFirestore(app);
  onAuthStateChanged(auth, user => {
    if (stopGest) { stopGest(); stopGest = null; }
    arreter();
    moi = user ? user.uid : null;
    if (!user) return;
    if (user.uid === ADMIN_UID) demarrerAuto();
    else {
      stopGest = onSnapshot(doc(db, "gestionnaires", user.uid), s => {
        if (s.exists()) demarrerAuto(); else arreter();
      }, () => {});
    }
  });
}
function attendre(n) {
  if (getApps().length && $("adminBox")) demarrer();
  else if (n < 300) setTimeout(() => attendre(n + 1), 100);
}
attendre(0);
