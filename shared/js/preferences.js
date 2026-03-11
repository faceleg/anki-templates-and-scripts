// Preferences / sidebar system
// Requires window.keyPrefix and window.preferenceDefaults to be set by the template before this script runs.

var UniqueCardPersistence = {
  getItem: function (key) {
    return Persistence.getItem(window.keyPrefix + "-" + key);
  },
  setItem: function (key, value) {
    if (value === "true") {
      value = true;
    } else if (value === "false") {
      value = false;
    }
    return Persistence.setItem(window.keyPrefix + "-" + key, value);
  },
};

// Defaults management — derive list from template-defined preferenceDefaults
var switchIdList = Object.keys(window.preferenceDefaults);

function getPreference(defaultName, frontOrBack) {
  if (
    window.preferenceDefaults[defaultName] &&
    window.preferenceDefaults[defaultName].hasOwnProperty(frontOrBack)
  ) {
    return window.preferenceDefaults[defaultName][frontOrBack];
  } else {
    throw new Error("Invalid default name or property");
  }
}
// End defaults management

var frontBack = "front";
function setActive(side) {
  if (side == "text-front") {
    frontBack = "front";
    document.getElementById("text-front").classList.add("btn-active");
    document.getElementById("text-back").classList.remove("btn-active");
  }
  if (side == "text-back") {
    frontBack = "back";
    document.getElementById("text-front").classList.remove("btn-active");
    document.getElementById("text-back").classList.add("btn-active");
  }
  initSwitchPrefs();
}

if (!document.getElementById("back")) {
  setActive("text-front");
} else {
  setActive("text-back");
}

function initPractice() {
  var _selectPracticeId = frontBack + "reading-practice-select";
  var selectPracticeElem = document.getElementById("reading-practice-select");
  var selectPracticeStore = UniqueCardPersistence.getItem(_selectPracticeId);

  if (selectPracticeStore == undefined) {
    selectPracticeElem.selectedIndex = 0;
    UniqueCardPersistence.setItem(_selectPracticeId, 0);
  } else {
    selectPracticeElem.selectedIndex = selectPracticeStore;
    UniqueCardPersistence.setItem(_selectPracticeId, selectPracticeStore);
  }
}

function initSwitchPrefs() {
  for (var _id of switchIdList) {
    var perId = frontBack + _id;

    var preferenceValue = UniqueCardPersistence.getItem(perId);
    if (preferenceValue === null) {
      preferenceValue = getPreference(_id, frontBack);
    }

    document.getElementById(_id).checked = preferenceValue;
    UniqueCardPersistence.setItem(perId, preferenceValue);

    showHideFieldByCheckboxId(_id);
  }

  showTraditionalChar();
}

function showHideFieldByCheckboxId(_id) {
  var isShowField = document.getElementById(_id).checked ? true : false;
  showHideFieldByCheckboxIdWithIsShowField(_id, isShowField);
}

function showHideFieldByCheckboxIdWithIsShowField(_id, isShowField) {
  var divId = _id.replace("text-", "char_");

  // Use the generic showhide on the element first
  showHide("#" + divId, isShowField, "block");

  // Perform additional show/hide on special elements
  switch (_id) {
    case "text-pinyin":
      showHide(".pinyin", isShowField);
      break;

    case "text-zhuyin":
      showHide(".zhuyin", isShowField);
      break;

    case "text-examples-parts-of-speech":
      showHide(".char_examples-parts-of-speech", isShowField);
      break;

    case "text-sim":
      showHide("#char-sim-id", isShowField);
      break;

    case "text-trad":
      showHide("#char-trad-id", isShowField);
      showHide(".sep", isShowField);
      break;

    default:
      // console.warn(_id + " not in switch list");
      break;
  }
}

function showTraditionalChar() {
  var tradChar = document.getElementById("char_trad");
  var simChar = document.getElementById("char_sim");
  if (tradChar.innerHTML != simChar.innerHTML) {
    if (UniqueCardPersistence.getItem(frontBack + "text-trad") == "true") {
      tradChar.style.display = "block";
    }
  } else {
    if (UniqueCardPersistence.getItem(frontBack + "text-sim") == "true") {
      tradChar.style.display = "none";
    }
  }
}

function setPrefs(e) {
  var perId = frontBack + e.id;
  if (e.id == "reading-practice-select") {
    UniqueCardPersistence.setItem(perId, e.selectedIndex);
    characters =
      document.getElementById("reading-practice-select").selectedIndex == 0
        ? document.getElementById("char_sim").innerHTML
        : document.getElementById("char_trad").innerHTML;
    doPractice();
  }

  if (e.type == "checkbox") {
    UniqueCardPersistence.setItem(perId, e.checked.toString());
    var divId = e.id.replace("text-", "char_");

    showHideFieldByCheckboxId(e.id);
  }

  if (e.type == "number") {
    UniqueCardPersistence.setItem(perId, e.value);
    var elem = document.getElementById(e.id);
    elem.value = e.value;
  }
}

function showHide(type, isShow, style) {
  if (style === undefined) style = "inline";
  if (isShow) {
    document.querySelectorAll(type).forEach(function (val) {
      val.style.display = style;
    });
  } else {
    document.querySelectorAll(type).forEach(function (val) {
      val.style.display = "none";
    });
  }
}

function openSidebar(id) {
  var width = id == "sidebar" ? "250px" : "160px";
  document.getElementById(id).style.width = width;
}

function closeSidebar(id) {
  document.getElementById(id).style.width = "0";
}

document.addEventListener("click", function (event) {
  if (
    !document.getElementById("sidebar") ||
    !document.getElementById("more-info-sidebar")
  ) {
    return;
  }
  if (!document.getElementById("sidebar").contains(event.target)) {
    closeSidebar("sidebar");
  }
  if (!document.getElementById("more-info-sidebar").contains(event.target)) {
    closeSidebar("more-info-sidebar");
  }
  if (document.getElementById("btnShowMenu").contains(event.target)) {
    openSidebar("sidebar");
  }
  if (document.getElementById("btnMoreOptions").contains(event.target)) {
    openSidebar("more-info-sidebar");
  }
});

function isInWebView() {
  var UA = navigator.userAgent;
  if (/iPhone|iPod|iPad/.test(UA)) {
    if (/(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/i.test(UA)) {
      return true;
    }
  }
  if (window.location.href.includes("ankiuser.net")) {
    return true;
  }
  return false;
}

if (Persistence.isAvailable()) {
  if (window.ankiPlatform == "desktop" || isInWebView()) {
    initPractice();
    initSwitchPrefs();
  } else {
    window.addEventListener("load", initPractice, false);
    window.addEventListener("load", initSwitchPrefs, false);
  }
}
