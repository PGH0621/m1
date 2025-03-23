// 시리얼 통신 설정 변수
let port;
let isPortOpen = false;
let receivedBuffer = "";

// 신호등 상태 관련 변수
let mode = "normal";
let brightness = 255;
let redTime = 2000, yellowTime = 500, greenTime = 2000;
let currentColor = "off";
let currentColor2 = "off";
let currentColor3 = "off";

// 슬라이더 객체들
let redSlider, yellowSlider, greenSlider;

// 손 인식 관련 변수
let handposeModel;
let video;
let hands = [];

// 현재 모드 및 타이머
let currentHandMode = "NORMAL";
let lastModeSendTime = 0;
let lastSliderUpdateTime = 0;

function setup() {
  createCanvas(800, 600);
  background(240);

  // 비디오 캡처 시작
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  // 손 포즈 모델 로딩
  handposeModel = ml5.handpose(video, () => {
    console.log("🖐️ Handpose model loaded!");
  });

  // 예측 결과 저장
  handposeModel.on("predict", results => {
    hands = results;
  });

  // 시리얼 포트 열기
  port = createSerial();
  let usedPorts = usedSerialPorts();
  if (usedPorts.length > 0) {
    port.open(usedPorts[0], 9600);
    console.log("🔗 Connected to:", usedPorts[0]);
    isPortOpen = true;
  } else {
    console.log("❌ No available serial ports.");
  }

  // 슬라이더 생성 및 이벤트 연결
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

  // 비디오 화면 출력 (좌우 반전)
  push();
  translate(800, 0);
  scale(-1, 1);
  image(video, 0, 0, 320, 240);
  pop();

  // 주요 기능들 실행
  drawHandPoints();
  detectGestureAndSendMode(); 
  drawSendTimerCircles();
  readSerialData();
  drawIndicators();
  drawColorCircle();
  drawBrightnessGauge();
  drawSliders();
}

// 손가락 위치 점 출력
function drawHandPoints() {
  for (let hand of hands) {
    for (let [x, y] of hand.landmarks) {
      let scaledX = map(x, 0, 640, 0, 320);
      let scaledY = map(y, 0, 480, 0, 240);
      let flippedX = 800 - scaledX;
      fill(255, 255, 0);
      noStroke();
      circle(flippedX, scaledY, 5);
    }
  }
}

// 손 제스처에 따라 모드 변경
function detectGestureAndSendMode() {
  const now = millis();
  if (hands.length === 0 || !isPortOpen) return;

  let detectedModes = [];

  for (let hand of hands) {
    let lm = hand.landmarks;

    function isFingerUp(tip, pip, margin = 15) {
      return lm[tip][1] < lm[pip][1] - margin;
    }

    // 각 손가락이 펴졌는지 확인
    let isThumbUp = isFingerUp(4, 3);
    let isIndexUp = isFingerUp(8, 6);
    let isMiddleUp = isFingerUp(12, 10);
    let isRingUp = isFingerUp(16, 14);
    let isPinkyUp = isFingerUp(20, 18);

    // 슬라이더 값 조정 제스처 처리
    handleSliderGestures(isIndexUp, isMiddleUp, isRingUp, isPinkyUp, isThumbUp, now);

    // 모드 제스처 인식
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

  // 우선순위에 따라 모드 전송
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

// 손 제스처로 슬라이더 값 조정
function handleSliderGestures(isIndexUp, isMiddleUp, isRingUp, isPinkyUp, isThumbUp, now) {
  if (now - lastSliderUpdateTime < 1000) return;

  // 증가 제스처
  if (isIndexUp && isMiddleUp && isRingUp && !isPinkyUp && !isThumbUp) {
    redTime = constrain(redTime + 100, 500, 5000);
    redSlider.value(redTime);
  } else if (isIndexUp && isMiddleUp && !isRingUp && isPinkyUp && !isThumbUp) {
    yellowTime = constrain(yellowTime + 100, 500, 5000);
    yellowSlider.value(yellowTime);
  } else if (isIndexUp && isMiddleUp && isRingUp && isPinkyUp && !isThumbUp) {
    greenTime = constrain(greenTime + 100, 500, 5000);
    greenSlider.value(greenTime);
  }

  // 감소 제스처
  else if (isIndexUp && isMiddleUp && !isRingUp && !isPinkyUp && isThumbUp) {
    redTime = constrain(redTime - 100, 500, 5000);
    redSlider.value(redTime);
  } else if (isIndexUp && !isMiddleUp && !isRingUp && isPinkyUp && isThumbUp) {
    yellowTime = constrain(yellowTime - 100, 500, 5000);
    yellowSlider.value(yellowTime);
  } else if (!isIndexUp && !isMiddleUp && !isRingUp && isPinkyUp && isThumbUp) {
    greenTime = constrain(greenTime - 100, 500, 5000);
    greenSlider.value(greenTime);
  }

  // 시리얼 전송 및 시간 갱신
  sendTrafficLightSettings();
  lastSliderUpdateTime = now;
}

// 모드 변경 타이머 시각화
function drawSendTimerCircles() {
  const now = millis();
  const maxDelay = 3000;
  const radiusMax = 40;

  for (let hand of hands) {
    let [x, y] = hand.landmarks[0];
    let scaledX = map(x, 0, 640, 0, 320);
    let scaledY = map(y, 0, 480, 0, 240);
    let flippedX = 800 - scaledX;
    let elapsed = constrain(now - lastModeSendTime, 0, maxDelay);
    let radius = map(elapsed, 0, maxDelay, 5, radiusMax);

    noStroke();
    fill(0, 255, 0);
    circle(flippedX, scaledY + 60, radius);
  }
}

// 시리얼 수신 처리
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

// 수신 데이터 처리
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
}

// 모드 표시
function drawIndicators() {
  fill(255);
  noStroke();
  rect(50, 280, 200, 40);
  fill(0);
  textSize(20);
  text("Mode: " + mode, 150, 300);
}

// 밝기 게이지
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

// 색상 상태 원
function drawColorCircle() {
  fill(currentColor === "R1" ? "red" : 200);
  circle(100, 100, 80);

  fill(currentColor2 === "Y1" ? "yellow" : 200);
  circle(250, 100, 80);

  fill(currentColor3 === "G1" ? "green" : 200);
  circle(400, 100, 80);

  fill(0);
  textSize(20);
  textAlign(CENTER, CENTER);
  text("R", 100, 100);
  text("Y", 250, 100);
  text("G", 400, 100);
}

// 슬라이더 값 표시
function drawSliders() {
  fill(0);
  textSize(14);
  text("Red Time: " + redTime + " ms", 100, 345);
  text("Yellow Time: " + yellowTime + " ms", 100, 375);
  text("Green Time: " + greenTime + " ms", 100, 405);
}

// 슬라이더 조작 함수
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

// 시리얼로 시간 전송
function sendTrafficLightSettings() {
  if (isPortOpen) {
    let message = `TRAFFIC_LIGHT:${redTime}:${yellowTime}:${greenTime}`;
    port.write(message);
    console.log(message);
  }
}
