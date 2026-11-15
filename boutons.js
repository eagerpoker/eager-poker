const s = document.createElement("style");
s.textContent =
  "#zoneBas{position:relative}" +
  "#actions{position:absolute!important;top:0;left:50%;transform:translateX(-50%);margin:0!important;width:min(340px,96vw);box-sizing:border-box;z-index:40;background:rgba(20,90,67,.35)!important}" +
  "#actions button,#actions input{opacity:.88}" +
  "#actions #infoAction{text-shadow:0 1px 3px #000}";
document.head.appendChild(s);
