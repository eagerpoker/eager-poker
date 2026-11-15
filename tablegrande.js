const s = document.createElement("style");
s.textContent =
  ".salle{transform:scale(var(--echelleTable,1))!important}" +
  "#salleWrap{width:calc(360px * var(--echelleTable,1))!important;height:calc(596px * var(--echelleTable,1))!important}";
document.head.appendChild(s);

function majEchelle() {
  const v = document.getElementById("tableView");
  if (!v || v.style.display === "none") return;
  const larg = document.documentElement.clientWidth - 12;
  const sc = Math.max(0.5, Math.min(larg / 360, 1.25));
  document.documentElement.style.setProperty("--echelleTable", sc);
}

let vu = false;
function suivreBoutons() {
  const a = document.getElementById("actions");
  const visible = !!a && a.style.display !== "none";
  if (visible && !vu) {
    vu = true;
    const r = a.getBoundingClientRect();
    if (r.bottom > window.innerHeight) a.scrollIntoView({ behavior: "smooth", block: "end" });
  }
  if (!visible) vu = false;
}

setInterval(() => { majEchelle(); suivreBoutons(); }, 400);
window.addEventListener("resize", majEchelle);
window.addEventListener("orientationchange", () => setTimeout(majEchelle, 200));
