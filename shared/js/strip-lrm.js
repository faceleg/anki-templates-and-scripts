// Strip U+200E (left-to-right mark) from the card's text nodes. Runs on render
// (DOMContentLoaded never fires again when the page is reused) and only touches
// text nodes, so nested tone-colour spans survive.
(function () {
  var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  var node;
  while ((node = walker.nextNode())) {
    if (node.nodeValue.indexOf("‎") !== -1) {
      node.nodeValue = node.nodeValue.split("‎").join("");
    }
  }
})();
