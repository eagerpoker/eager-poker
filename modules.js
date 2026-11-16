const fichiers = [
  "historique.js?v=3", "decor.js?v=1", "decor2.js?v=1", "fond.js?v=1", "cartes.js?v=1",
  "robots.js?v=1", "tablegrande.js?v=1", "boutons.js?v=1", "chat.js?v=1", "messages.js?v=1",
  "chattable.js?v=1", "photos.js?v=1","lobbytables.js?v=2"
];
const echecs = [];

function signaler(f, e) {
  echecs.push(f.split("?")[0]);
  let b = document.getElementById("alerteModules");
  if (!b) {
    b = document.createElement("div");
    b.id = "alerteModules";
    b.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#c0392b;color:#fff;font-size:12px;padding:6px;text-align:center";
    document.body.appendChild(b);
  }
  b.textContent = "Fichier(s) en erreur : " + echecs.join(", ") + " : " + (e && e.message ? e.message : "introuvable");
}

fichiers.forEach(f => import("./" + f).catch(e => signaler(f, e)));
