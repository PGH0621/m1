# 🚦 아두이노 신호등

아두이노와 TaskScheduler, 인터럽트를 이용하여 실제 교통 신호등처럼 동작하는 **스마트 신호등 시스템**입니다.  
3가지 모드를 버튼으로 제어하고, 포텐셔미터로 밝기를 조절하며, 시리얼 통신을 통해 외부 프로그램(p5.js 등)과 연동할 수 있습니다.

---

## 🎬 시연 영상

[![YouTube](https://img.shields.io/badge/YouTube-Demo-red?logo=youtube)](https://youtu.be/AzQ1sfFF0qk?si=Ezk5KPLj35inQ05I)

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

### 🌈 3. 밝기 조절
- 포텐셔미터를 통해 모든 LED 밝기를 실시간 조절

### 🔗 4. 시리얼 통신 연동
- 시리얼 입력 `"TRAFFIC_LIGHT:2000:500:3000"` 형식으로 시간 설정 가능
- `"LED_STATE"`, `"MODE"`, `"BRIGHTNESS"` 상태를 실시간으로 외부에 출력
- 시각화 도구(p5.js 등)와 연동 시 유용함

---

## 🖼️ 회로도

### 아두이노 회로 설계도  
![image](https://github.com/user-attachments/assets/82f62e09-cc88-4617-a92c-f9ac9382a212)

### 실제 아두이노 구현 사진  
![image](https://github.com/user-attachments/assets/5aef0afe-b640-42c7-abcd-090817a4bf32)

---

## 📦 사용한 부품
- Arduino Uno (또는 호환 보드)
- LED 3개 (빨강, 노랑, 초록)
- 저항 220Ω x 3
- 버튼 스위치 3개
- 포텐셔미터 (가변저항) 1개
- 점퍼선, 브레드보드

---

## 🔧 시리얼 명령어 형식

```bash
TRAFFIC_LIGHT:2000:500:3000
