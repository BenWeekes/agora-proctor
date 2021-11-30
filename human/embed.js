import { Human } from "https://sa-utils.agora.io/agora-proctor/human/assets/human.esm.js";
import { AgoraProctorUtils, AgoraProctorUtilEvents } from "https://sa-utils.agora.io/agora-proctor/utils/AgoraProctorUtils.js";
//import { AgoraProctorUtils, AgoraProctorUtilEvents } from "../utils/AgoraProctorUtils.js";

var humanConfig = {
  modelBasePath: "https://sa-utils.agora.io/agora-proctor/human/assets/models",
  filter: { equalization: false },
  face: {
    enabled: true,
    //detector: { rotation: true, return: true, cropFactor: 1.6, mask: false }, // return tensor is used to get detected face image
    detector: { rotation: true, return: true, cropFactor: 1.6, mask: false },
    //detector: { rotation: false}, // return tensor is used to get detected face image
    description: { enabled: false },
    iris: { enabled: false }, // needed to determine gaze direction
    emotion: { enabled: false }, // not needed
    antispoof: { enabled: false }, // enable optional antispoof module
    liveness: { enabled: false }, // enable optional liveness module
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  gesture: { enabled: false }, // parses face and iris gestures//options
};

var human = new Human(humanConfig);

human.env["perfadd"] = false;
human.draw.options.font = 'small-caps 28px "Lato"';
human.draw.options.lineHeight = 32;


const drawOptions = {
  color: "#007bff",
  labelColor: "#d9e7f7",
  shadowColor: "#666",
  bufferedOutput: true, // makes draw functions interpolate results between each detection for smoother movement
  drawBoxes: true,
  drawGaze: true,
  drawLabels: true,
  drawGestures: false ,
  drawPolygons: true,
  drawPoints: false,
  fillPolygons: false,
  useCurves: false,
  useDepth: true,
};


var dom = {
  video: null, //document.getElementById("video"),
  canvas: null, //document.getElementById("canvas"),
  stream: null,
  compareImg: null,
  compareUrl: null,
  init: false,
  similarity: 0,
  log: document.getElementById("log"),
  fps: document.getElementById("status"),
  perf: document.getElementById("performance")
};

var timestamp = { detect: 0, draw: 0, tensors: 0 };
var fps = { detect: 0, draw: 0 };
var log = (...msg) => {
//  dom.log.innerText += msg.join(" ") + "\n";
 // console.log(...msg);
};

var status = (msg) => dom.fps.innerText = msg;
var perf = (msg) => dom.perf.innerText = "tensors:" + human.tf.memory().numTensors + " | performance: " + JSON.stringify(msg).replace(/"|{|}/g, "").replace(/,/g, " | ");

async function detectionLoop() {
  if (dom.video && !dom.video.paused) {
    
    var res1=await human.detect(dom.video);
    // compare to photoId
    if (dom.compareUrl && !dom.compareImg) {

      if (res1 && res1.face && res1.face.tensor) {
      	human.tf.dispose(res1.face.tensor);
      }

      const img = new Image();
      img.onload = () => {
        human.detect(img).then((res2) => {
          dom.compareImg=res2;
        });
      };
      img.onerror = () => {
        log('Add image error:',dom.compareUrl);
      };
      img.src = encodeURI(dom.compareUrl);
    }

    if (dom.compareUrl && dom.compareImg) {
      var x=0;
      if (res1 && res1.face && res1.face.length>0 && res1.face[0].embedding && dom.compareImg && dom.compareImg.face && dom.compareImg.face.length>0 &&  dom.compareImg.face[0].embedding){
        x= await human.similarity(res1.face[0].embedding, dom.compareImg.face[0].embedding);
      }
      AgoraProctorUtilEvents.emit(AgoraProctorUtils.FaceSimilarity,x);   
      dom.similarity=x;   

    }
    const tensors = human.tf.memory().numTensors;
    timestamp.tensors = tensors;
  }
  const now = human.now();
  fps.detect = 1e3 / (now - timestamp.detect);
  timestamp.detect = now;
  requestAnimationFrame(detectionLoop);
}

var interpolated_prev=0;

async function drawLoop() {
  if (dom.video && !dom.video.paused) {
    const interpolated = await human.next(human.result);
    var faces=interpolated.face.length;
    if (interpolated.face.length>0){
      var box=interpolated.face[0].box;
      if (box[0]<2 && box[1]<2 && box[2]<2 && box[3]<2 ) {
        faces=0;
      }
    }     

    if (faces!=interpolated_prev) {    
      AgoraProctorUtilEvents.emit(AgoraProctorUtils.FaceDetected,faces);
      interpolated_prev=faces;
    }
    await human.draw.canvas(dom.video, dom.canvas); // clear
    await human.draw.all(dom.canvas, interpolated,drawOptions );
    var ctx = dom.canvas.getContext('2d');
    ctx.font = '16px serif';
    if (dom.similarity) {
      var display=dom.similarity;
      if (display>0) {
        display=display.toFixed(2);
	ctx.fillStyle = 'orange';
        ctx.fillText('MATCH '+display, 40, 26);
      }
      
    }
    //perf(interpolated.performance);
  }
  const now = human.now();
  fps.draw = 1e3 / (now - timestamp.draw);
  timestamp.draw = now;
  //status(dom.video.paused ? "paused" : `fps: ${fps.detect.toFixed(1).padStart(5, " ")} detect | ${fps.draw.toFixed(1).padStart(5, " ")} draw`);
  setTimeout(drawLoop, 30);
}

export async function human_match(compare) {
  dom.compareImg=null;
  dom.compareUrl=compare;
}


export async function human_start(canvas, video) {
  dom.canvas=canvas;
  dom.video=video;

  //if (dom.canvas || dom.video)
//	return;
  //dom.canvas.width = dom.video.videoWidth;
  //dom.canvas.height = dom.video.videoHeight;

  if (!dom.init){ 
   dom.init=true;
   await human.load();
   await human.warmup();
   await detectionLoop();
   await drawLoop();
  }
}

export function base64DecToArr(sBase64, nBlocksSize) {

  var sB64Enc = sBase64.replace(/[^A-Za-z0-9\+\/]/g, ""), nInLen = sB64Enc.length,
    nOutLen = nBlocksSize ? Math.ceil((nInLen * 3 + 1 >> 2) / nBlocksSize) * nBlocksSize : nInLen * 3 + 1 >> 2, 
    taBytes = new Uint8Array(nOutLen);
  
  for (var nMod3, nMod4, nUint24 = 0, nOutIdx = 0, nInIdx = 0; nInIdx < nInLen; nInIdx++) {
    nMod4 = nInIdx & 3;
    nUint24 |= b64ToUint6(sB64Enc.charCodeAt(nInIdx)) << 18 - 6 * nMod4;
    if (nMod4 === 3 || nInLen - nInIdx === 1) {
      for (nMod3 = 0; nMod3 < 3 && nOutIdx < nOutLen; nMod3++, nOutIdx++) {
        taBytes[nOutIdx] = nUint24 >>> (16 >>> nMod3 & 24) & 255;
      }
      nUint24 = 0;
    }
  }
  return taBytes;
}

function b64ToUint6 (nChr) {
  // convert base64 encoded character to 6-bit integer
  // from: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Base64_encoding_and_decoding
  return nChr > 64 && nChr < 91 ? nChr - 65
    : nChr > 96 && nChr < 123 ? nChr - 71
    : nChr > 47 && nChr < 58 ? nChr + 4
    : nChr === 43 ? 62 : nChr === 47 ? 63 : 0;
}
