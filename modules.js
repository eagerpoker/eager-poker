["historique.js?v=3", "decor.js?v=1", "decor2.js?v=1", "fond.js?v=1", "cartes.js?v=1","robots.js?v=1"]
  .forEach(f => import("./" + f).catch(() => {}));
