import { getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, collection, query, where, orderBy, limit, onSnapshot, addDoc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ADMIN_UID = "vIia3H24Mla7zkdEBdUTn0VaIkD3";
const $ = id => document.getElementById(id);
const msg = t => { const m = $("msg"); if (m) m.textContent = t; };
const STATUT = { en_attente: ["En attente", "att"], acceptee: ["Acceptée", "ok"], refusee: ["Refusée", "non"], rendu: ["Rendu", "ok"] };
let auth = null, db = null;

function quand(d) {
  const t = d && d.createdAt && d.createdAt.toDate ? d.createdAt.toDate() : null;
  return t ? t.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "à l'instant";
}
function ligne(texte, classe, etiquette) {
  const l = document.createElement("div");
  l.className = "ligne";
  const g = document.createElement("span");
  g.textContent = texte;
  l.appendChild(g);
  if (etiquette) {
    const e = document.createElement("b");
    e.className = classe;
    e.textContent = etiquette;
    l.appendChild(e);
  }
  return l;
}
function qui(d) {
  const c = d.contact || d.email || "";
  return (d.name || "?") + (c ? " (" + c + ")" : "");
}

/* ===== A. Demande de jetons sans montant ===== */
let dMoi = null, dMesAtt = false, dDemandes = [], dZone = null, dObs = false;
let dStopMes = null, dStopGest = null, dStopStaff = null;

function dConfigurerJoueur() {
  const m = $("montant"), b = $("btnDemande"), c = $("codeValid");
  if (!m || !b || !c) return;
  m.style.display = "none";
  b.textContent = "Envoyer la demande à Eager Poker";
  b.onclick = dEnvoyer;
  if (!$("noteDemande")) {
    const note = document.createElement("div");
    note.id = "noteDemande";
    note.className = "mini";
    note.style.wordBreak = "normal";
    note.textContent = "Écris seulement ton code. Eager Poker décide du nombre de jetons que tu reçois.";
    c.after(note);
  }
}

async function dEnvoyer() {
  if (dMesAtt) { msg("Tu as déjà une demande en attente."); return; }
  const code = $("codeValid").value.replace(/[^A-Za-z0-9]/g, "");
  if (code.length < 6) { msg("Le code de validation doit avoir au moins 6 chiffres ou lettres."); return; }
  const user = auth.currentUser;
  if (!user) return;
  const nom = ($("pseudo") && $("pseudo").textContent) || "";
  try {
    await addDoc(collection(db, "demandes"), {
      uid: user.uid,
      name: nom,
      contact: user.email || user.phoneNumber || "",
      montant: 0,
      sansMontant: true,
      code,
      statut: "en_attente",
      createdAt: serverTimestamp()
    });
    $("codeValid").value = "";
    msg("Demande envoyée. Eager Poker décidera du nombre de jetons.");
  } catch (e) { msg("Erreur : " + (e.code || e.message)); }
}

function dCorrigerHistorique() {
  if (dObs) return;
  const box = $("mesDemandes");
  if (!box) return;
  dObs = true;
  const corriger = () => {
    box.querySelectorAll(".ligne span").forEach(s => {
      const t = s.textContent;
      if (/^Demande : 0 ·/.test(t)) s.textContent = t.replace("Demande : 0 ·", "Demande (montant décidé par Eager Poker) ·");
    });
  };
  new MutationObserver(corriger).observe(box, { childList: true, subtree: true });
  corriger();
}

function dSuivreStaff() {
  if (dStopStaff) return;
  const orig = $("demandesAttente");
  if (!orig) return;
  orig.style.display = "none";
  dZone = document.createElement("div");
  orig.after(dZone);
  dStopStaff = onSnapshot(
    query(collection(db, "demandes"), orderBy("createdAt", "desc"), limit(50)),
    snap => { dDemandes = snap.docs.map(x => ({ id: x.id, ...x.data() })); dDessinerAdmin(); },
    e => msg("Erreur : " + (e.code || e.message))
  );
}
function dArreterStaff() {
  if (dStopStaff) { dStopStaff(); dStopStaff = null; }
  if (dZone) { dZone.remove(); dZone = null; }
  const orig = $("demandesAttente");
  if (orig) orig.style.display = "";
  dDemandes = [];
}

function dDessinerAdmin() {
  if (!dZone) return;
  const actif = document.activeElement;
  if (actif && dZone.contains(actif) && actif.tagName === "INPUT") return;
  dZone.textContent = "";
  const att = dDemandes.filter(x => x.statut === "en_attente");
  if (!att.length) { dZone.appendChild(ligne("Aucune demande en attente.", "", "")); return; }
  att.forEach(x => {
    const bloc = document.createElement("div");
    bloc.className = "ligne";
    bloc.style.cssText = "flex-direction:column;align-items:stretch";
    const info = document.createElement("span");
    info.textContent = qui(x) + " · " + quand(x) + " · code : " + (x.code || "aucun") + (x.montant > 0 ? " · demandé : " + x.montant : "");
    bloc.appendChild(info);
    if (x.uid === dMoi && dMoi !== ADMIN_UID) {
      const s = document.createElement("span");
      s.className = "mini";
      s.textContent = "Ta propre demande : seule Eager Poker peut la traiter.";
      bloc.appendChild(s);
      dZone.appendChild(bloc);
      return;
    }
    const champ = document.createElement("input");
    champ.type = "number";
    champ.min = "1";
    champ.step = "1";
    champ.inputMode = "numeric";
    champ.placeholder = "Jetons à donner";
    champ.style.cssText = "flex:none;width:100%;max-width:none;margin:6px 0;padding:8px 10px";
    if (x.montant > 0) champ.value = x.montant;
    const btns = document.createElement("div");
    btns.className = "btns";
    const ok = document.createElement("button");
    ok.textContent = "Accepter";
    ok.onclick = () => dTraiter(x, true, champ.value);
    const non = document.createElement("button");
    non.textContent = "Refuser";
    non.className = "quitter";
    non.onclick = () => dTraiter(x, false, "");
    btns.append(ok, non);
    bloc.append(champ, btns);
    dZone.appendChild(bloc);
  });
}

async function dTraiter(d, accepter, valeur) {
  let m = 0;
  if (accepter) {
    m = Math.floor(Number(valeur));
    if (!(m > 0) || !Number.isSafeInteger(m)) { msg("Écris le nombre de jetons à donner."); return; }
  }
  try {
    await runTransaction(db, async tx => {
      const dref = doc(db, "demandes", d.id);
      const s = await tx.get(dref);
      if (!s.exists() || s.data().statut !== "en_attente") throw new Error("deja");
      if (s.data().uid === dMoi && dMoi !== ADMIN_UID) throw new Error("propre");
      let uref = null, chips = 0;
      if (accepter) {
        uref = doc(db, "users", s.data().uid);
        const u = await tx.get(uref);
        chips = u.exists() ? (u.data().chips || 0) : 0;
      }
      if (accepter) tx.update(uref, { chips: chips + m });
      const maj = { statut: accepter ? "acceptee" : "refusee", traiteLe: serverTimestamp(), traitePar: dMoi };
      if (accepter) maj.montant = m;
      tx.update(dref, maj);
    });
    msg(accepter ? m + " jetons donnés." : "Demande refusée.");
  } catch (e) {
    msg(e.message === "deja" ? "Cette demande est déjà traitée."
      : e.message === "propre" ? "Tu ne peux pas traiter ta propre demande."
      : "Erreur : " + (e.code || e.message));
  }
}

function dInit() {
  onAuthStateChanged(auth, user => {
    if (dStopMes) { dStopMes(); dStopMes = null; }
    if (dStopGest) { dStopGest(); dStopGest = null; }
    dArreterStaff();
    dMesAtt = false;
    dMoi = user ? user.uid : null;
    if (!user) return;
    dConfigurerJoueur();
    dCorrigerHistorique();
    dStopMes = onSnapshot(
      query(collection(db, "demandes"), where("uid", "==", user.uid)),
      snap => { dMesAtt = snap.docs.some(x => x.data().statut === "en_attente"); },
      () => {}
    );
    if (user.uid === ADMIN_UID) dSuivreStaff();
    else {
      dStopGest = onSnapshot(
        doc(db, "gestionnaires", user.uid),
        s => { if (s.exists()) dSuivreStaff(); else dArreterStaff(); },
        () => {}
      );
    }
  });
}

/* ===== B. Notifications ===== */
let nMoi = null, nBouton = null;
let nStopDem = null, nStopMes = null, nStopGest = null;

function nEnregistrer() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
function nNotifier(titre, texte, tag) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const opts = { body: texte, tag, renotify: true, vibrate: [200, 100, 200] };
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready
      .then(r => r.showNotification(titre, opts))
      .catch(() => { try { new Notification(titre, opts); } catch (e) {} });
  } else {
    try { new Notification(titre, opts); } catch (e) {}
  }
}
function nMajBouton() {
  if (!nBouton) {
    nBouton = document.createElement("button");
    nBouton.className = "gris";
    nBouton.style.maxWidth = "340px";
    nBouton.onclick = async () => {
      if (!("Notification" in window)) { msg("Ce navigateur ne gère pas les notifications."); return; }
      const p = await Notification.requestPermission();
      nMajBouton();
      if (p === "granted") nNotifier("Notifications activées", "Tu seras prévenu même quand le site est en arrière-plan.", "test");
    };
    const bar = document.querySelector("#lobby .bar");
    if (bar) bar.after(nBouton);
  }
  if (!("Notification" in window)) { nBouton.style.display = "none"; return; }
  const p = Notification.permission;
  nBouton.style.display = p === "granted" ? "none" : "";
  nBouton.disabled = p === "denied";
  nBouton.textContent = p === "denied" ? "🔕 Notifications bloquées (réglages du navigateur)" : "🔔 Activer les notifications";
}
function nSuivreDemandes() {
  if (nStopDem) return;
  let premier = true;
  nStopDem = onSnapshot(
    query(collection(db, "demandes"), orderBy("createdAt", "desc"), limit(50)),
    snap => {
      if (!premier) {
        snap.docChanges().forEach(c => {
          if (c.type !== "added") return;
          const d = c.doc.data();
          if (d.statut !== "en_attente" || d.uid === nMoi) return;
          nNotifier("Nouvelle demande de jetons", (d.name || "Un joueur") + " attend une réponse.", "dem-" + c.doc.id);
        });
      }
      premier = false;
    },
    () => {}
  );
}
function nArreter() {
  [nStopDem, nStopMes, nStopGest].forEach(f => { if (f) f(); });
  nStopDem = nStopMes = nStopGest = null;
}
function nInit() {
  nEnregistrer();
  onAuthStateChanged(auth, user => {
    nArreter();
    nMoi = user ? user.uid : null;
    if (!user) return;
    nMajBouton();
    let premier = true;
    nStopMes = onSnapshot(
      query(collection(db, "demandes"), where("uid", "==", user.uid)),
      snap => {
        if (!premier) {
          snap.docChanges().forEach(c => {
            if (c.type !== "modified") return;
            const d = c.doc.data();
            if (d.statut === "acceptee") nNotifier("Demande acceptée ✅", d.montant > 0 ? d.montant + " jetons ajoutés à ton compte." : "Tes jetons ont été ajoutés.", "res-" + c.doc.id);
            else if (d.statut === "refusee") nNotifier("Demande refusée", "Eager Poker a refusé ta demande de jetons.", "res-" + c.doc.id);
          });
        }
        premier = false;
      },
      () => {}
    );
    if (user.uid === ADMIN_UID) nSuivreDemandes();
    else {
      nStopGest = onSnapshot(
        doc(db, "gestionnaires", user.uid),
        s => {
          if (s.exists()) nSuivreDemandes();
          else if (nStopDem) { nStopDem(); nStopDem = null; }
        },
        () => {}
      );
    }
  });
}

/* ===== C. Volet Membres (administrateur) ===== */
let mBtn = null, mPane = null, mTimer = null;
let mListeU = [], mMap = {}, mStopU = null, mStopM = null, mStopH = null;
let mChoisi = null, mOnglet = "jetons", mHisto = [];

function mContact(id) {
  const u = mListeU.find(x => x.id === id);
  return (mMap[id] && mMap[id].contact) || (u && u.email) || "";
}
function mNom(id) {
  const u = mListeU.find(x => x.id === id);
  return (u && u.name) || "?";
}
function mNettoyer() {
  [mStopU, mStopM, mStopH].forEach(f => { if (f) f(); });
  mStopU = mStopM = mStopH = null;
  if (mBtn) { mBtn.remove(); mBtn = null; }
  if (mPane) { mPane.remove(); mPane = null; }
  if (mTimer) { clearInterval(mTimer); mTimer = null; }
  mListeU = []; mMap = {}; mChoisi = null; mHisto = [];
}
function mCreer() {
  const volets = document.querySelector(".volets");
  const apres = $("paneAdmins") || $("paneTables");
  if (!volets || !apres) return;
  mBtn = document.createElement("button");
  mBtn.id = "vMembres";
  mBtn.textContent = "Membres";
  mBtn.style.display = "none";
  volets.appendChild(mBtn);

  mPane = document.createElement("div");
  mPane.id = "paneMembres";
  mPane.className = "pane";
  mPane.style.display = "none";
  mPane.innerHTML =
    '<div class="boite">' +
    '<h3>Liste des membres <span id="mb_nb"></span></h3>' +
    '<div id="mb_vueListe">' +
    '<input id="mb_filtre" type="text" placeholder="Chercher un membre (pseudo ou contact)">' +
    '<div id="mb_liste"></div>' +
    '</div>' +
    '<div id="mb_vueDetail" style="display:none">' +
    '<button id="mb_retour" class="gris">← Retour à la liste</button>' +
    '<h3 id="mb_titre" style="margin-top:8px"></h3>' +
    '<div id="mb_onglets" class="onglets" style="max-width:none"></div>' +
    '<div id="mb_contenu"></div>' +
    '</div>' +
    '</div>';
  apres.after(mPane);

  $("mb_filtre").oninput = mDessinerListe;
  $("mb_retour").onclick = mFermer;

  const autres = ["vProfil", "vJetons", "vTables", "vAdmins"];
  mBtn.onclick = () => {
    ["paneProfil", "paneJetons", "paneTables", "paneAdmins"].forEach(i => { const e = $(i); if (e) e.style.display = "none"; });
    autres.forEach(i => { const e = $(i); if (e) e.classList.remove("actif"); });
    mPane.style.display = "block";
    mBtn.classList.add("actif");
  };
  autres.forEach(i => {
    const e = $(i);
    if (e) e.addEventListener("click", () => {
      if (mPane) mPane.style.display = "none";
      if (mBtn) mBtn.classList.remove("actif");
    });
  });

  mTimer = setInterval(() => {
    if (!mBtn || !mPane) return;
    const va = $("vAdmins");
    const adm = !!va && va.style.display !== "none";
    mBtn.style.display = adm ? "" : "none";
    if (!adm && mPane.style.display !== "none") {
      mPane.style.display = "none";
      mBtn.classList.remove("actif");
      const p = $("vProfil");
      if (p) p.click();
    }
  }, 500);

  const err = e => msg("Erreur : " + (e.code || e.message));
  mStopU = onSnapshot(collection(db, "users"), snap => {
    mListeU = snap.docs.map(x => ({ id: x.id, ...x.data() }));
    mDessinerListe();
  }, err);
  mStopM = onSnapshot(collection(db, "membres"), snap => {
    mMap = {};
    snap.forEach(x => { mMap[x.id] = x.data(); });
    mDessinerListe();
  }, err);
}
function mDessinerListe() {
  if (!mPane) return;
  const f = ($("mb_filtre").value || "").trim().toLowerCase();
  const box = $("mb_liste");
  box.textContent = "";
  $("mb_nb").textContent = "(" + mListeU.length + ")";
  const items = mListeU
    .map(u => ({ u, nom: u.name || "?", c: mContact(u.id) }))
    .filter(x => !f || (x.nom + " " + x.c).toLowerCase().includes(f))
    .sort((a, b) => String(a.nom).localeCompare(String(b.nom)));
  if (!items.length) box.appendChild(ligne("Aucun membre trouvé.", "", ""));
  items.forEach(x => {
    const l = ligne(x.nom + (x.c ? " · " + x.c : ""), "", "🪙 " + (x.u.chips || 0));
    l.style.cursor = "pointer";
    l.onclick = () => mOuvrir(x.u.id);
    box.appendChild(l);
  });
  if (mChoisi) $("mb_titre").textContent = mNom(mChoisi) + (mContact(mChoisi) ? " · " + mContact(mChoisi) : "");
}
function mOuvrir(id) {
  mChoisi = id;
  mOnglet = "jetons";
  $("mb_vueListe").style.display = "none";
  $("mb_vueDetail").style.display = "block";
  $("mb_titre").textContent = mNom(id) + (mContact(id) ? " · " + mContact(id) : "");
  if (mStopH) { mStopH(); mStopH = null; }
  mHisto = [];
  mStopH = onSnapshot(
    query(collection(db, "demandes"), where("uid", "==", id)),
    snap => {
      mHisto = snap.docs.map(x => ({ id: x.id, ...x.data() }))
        .sort((a, b) => ((b.createdAt && b.createdAt.seconds) || 9e9) - ((a.createdAt && a.createdAt.seconds) || 9e9));
      mDessinerDetail();
    },
    e => msg("Erreur : " + (e.code || e.message))
  );
  mDessinerDetail();
}
function mFermer() {
  mChoisi = null;
  if (mStopH) { mStopH(); mStopH = null; }
  mHisto = [];
  $("mb_vueDetail").style.display = "none";
  $("mb_vueListe").style.display = "block";
}
function mDessinerDetail() {
  if (!mPane || !mChoisi) return;
  const on = $("mb_onglets");
  on.textContent = "";
  [["message", "Message"], ["main", "Main"], ["jetons", "Jetons"]].forEach(([k, t]) => {
    const b = document.createElement("button");
    b.textContent = t;
    b.className = k === mOnglet ? "" : "gris";
    b.onclick = () => { mOnglet = k; mDessinerDetail(); };
    on.appendChild(b);
  });
  const c = $("mb_contenu");
  c.textContent = "";
  if (mOnglet === "jetons") {
    if (!mHisto.length) { c.appendChild(ligne("Aucune demande ni retour de jetons.", "", "")); return; }
    mHisto.forEach(d => {
      const st = STATUT[d.statut] || ["?", ""];
      const quoi = d.type === "retour" ? "A rendu " + d.montant
        : (d.montant > 0 ? "Demande : " + d.montant : "Demande (montant à décider)");
      c.appendChild(ligne(quoi + " · " + quand(d) + (d.code ? " · code : " + d.code : ""), st[1], st[0]));
    });
  } else {
    c.appendChild(ligne("Cet historique sera branché prochainement.", "", ""));
  }
}
function mInit() {
  onAuthStateChanged(auth, user => {
    mNettoyer();
    if (user && user.uid === ADMIN_UID) mCreer();
  });
}

/* ===== Démarrage ===== */
function demarrer() {
  const app = getApp();
  auth = getAuth(app);
  db = getFirestore(app);
  [dInit, nInit, mInit].forEach(f => { try { f(); } catch (e) { console.error(e); } });
}
function attendre(n) {
  if (getApps().length && $("btnDemande") && $("lobby") && document.querySelector(".volets")) demarrer();
  else if (n < 300) setTimeout(() => attendre(n + 1), 100);
}
attendre(0);
