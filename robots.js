import { getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, onSnapshot, doc, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ADMIN_UID = "vIia3H24Mla7zkdEBdUTn0VaIkD3";
let db, auth, stop = null, tables = {}, courante = null, occupe = false;
const attente = {};
const msg = t => { const m = document.getElementById("msg"); if (m) m.textContent = t; };

const init = setInterval(() => {
  if (!getApps().length) return;
  clearInterval(init);
  auth = getAuth(getApps()[0]);
  db = getFirestore(getApps()[0]);
  onAuthStateChanged(auth, user => {
    if (stop) { stop(); stop = null; }
    tables = {};
    if (!user || user.uid !== ADMIN_UID) return;
    stop = onSnapshot(collection(db, "tables"), snap => {
      tables = {};
      snap.docs.forEach(d => { tables[d.id] = d.data(); });
      traiterRetraits();
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
  courante = tableAffichee();
  majBots();
  traiterRetraits();
}

async function modifier(tid, fn) {
  await runTransaction(db, async tx => {
    const ref = doc(db, "tables", tid);
    const s = await tx.get(ref);
    if (!s.exists()) throw new Error("absente");
    const t = s.data();
    const players = (t.players || []).map(p => ({ ...p }));
    const res = fn(players, t);
    tx.update(ref, { players: res || players });
  });
}

function majBots() {
  const liste = document.getElementById("listeBots");
  const t = courante && tables[courante];
  if (!liste || !t) return;
  const bots = (t.players || []).filter(p => p.bot);
  bots.forEach((b, i) => {
    const l1 = liste.children[i * 4];
    const l4 = liste.children[i * 4 + 3];
    if (!l1 || !l4 || l1.textContent.indexOf(b.name) === -1) return;
    const btns = l1.querySelector(".btns");
    if (btns) {
      const r = Array.from(btns.querySelectorAll("button")).find(x => x.className.indexOf("quitter") !== -1);
      if (r && r.dataset.v2 !== b.uid) { r.dataset.v2 = b.uid; r.onclick = () => retirer(courante, b.uid, b.name); }
    }
    if (!l4.querySelector(".rechargeBot")) {
      const x = document.createElement("button");
      x.className = "gris rechargeBot";
      x.textContent = "Recharger";
      x.onclick = () => recharger(courante, b.uid, b.name);
      l4.appendChild(x);
    }
  });
}

async function recharger(tid, uid, nom) {
  if (!tid) return;
  const r = prompt("Combien de jetons ajouter à " + nom + " ?", "2000");
  if (r === null) return;
  const n = Math.floor(Number(r));
  if (!(n > 0) || n > 1000000000) { msg("Écris un nombre positif."); return; }
  try {
    await modifier(tid, players => {
      const p = players.find(x => x.uid === uid && x.bot);
      if (!p) throw new Error("absent");
      p.stack = (p.stack || 0) + n;
    });
    msg(nom + " reçoit " + n + " jetons.");
  } catch (e) { msg(e.message === "absent" ? "Ce robot n'est plus à la table." : "Erreur : " + (e.code || e.message)); }
}

function retirer(tid, uid, nom) {
  if (!tid || !tables[tid]) return;
  attente[tid + "|" + uid] = nom;
  msg(tables[tid].hand ? nom + " sera retiré dès la fin de la main." : "Retrait de " + nom + "…");
  traiterRetraits();
}

async function traiterRetraits() {
  if (occupe) return;
  occupe = true;
  try {
    for (const cle of Object.keys(attente)) {
      const tid = cle.split("|")[0], uid = cle.split("|")[1];
      const nom = attente[cle];
      const t = tables[tid];
      if (!t || t.hand) continue;
      delete attente[cle];
      try {
        await modifier(tid, (players, t2) => {
          if (t2.hand) throw new Error("main");
          return players.filter(p => p.uid !== uid);
        });
        msg(nom + " retiré.");
      } catch (e) {
        if (e.message === "main") attente[cle] = nom;
        else msg("Erreur : " + (e.code || e.message));
      }
    }
  } finally { occupe = false; }
    }
