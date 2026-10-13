// Underline the word(s) AnkiMorphs marks as unknown inside the displayed sentence.
// Reads the hidden #am-hl ({{am-highlighted}}); targets keep their own markup
// (tone-colour spans), so marking is done per character across text nodes.
// No-op when the field is empty. Safe to re-run on a reused page.
(function () {
  var src = document.getElementById("am-hl");
  if (!src) return;
  var unknown = Array.prototype.map.call(
    src.querySelectorAll('[morph-status="unknown"]'),
    function (el) { return el.textContent.trim(); }
  ).filter(Boolean);
  if (!unknown.length) return;

  ["char_sim", "char_sim_coloured", "char_reading"].forEach(function (id) {
    var root = document.getElementById(id);
    if (!root || root.querySelector(".am-unknown")) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var nodes = [], text = "";
    while (walker.nextNode()) { nodes.push({ node: walker.currentNode, start: text.length }); text += walker.currentNode.nodeValue; }
    var marked = {};
    unknown.forEach(function (w) {
      var i = text.indexOf(w);
      while (i !== -1) { for (var k = 0; k < w.length; k++) marked[i + k] = true; i = text.indexOf(w, i + w.length); }
    });
    nodes.forEach(function (n) {
      var s = n.node.nodeValue, frag = document.createDocumentFragment(), buf = "", hit = false;
      for (var j = 0; j < s.length; j++) {
        if (marked[n.start + j]) {
          if (buf) frag.appendChild(document.createTextNode(buf)); buf = "";
          var span = document.createElement("span"); span.className = "am-unknown"; span.textContent = s[j];
          frag.appendChild(span); hit = true;
        } else buf += s[j];
      }
      if (!hit) return;
      if (buf) frag.appendChild(document.createTextNode(buf));
      n.node.parentNode.replaceChild(frag, n.node);
    });
  });
})();
