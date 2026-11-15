import { getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, onSnapshot, doc, setDoc, serverTimestamp, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ADMIN_UID = "vIia3H24Mla7zkdEBdUTn0VaIkD3";
let db, auth, vues = {}, stop = null;

const attente = setInterval(() => {
  if (!getApps().length) return;
  clearInterval(attente);
  auth = getAuth(getApps()[0]);
  db = getFirestore(getApps()[0]);
  onAuthStateChanged(auth, user => {
    if (stop) { stop(); stop = null; }
    vues = {};
    if (!user) return;
    stop = onSnapshot(collection(db, "tables"), snap => {
      snap.docs.forEach(d => suivre(d.id, d.data(), user));
    }, () => {});
    boutonExport();
  });
}, 300);

function suivre(id, t, user) {
  const h = t.hand;
  if (h) {
    vues[id] = { stage: h.stage, order: h.order, hands: h.hands || {}, board: h.board || [], paid: h.paid || {}, folded: h.folded || {} };
    return;
  }
  const m = vues[id];
  if (!m || !t.finAt) return;
  delete vues[id];
  if (!m.order.includes(user.uid) && user.uid !== ADMIN_UID) return;
  const mains = {};
  if (m.stage === "showdown") m.order.forEach(u => { if (!m.folded[u]) mains[u] = m.hands[u]; });
  const noms = {};
  (t.players || []).forEach(p => { noms[p.uid] = p.name; });
  setDoc(doc(db, "historique_mains", id + "_" + t.finAt), {
    tableId: id, tableName: t.name || "", finAt: t.finAt, date: serverTimestamp(),
    uids: m.order, noms, mains, board: m.board, mises: m.paid, resultat: t.dernier || ""
  }).catch(() => {});
}

function boutonExport() {
  if (document.getElementById("btnExportHisto")) return;
  const boite = document.querySelector("#paneProfil .boite");
  if (!boite) return;
  const b = document.createElement("button");
  b.id = "btnExportHisto";
  b.className = "gris";
  b.textContent = "Exporter mon historique";
  b.onclick = exporter;
  boite.appendChild(b);
}

async function exporter() {
  const m = document.getElementById("msg");
  try {
    const u = auth.currentUser;
    const ref = collection(db, "historique_mains");
    const snap = await getDocs(u.uid === ADMIN_UID ? ref : query(ref, where("uids", "array-contains", u.uid)));
    const lignes = snap.docs.map(d => d.data()).sort((a, b) => a.finAt - b.finAt);
    const blob = new Blob([JSON.stringify(lignes, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "historique-poker.json";
    a.click();
    if (m) m.textContent = lignes.length + " mains exportées.";
  } catch (e) { if (m) m.textContent = "Erreur : " + (e.code || e.message); }
}
