let port;
let isPortOpen = false;
let receivedBuffer = ""; // 버퍼를 사용해 데이터 밀림 방지

let mode = "NORMAL";
let brightness = 255;
let redTime = 2000, yellowTime = 500, greenTime = 2000;
let currentColor = "off";
let currentColor2 = "off";
let currentColor3 = "off";

let redSlider, yellowSlider, greenSlider;

function setup() {
  createCanvas(800, 600);
  background(240);

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

  // 🔹 시리얼 데이터 수신 처리
  readSerialData();

  drawIndicators();
  drawColorCircle();
  drawBrightnessGauge();
  drawSliders();
}

// 🔹 시리얼 데이터 읽기 (버퍼를 활용하여 데이터 밀림 방지)
function readSerialData() {
  if (isPortOpen && port.available()) {
    let incomingData = port.read();
    if (incomingData) {
      receivedBuffer += incomingData; // 🔹 데이터를 버퍼에 추가

      // **완전한 줄이 들어왔을 때만 처리**
      let lines = receivedBuffer.split("\n");
      while (lines.length > 1) { // 완전한 줄이 있을 경우
        let line = lines.shift().trim(); // 첫 번째 줄을 가져와 처리
        processSerialData(line);
      }
      receivedBuffer = lines.join("\n"); // 처리되지 않은 데이터는 다시 버퍼에 저장
    }
  }
}

// 🔹 개별 시리얼 데이터 처리 함수
function processSerialData(data) {
  if (data.startsWith("MODE:")) {
    mode = data.substring(5);
    console.log("📡 Mode changed to:", mode);
  } else if (data.startsWith("BRIGHTNESS:")) {
    let brightVal = parseInt(data.substring(11)); // 🔹 `int()` 대신 `parseInt()` 사용
    if (!isNaN(brightVal)) {
      brightness = brightVal; // 🔹 실시간 업데이트
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

// 🔹 UI 요소 업데이트
function drawIndicators() {
  fill(255);
  noStroke();
  rect(50, 280, 200, 40);
  fill(0);
  textSize(20);
  text("Mode: " + mode, 150, 300);
}

// 🔹 밝기 조절 게이지 (실시간 반영)
function drawBrightnessGauge() {
  fill(200);
  rect(50, 200, 300, 30,10);

  let gaugeWidth = map(brightness, 0, 255, 0, 300);
  fill(200, 255, 180);
  rect(50, 200, gaugeWidth, 30, 10);
  
  fill(0);
  textSize(20);
  text(brightness, brightness+70, 180);
}

// 🔹 신호등 색깔 변경
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
