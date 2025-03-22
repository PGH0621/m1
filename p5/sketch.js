let port;                                       // 시리얼 포트 객체
let isPortOpen = false;                        // 시리얼 포트 연결 여부 플래그
let receivedBuffer = "";                       // 수신된 데이터 버퍼

let mode = "NORMAL";                           // 현재 모드 상태 (NORMAL, blink, emergency 등)
let brightness = 255;                           // LED 밝기
let redTime = 2000, yellowTime = 500, greenTime = 2000; // 각 신호등 지속 시간(ms)
let currentColor = "off";                      // 현재 빨간불 상태 문자열
let currentColor2 = "off";                     // 현재 노란불 상태 문자열
let currentColor3 = "off";                     // 현재 초록불 상태 문자열

let redSlider, yellowSlider, greenSlider;       // 각 신호등 시간 설정용 슬라이더

function setup() {
  createCanvas(800, 600);                        // 캔버스 생성
  background(240);                               // 배경색 설정

  port = createSerial();                         // 시리얼 객체 생성
  let usedPorts = usedSerialPorts();             // 사용 가능한 시리얼 포트 목록

  if (usedPorts.length > 0) {
    port.open(usedPorts[0], 9600);               // 첫 번째 포트 열기 (9600bps)
    console.log("🔗 Connected to:", usedPorts[0]);
    isPortOpen = true;                           // 포트 연결 상태 설정
  } else {
    console.log("❌ No available serial ports.");
  }

  redSlider = createSlider(500, 5000, redTime, 500);     // 빨간불 슬라이더 생성
  redSlider.position(50, 350);
  redSlider.input(updateRedTime);               // 슬라이더 입력 시 함수 호출

  yellowSlider = createSlider(500, 5000, yellowTime, 500); // 노란불 슬라이더
  yellowSlider.position(50, 380);
  yellowSlider.input(updateYellowTime);

  greenSlider = createSlider(500, 5000, greenTime, 500);   // 초록불 슬라이더
  greenSlider.position(50, 410);
  greenSlider.input(updateGreenTime);

  frameRate(30);                                 // 프레임레이트 설정 (30fps)
}

function draw() {
  background(240);                               // 매 프레임 배경 리셋
  readSerialData();                              // 시리얼 데이터 수신 처리
  drawIndicators();                              // 모드 텍스트 출력
  drawColorCircle();                             // 신호등 원 출력
  drawBrightnessGauge();                         // 밝기 게이지 출력
  drawSliders();                                 // 슬라이더 텍스트 출력
}

function readSerialData() {
  if (isPortOpen && port.available()) {          // 포트 열려 있고 수신 데이터 있을 경우
    let incomingData = port.read();              // 한 글자씩 읽기
    if (incomingData) {
      receivedBuffer += incomingData;            // 버퍼에 추가
      let lines = receivedBuffer.split("\n");     // 개행 기준으로 분리
      while (lines.length > 1) {                 // 완성된 줄이 있을 경우
        let line = lines.shift().trim();         // 앞줄 꺼내서 처리
        processSerialData(line);
      }
      receivedBuffer = lines.join("\n");         // 남은 데이터는 버퍼에 다시 저장
    }
  }
}

function processSerialData(data) {
  if (data.startsWith("MODE:")) {                // 모드 변경 정보 수신 시
    mode = data.substring(5);
    console.log("📡 Mode changed to:", mode);
  } else if (data.startsWith("BRIGHTNESS:")) {   // 밝기 값 수신 시
    let brightVal = parseInt(data.substring(11));
    if (!isNaN(brightVal)) {
      brightness = brightVal;
    }
  } else if (data.startsWith("LED_STATE:")) {    // LED 상태 수신 시
    let parts = data.split(":");
    if (parts.length >= 4) {
      currentColor = parts[1];                   // 빨간불
      currentColor2 = parts[2];                  // 노란불
      currentColor3 = parts[3];                  // 초록불
      console.log("LED State Updated:", currentColor, currentColor2, currentColor3);
    }
  }

  console.log("Brightness:", brightness);        // 현재 밝기 출력
}

function drawIndicators() {
  fill(255);
  noStroke();
  rect(50, 280, 200, 40);                         // 흰색 배경 박스
  fill(0);
  textSize(20);
  text("Mode: " + mode, 150, 300);               // 현재 모드 출력
}

function drawBrightnessGauge() {
  fill(200);
  rect(50, 200, 300, 30,10);                      // 게이지 배경
  let gaugeWidth = map(brightness, 0, 255, 0, 300);
  fill(200, 255, 180);
  rect(50, 200, gaugeWidth, 30, 10);              // 현재 밝기 길이 반영
  fill(0);
  textSize(20);
  text(brightness, brightness+70, 180);          // 숫자 출력
}

function drawColorCircle() {
  if (currentColor === "R1") fill("red");        // 빨간불 on
  else fill(200);
  circle(100, 100, 80);

  if (currentColor2 === "Y1") fill("yellow");    // 노란불 on
  else fill(200);
  circle(250, 100, 80);

  if (currentColor3 === "G1") fill("green");     // 초록불 on
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
  text("Red Time: " + redTime + " ms", 100, 345);     // 빨간불 시간 표시
  text("Yellow Time: " + yellowTime + " ms", 100, 375); // 노란불 시간 표시
  text("Green Time: " + greenTime + " ms", 100, 405);   // 초록불 시간 표시
}

function updateRedTime() {
  redTime = redSlider.value();                    // 슬라이더 값 갱신
  sendTrafficLightSettings();                     // 아두이노로 전송
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
    let message = `TRAFFIC_LIGHT:${redTime}:${yellowTime}:${greenTime}`; // 포맷 정의
    port.write(message);                         // 시리얼 전송
    console.log(message);                        // 디버그 출력
  }
}
