// Font rotation — assigns a class to Chinese character elements based on time
// to rotate through fonts every 3 minutes, helping readers learn multiple fonts.

function assignClassBasedOnTime() {
  var charSimElement = document.getElementById("char_sim");
  var charSimColorElement = document.getElementById("char_sim_coloured");
  var charReadingElement = document.getElementById("char_reading");

  var now = new Date();
  var minutes = now.getMinutes();
  var seconds = now.getSeconds();
  var segment = Math.floor((minutes * 60 + seconds) / 180); // 3-minute segments

  var classes = ["kaiti", "arial", "roboto", "mashanzheng", "yrdzst", "xxx", "yyy"];
  var cls = classes[segment % classes.length];

  if (charSimElement) charSimElement.className = "char-card " + cls;
  if (charSimColorElement) charSimColorElement.className = "char-card " + cls;
  if (charReadingElement) charReadingElement.className = "char-card " + cls;

  var fontNameEl = document.getElementById("font-name");
  if (fontNameEl) fontNameEl.innerHTML = cls;
}

assignClassBasedOnTime();
