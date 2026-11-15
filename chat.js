import { getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, onSnapshot, query, orderBy, limit, addDoc, deleteDoc, doc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ADMIN_UID = "vIia3H24Mla7zkdEBdUTn0VaIkD3";
let db, auth, stop = null, msgs = [], pane = null, liste = null, saisie = null, bouton = null, vu = Date.now();
const msg = t => { const m = document.getElementById("msg"); if (m) m.textContent = t; };
try { const v = Number(localStorage.getItem("chatVu")); if (v) vu = v; } catch (e) {}
function marquerVu() { vu = Date.now(); try { localStorage.setItem("chatVu", String(vu)); } catch (e) {} }

const init = setInterval(() => {
  if (!getApps().length) return;
  clearInterval(init);
  auth = getAuth(getApps()[0]);
  db = getFirestore(getApps()[0]);
  onAuthStateChanged(auth, user => {
    if (stop) { stop(); stop = null; }
    msgs = [];
    if (liste) liste.textContent = "";
    if (!user) return;
    stop = onSnapshot(query(collection(db, "chat_general"), orderBy("date", "desc"), limit(60)), snap => {
      msgs = snap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) })).reverse();
      dessiner();
    }, () => {});
  });
  setInterval(boucle, 500);
}, 300);

function boucle() {
  construire();
  if (pane && pane.style.display !== "none") {
    const autre = Array.from(document.querySelectorAll("#lobby .pane")).some(p => p !== pane && p.style.display !== "none");
    if (autre) fermer();
  }
}

function construire() {
  if (document.getElementById("vChat")) return;
  const volets = document.querySelector(".volets");
  const lobby = document.getElementById("lobby");
  const sortir = document.getElementById("btnSortir");
  if (!volets || !lobby || !sortir) return;
  bouton = document.createElement("button");
  bouton.id = "vChat";
  bouton.textContent = "Chat";
  volets.appendChild(bouton);

  pane = document.createElement("div");
  pane.id = "paneChat";
  pane.className = "pane";
  pane.style.display = "none";
  const boite = document.createElement("div");
  boite.className = "boite";
  boite.style.maxWidth = "340px";
  const titre = document.createElement("h3");
  titre.textContent = "Chat général";
  liste = document.createElement("div");
  liste.style.cssText = "height:50vh;max-height:420px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;padding:4px 0";
  const bas = document.createElement("div");
  bas.style.cssText = "display:flex;gap:6px;margin-top:8px";
  saisie = document.createElement("input");
  saisie.type = "text";
  saisie.maxLength = 500;
  saisie.placeholder = "Écris un message…";
  saisie.style.cssText = "flex:1;width:auto;max-width:none;margin:0;min-width:0";
  saisie.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); envoyer(); } };
  const bt = document.createElement("button");
  bt.textContent = "Envoyer";
  bt.style.cssText = "width:auto;max-width:none;margin:0;padding:8px 14px";
  bt.onclick = envoyer;
  bas.append(saisie, bt);
  boite.append(titre, liste, bas);
  pane.appendChild(boite);
  lobby.insertBefore(pane, sortir);

  bouton.onclick = ouvrir;
  ["vProfil", "vJetons", "vTables", "vAdmins"].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.addEventListener("click", fermer);
  });
  dessiner();
}

function ouvrir() {
  document.querySelectorAll("#lobby .pane").forEach(p => { if (p !== pane) p.style.display = "none"; });
  document.querySelectorAll("#lobby .volets button").forEach(b => b.classList.remove("actif"));
  bouton.classList.add("actif");
  pane.style.display = "block";
  marquerVu();
  dessiner();
  liste.scrollTop = liste.scrollHeight;
}

function fermer() {
  if (!pane) return;
  pane.style.display = "none";
  if (bouton) bouton.classList.remove("actif");
}

function avatar(nom, uid) {
  const a = document.createElement("div");
  let h = 0;
  String(uid).split("").forEach(c => { h = (h * 31 + c.charCodeAt(0)) % 360; });
  a.style.cssText = "width:28px;height:28px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:13px;color:#022;background:hsl(" + h + ",55%,60%)";
  a.textContent = (String(nom || "?").trim()[0] || "?").toUpperCase();
  return a;
}

function heure(m) {
  const d = m.date && m.date.toDate ? m.date.toDate() : new Date();
  const h = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return d.toDateString() === new Date().toDateString() ? h : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) + " " + h;
}

function bulle(m, moi) {
  const mien = m.de === moi;
  const ligne = document.createElement("div");
  ligne.style.cssText = "display:flex;gap:6px;align-items:flex-end;justify-content:" + (mien ? "flex-end" : "flex-start");
  if (!mien) ligne.appendChild(avatar(m.nom, m.de));
  const b = document.createElement("div");
  b.style.cssText = "max-width:75%;padding:6px 10px;border-radius:14px;text-align:left;word-break:break-word;font-size:14px;background:" + (mien ? "#f4b400" : "#0e3b2a") + ";color:" + (mien ? "#022" : "#fff");
  if (!mien) {
    const n = document.createElement("div");
    n.style.cssText = "font-size:11px;font-weight:bold;color:#f4b400";
    n.textContent = m.nom || "?";
    b.appendChild(n);
  }
  const t = document.createElement("div");
  t.textContent = m.texte || "";
  const h = document.createElement("div");
  h.style.cssText = "font-size:10px;opacity:.7;text-align:right";
  h.textContent = heure(m);
  b.append(t, h);
  ligne.appendChild(b);
  if (auth.currentUser && auth.currentUser.uid === ADMIN_UID) {
    const x = document.createElement("button");
    x.textContent = "✕";
    x.style.cssText = "width:auto;max-width:none;margin:0;padding:2px 6px;font-size:11px;background:#c0392b;color:#fff";
    x.onclick = () => deleteDoc(doc(db, "chat_general", m.id)).catch(e => msg("Erreur : " + (e.code || e.message)));
    ligne.appendChild(x);
  }
  return ligne;
}

function dessiner() {
  if (!liste || !auth) return;
  const moi = auth.currentUser ? auth.currentUser.uid : "";
  const enBas = liste.scrollHeight - liste.scrollTop - liste.clientHeight < 80;
  liste.textContent = "";
  msgs.forEach(m => liste.appendChild(bulle(m, moi)));
  if (enBas) liste.scrollTop = liste.scrollHeight;
  const ouvert = pane && pane.style.display !== "none";
  if (ouvert) marquerVu();
  if (bouton) {
    const n = ouvert ? 0 : msgs.filter(m => m.de !== moi && m.date && m.date.toMillis && m.date.toMillis() > vu).length;
    bouton.textContent = n ? "Chat (" + n + ")" : "Chat";
  }
}

async function envoyer() {
  const t = saisie.value.trim().slice(0, 500);
  const u = auth.currentUser;
  if (!t || !u) return;
  saisie.value = "";
  try {
    const s = await getDoc(doc(db, "users", u.uid));
    const nom = (s.exists() && s.data().name) || "joueur";
    await addDoc(collection(db, "chat_general"), { de: u.uid, nom, texte: t, date: serverTimestamp() });
  } catch (e) {
    saisie.value = t;
    msg("Erreur : " + (e.code || e.message));
  }
}
