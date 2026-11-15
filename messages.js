import { getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, onSnapshot, query, where, orderBy, limit, getDoc, getDocs, setDoc, deleteDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ADMIN_UID = "vIia3H24Mla7zkdEBdUTn0VaIkD3";
let db, auth, moi = null, estAdmin = false, dernierEcrit = "", dernierBadge = -1;
let annuaire = {}, convs = [], stopAnn = null, stopConvs = null, stopMsgs = null;
let btnGen = null, btnPriv = null, generaux = [], section = null;
let vueListe = null, zoneListe = null, vueNouveau = null, titreNouveau = null, nomGroupe = null, filtre = null, zoneChoix = null, btnCreer = null;
let vueConv = null, titreConv = null, listeMsgs = null, ligneSaisie = null, saisie = null;
let courante = null, msgsC = [], modeNouveau = "prive", choisis = new Set(), vus = {};
try { vus = JSON.parse(localStorage.getItem("convVus") || "{}"); } catch (e) { vus = {}; }
const msg = t => { const m = document.getElementById("msg"); if (m) m.textContent = t; };
const ms = t => (t && t.toMillis ? t.toMillis() : 0);
function marquer(id) { vus[id] = Date.now(); try { localStorage.setItem("convVus", JSON.stringify(vus)); } catch (e) {} }
function monNom() { const p = document.getElementById("pseudo"); return annuaire[moi] || (p && p.textContent) || "joueur"; }

const init = setInterval(() => {
  if (!getApps().length) return;
  clearInterval(init);
  auth = getAuth(getApps()[0]);
  db = getFirestore(getApps()[0]);
  onAuthStateChanged(auth, user => {
    [stopAnn, stopConvs, stopMsgs].forEach(f => { if (f) f(); });
    stopAnn = stopConvs = stopMsgs = null;
    annuaire = {}; convs = []; courante = null; msgsC = []; dernierEcrit = "";
    moi = user ? user.uid : null;
    estAdmin = moi === ADMIN_UID;
    if (zoneListe) { zoneListe.textContent = ""; montrer(vueListe); }
    if (!user) return;
    ecrireAnnuaire();
    if (estAdmin) synchroniser();
    stopAnn = onSnapshot(collection(db, "annuaire"), snap => {
      annuaire = {};
      snap.docs.forEach(d => { annuaire[d.id] = d.data().name || "?"; });
      majListe(); majChoix();
    }, () => {});
    const q = estAdmin ? collection(db, "conversations") : query(collection(db, "conversations"), where("membres", "array-contains", user.uid));
    stopConvs = onSnapshot(q, snap => {
      convs = snap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }));
      convs.sort((a, b) => ms(b.derniereAt) - ms(a.derniereAt));
      majListe(); badge();
    }, () => {});
  });
  setInterval(boucle, 500);
}, 300);

function boucle() {
  construire();
  if (!moi) return;
  const p = document.getElementById("pseudo");
  const txt = p ? p.textContent : "";
  if (txt && annuaire[moi] !== undefined && annuaire[moi] !== txt && dernierEcrit !== txt) { dernierEcrit = txt; ecrireAnnuaire(); }
  badge();
  const b = document.getElementById("vChat");
  if (b) {
    const voulu = b.textContent.replace(" ✉", "") + (dernierBadge > 0 ? " ✉" : "");
    if (b.textContent !== voulu) b.textContent = voulu;
  }
}

async function ecrireAnnuaire() {
  try {
    const s = await getDoc(doc(db, "users", moi));
    const name = s.exists() ? s.data().name : "";
    if (name && annuaire[moi] !== name) await setDoc(doc(db, "annuaire", moi), { name });
  } catch (e) {}
}

async function synchroniser() {
  try {
    const us = await getDocs(collection(db, "users"));
    const an = await getDocs(collection(db, "annuaire"));
    const connus = {};
    an.docs.forEach(d => { connus[d.id] = d.data().name; });
    for (const d of us.docs) {
      const n = d.data().name;
      if (n && connus[d.id] !== n) await setDoc(doc(db, "annuaire", d.id), { name: n });
    }
  } catch (e) {}
}

function div(css) { const d = document.createElement("div"); if (css) d.style.cssText = css; return d; }
function bt(texte, fn) {
  const b = document.createElement("button");
  b.textContent = texte;
  b.onclick = fn;
  b.style.cssText = "width:auto;max-width:none;margin:0;padding:8px 12px;font-size:13px;flex:1";
  return b;
}
function champ(ph, max) {
  const i = document.createElement("input");
  i.type = "text"; i.placeholder = ph;
  if (max) i.maxLength = max;
  i.style.cssText = "display:block;width:100%;max-width:none;margin:0 0 6px;box-sizing:border-box";
  return i;
}
function avatar(nom, id) {
  const a = div();
  let h = 0;
  String(id).split("").forEach(c => { h = (h * 31 + c.charCodeAt(0)) % 360; });
  a.style.cssText = "width:30px;height:30px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:13px;color:#022;background:hsl(" + h + ",55%,60%)";
  a.textContent = (String(nom || "?").trim()[0] || "?").toUpperCase();
  return a;
}
function heure(m) {
  const d = m.date && m.date.toDate ? m.date.toDate() : new Date();
  const h = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return d.toDateString() === new Date().toDateString() ? h : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) + " " + h;
}

function construire() {
  if (document.getElementById("chatOnglets")) return;
  const boite = document.querySelector("#paneChat .boite");
  if (!boite) return;
  generaux = Array.from(boite.children);
  generaux.forEach(e => { e.dataset.d = e.style.display; });

  const onglets = div("display:flex;gap:6px;margin-bottom:8px");
  onglets.id = "chatOnglets";
  btnGen = bt("Général", () => onglet("general"));
  btnPriv = bt("Privé", () => onglet("prive"));
  onglets.append(btnGen, btnPriv);
  boite.insertBefore(onglets, boite.firstChild);

  section = div("display:none");
  const avis = div("font-size:12px;color:#cde;margin-bottom:6px");
  avis.textContent = "Les conversations privées sont visibles par leurs membres et par l'administrateur.";

  vueListe = div();
  const barre = div("display:flex;gap:6px;margin-bottom:6px");
  barre.append(bt("Nouveau message", () => nouveau("prive")), bt("Nouveau groupe", () => nouveau("groupe")));
  zoneListe = div();
  vueListe.append(barre, zoneListe);

  vueNouveau = div("display:none");
  titreNouveau = div("font-weight:bold;margin-bottom:6px");
  nomGroupe = champ("Nom du groupe", 40);
  filtre = champ("Chercher un membre");
  filtre.oninput = majChoix;
  zoneChoix = div("max-height:40vh;overflow-y:auto");
  const bas = div("display:flex;gap:6px;margin-top:8px");
  btnCreer = bt("Créer le groupe", creerGroupe);
  bas.append(btnCreer, bt("Annuler", () => montrer(vueListe)));
  vueNouveau.append(titreNouveau, nomGroupe, filtre, zoneChoix, bas);

  vueConv = div("display:none");
  const tete = div("display:flex;gap:6px;align-items:center;margin-bottom:6px");
  const retour = bt("←", fermerConv);
  retour.style.flex = "none";
  titreConv = div("flex:1;font-weight:bold;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap");
  tete.append(retour, titreConv);
  if (estAdmin) {
    const sp = bt("🗑", supprimerConv);
    sp.style.cssText += ";flex:none;background:#c0392b;color:#fff";
    tete.append(sp);
  }
  listeMsgs = div("height:42vh;max-height:380px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;padding:4px 0");
  ligneSaisie = div("display:flex;gap:6px;margin-top:8px");
  saisie = document.createElement("input");
  saisie.type = "text"; saisie.maxLength = 500; saisie.placeholder = "Écris un message…";
  saisie.style.cssText = "flex:1;width:auto;max-width:none;margin:0;min-width:0";
  saisie.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); envoyer(); } };
  const env = bt("Envoyer", envoyer);
  env.style.flex = "none";
  ligneSaisie.append(saisie, env);
  vueConv.append(tete, listeMsgs, ligneSaisie);

  section.append(avis, vueListe, vueNouveau, vueConv);
  boite.appendChild(section);
  onglet("general");
  majListe();
}

function onglet(nom) {
  const priv = nom === "prive";
  generaux.forEach(e => { e.style.display = priv ? "none" : e.dataset.d; });
  section.style.display = priv ? "block" : "none";
  btnGen.className = priv ? "gris" : "";
  btnPriv.className = priv ? "" : "gris";
  if (priv) majListe();
}

function montrer(v) {
  if (!vueListe) return;
  [vueListe, vueNouveau, vueConv].forEach(x => { x.style.display = x === v ? "block" : "none"; });
}

function estMembre(c) { return (c.membres || []).indexOf(moi) !== -1; }
function nomDe(u, c) { return annuaire[u] || (c.noms && c.noms[u]) || "?"; }
function nomConv(c) {
  const m = c.membres || [];
  if (c.type === "groupe") return c.titre || "Groupe";
  if (!estMembre(c)) return m.map(u => nomDe(u, c)).join(" ↔ ");
  return m.filter(u => u !== moi).map(u => nomDe(u, c)).join(", ") || "Moi";
}

function majListe() {
  if (!zoneListe) return;
  zoneListe.textContent = "";
  if (!convs.length) {
    zoneListe.appendChild(div("font-size:12px;color:#cde;padding:8px 0")).textContent = "Aucune conversation. Touche « Nouveau message » pour commencer.";
    return;
  }
  convs.forEach(c => {
    const membre = estMembre(c);
    const nom = nomConv(c);
    const el = div("display:flex;gap:8px;align-items:center;padding:8px 4px;border-top:1px solid #ffffff22;cursor:pointer;text-align:left");
    el.appendChild(avatar(nom, c.id));
    const mid = div("flex:1;min-width:0");
    const l1 = div("font-weight:bold;overflow:hidden;text-overflow:ellipsis;white-space:nowrap");
    l1.textContent = (membre ? "" : "👁 ") + nom;
    const l2 = div("font-size:12px;color:#cde;overflow:hidden;text-overflow:ellipsis;white-space:nowrap");
    l2.textContent = c.dernierTexte || "Conversation commencée";
    mid.append(l1, l2);
    if (!membre && c.type === "groupe") {
      const l3 = div("font-size:11px;color:#cde;overflow:hidden;text-overflow:ellipsis;white-space:nowrap");
      l3.textContent = "Membres : " + (c.membres || []).map(u => nomDe(u, c)).join(", ");
      mid.append(l3);
    }
    el.appendChild(mid);
    if (membre && c.dernierTexte && c.dernierDe !== moi && ms(c.derniereAt) > (vus[c.id] || 0)) {
      el.appendChild(div("width:10px;height:10px;border-radius:50%;background:#f4b400;flex:none"));
    }
    el.onclick = () => ouvrirConv(c.id);
    zoneListe.appendChild(el);
  });
}

function badge() {
  if (!btnPriv) return;
  const n = convs.filter(c => c.id !== courante && estMembre(c) && c.dernierTexte && c.dernierDe !== moi && ms(c.derniereAt) > (vus[c.id] || 0)).length;
  if (n === dernierBadge) return;
  dernierBadge = n;
  btnPriv.textContent = n ? "Privé (" + n + ")" : "Privé";
}

function nouveau(mode) {
  modeNouveau = mode;
  choisis = new Set();
  nomGroupe.style.display = mode === "groupe" ? "block" : "none";
  btnCreer.style.display = mode === "groupe" ? "block" : "none";
  titreNouveau.textContent = mode === "groupe" ? "Nouveau groupe : choisis les membres" : "Nouveau message : choisis un membre";
  filtre.value = ""; nomGroupe.value = "";
  majChoix();
  montrer(vueNouveau);
}

function majChoix() {
  if (!zoneChoix) return;
  const f = (filtre.value || "").trim().toLowerCase();
  zoneChoix.textContent = "";
  Object.keys(annuaire)
    .filter(u => u !== moi && (!f || String(annuaire[u]).toLowerCase().indexOf(f) !== -1))
    .sort((a, b) => String(annuaire[a]).localeCompare(String(annuaire[b])))
    .forEach(u => {
      const l = div("display:flex;gap:8px;align-items:center;padding:8px 6px;border-top:1px solid #ffffff22;cursor:pointer;border-radius:8px;background:" + (choisis.has(u) ? "#f4b40055" : "transparent"));
      l.appendChild(avatar(annuaire[u], u));
      const n = div("flex:1;text-align:left");
      n.textContent = annuaire[u];
      l.appendChild(n);
      l.onclick = () => {
        if (modeNouveau === "prive") { ouvrirPrive(u); return; }
        if (choisis.has(u)) choisis.delete(u); else if (choisis.size < 19) choisis.add(u);
        majChoix();
      };
      zoneChoix.appendChild(l);
    });
}

function attendreEtOuvrir(id) {
  let n = 0;
  const t = setInterval(() => {
    if (convs.some(c => c.id === id)) { clearInterval(t); ouvrirConv(id); }
    else if (++n > 25) clearInterval(t);
  }, 150);
}

async function ouvrirPrive(autre) {
  const ids = [moi, autre].sort();
  const cid = "p_" + ids.join("_");
  try {
    let existe = false;
    try { existe = (await getDoc(doc(db, "conversations", cid))).exists(); } catch (e) {}
    if (!existe) {
      const noms = {};
      noms[moi] = monNom(); noms[autre] = annuaire[autre] || "?";
      await setDoc(doc(db, "conversations", cid), { type: "prive", titre: "", membres: ids, noms, creePar: moi, creeLe: serverTimestamp(), derniereAt: serverTimestamp(), dernierTexte: "", dernierDe: moi });
    }
    attendreEtOuvrir(cid);
  } catch (e) { msg("Erreur : " + (e.code || e.message)); }
}

async function creerGroupe() {
  if (!choisis.size) { msg("Choisis au moins un membre."); return; }
  const titre = nomGroupe.value.trim().slice(0, 40) || "Groupe";
  const membres = [moi].concat(Array.from(choisis));
  const noms = {};
  membres.forEach(u => { noms[u] = u === moi ? monNom() : (annuaire[u] || "?"); });
  try {
    const ref = doc(collection(db, "conversations"));
    await setDoc(ref, { type: "groupe", titre, membres, noms, creePar: moi, creeLe: serverTimestamp(), derniereAt: serverTimestamp(), dernierTexte: "", dernierDe: moi });
    attendreEtOuvrir(ref.id);
  } catch (e) { msg("Erreur : " + (e.code || e.message)); }
}

function ouvrirConv(id) {
  const c = convs.find(x => x.id === id);
  if (!c) return;
  courante = id;
  marquer(id);
  titreConv.textContent = (estMembre(c) ? "" : "👁 ") + nomConv(c);
  ligneSaisie.style.display = estMembre(c) ? "flex" : "none";
  listeMsgs.textContent = "";
  msgsC = [];
  montrer(vueConv);
  if (stopMsgs) stopMsgs();
  stopMsgs = onSnapshot(query(collection(db, "conversations", id, "messages"), orderBy("date", "desc"), limit(60)), snap => {
    msgsC = snap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) })).reverse();
    dessinerMsgs();
    marquer(id);
  }, e => msg("Erreur : " + (e.code || e.message)));
}

function fermerConv() {
  if (stopMsgs) { stopMsgs(); stopMsgs = null; }
  courante = null;
  montrer(vueListe);
  majListe();
}

function dessinerMsgs() {
  if (!listeMsgs) return;
  const enBas = listeMsgs.scrollHeight - listeMsgs.scrollTop - listeMsgs.clientHeight < 80;
  listeMsgs.textContent = "";
  msgsC.forEach(m => {
    const mien = m.de === moi;
    const ligne = div("display:flex;gap:6px;align-items:flex-end;justify-content:" + (mien ? "flex-end" : "flex-start"));
    if (!mien) ligne.appendChild(avatar(m.nom, m.de));
    const b = div("max-width:75%;padding:6px 10px;border-radius:14px;text-align:left;word-break:break-word;font-size:14px;background:" + (mien ? "#f4b400" : "#0e3b2a") + ";color:" + (mien ? "#022" : "#fff"));
    if (!mien) { const n = div("font-size:11px;font-weight:bold;color:#f4b400"); n.textContent = m.nom || "?"; b.appendChild(n); }
    const t = div(); t.textContent = m.texte || "";
    const h = div("font-size:10px;opacity:.7;text-align:right"); h.textContent = heure(m);
    b.append(t, h);
    ligne.appendChild(b);
    listeMsgs.appendChild(ligne);
  });
  if (enBas) listeMsgs.scrollTop = listeMsgs.scrollHeight;
}

async function envoyer() {
  const t = saisie.value.trim().slice(0, 500);
  if (!t || !courante || !moi) return;
  saisie.value = "";
  try {
    const s = await getDoc(doc(db, "users", moi));
    const nom = (s.exists() && s.data().name) || "joueur";
    const b = writeBatch(db);
    b.set(doc(collection(db, "conversations", courante, "messages")), { de: moi, nom, texte: t, date: serverTimestamp() });
    b.update(doc(db, "conversations", courante), { derniereAt: serverTimestamp(), dernierTexte: t.slice(0, 60), dernierDe: moi });
    await b.commit();
  } catch (e) { saisie.value = t; msg("Erreur : " + (e.code || e.message)); }
}

async function supprimerConv() {
  if (!estAdmin || !courante) return;
  if (!confirm("Supprimer cette conversation pour tout le monde ?")) return;
  const id = courante;
  try {
    const sn = await getDocs(collection(db, "conversations", id, "messages"));
    for (const d of sn.docs) await deleteDoc(d.ref);
    await deleteDoc(doc(db, "conversations", id));
    fermerConv();
    msg("Conversation supprimée.");
  } catch (e) { msg("Erreur : " + (e.code || e.message)); }
}
