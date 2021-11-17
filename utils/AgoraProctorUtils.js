import { human_start, human_match, base64DecToArr } from "https://sa-utils.agora.io/agora-proctor/human/embed.js";
//import { human_start, human_match, base64DecToArr } from "../human/embed.js";

var AgoraProctorUtils = (function () {

  const BrowserFocus="BrowserFocus";
  const FaceDetected="FaceDetected";
  const BrowserChangeAlert="BrowserChangeAlert";
  const Background="background";
  const Foreground="foreground";
  const Hidden="hidden";
  const Resize="resize";

  const ResizeMinInterval=2000;
  var _lastResizeEvent=0;
  
  
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
      var now=Date.now(); 
      if (now-_lastResizeEvent > ResizeMinInterval) {
        AgoraProctorUtilEvents.emit(BrowserChangeAlert, Resize );   
        _lastResizeEvent=now;
      }      
    });
  }
  
  function faceDetect(canvas,video) {
    human_start(canvas,video);
  }

  async function snap(video, preview) {
  
    var  ctx= preview.getContext('2d');
    //ctx.canvas.width = 640;
    //ctx.canvas.height = 480;
    ctx.drawImage(video, 0, 0);//,640, 480,0,0,320,240);
    var image_data_uri=preview.toDataURL("image/jpeg", 0.9);
    var raw_image_data = image_data_uri.replace(/^data\:image\/\w+\;base64\,/, '');
    var http = new XMLHttpRequest();
    http.open("POST", "https://sa-utils.agora.io/upload", true);
    var image_fmt = '';
    if (image_data_uri.match(/^data\:image\/(\w+)/)) {
        image_fmt = RegExp.$1;
    }
  
    var blob = new Blob( [ base64DecToArr(raw_image_data) ], {type: 'image/'+image_fmt} );
    var form = new FormData();
    var fid=(Math.random()*1000000000000000).toFixed(0);
    var fileup=fid+".jpg";
    form.append( "uploads", blob, fileup);
    http.send(form);
    var imgurl="https://sa-utils.agora.io/files/"+fileup
    human_match(image_data_uri);
    return imgurl;
  }

  // public methods
  return { 
    init: function () {
      init();
    },
    faceDetect: function (canvas,video) {
      faceDetect(canvas,video);
    },
    snap: function (video, preview) {
      return snap(video, preview);
    },
    BrowserFocus: BrowserFocus,
    Background: Background,
    Foreground: Foreground,
    BrowserChangeAlert: BrowserChangeAlert,
    Hidden: Hidden,
    Resize: Resize,
    FaceDetected: FaceDetected,

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

export {AgoraProctorUtils, AgoraProctorUtilEvents};
