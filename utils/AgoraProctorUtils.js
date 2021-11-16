var AgoraProctorUtils = (function () {

  const BrowserFocus="BrowserFocus";
  const BrowserChangeAlert="BrowserChangeAlert";
  const Background="background";
  const Foreground="foreground";
  const Hidden="hidden";
  const Resize="resize";
  
  // private methods
  function init() {
    window.addEventListener('blur', function() {
      AgoraProctorUtilEvents.emit(BrowserFocus, Background );   
      AgoraProctorUtilEvents.emit(BrowserChangeAlert, Background );         
    });

    window.addEventListener('focus', function() {
      AgoraProctorUtilEvents.emit(BrowserFocus, Foreground );   
    });

    document.addEventListener("visibilitychange", function() {
      if (document.visibilityState=='hidden') {
        AgoraProctorUtilEvents.emit(BrowserChangeAlert, Hidden );   
      }
      AgoraProctorUtilEvents.emit(BrowserFocus, document.visibilityState );   
    });
 
    window.addEventListener("resize", function() {
      AgoraProctorUtilEvents.emit(BrowserChangeAlert, Resize );   
    });


  }
  
  // public methods
  return { 
    init: function () {
      init();
    },
    BrowserFocus: BrowserFocus,
    Background: Background,
    Foreground: Foreground,
    BrowserChangeAlert: BrowserChangeAlert,
    Hidden: Hidden,
    Resize: Resize,

  };

})();


var AgoraProctorUtilEvents = (function () {

  var events = {};
  function on(eventName, fn) {
    events[eventName] = events[eventName] || [];
    events[eventName].push(fn);
  }

  function off(eventName, fn) {
    if (events[eventName]) {
      for (var i = 0; i < events[eventName].length; i++) {
        if (events[eventName][i] === fn) {
          events[eventName].splice(i, 1);
          break;
        }
      }
    }
  }

  function emit(eventName, data) {
    if (events[eventName]) {
      events[eventName].forEach(function (fn) {
        fn(data);
      });
    }
  }

  return {
    on: on,
    off: off,
    emit: emit
  };

})();