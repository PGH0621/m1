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
    // 모든 LED를 토글 상태에 따라 켜거나 끔
    setLED(toggleState ? brightness : 0, toggleState ? brightness : 0, toggleState ? brightness : 0);

    // 현재 상태를 시리얼 출력
    Serial.print("LED_STATE:");
    Serial.print("R");
    Serial.print(toggleState ? "1" : "0");
    Serial.print(":Y");
    Serial.print(toggleState ? "1" : "0");
    Serial.print(":G");
    Serial.println(toggleState ? "1" : "0");
    Serial.print("BRIGHTNESS:");
    Serial.println(brightness);
  }
}

// 시리얼로 전달된 명령어 처리 함수
void processSerialData(String data) {
  if (data.startsWith("TRAFFIC_LIGHT:")) {
    int firstColon = data.indexOf(':');
    int secondColon = data.indexOf(':', firstColon + 1);
    int thirdColon = data.indexOf(':', secondColon + 1);

    if (firstColon != -1 && secondColon != -1 && thirdColon != -1) {
      // 시리얼 명령어에서 시간값 추출
      TIME_RED = data.substring(firstColon + 1, secondColon).toInt();
      TIME_YELLOW = data.substring(secondColon + 1, thirdColon).toInt();
      TIME_GREEN = data.substring(thirdColon + 1).toInt();
    }
  }
}

// 신호등 상태에 따른 LED 제어 로직
void updateTrafficLights() {
  if (emergencyMode || blinkMode || offMode) return;  // 특수 모드일 경우 무시

  unsigned long now = millis();
  static unsigned long stateStartTime = millis();     // 상태 시작 시간 저장
  static int flickerCount = 0;                        // 초록불 깜빡임 횟수 카운터

  switch (trafficState) {  //기본 사이클 구조
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

// 버튼 인터럽트 처리 및 모드 전환 함수
void handleButtonPress(int buttonPin, volatile bool *modeFlag, LEDState ledState) {
  unsigned long now = millis();
  if (now - lastInterruptTime < 200) return; // 디바운싱 처리 (200ms 이내 무시)

  if (digitalRead(buttonPin) == LOW) {
    *modeFlag = !(*modeFlag); // 플래그 상태 토글

    if (*modeFlag) {  // 모드 진입
      emergencyMode = (buttonPin == BUTTON_EMERGENCY);
      blinkMode = (buttonPin == BUTTON_BLINK);
      offMode = (buttonPin == BUTTON_OFF);

      if (emergencyMode) {
        Serial.println("MODE: emergency");
        currentLEDState = RED;
        blinkTask.disable();
      } 
      else if (blinkMode) {
        Serial.println("MODE: blink");
        blinkTask.enable();
      } 
      else if (offMode) {
        Serial.println("MODE: OFF");
        currentLEDState = OFF;
        blinkTask.disable();
      }
    } 
    else { // 일반 모드 복귀
      Serial.println("MODE: normal");
      emergencyMode = blinkMode = offMode = false;
      blinkTask.disable();
      trafficState = RED_BLINK;
    }
  }

  lastInterruptTime = now; // 마지막 인터럽트 시간 업데이트
}

// 버튼별 인터럽트 콜백 등록
void onEmergencyButtonPress() { handleButtonPress(BUTTON_EMERGENCY, &emergencyMode, RED); }
void onBlinkButtonPress() { handleButtonPress(BUTTON_BLINK, &blinkMode, TOGGLE); }
void onOffButtonPress() { handleButtonPress(BUTTON_OFF, &offMode, OFF); }

// 설정 초기화 함수
void setup() {
  Serial.begin(9600);                            // 시리얼 통신 시작

  // LED 핀 출력 설정
  pinMode(LED_RED, OUTPUT);
  pinMode(LED_YELLOW, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);

  // 버튼 핀 입력 풀업 설정
  pinMode(BUTTON_EMERGENCY, INPUT_PULLUP);
  pinMode(BUTTON_BLINK, INPUT_PULLUP);
  pinMode(BUTTON_OFF, INPUT_PULLUP);

  // 버튼 인터럽트 핸들러 연결
  attachPCINT(digitalPinToPCINT(BUTTON_EMERGENCY), onEmergencyButtonPress, CHANGE);
  attachPCINT(digitalPinToPCINT(BUTTON_BLINK), onBlinkButtonPress, CHANGE);
  attachPCINT(digitalPinToPCINT(BUTTON_OFF), onOffButtonPress, CHANGE);

  // TaskScheduler 초기화 및 작업 추가
  taskManager.init();
  taskManager.addTask(taskTrafficUpdate);
  taskManager.addTask(blinkTask);
  taskTrafficUpdate.enable();
}

unsigned long lastSerialTime = 0;                  // 마지막 시리얼 출력 시간 저장 변수
const unsigned long serialInterval = 100;          // 시리얼 출력 간격 (100ms)

// 메인 루프 함수
void loop() {
  int potVal = analogRead(POTENTIOMETER);          // 포텐셔미터 값 읽기
  int brightness = map(potVal, 0, 1023, 0, 255);    // 밝기 값으로 변환

  if (Serial.available()) {
    String receivedData = Serial.readStringUntil('\n');  // 시리얼 데이터 읽기
    processSerialData(receivedData);                      // 데이터 처리
  }

  if (!blinkMode) { // 깜빡 모드가 아닐 때만 수동 LED 점등
    analogWrite(LED_RED, (currentLEDState == RED) ? brightness : 0);
    analogWrite(LED_YELLOW, (currentLEDState == YELLOW) ? brightness : 0);
    analogWrite(LED_GREEN, (currentLEDState == GREEN) ? brightness : 0);

    if (millis() - lastSerialTime >= serialInterval) {
      lastSerialTime = millis();

      // 현재 LED 상태 및 밝기를 시리얼 출력
      Serial.print("LED_STATE:");
      Serial.print("R");
      Serial.print((currentLEDState == RED) ? "1" : "0");
      Serial.print(":Y");
      Serial.print((currentLEDState == YELLOW) ? "1" : "0");
      Serial.print(":G");
      Serial.println((currentLEDState == GREEN) ? "1" : "0");
      Serial.print("BRIGHTNESS:");
      Serial.println(brightness);
    }
  }

  taskManager.execute();  // TaskScheduler 실행
}