let port;
let isPortOpen = false;
let receivedBuffer = "";

let mode = "normal";
let brightness = 255;
let redTime = 2000, yellowTime = 500, greenTime = 2000;
let currentColor = "off";
let currentColor2 = "off";
let currentColor3 = "off";

let redSlider, yellowSlider, greenSlider;

let handposeModel;
let video;
let hands = [];

let currentHandMode = "NORMAL";
let lastModeSendTime = 0;
let lastSliderUpdateTime = 0;

function setup() {
  createCanvas(800, 600);
  background(240);

  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  handposeModel = ml5.handpose(video, () => {
    console.log("🖐️ Handpose model loaded!");
  });

  handposeModel.on("predict", results => {
    hands = results;
  });

  port = createSerial();
  let usedPorts = usedSerialPorts();

  if (usedPorts.length > 0) {
    port.open(usedPorts[0], 9600);
    console.log("🔗 Connected to:", usedPorts[0]);
    isPortOpen = true;
  } else {
    console.log("❌ No available serial ports.");
  }

  redSlider = createSlider(500, 5000, redTime, 500);
  redSlider.position(50, 350);
  redSlider.input(updateRedTime);

  yellowSlider = createSlider(500, 5000, yellowTime, 500);
  yellowSlider.position(50, 380);
  yellowSlider.input(updateYellowTime);

  greenSlider = createSlider(500, 5000, greenTime, 500);
  greenSlider.position(50, 410);
  greenSlider.input(updateGreenTime);

  frameRate(30);
}

function draw() {
  background(240);

  push();
  translate(480 + 320, 0);
  scale(-1, 1);
  image(video, 0, 0, 320, 240);
  pop();

  drawHandPoints(); //추가
  detectGestureAndSendMode(); //추가 
  drawSendTimerCircles();  //추가
  readSerialData();
  drawIndicators();
  drawColorCircle();
  drawBrightnessGauge();
  drawSliders();
}

function drawHandPoints() { // 손 인식 마커수찍어주는 함수
  for (let i = 0; i < hands.length; i++) {
    let hand = hands[i];
    for (let j = 0; j < hand.landmarks.length; j++) {
      let [x, y] = hand.landmarks[j];
      let scaledX = map(x, 0, 640, 0, 320);
      let scaledY = map(y, 0, 480, 0, 240);
      let flippedX = 480 + (320 - scaledX);
      fill(255, 255, 0);
      noStroke();
      circle(flippedX, scaledY, 5);
    }
  }
}

function detectGestureAndSendMode() { // 제스쳐에 따른 모드 변화수함수
  const now = millis();
  if (hands.length === 0 || !isPortOpen) return;

  let detectedModes = [];

  for (let i = 0; i < hands.length; i++) {
    let lm = hands[i].landmarks;

    function isFingerUp(tip, pip, margin = 15) {
      return lm[tip][1] < lm[pip][1] - margin;
    }

    let isThumbUp = isFingerUp(4, 3); //엄지
    let isIndexUp = isFingerUp(8, 6); //검지
    let isMiddleUp = isFingerUp(12, 10); //중지
    let isRingUp = isFingerUp(16, 14); //약지
    let isPinkyUp = isFingerUp(20, 18); //

    handleSliderGestures(isIndexUp, isMiddleUp, isRingUp, isPinkyUp, isThumbUp, now);

    // 모드 제스처 판단
    if (isIndexUp && !isMiddleUp && !isRingUp && isPinkyUp && !isThumbUp) {
      detectedModes.push("touch-select");
    } else if (isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp && !isThumbUp) {
      detectedModes.push("emergency");
    } else if (isIndexUp && isMiddleUp && !isRingUp && !isPinkyUp && !isThumbUp) {
      detectedModes.push("blink");
    } else if (!isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp && !isThumbUp) {
      detectedModes.push("OFF");
    } else if (isIndexUp && isMiddleUp && isRingUp && isPinkyUp && isThumbUp) {
      detectedModes.push("normal");
    }
  }

  const priority = ["touch-select", "emergency", "blink", "OFF", "normal"];
  for (let mode of priority) {
    if (detectedModes.includes(mode)) {
      if (mode !== currentHandMode || now - lastModeSendTime >= 3000) {
        port.write(`MODE:${mode}\n`);
        console.log("📡 Traffic_light:", mode);
        currentHandMode = mode;
        lastModeSendTime = now;
      }
      break;
    }
  }
}

function handleSliderGestures(isIndexUp, isMiddleUp, isRingUp, isPinkyUp, isThumbUp, now) {
  if (now - lastSliderUpdateTime < 1000) return;

  if (isIndexUp && isMiddleUp && isRingUp && !isPinkyUp && !isThumbUp) { //
    redTime = constrain(redTime + 100, 500, 5000);
    redSlider.value(redTime);
    sendTrafficLightSettings();
    lastSliderUpdateTime = now;
  } else if (isIndexUp && isMiddleUp && !isRingUp && !isPinkyUp && isThumbUp) { //빨강 시간 감소
    redTime = constrain(redTime - 100, 500, 5000);
    redSlider.value(redTime);
    sendTrafficLightSettings();
    lastSliderUpdateTime = now;
  } else if (isIndexUp && isMiddleUp && !isRingUp && isPinkyUp && !isThumbUp) { //노랑 시간 증가
    yellowTime = constrain(yellowTime + 100, 500, 5000);
    yellowSlider.value(yellowTime);
    sendTrafficLightSettings();
    lastSliderUpdateTime = now;
  } 
  else if (isIndexUp && !isMiddleUp && !isRingUp && isPinkyUp && isThumbUp) {// 노랑 시간 감소
    yellowTime = constrain(yellowTime - 100, 500, 5000);
    yellowSlider.value(yellowTime);
    sendTrafficLightSettings();
    lastSliderUpdateTime = now;
  } else if (isIndexUp && isMiddleUp && isRingUp && isPinkyUp && !isThumbUp) {//초록 시간 증가
    greenTime = constrain(greenTime + 100, 500, 5000);
    greenSlider.value(greenTime);
    sendTrafficLightSettings();
    lastSliderUpdateTime = now;
  }else if (!isIndexUp && !isMiddleUp && !isRingUp && isPinkyUp && isThumbUp) { //초록 시간 감소
    greenTime = constrain(greenTime - 100, 500, 5000);
    greenSlider.value(greenTime);
    sendTrafficLightSettings();
    lastSliderUpdateTime = now;
  } 
}

function drawSendTimerCircles() { // 3초 타이머 동그라미 함수
  const now = millis();
  const maxDelay = 3000;
  const radiusMax = 40;

  for (let i = 0; i < hands.length; i++) { // 손 바로 밑에 위치하게 함
    let lm = hands[i].landmarks;
    let x = lm[0][0];
    let y = lm[0][1];
    let scaledX = map(x, 0, 640, 0, 320);
    let scaledY = map(y, 0, 480, 0, 240);
    let flippedX = 480 + (320 - scaledX);
    let elapsed = constrain(now - lastModeSendTime, 0, maxDelay);
    let radius = map(elapsed, 0, maxDelay, 5, radiusMax);

    noStroke();
    fill(0, 255, 0);
    circle(flippedX, scaledY + 60, radius);
  }
}

function readSerialData() {
  if (isPortOpen && port.available()) {
    let incomingData = port.read();
    if (incomingData) {
      receivedBuffer += incomingData;
      let lines = receivedBuffer.split("\n");
      while (lines.length > 1) {
        let line = lines.shift().trim();
        processSerialData(line);
      }
      receivedBuffer = lines.join("\n");
    }
  }
}

function processSerialData(data) {
  if (data.startsWith("MODE:")) {
    mode = data.substring(5);
    console.log("📡 Mode changed to:", mode);
  } else if (data.startsWith("BRIGHTNESS:")) {
    let brightVal = parseInt(data.substring(11));
    if (!isNaN(brightVal)) {
      brightness = brightVal;
    }
  } else if (data.startsWith("LED_STATE:")) {
    let parts = data.split(":");
    if (parts.length >= 4) {
      currentColor = parts[1];
      currentColor2 = parts[2];
      currentColor3 = parts[3];
      console.log("LED State Updated:", currentColor, currentColor2, currentColor3);
    }
  }
  console.log("Brightness:", brightness);
}

function drawIndicators() {
  fill(255);
  noStroke();
  rect(50, 280, 200, 40);
  fill(0);
  textSize(20);
  text("Mode: " + mode, 150, 300);
}

function drawBrightnessGauge() {
  fill(200);
  rect(50, 200, 300, 30, 10);
  let gaugeWidth = map(brightness, 0, 255, 0, 300);
  fill(200, 255, 180);
  rect(50, 200, gaugeWidth, 30, 10);
  fill(0);
  textSize(20);
  text(brightness, brightness + 70, 180);
}

function drawColorCircle() {
  if (currentColor === "R1") fill("red");
  else fill(200);
  circle(100, 100, 80);

  if (currentColor2 === "Y1") fill("yellow");
  else fill(200);
  circle(250, 100, 80);

  if (currentColor3 === "G1") fill("green");
  else fill(200);
  circle(400, 100, 80);

  fill(0);
  textSize(20);
  textAlign(CENTER, CENTER);
  text("R", 100, 100);
  text("Y", 250, 100);
  text("G", 400, 100);
}

function drawSliders() {
  fill(0);
  textSize(14);
  text("Red Time: " + redTime + " ms", 100, 345);
  text("Yellow Time: " + yellowTime + " ms", 100, 375);
  text("Green Time: " + greenTime + " ms", 100, 405);
}

function updateRedTime() {
  redTime = redSlider.value();
  sendTrafficLightSettings();
}

function updateYellowTime() {
  yellowTime = yellowSlider.value();
  sendTrafficLightSettings();
}

function updateGreenTime() {
  greenTime = greenSlider.value();
  sendTrafficLightSettings();
}

function sendTrafficLightSettings() {
  if (isPortOpen) {
    let message = `TRAFFIC_LIGHT:${redTime}:${yellowTime}:${greenTime}`;
    port.write(message);
    console.log(message);
  }
}
