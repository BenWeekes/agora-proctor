import { human_start, human_match, base64DecToArr } from "https://sa-utils.agora.io/agora-proctor/human/embed.js";
//import { human_start, human_match, base64DecToArr } from "../human/embed.js";

var AgoraProctorUtils = (function () {

  const BrowserFocus="BrowserFocus";
  const FaceDetected="FaceDetected";
  const FaceSimilarity="FaceSimilarity";
  
  const BrowserChangeAlert="BrowserChangeAlert";
  const Background="background";
  const Foreground="foreground";
  const VoiceActivityDetected="voiceActivityDetected";
  
  const Hidden="hidden";
  const Resize="resize";

  const ResizeMinInterval=2000;
  const VADMinInterval=6000;
  var _lastResizeEvent=0;
  var _lastVADEvent=0;

  var _vad_audioTrack = null;
  var _voiceActivityDetectionFrequency = 150;
  var _vad_MaxAudioSamples = 400;
  var _vad_MaxBackgroundNoiseLevel = 30;
  var _vad_SilenceOffeset = 10;
  var _vad_audioSamplesArr = [];
  var _vad_audioSamplesArrSorted = [];
  var _vad_exceedCount = 0;
  var _vad_exceedCountThreshold = 1;
  var _vad_exceedCountThresholdLow = 1;
  var _voiceActivityDetectionInterval;
  
  
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

  function getInputLevel(track) {
    var analyser = track._source.analyserNode;
    const bufferLength = analyser.frequencyBinCount;
    var data = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(data);
    var values = 0;
    var average;
    var length = data.length;
    for (var i = 0; i < length; i++) {
      values += data[i];
    }
    average = Math.floor(values / length);
    return average;
  }

  function voiceActivityDetection() {
    if (!_vad_audioTrack || !_vad_audioTrack._enabled)
      return;

    var audioLevel = getInputLevel(_vad_audioTrack);
    if (audioLevel <= _vad_MaxBackgroundNoiseLevel) {
      if (_vad_audioSamplesArr.length >= _vad_MaxAudioSamples) {
        var removed = _vad_audioSamplesArr.shift();
        var removedIndex = _vad_audioSamplesArrSorted.indexOf(removed);
        if (removedIndex > -1) {
          _vad_audioSamplesArrSorted.splice(removedIndex, 1);
        }
      }
      _vad_audioSamplesArr.push(audioLevel);
      _vad_audioSamplesArrSorted.push(audioLevel);
      _vad_audioSamplesArrSorted.sort((a, b) => a - b);
    }
    var background = Math.floor(3 * _vad_audioSamplesArrSorted[Math.floor(_vad_audioSamplesArrSorted.length / 2)] / 2);
    if (audioLevel > background + _vad_SilenceOffeset) {
      _vad_exceedCount++;
    } else {
      _vad_exceedCount = 0;
    }

    if (_vad_exceedCount > _vad_exceedCountThreshold) {
      var now=Date.now(); 
      if (now-_lastVADEvent > VADMinInterval) {
        AgoraProctorUtilEvents.emit(BrowserChangeAlert, VoiceActivityDetected);
        _lastVADEvent=now;
      }   
      _vad_exceedCount = 0;
    }

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
    startVoiceActivityDetection: function (vad_audioTrack) {
      _vad_audioTrack = vad_audioTrack;
      if (_voiceActivityDetectionInterval) {
        return;
      }
      _voiceActivityDetectionInterval = setInterval(() => {
        voiceActivityDetection();
      }, _voiceActivityDetectionFrequency);
    },
    stopVoiceActivityDetection: function () {
      clearInterval(_voiceActivityDetectionInterval);
      _voiceActivityDetectionInterval = null;
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
