# 🚦 아두이노 신호등 과제 2차(손 제스쳐 인식 제어)

아두이노와 TaskScheduler, 인터럽트를 이용하여 실제 교통 신호등처럼 동작하는 **스마트 신호등 시스템**입니다.  
3가지 모드를 버튼으로 제어하고, 포텐셔미터로 밝기를 조절하며, p5.js를 통한 손 포즈 인식 기능을 통해 간단한 제스쳐들로 신호등 시스템을
제어할 수 있습니다.

---

## 🎬 시연 영상
# 1차
[![YouTube](https://img.shields.io/badge/YouTube-Demo-red?logo=youtube)](https://youtu.be/AzQ1sfFF0qk?si=Ezk5KPLj35inQ05I)
# 2차
- 🔗 영상 링크: https://youtu.be/gQge7ao-T_o
---

## 🧠 주요 기능

### 🟢 1. 기본 교통신호 사이클
- 빨간불 → 노란불 → 초록불 → 초록불 깜빡임(7회) → 노란불 / 반복
- 각 상태별 시간은 시리얼 명령어로 실시간 조정 가능

### 🔴 2. 모드 전환 (버튼 인터럽트 기반)
- **Emergency 모드**: 빨간불만 켜지고 다른 기능 정지
- **Blink 모드**: 모든 LED가 주기적으로 깜빡이며, 포텐셔미터로 밝기 조절
- **Off 모드**: 모든 LED 꺼짐
- 버튼을 다시 누르면 normal 모드로 복귀


### 🔴 3. 모드 전환 (손 제스쳐 기반)
- **Emergency 모드**: 검지만 폈을 때 Emergency 모드 작동 -> 3초 동안 유지 시 normal로 변경
- **Blink 모드**: 검지, 중지만 폈을 때 Blink 모드 작동 -> 3초 동안 유지 시 normal로 변경
- **Off 모드**: 모든 손가락을 접었을 때(주먹) Off 모드 작동 -> 3초 동안 유지 시 normal로 변경
- 모든 손가락을 폈을 때 **normalr** 모드 작동

| 제스처                        | 전환 모드       | 설명               |
|-------------------------------|------------------|--------------------|
| 검지                          | Emergency 모드   | 빨간 LED ON     |
| 검지 + 중지                   | Blink 모드       | 전체 깜빡임(0.5초 주기         |
| 모든 손가락 접음 (주먹)       | OFF 모드         | 전체 꺼짐               |
| 모든 손가락 펴짐              | Normal 모드      | 기본 사이클     |


### 🌈 4. 밝기 조절
- 포텐셔미터를 통해 모든 LED 밝기를 실시간 조절

### 🔗 5. 시리얼 통신 연동
- 시리얼 입력 `"TRAFFIC_LIGHT:2000:500:3000"` 형식으로 시간 설정 가능
- `"LED_STATE"`, `"MODE"`, `"BRIGHTNESS"` 상태를 실시간으로 외부에 출력
- 시각화 도구(p5.js 등)와 연동 시 유용함

### ✋ 6. 손 제스처 제어 기능 
카메라에 손을 인식시켜 제스처 기반 신호등 제어가 가능하며, 손가락의 펴짐 상태에 따라 시간 조정이 이루어
| 제스처                                 | 조절 대상         | 동작   |
|----------------------------------------|--------------------|--------|
| 검지 + 중지 + 약지                     | 빨간불 시간         | ⬆️ 증가 |
| 엄지 + 검지 + 중지                     | 빨간불 시간         | ⬇️ 감소 |
| 검지 + 중지 + 새끼                     | 노란불 시간         | ⬆️ 증가 |
| 검지 + 새끼 + 엄지                     | 노란불 시간         | ⬇️ 감소 |
| 검지 + 중지 + 약지 + 새끼 (손가락 4개) | 초록불 시간         | ⬆️ 증가 |
| 엄지 + 새끼                            | 초록불 시간         | ⬇️ 감소 |

---

## 🖼️ 회로도

### 아두이노 회로 설계도  
![image](https://github.com/user-attachments/assets/82f62e09-cc88-4617-a92c-f9ac9382a212)

### 실제 아두이노 구현 사진  
![image](https://github.com/user-attachments/assets/5aef0afe-b640-42c7-abcd-090817a4bf32)

## 🔌 아두이노 핀 연결 표

| 부품             | 핀 번호       | 설명                         |
|------------------|---------------|------------------------------|
| 빨간 LED (Red)   | D11 (PWM)     | 신호등 – 빨간불              |
| 노란 LED (Yellow)| D10 (PWM)     | 신호등 – 노란불              |
| 초록 LED (Green) | D9  (PWM)     | 신호등 – 초록불              |
| Emergency 버튼   | D7            | 비상모드 버튼 (긴급 정지)    |
| Blink 버튼       | D6            | 전체 깜빡이 모드 버튼         |
| Off 버튼         | D5            | 전체 소등 모드 버튼          |
| 포텐셔미터       | A0 (Analog)   | 밝기 조절 (PWM 밝기 입력)   |
---

## 📦 사용한 부품
- Arduino Uno (또는 호환 보드)
- LED 3개 (빨강, 노랑, 초록)
- 저항 220Ω x 3
- 버튼 스위치 3개
- 포텐셔미터 (가변저항) 1개
- 점퍼선, 브레드보드


