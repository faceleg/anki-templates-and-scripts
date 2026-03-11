// Debug utilities

var DEBUG = false;

window.onerror = function (message, source, lineno, colno, error) {
  if (!DEBUG) return;
  var el = document.getElementById("debug-message-console");
  if (!el) return;
  el.style.display = "block";
  el.innerHTML +=
    "<div>" +
    message +
    " (" +
    (source || "") +
    ":" +
    lineno +
    ":" +
    colno +
    ")</div>";
};

function debugLog(msg) {
  if (!DEBUG) return;
  var el = document.getElementById("debug-message-console");
  if (!el) return;
  el.style.display = "block";
  el.innerHTML += "<div>" + msg + "</div>";
}
