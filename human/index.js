import { Human } from "./assets/human.esm.js";

var humanConfig = {
  modelBasePath: "./assets/models",
  filter: { equalization: false },
  face: {
    enabled: true,
    //detector: { rotation: true, return: true, cropFactor: 1.6, mask: false }, // return tensor is used to get detected face image
    detector: { rotation: false}, // return tensor is used to get detected face image
    description: { enabled: false },
    iris: { enabled: true }, // needed to determine gaze direction
    emotion: { enabled: false }, // not needed
    antispoof: { enabled: false }, // enable optional antispoof module
    liveness: { enabled: false }, // enable optional liveness module
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  gesture: { enabled: true }, // parses face and iris gestures//options
};

var human = new Human(humanConfig);

human.env["perfadd"] = false;
human.draw.options.font = 'small-caps 18px "Lato"';
human.draw.options.lineHeight = 20;

var dom = {
  video: document.getElementById("video"),
  canvas: document.getElementById("canvas"),
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

async function webCam() {
  status("starting webcam...");
  const options = { audio: false, video: { facingMode: "user", resizeMode: "none", width: { ideal: document.body.clientWidth } } };
  const stream = await navigator.mediaDevices.getUserMedia(options);
  const ready = new Promise((resolve) => {
    dom.video.onloadeddata = () => resolve(true);
  });
  dom.video.srcObject = stream;
  dom.video.play();
  await ready;
  dom.canvas.width = dom.video.videoWidth;
  dom.canvas.height = dom.video.videoHeight;
  const track = stream.getVideoTracks()[0];
  const capabilities = track.getCapabilities ? track.getCapabilities() : "";
  const settings = track.getSettings ? track.getSettings() : "";
  const constraints = track.getConstraints ? track.getConstraints() : "";
  log("video:", dom.video.videoWidth, dom.video.videoHeight, track.label, { stream, track, settings, constraints, capabilities });
  dom.canvas.onclick = () => {
    if (dom.video.paused)
      dom.video.play();
    else
      dom.video.pause();
  };
}

async function detectionLoop() {
  if (!dom.video.paused) {
    await human.detect(dom.video);

   	human.detect(dom.video).then((res) => {
	   console.log(res);
       });

    const tensors = human.tf.memory().numTensors;
    if (tensors - timestamp.tensors !== 0)
      log("iallocated tensors:", tensors - timestamp.tensors);
    timestamp.tensors = tensors;
  }
  const now = human.now();
  fps.detect = 1e3 / (now - timestamp.detect);
  timestamp.detect = now;
  requestAnimationFrame(detectionLoop);
}

async function drawLoop() {
  if (!dom.video.paused) {
    const interpolated = await human.next(human.result);
    await human.draw.canvas(dom.video, dom.canvas);
    await human.draw.all(dom.canvas, interpolated);
    perf(interpolated.performance);
  }
  const now = human.now();
  fps.draw = 1e3 / (now - timestamp.draw);
  timestamp.draw = now;
  status(dom.video.paused ? "paused" : `fps: ${fps.detect.toFixed(1).padStart(5, " ")} detect | ${fps.draw.toFixed(1).padStart(5, " ")} draw`);
  setTimeout(drawLoop, 30);
}

async function main() {
  await human.load();
  await human.warmup();
  await webCam();
  await detectionLoop();
  await drawLoop();
}

window.onload = main;
