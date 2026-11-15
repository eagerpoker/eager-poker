import { getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let db, auth, moi = null, fichier = null, cibleInp = null, cibleEnv = null, prog = false;
const memoire = {};
const msg = t => { const m = document.getElementById("msg"); if (m) m.textContent = t; };

const init = setInterval(() => {
  if (!getApps().length) return;
  clearInterval(init);
  auth = getAuth(getApps()[0]);
  db = getFirestore(getApps()[0]);
  onAuthStateChanged(auth, user => {
    moi = user ? user.uid : null;
    if (!user) { try { if (window.caches) caches.delete("chatPhotos"); } catch (e) {} }
  });
}, 300);

function bouton(texte, fn) {
  const b = document.createElement("button");
  b.textContent = texte;
  b.onclick = fn;
  b.style.cssText = "display:block;width:auto;max-width:none;margin:0;padding:9px 14px;font-size:14px";
  return b;
}

function petit(texte, fn) {
  const b = bouton(texte, fn);
  b.style.cssText = "display:block;width:auto;max-width:none;margin:0;padding:8px 9px;font-size:15px;flex:none;background:#8aa";
  return b;
}

function compresser(blob) {
  return new Promise((ok, ko) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let cote = 900, q = 0.75;
      for (let i = 0; i < 6; i++) {
        const r = Math.min(1, cote / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * r));
        c.height = Math.max(1, Math.round(img.height * r));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        let data = c.toDataURL("image/webp", q);
        if (data.indexOf("data:image/webp") !== 0) data = c.toDataURL("image/jpeg", q);
        if (data.length <= 200000) return ok(data);
        cote = Math.round(cote * 0.8);
        q = Math.max(0.5, q - 0.06);
      }
      ko(new Error("image trop lourde"));
    };
    img.onerror = () => { URL.revokeObjectURL(url); ko(new Error("image illisible")); };
    img.src = url;
  });
}

function confirmer(src) {
  return new Promise(ok => {
    const v = document.createElement("div");
    v.style.cssText = "position:fixed;left:0;top:0;right:0;bottom:0;z-index:9600;background:rgba(0,0,0,.85);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:12px";
    const im = document.createElement("img");
    im.src = src;
    im.style.cssText = "max-width:100%;max-height:60vh;border-radius:10px";
    const r = document.createElement("div");
    r.style.cssText = "display:flex;gap:10px";
    const non = bouton("Annuler", () => { v.remove(); ok(false); });
    non.style.background = "#8aa";
    r.append(bouton("Envoyer la photo", () => { v.remove(); ok(true); }), non);
    v.append(im, r);
    document.body.appendChild(v);
  });
}

function voir(src) {
  const v = document.createElement("div");
  v.style.cssText = "position:fixed;left:0;top:0;right:0;bottom:0;z-index:9700;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center";
  const im = document.createElement("img");
  im.src = src;
  im.style.cssText = "max-width:100%;max-height:100%";
  v.appendChild(im);
  v.onclick = () => v.remove();
  document.body.appendChild(v);
}

async function envoyerPhoto(inp, envoyer, blob) {
  if (!envoyer || !moi) return;
  let data = null;
  try { data = await compresser(blob); } catch (e) { msg("Erreur : " + e.message); return; }
  if (!(await confirmer(data))) return;
  try {
    const ref = await addDoc(collection(db, "chat_photos"), { de: moi, data, date: serverTimestamp() });
    memoire[ref.id] = data;
    const legende = inp.value.trim().slice(0, 300);
    inp.value = "📷photo:" + ref.id + (legende ? " " + legende : "");
    envoyer.click();
    inp.value = "";
  } catch (e) { msg("Erreur : " + (e.code || e.message)); }
}

function choisir(inp, envoyer) {
  if (!fichier) {
    fichier = document.createElement("input");
    fichier.type = "file";
    fichier.accept = "image/*";
    fichier.hidden = true;
    fichier.onchange = () => {
      const f = fichier.files[0];
      fichier.value = "";
      if (f && f.type.indexOf("image/") === 0 && cibleInp) envoyerPhoto(cibleInp, cibleEnv, f);
    };
    document.body.appendChild(fichier);
  }
  cibleInp = inp; cibleEnv = envoyer;
  fichier.click();
}

async function coller(inp, envoyer) {
  try {
    if (!navigator.clipboard || !navigator.clipboard.read) { msg("Ce navigateur ne permet pas de coller une image ici. Utilise 📎."); return; }
    const items = await navigator.clipboard.read();
    for (const it of items) {
      const type = it.types.find(t => t.indexOf("image/") === 0);
      if (type) { envoyerPhoto(inp, envoyer, await it.getType(type)); return; }
    }
    msg("Aucune image dans le presse-papiers.");
  } catch (e) { msg("Impossible de lire le presse-papiers : " + (e.message || e.name)); }
}

document.addEventListener("paste", e => {
  const t = e.target;
  if (!t || !t.dataset || !t.dataset.photo) return;
  const f = Array.from((e.clipboardData && e.clipboardData.files) || []).find(x => x.type.indexOf("image/") === 0);
  if (!f) return;
  e.preventDefault();
  const envoyer = Array.from(t.parentElement.querySelectorAll("button")).find(b => b.textContent === "Envoyer");
  envoyerPhoto(t, envoyer, f);
});

function ajouterBoutons() {
  document.querySelectorAll('input[placeholder="Écris un message…"]').forEach(inp => {
    if (inp.dataset.photo) return;
    const envoyer = Array.from(inp.parentElement.querySelectorAll("button")).find(b => b.textContent === "Envoyer");
    if (!envoyer) return;
    inp.dataset.photo = "1";
    inp.after(petit("📎", () => choisir(inp, envoyer)), petit("📋", () => coller(inp, envoyer)));
  });
}

async function charger(id) {
  if (memoire[id]) return memoire[id];
  try {
    if (window.caches) {
      const c = await caches.open("chatPhotos");
      const r = await c.match("/_photo/" + id);
      if (r) { const t = await r.text(); memoire[id] = t; return t; }
    }
  } catch (e) {}
  try {
    const s = await getDoc(doc(db, "chat_photos", id));
    if (!s.exists()) return null;
    const data = s.data().data;
    memoire[id] = data;
    try { if (window.caches) { const c = await caches.open("chatPhotos"); await c.put("/_photo/" + id, new Response(data)); } } catch (e) {}
    return data;
  } catch (e) { return null; }
}

function habiller(d, id, legende) {
  d.textContent = "";
  const img = document.createElement("img");
  img.alt = "photo";
  img.style.cssText = "display:block;max-width:100%;max-height:260px;border-radius:10px;cursor:pointer";
  img.onclick = () => { if (img.src) voir(img.src); };
  d.appendChild(img);
  if (legende) {
    const c = document.createElement("div");
    c.style.marginTop = "4px";
    c.textContent = legende;
    d.appendChild(c);
  }
  if (memoire[id]) { img.src = memoire[id]; return; }
  charger(id).then(src => {
    if (src) img.src = src;
    else { const s = document.createElement("span"); s.textContent = "📷 Photo indisponible"; img.replaceWith(s); }
  });
}

function traiter() {
  if (!db) return;
  const base = document.getElementById("chatOnglets");
  const racine = base ? base.parentElement : document.querySelector("#paneChat .boite");
  if (!racine) return;
  racine.querySelectorAll("div").forEach(d => {
    if (d.children.length) return;
    const t = d.textContent;
    if (t.indexOf("📷photo:") !== 0) return;
    const m = t.match(/^📷photo:([A-Za-z0-9]+)(?: ([\s\S]*))?$/);
    if (!m) return;
    if (getComputedStyle(d).whiteSpace === "nowrap") d.textContent = "📷 Photo" + (m[2] ? " · " + m[2] : "");
    else habiller(d, m[1], m[2] || "");
  });
}

new MutationObserver(() => {
  if (prog) return;
  prog = true;
  setTimeout(() => { prog = false; traiter(); ajouterBoutons(); }, 60);
}).observe(document.body, { childList: true, subtree: true });
setInterval(() => { traiter(); ajouterBoutons(); }, 1000);
