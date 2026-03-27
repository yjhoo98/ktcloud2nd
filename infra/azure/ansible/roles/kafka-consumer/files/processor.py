import os
import json
import time
import threading  # 누락되었던 스레드 임포트 추가
from kafka import KafkaConsumer, KafkaProducer

# 환경변수 설정
KAFKA_BROKER = os.environ.get('KAFKA_BROKER', 'localhost:9092')
RAW_TOPIC = 'raw_topic'
CLEANSED_TOPIC = 'cleansed_topic'
ANOMALY_TOPIC = 'anomaly_topic'

print(f"통합 프로세서 가동 시작 (Broker: {KAFKA_BROKER})")

# 카프카 연결
def create_kafka_clients():
    while True:
        try:
            consumer = KafkaConsumer(
                RAW_TOPIC,
                bootstrap_servers=[KAFKA_BROKER],
                auto_offset_reset='earliest',
                enable_auto_commit=True,
                group_id='vehicle-processor-group',
                value_deserializer=lambda x: json.loads(x.decode('utf-8'))
            )
            producer = KafkaProducer(
                bootstrap_servers=[KAFKA_BROKER],
                value_serializer=lambda x: json.dumps(x).encode('utf-8')
            )
            print("Kafka Broker 연결 성공")
            return consumer, producer
        except Exception as e:
            print(f"Broker 연결 대기 중... ({e})")
            time.sleep(5)

consumer, producer = create_kafka_clients()

# 차량별 이전 상태 저장용 (메모리)
vehicle_states = {}

def send_alert(vehicle_id, anomaly_type, description, data):
    """ 이상 징후 발생 시 별도 토픽으로 전송 """
    alert = {
        "alert_time": int(time.time()),
        "vehicle_id": vehicle_id,
        "anomaly_type": anomaly_type,
        "description": description,
        "occurred_at": data.get('timestamp') if data else int(time.time()),
        "raw_data": data
    }
    # key값은 바이너리로 인코딩해서 전송
    producer.send(ANOMALY_TOPIC, key=str(vehicle_id).encode('utf-8'), value=alert)
    print(f"[🚨 경고] {vehicle_id}: {anomaly_type}")

def monitor_missing_data():
    """백그라운드 스레드: 30초 이상 데이터 미수신 감시"""
    while True:
        now = time.time()
        for v_id, state in list(vehicle_states.items()):
            if now - state['last_seen'] >= 30 and not state.get('missing_alert_sent', False):
                send_alert(v_id, "MISSING_DATA", "30초 이상 데이터 미수신", None)
                state['missing_alert_sent'] = True
        time.sleep(5)

# 감시 스레드 가동
threading.Thread(target=monitor_missing_data, daemon=True).start()

print(f"실시간 정제 및 이상 탐지 루프 시작...")

try:
    for message in consumer:
        raw_data = message.value
        v_id = raw_data.get('vehicle_id')
        original_key = message.key  # 누락되었던 키 변수 선언 추가
        now = time.time()

        if not v_id: continue

        # ----- 상태 업데이트 및 복구 알림 -----
        if v_id not in vehicle_states:
            vehicle_states[v_id] = {
                "last_speed": raw_data.get('speed', 0),
                "last_lat": raw_data.get('lat', 0),
                "last_seen": now,
                "msg_times": [now],
                "missing_alert_sent": False
            }
        
        state = vehicle_states[v_id]
        state['last_seen'] = now
        
        if state.get('missing_alert_sent'):
            print(f"[✅ 복구] {v_id} 통신 재개")
            state['missing_alert_sent'] = False

        # ----- 이상 탐지 로직 (원본 데이터 기준) -----
        # 데이터 폭주
        state['msg_times'].append(now)
        state['msg_times'] = [t for t in state['msg_times'] if now - t <= 1.0]
        if len(state['msg_times']) >= 5:
            send_alert(v_id, "DATA_BURST", "데이터 수신 폭주", raw_data)

        # 급가감속
        curr_speed = raw_data.get('speed', 0)
        speed_diff = curr_speed - state['last_speed']
        if speed_diff >= 50:
            send_alert(v_id, "SUDDEN_ACCEL", f"급가속 감지 (+{speed_diff}km/h)", raw_data)
        elif speed_diff <= -50:
            send_alert(v_id, "SUDDEN_DECEL", f"급감속 감지 ({speed_diff}km/h)", raw_data)
        # 연료 부족
        if raw_data.get('fuel_level', 100) < 5.0:
            send_alert(v_id, "LOW_FUEL", "연료 5% 미만 부족", raw_data)

        # GPS 도약
        if abs(raw_data.get('lat', 0) - state['last_lat']) > 1.0:
            send_alert(v_id, "ABNORMAL_GPS", "GPS 좌표 도약 감지", raw_data)

        # 상태 갱신
        state['last_speed'] = curr_speed
        state['last_lat'] = raw_data.get('lat', 0)

        # ----- 데이터 정제 (Cleansing) -----
        # 개인정보 삭제 (원본 데이터를 직접 수정)
        if 'driver_id' in raw_data:
            del raw_data['driver_id']

        # 노이즈 필터링
        lat = raw_data.get('lat', 0)
        if not (-90 <= lat <= 90) or curr_speed < 0 or curr_speed > 300:
            print(f"비정상 데이터 필터링됨 (v_id: {v_id})")
            continue
            
        # 정제 완료된 데이터 전송
        producer.send(
            CLEANSED_TOPIC, 
            key=original_key, 
            value=raw_data
        )

except KeyboardInterrupt:
    print("종료 중...")
finally:
    consumer.close()
    producer.close()