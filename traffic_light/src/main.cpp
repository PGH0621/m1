#include <Arduino.h>
#include <TaskScheduler.h>
#include <PinChangeInterrupt.h>

// -------------------------
// 핀 설정
// -------------------------
#define LED_RED       11  
#define LED_YELLOW    10  
#define LED_GREEN     9

#define BUTTON_EMERGENCY  7  
#define BUTTON_BLINK      6  
#define BUTTON_OFF        5  

#define POTENTIOMETER A0  

// -------------------------
// 신호등 상태 및 모드 설정
// -------------------------
enum LEDState {
  OFF, RED, YELLOW, GREEN, TOGGLE
};
volatile LEDState currentLEDState = OFF;

enum TrafficState {
  RED_BLINK, YELLOW1_BLINK, GREEN_BLINK, GREEN_FLICKER, YELLOW2_BLINK
};
volatile TrafficState trafficState = RED_BLINK;

// -------------------------
// 시간 설정 (밀리초)
// -------------------------
volatile unsigned int TIME_RED = 2000;
volatile unsigned int TIME_YELLOW = 500;
volatile unsigned int TIME_GREEN = 2000;

volatile unsigned int TIME_FLICKER = 1000 / 7;  
volatile unsigned int TIME_BLINK = 500; // 깜빡 모드 토글 간격

// -------------------------
// 모드 플래그
// -------------------------
volatile bool emergencyMode = false;
volatile bool blinkMode = false;
volatile bool offMode = false;
volatile unsigned long lastInterruptTime = 0;

// -------------------------
// 함수 선언 (오류 방지용)
// -------------------------
void updateTrafficLights();
void blinkLEDs();
void onEmergencyButtonPress();
void onBlinkButtonPress();
void onOffButtonPress();

// -------------------------
// TaskScheduler 설정
// -------------------------
Scheduler taskManager;
Task taskTrafficUpdate(10, TASK_FOREVER, updateTrafficLights);
Task blinkTask(TIME_BLINK, TASK_FOREVER, blinkLEDs);

// -------------------------
// LED 제어 함수
// -------------------------
void setLED(int red, int yellow, int green) {
  analogWrite(LED_RED, red);
  analogWrite(LED_YELLOW, yellow);
  analogWrite(LED_GREEN, green);
}

// 깜빡 모드 제어 함수
void blinkLEDs() {
  int potVal = analogRead(POTENTIOMETER);
  int brightness = map(potVal, 0, 1023, 0, 255);
  static bool toggleState = false;
  toggleState = !toggleState;
  setLED(toggleState ? brightness: 0, toggleState ? brightness: 0, toggleState ? brightness: 0);
}

// LED 상태 업데이트
void updateLEDState() {
  switch (currentLEDState) {
    case RED:
      Serial.println("r");
      setLED(255, 0, 0);
      break;
    case YELLOW:
      Serial.println("y");

      setLED(0, 255, 0);
      break;
    case GREEN:
      Serial.println("g");

      setLED(0, 0, 255);
      break;
    case TOGGLE:
      Serial.println("HH");
      blinkTask.enable();  // 깜빡 모드 실행
      break;
    case OFF:
    default:
      setLED(0, 0, 0);
      break;
  }
}

// -------------------------
// 신호등 상태 업데이트 함수
// -------------------------
void updateTrafficLights() {
  if (emergencyMode) {
    currentLEDState = RED;
    return;
  }
  if (blinkMode) {
    currentLEDState = TOGGLE;
    return;
  }
  if (offMode) {
    currentLEDState = OFF;
    return;
  }

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

// -------------------------
// 인터럽트 콜백 함수
// -------------------------
void handleButtonPress(int buttonPin, volatile bool *modeFlag, LEDState ledState) {
  unsigned long now = millis();
  if (now - lastInterruptTime < 200) return; // 디바운싱

  if (digitalRead(buttonPin) == LOW) {
    *modeFlag = !(*modeFlag); // 모드 토글

    if (*modeFlag) {  
      // 모드가 활성화될 때, 다른 모드는 비활성화
      emergencyMode = (buttonPin == BUTTON_EMERGENCY);
      blinkMode = (buttonPin == BUTTON_BLINK);
      offMode = (buttonPin == BUTTON_OFF);

      if (emergencyMode) {
        Serial.println("MODE: emergency");
        currentLEDState = RED;  // 🚨 긴급 모드: 빨간불만 ON
        blinkTask.disable();    // 깜빡임 비활성화
      } 
      else if (blinkMode) {
        Serial.println("MODE: blink");
        blinkTask.enable();  // 🔄 깜빡 모드 실행
      } 
      else if (offMode) {
        Serial.println("MODE: ON/OFF");
        currentLEDState = OFF;  // 모든 LED 끄기
        blinkTask.disable();    // 깜빡임 비활성화
      }
    } 
    else {
      // 모든 모드를 해제하면 신호등 기본 상태로 복귀귀
      Serial.println("MODE: normal");
      emergencyMode = blinkMode = offMode = false;
      blinkTask.disable();  // 깜빡임 비활성화
      trafficState = RED_BLINK;  // 기본 신호등 상태로 돌아감
    }
  }

  lastInterruptTime = now;
}

// -------------------------
// 버튼 이벤트 핸들러
// -------------------------
void onEmergencyButtonPress() { handleButtonPress(BUTTON_EMERGENCY, &emergencyMode, RED); }
void onBlinkButtonPress() { handleButtonPress(BUTTON_BLINK, &blinkMode, TOGGLE); }
void onOffButtonPress() { handleButtonPress(BUTTON_OFF, &offMode, OFF); }

// -------------------------
// Setup 함수
// -------------------------
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


// -------------------------
// Loop 함수
unsigned long lastSerialTime = 0;
const unsigned long serialInterval = 500; // 500ms마다 출력

void loop() {
  int potVal = analogRead(POTENTIOMETER);
  int brightness = map(potVal, 0, 1023, 0, 255);

  // 🔹 500ms마다 한 번만 시리얼 출력
  if (millis() - lastSerialTime >= serialInterval) {
    lastSerialTime = millis();
    Serial.print("Brightness: ");
    Serial.println(brightness);
  }

  if (!blinkMode) {
    analogWrite(LED_RED, (currentLEDState == RED) ? brightness : 0);
    analogWrite(LED_YELLOW, (currentLEDState == YELLOW) ? brightness : 0);
    analogWrite(LED_GREEN, (currentLEDState == GREEN) ? brightness : 0);
  }

  taskManager.execute();
}
