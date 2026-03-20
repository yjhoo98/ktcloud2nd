## 👤 Infra 3 담당 범위 (Data Layer)

### 📌 담당 영역

- S3
- RDS PostgreSQL
- DB Subnet Group
- Import Job
- Serving Schema

1. S3 (정제 데이터 저장소)

- 역할
  - Consumer/Processor에서 생성된 정제 데이터를 저장
  - RDS import의 source storage

- 구조

processed/
├── vehicle_stats/
├── recent_alert/
└── user_vehicle_mapping/


- 특징
  - Public Access 차단
  - Server-side Encryption 적용
  - Versioning 활성화
  - Lifecycle 정책 (비용 관리용, 선택)

2. RDS PostgreSQL (Serving DB)

- 역할
  - Dashboard가 조회하는 데이터 저장소

- 특징
  - Private Subnet에 위치
  - 외부 직접 접근 불가
  - 프리티어 기준 구성 (db.t3.micro)

- 핵심 개념

RDS는 전체 데이터를 저장하지 않고,
조회용 데이터만 유지한다

3. DB Subnet Group

- 역할
  - RDS가 위치할 subnet 그룹 정의

- 구성 방식
  - network에서 생성한 private_db_subnet_ids 사용

- 의미
Network 위에 DB 배치


4. Serving Schema

Dashboard 조회를 위한 테이블 구조

vehicle_stats
- 차량 상태 데이터

recent_alert
- 이상 탐지 이벤트

user_vehicle_mapping
- 사용자 ↔ 차량 매핑

5. Import Job (S3 → RDS)

- 역할
  - S3에 저장된 CSV 데이터를 RDS로 반영

- 흐름

S3
→ import_job.py
→ PostgreSQL insert / upsert

- 주요 기능
  - 최신 파일 조회
  - CSV 파싱
  - DB insert / upsert

- 현재 상태
  - 수동 실행 가능
  - 자동화는 이후 단계에서 진행

핵심 책임

- S3 → RDS 데이터 반영 구조 완성
- Dashboard가 사용할 serving 데이터 구조 정의
- 데이터 저장소 역할 분리

한 줄 정리

S3에 저장된 정제 데이터를 RDS로 반영하여  
Dashboard가 조회할 수 있는 데이터 계층을 구축하는 역할이다.