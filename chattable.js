let boite = null, ouvert = false, avant = null, pos = null, dep = null;
try { pos = JSON.parse(localStorage.getItem("bulleChatPos")); } catch (e) { pos = null; }

const css = document.createElement("style");
css.textContent = "@keyframes pulseChat{0%,100%{box-shadow:0 0 0 0 #f4b40099}50%{box-shadow:0 0 0 8px #f4b40000}}";
document.head.appendChild(css);

const bulle = document.createElement("div");
bulle.style.cssText = "position:fixed;z-index:8000;width:50px;height:50px;border-radius:50%;background:#f4b400;color:#022;display:none;align-items:center;justify-content:center;font-size:24px;box-shadow:0 2px 10px #0008;touch-action:none;user-select:none;-webkit-user-select:none;opacity:.92";
bulle.textContent = "💬";
const pastille = document.createElement("div");
pastille.style.cssText = "position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;border-radius:9px;background:#c0392b;color:#fff;font-size:11px;font-weight:bold;display:none;align-items:center;justify-content:center;padding:0 4px;box-sizing:border-box";
bulle.appendChild(pastille);

const voile = document.createElement("div");
voile.style.cssText = "position:fixed;left:0;top:0;right:0;bottom:0;z-index:8999;background:rgba(0,0,0,.35);display:none";
voile.onclick = fermer;

const feuille = document.createElement("div");
feuille.style.cssText = "position:fixed;left:0;right:0;bottom:0;height:78vh;z-index:9000;background:#0b3d2e;border-radius:16px 16px 0 0;box-shadow:0 -4px 16px #000a;display:none;flex-direction:column;color:#fff";
const entete = document.createElement("div");
entete.style.cssText = "display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid #ffffff22";
const titre = document.createElement("span");
titre.style.cssText = "flex:1;text-align:left;font-weight:bold";
titre.textContent = "Discussion";
const note = document.createElement("span");
note.style.cssText = "display:none;color:#f4b400;font-size:13px;font-weight:bold";
note.textContent = "À toi de jouer !";
const retour = document.createElement("button");
retour.textContent = "↩ Table";
retour.style.cssText = "display:block;width:auto;max-width:none;margin:0;padding:7px 12px;font-size:13px";
retour.onclick = fermer;
entete.append(titre, note, retour);
const corps = document.createElement("div");
corps.style.cssText = "flex:1;overflow-y:auto;padding:6px 8px 12px";
feuille.append(entete, corps);
document.body.append(bulle, voile, feuille);

function placer() {
  const w = window.innerWidth, h = window.innerHeight;
  let x = pos ? pos.x : w - 60, y = pos ? pos.y : Math.round(h * 0.55);
  x = Math.max(4, Math.min(w - 54, x));
  y = Math.max(60, Math.min(h - 120, y));
  bulle.style.left = x + "px";
  bulle.style.top = y + "px";
}
placer();
window.addEventListener("resize", placer);

bulle.addEventListener("pointerdown", e => {
  dep = { sx: e.clientX, sy: e.clientY, x: parseFloat(bulle.style.left), y: parseFloat(bulle.style.top), bouge: false };
  bulle.setPointerCapture(e.pointerId);
});
bulle.addEventListener("pointermove", e => {
  if (!dep) return;
  const dx = e.clientX - dep.sx, dy = e.clientY - dep.sy;
  if (Math.abs(dx) + Math.abs(dy) > 8) dep.bouge = true;
  if (dep.bouge) { pos = { x: dep.x + dx, y: dep.y + dy }; placer(); }
});
bulle.addEventListener("pointerup", () => {
  if (!dep) return;
  const clic = !dep.bouge;
  dep = null;
  if (clic) ouvrir();
  else { try { localStorage.setItem("bulleChatPos", JSON.stringify(pos)); } catch (e) {} }
});
bulle.addEventListener("pointercancel", () => { dep = null; });

function defiler() {
  if (!boite) return;
  boite.querySelectorAll("div").forEach(d => {
    if (d.scrollHeight > d.clientHeight + 4 && getComputedStyle(d).overflowY === "auto") d.scrollTop = d.scrollHeight;
  });
}

function ouvrir() {
  const pane = document.getElementById("paneChat");
  if (ouvert || !pane) return;
  if (!boite) boite = pane.querySelector(".boite");
  if (!boite) return;
  avant = document.querySelector("#lobby .volets button.actif");
  const vc = document.getElementById("vChat");
  if (vc && avant !== vc) vc.click();
  corps.appendChild(boite);
  voile.style.display = "block";
  feuille.style.display = "flex";
  ouvert = true;
  setTimeout(defiler, 60);
}

function fermer() {
  if (!ouvert) return;
  const pane = document.getElementById("paneChat");
  if (pane && boite) pane.appendChild(boite);
  voile.style.display = "none";
  feuille.style.display = "none";
  ouvert = false;
  if (avant && avant.id !== "vChat") avant.click();
  avant = null;
}

setInterval(() => {
  const tv = document.getElementById("tableView");
  const enTable = !!tv && tv.style.display !== "none";
  const vc = document.getElementById("vChat");
  bulle.style.display = enTable && vc && !ouvert ? "flex" : "none";
  if (ouvert && !enTable) fermer();
  const t = vc ? vc.textContent : "";
  const m = t.match(/\((\d+)\)/);
  const n = m ? Number(m[1]) : 0;
  const txt = n ? String(n) : (t.indexOf("✉") !== -1 ? "•" : "");
  pastille.textContent = txt;
  pastille.style.display = txt ? "flex" : "none";
  bulle.style.animation = txt ? "pulseChat 1.4s infinite" : "none";
  const a = document.getElementById("actions");
  note.style.display = ouvert && a && a.style.display !== "none" ? "inline" : "none";
}, 400);
