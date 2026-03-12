// Audio playback utilities

function playAudio() {
  var audioDiv = document.getElementById("audio");
  if (!audioDiv) return;
  var audio = audioDiv.getElementsByTagName("*");
  if (!audio.length) return;
  audio[0].tagName == "AUDIO" ? audio[0].play() : audio[0].click();
}

// AudioManager — speech synthesis and Anki audio playback
var AudioManager = (function () {
  var _voice = null;
  var _voicesLoaded = false;

  function _findVoice() {
    var voices = speechSynthesis.getVoices();
    return (
      voices.find(function (v) {
        return (
          v.lang.indexOf("zh-CN") === 0 &&
          v.name.toLowerCase() === "tingting"
        );
      }) ||
      voices.find(function (v) {
        return v.lang.indexOf("zh") === 0;
      }) ||
      null
    );
  }

  function _loadVoices() {
    _voice = _findVoice();
    _voicesLoaded = true;
  }

  if (speechSynthesis.getVoices().length > 0) {
    _loadVoices();
  } else {
    speechSynthesis.addEventListener("voiceschanged", function onVoicesChanged() {
      _loadVoices();
      speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
    });
  }

  function speak(phrase, onEnd) {
    if (!phrase) return;
    if (!_voicesLoaded) {
      _voice = _findVoice();
      _voicesLoaded = true;
    }
    // Defensive: if the queue is stuck (pending but nothing playing), reset it.
    // This guards against a WKWebView bug where utterances queue silently.
    if (speechSynthesis.pending && !speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
    var utterance = new SpeechSynthesisUtterance();
    utterance.rate = 0.5;
    utterance.volume = 0.75;
    utterance.lang = "zh";
    if (_voice) utterance.voice = _voice;
    utterance.text = phrase;
    if (onEnd) utterance.onend = onEnd;
    speechSynthesis.speak(utterance);
  }

  function playAnkiAudio() {
    var audioDiv = document.getElementById("audio");
    if (!audioDiv) return;
    var els = audioDiv.getElementsByTagName("*");
    if (!els.length) return;
    els[0].tagName === "AUDIO" ? els[0].play() : els[0].click();
  }

  return { speak: speak, playAnkiAudio: playAnkiAudio };
})();
