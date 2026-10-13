// Strip Chinese from #char_meaning on prompt sides (English -> Mandarin), so
// definitions like "variant of 夜[ye4]" or "abbr. for 家庭暴力[jia1 ting2 ...]"
// don't give the answer away. Skipped inside #back (Writing's back is
// {{FrontSide}}), and the hidden .char/.pinyin/.zhuyin block is left alone.
// data-keep-cl on #char_meaning keeps "CL:个[ge4]" measure words (Writing).
(function () {
  var root = document.getElementById("char_meaning");
  if (!root || root.closest("#back")) return;
  var keepCL = root.hasAttribute("data-keep-cl");

  // Remove the last "CL:..." segment (and a "◆" separator before it).
  function removeCL(s) {
    var clIndex = s.lastIndexOf("CL:");
    if (clIndex === -1) return s;
    var markerIndex = s.lastIndexOf("◆", clIndex);
    var endIndex = markerIndex !== -1 ? markerIndex - 1 : clIndex;
    var closingBracketIndex = s.indexOf("]", clIndex);
    if (closingBracketIndex === -1) return s.substring(0, endIndex);
    return s.substring(0, endIndex) + s.substring(closingBracketIndex + 1);
  }

  var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  var nodes = [];
  var node;
  while ((node = walker.nextNode())) {
    if (!node.parentElement.closest(".char, .pinyin, .zhuyin"))
      nodes.push(node);
  }
  nodes.forEach(function (n) {
    var text = n.nodeValue;
    var cl = "";
    var clIndex = keepCL ? text.indexOf("CL:") : -1;
    if (clIndex !== -1) {
      cl = text.substring(clIndex);
      text = text.substring(0, clIndex);
    }
    text = text
      // 個|个[ge4] / 家庭暴力[jia1 ting2 bao4 li4]: drop hanzi and its pinyin together
      .replace(/[一-鿿|·]+\[[^\]]*\]/g, "")
      .replace(/\[([一-鿿]+)\]/g, "[X]")
      .replace(/\(([一-鿿]+)\)/g, "(X)")
      .replace(/[一-鿿]/g, "");
    if (!keepCL && /CL/.test(text)) text = removeCL(text);
    n.nodeValue = (text + cl).trim();
  });

  // Drop list items / elements left empty.
  root.querySelectorAll("li, span, div").forEach(function (el) {
    if (!el.closest(".char, .pinyin, .zhuyin") && !el.textContent.trim())
      el.remove();
  });
})();
