import { getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, collection, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = id => document.getElementById(id);
const msg = t => { const m = $("msg"); if (m) m.textContent = t; };
let auth = null, db = null;

function montantDe(texte) {
  const m = texte.match(/\d{1,3}(?:[ \u00A0.]\d{3})+|\d+/);
  return m ? parseInt(m[0].replace(/[ \u00A0.]/g, ""), 10) : 0;
}

async function rendre() {
  const zone = $("rendre");
  const texte = zone.value.trim();
  const m = montantDe(texte);
  if (!(m > 0) || !Number.isSafeInteger(m)) {
    msg("Écris le nombre de jetons à rendre. Le premier nombre de la case est utilisé.");
    return;
  }
  const user = auth.currentUser;
  if (!user) return;
  const nom = ($("pseudo") && $("pseudo").textContent) || "";
  const code = /^[\d\s.\u00A0]+$/.test(texte) ? "" : texte.slice(0, 20000);
  try {
    await runTransaction(db, async tx => {
      const uref = doc(db, "users", user.uid);
      const u = await tx.get(uref);
      const c = u.exists() ? (u.data().chips || 0) : 0;
      if (m > c) throw new Error("pasassez");
      tx.update(uref, { chips: c - m });
      tx.set(doc(collection(db, "demandes")), {
        uid: user.uid,
        name: nom,
        contact: user.email || user.phoneNumber || "",
        type: "retour",
        montant: m,
        code,
        statut: "rendu",
        createdAt: serverTimestamp()
      });
    });
    zone.value = "";
    msg(m + " jetons rendus à Eager Poker.");
  } catch (e) {
    msg(e.message === "pasassez" ? "Tu n'as pas assez de jetons sur ton compte." : "Erreur : " + (e.code || e.message));
  }
}

function configurer() {
  const ancien = $("rendre"), btn = $("btnRendre");
  if (!ancien || !btn) return;
  if (ancien.tagName !== "TEXTAREA") {
    const zone = document.createElement("textarea");
    zone.id = "rendre";
    zone.rows = 2;
    zone.placeholder = "Jetons à rendre : écris le nombre, puis ce que tu veux";
    zone.style.cssText = "display:block;width:100%;max-width:260px;margin:8px auto;padding:8px 12px;font-size:14px;border-radius:8px;border:0;box-sizing:border-box;font-family:inherit;resize:vertical";
    ancien.replaceWith(zone);
  }
  btn.onclick = rendre;
}

function demarrer() {
  const app = getApp();
  auth = getAuth(app);
  db = getFirestore(app);
  configurer();
}

function attendre(n) {
  if (getApps().length && $("rendre") && $("btnRendre")) demarrer();
  else if (n < 300) setTimeout(() => attendre(n + 1), 100);
}
attendre(0);
