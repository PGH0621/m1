#include <Arduino.h>                     // 아두이노 기본 라이브러리 포함
#include <TaskScheduler.h>              // Task 스케줄링을 위한 라이브러리 포함
#include <PinChangeInterrupt.h>         // 핀 체인지 인터럽트를 위한 라이브러리 포함

// LED 핀 정의
#define LED_RED       11                // 빨간 LED 핀
#define LED_YELLOW    10                // 노란 LED 핀
#define LED_GREEN     9                 // 초록 LED 핀

// 버튼 핀 정의
#define BUTTON_EMERGENCY  7             // emergency 모드 버튼
#define BUTTON_BLINK      6             // blink 모드 버튼
#define BUTTON_OFF        5             // off 모드 버튼

// 포텐셔미터 아날로그 핀
#define POTENTIOMETER A0                // 밝기 조절용 가변저항 핀

// LED 상태 정의 열거형
enum LEDState {
  OFF, RED, YELLOW, GREEN, TOGGLE
};
volatile LEDState currentLEDState = OFF;  // 현재 점등된 LED 상태

// 신호등 상태 정의 열거형
enum TrafficState {
  RED_BLINK, YELLOW1_BLINK, GREEN_BLINK, GREEN_FLICKER, YELLOW2_BLINK
};
volatile TrafficState trafficState = RED_BLINK;  // 현재 신호등 상태

// 신호 시간 설정값 (밀리초 단위)
int TIME_RED = 2000;                              // 빨간불 지속 시간
int TIME_YELLOW = 500;                            // 노란불 지속 시간
int TIME_GREEN = 2000;                            // 초록불 지속 시간
const unsigned int TIME_FLICKER = 1000 / 7;       // 초록불 깜빡이는 시간 간격 (7Hz)
const unsigned int TIME_BLINK = 500;              // 깜빡 모드 LED 토글 시간 간격

// 모드 플래그 변수들
volatile bool emergencyMode = false;              // emergency 모드 상태
volatile bool blinkMode = false;                  // blink 모드 상태
volatile bool offMode = false;                    // iff 모드 상태
volatile unsigned long lastInterruptTime = 0;     // 버튼 인터럽트 디바운싱 처리용 변수

// 함수 프로토타입 선언
void updateTrafficLights();
void blinkLEDs();
void onEmergencyButtonPress();
void onBlinkButtonPress();
void onOffButtonPress();
void applyModeFromSerial(const String& modeStr);

// TaskScheduler를 이용한 작업 관리
Scheduler taskManager;                            // 작업 스케줄러 객체 생성
Task taskTrafficUpdate(10, TASK_FOREVER, updateTrafficLights); // 신호등 상태 업데이트 작업
Task blinkTask(TIME_BLINK, TASK_FOREVER, blinkLEDs);           // LED 깜빡임 작업

// LED에 밝기를 적용하여 점등하는 함수
void setLED(int red, int yellow, int green) {
  analogWrite(LED_RED, red);                      // 빨간 LED 밝기 설정
  analogWrite(LED_YELLOW, yellow);                // 노란 LED 밝기 설정
  analogWrite(LED_GREEN, green);                  // 초록 LED 밝기 설정
}

// 깜빡 모드 동작 함수 (모든 LED가 주기적으로 깜빡임)
void blinkLEDs() {
  int potVal = analogRead(POTENTIOMETER);         // 가변저항 값을 읽어옴
  int brightness = map(potVal, 0, 1023, 0, 255);   // 아날로그 값을 PWM 밝기로 변환
  static bool toggleState = false;                // blink 상태 토글 플래그
  toggleState = !toggleState;                     // 상태 반전

  if (blinkMode) {
    setLED(toggleState ? brightness : 0, toggleState ? brightness : 0, toggleState ? brightness : 0);
    Serial.print("LED_STATE:");
    Serial.print("R"); Serial.print(toggleState ? "1" : "0");
    Serial.print(":Y"); Serial.print(toggleState ? "1" : "0");
    Serial.print(":G"); Serial.println(toggleState ? "1" : "0");
    Serial.print("BRIGHTNESS:"); Serial.println(brightness);
  }
}

// 시리얼로 전달된 명령어 처리 함수
void processSerialData(String data) {
  if (data.startsWith("TRAFFIC_LIGHT:")) {
    int firstColon = data.indexOf(':');
    int secondColon = data.indexOf(':', firstColon + 1);
    int thirdColon = data.indexOf(':', secondColon + 1);
    if (firstColon != -1 && secondColon != -1 && thirdColon != -1) {
      TIME_RED = data.substring(firstColon + 1, secondColon).toInt();
      TIME_YELLOW = data.substring(secondColon + 1, thirdColon).toInt();
      TIME_GREEN = data.substring(thirdColon + 1).toInt();
    }
  } else if (data.startsWith("MODE:")) {
    String modeStr = data.substring(5);
    applyModeFromSerial(modeStr);
  }
}

// 시리얼로 전달된 MODE 값을 처리하여 동작 적용


// 신호등 상태에 따른 LED 제어 로직
void updateTrafficLights() {
  if (emergencyMode || blinkMode || offMode) return;

  unsigned long now = millis();
  static unsigned long stateStartTime = millis();
  static int flickerCount = 0;

  switch (trafficState) {
    case RED_BLINK:
      currentLEDState = RED;
      if (now - stateStartTime >= TIME_RED) {
        stateStartTime = now;
        trafficState = YELLOW1_BLINK;
      }
      break;

    case YELLOW1_BLINK:
      currentLEDState = YELLOW;
      if (now - stateStartTime >= TIME_YELLOW) {
        stateStartTime = now;
        trafficState = GREEN_BLINK;
      }
      break;

    case GREEN_BLINK:
      currentLEDState = GREEN;
      if (now - stateStartTime >= TIME_GREEN) {
        stateStartTime = now;
        trafficState = GREEN_FLICKER;
        flickerCount = 0;
      }
      break;

    case GREEN_FLICKER:
      currentLEDState = (flickerCount % 2 == 0) ? GREEN : OFF;
      if (now - stateStartTime >= TIME_FLICKER) {
        stateStartTime = now;
        flickerCount++;
        if (flickerCount >= 7) {
          trafficState = YELLOW2_BLINK;
        }
      }
      break;

    case YELLOW2_BLINK:
      currentLEDState = YELLOW;
      if (now - stateStartTime >= TIME_YELLOW) {
        stateStartTime = now;
        trafficState = RED_BLINK;
      }
      break;
  }
}

void handleButtonPress(int buttonPin, volatile bool *modeFlag, LEDState ledState) {
  unsigned long now = millis();
  if (now - lastInterruptTime < 200) return;

  if (digitalRead(buttonPin) == LOW || true) { // true 추가로 시리얼 명령도 적용되게
    *modeFlag = !(*modeFlag);

    if (*modeFlag) {
      emergencyMode = (buttonPin == BUTTON_EMERGENCY);
      blinkMode = (buttonPin == BUTTON_BLINK);
      offMode = (buttonPin == BUTTON_OFF);

      if (emergencyMode) {
        Serial.println("MODE: emergency");
        currentLEDState = RED;
        blinkTask.disable();
      } else if (blinkMode) {
        Serial.println("MODE: blink");
        blinkTask.enable();
      } else if (offMode) {
        Serial.println("MODE: OFF");
        currentLEDState = OFF;
        blinkTask.disable();
      }
    } else {
      Serial.println("MODE: normal");
      emergencyMode = blinkMode = offMode = false;
      blinkTask.disable();
      trafficState = RED_BLINK;
    }
  }

  lastInterruptTime = now;
}
void applyModeFromSerial(const String& modeStr) { // p5.js에서 특수모드에 대한 값 받아서 적용
  if (modeStr == "emergency") {
    handleButtonPress(BUTTON_EMERGENCY, &emergencyMode, RED);
  } else if (modeStr == "blink") {
    handleButtonPress(BUTTON_BLINK, &blinkMode, TOGGLE);
  } else if (modeStr == "OFF") {
    handleButtonPress(BUTTON_OFF, &offMode, OFF);
  } else if (modeStr == "normal") {
    emergencyMode = blinkMode = offMode = false;
    blinkTask.disable();
    trafficState = RED_BLINK;
    Serial.println("MODE: normal");
  }
}
void onEmergencyButtonPress() { handleButtonPress(BUTTON_EMERGENCY, &emergencyMode, RED); }
void onBlinkButtonPress() { handleButtonPress(BUTTON_BLINK, &blinkMode, TOGGLE); }
void onOffButtonPress() { handleButtonPress(BUTTON_OFF, &offMode, OFF); }

void setup() {
  Serial.begin(9600);

  pinMode(LED_RED, OUTPUT);
  pinMode(LED_YELLOW, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);

  pinMode(BUTTON_EMERGENCY, INPUT_PULLUP);
  pinMode(BUTTON_BLINK, INPUT_PULLUP);
  pinMode(BUTTON_OFF, INPUT_PULLUP);

  attachPCINT(digitalPinToPCINT(BUTTON_EMERGENCY), onEmergencyButtonPress, CHANGE);
  attachPCINT(digitalPinToPCINT(BUTTON_BLINK), onBlinkButtonPress, CHANGE);
  attachPCINT(digitalPinToPCINT(BUTTON_OFF), onOffButtonPress, CHANGE);

  taskManager.init();
  taskManager.addTask(taskTrafficUpdate);
  taskManager.addTask(blinkTask);
  taskTrafficUpdate.enable();
}

unsigned long lastSerialTime = 0;
const unsigned long serialInterval = 100;

void loop() {
  int potVal = analogRead(POTENTIOMETER);
  int brightness = map(potVal, 0, 1023, 0, 255);

  if (Serial.available()) {
    String receivedData = Serial.readStringUntil('\n');
    processSerialData(receivedData);
  }

  if (!blinkMode) {
    analogWrite(LED_RED, (currentLEDState == RED) ? brightness : 0);
    analogWrite(LED_YELLOW, (currentLEDState == YELLOW) ? brightness : 0);
    analogWrite(LED_GREEN, (currentLEDState == GREEN) ? brightness : 0);

    if (millis() - lastSerialTime >= serialInterval) {
      lastSerialTime = millis();
      Serial.print("LED_STATE:");
      Serial.print("R"); Serial.print((currentLEDState == RED) ? "1" : "0");
      Serial.print(":Y"); Serial.print((currentLEDState == YELLOW) ? "1" : "0");
      Serial.print(":G"); Serial.println((currentLEDState == GREEN) ? "1" : "0");
      Serial.print("BRIGHTNESS:"); Serial.println(brightness);
    }
  }

  taskManager.execute();
}
