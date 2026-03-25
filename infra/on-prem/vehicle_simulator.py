import os
import sys
from kafka import KafkaProducer
import json
import threading
import time
import random

# 실무 코드북 명세
# EVENT_TYPE: 1 (telemetry/주행데이터), 2 (heartbeat/생존신고)
# MODE: 1 (driving/주행중), 2 (stopped/정차중), 3 (off/시동꺼짐)

broker_ip = os.getenv('KAFKA_BROKER_IP') # Azure 브로커 VM의 공인 IP
if not broker_ip:
    print("에러: KAFKA_BROKER_IP 환경 변수가 설정되지 않았습니다.")
    sys.exit(1) # 프로그램 강제 종료

broker_port = "9094"

producer = KafkaProducer(
    bootstrap_servers=[f'{broker_ip}:{broker_port}'],
    value_serializer=lambda v: json.dumps(v).encode('utf-8')
)

LAT_MIN, LAT_MAX = 37.40, 37.70
LON_MIN, LON_MAX = 126.70, 127.20

# 차량 리스트 생성
vehicles = [
    {
        "vehicle_id": f"car_{i+1}",
        "driver_id": f"driver_{i+1}",
        "lat": round(random.uniform(LAT_MIN, LAT_MAX), 6),
        "lon": round(random.uniform(LON_MIN, LON_MAX), 6),
        "speed": 0,
        "engine_on": True,
        "fuel": round(random.uniform(30, 100), 2)
    }
    for i in range(100)
]

def clamp(value, min_value, max_value):
    return max(min_value, min(value, max_value))

def simulate_vehicle(vehicle):
    while True:
        # 15% 확률로 시동 켜짐/꺼짐 변경
        if random.random() < 0.15:
            vehicle["engine_on"] = not vehicle["engine_on"]
        
        if vehicle["fuel"] <= 0:
            vehicle["fuel"] = 0
            vehicle["engine_on"] = False

        # 상태 결정
        if vehicle["engine_on"]:
            if random.random() < 0.7:
                # 주행
                vehicle["speed"] = random.randint(30, 100)
                vehicle["fuel"] = max(0, vehicle["fuel"] - random.uniform(0.1, 0.5))
                # 위치 이동
                vehicle["lat"] += random.uniform(-0.001, 0.001) * (vehicle["speed"] / 50)
                vehicle["lon"] += random.uniform(-0.001, 0.001) * (vehicle["speed"] / 50)
                
                mode = 1          
                event_type = 1    
                interval = random.randint(1, 5)
            else:
                # 정지
                vehicle["speed"] = 0
                mode = 2          
                event_type = 1    
                interval = random.randint(5, 30)
        else:
            # 엔진 꺼짐
            vehicle["speed"] = 0
            mode = 3          
            event_type = 2    
            interval = random.randint(60, 180)

        # 위치 제한
        vehicle["lat"] = round(clamp(vehicle["lat"], LAT_MIN, LAT_MAX), 6)
        vehicle["lon"] = round(clamp(vehicle["lon"], LON_MIN, LON_MAX), 6)

        # Kafka 전송 데이터
        data = {
            "event_type": event_type, 
            "vehicle_id": vehicle["vehicle_id"],
            "driver_id": vehicle["driver_id"],
            "timestamp": int(time.time()),
            "lat": vehicle["lat"],
            "lon": vehicle["lon"],
            "speed": vehicle["speed"],
            "engine_on": vehicle["engine_on"],
            "fuel": round(vehicle["fuel"], 2),
            "mode": mode 
        }

        print(f"[{vehicle['vehicle_id']}] Data sent: {data}")
        # Key를 지정하여 데이터 순서 보장
        producer.send(
            "raw_topic", 
            key=vehicle["vehicle_id"].encode('utf-8'), 
            value=data
        )
        time.sleep(interval)

# 스레드 실행
threads = []
for v in vehicles:
    t = threading.Thread(target=simulate_vehicle, args=(v,))
    t.daemon = True
    t.start()
    threads.append(t)

try:
    while True:
        time.sleep(0.05)
except KeyboardInterrupt:
    print("\n시뮬레이터 종료")
    producer.flush() # 남은 데이터 확실히 밀어넣기