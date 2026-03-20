# Compute

인프라 2 담당 영역입니다.

- EC2
- Launch Template
- Auto Scaling Group
- K3s
- Linkerd
- Ansible 연동

# AWS Compute Infrastructure (Terraform)

AWS EC2 인스턴스와 Auto Scaling Group을 관리합니다.

## 📌 주요 설정
* **Fixed IPs**: 
  - [cite_start]Master: `10.0.1.10` [cite: 9]
  - [cite_start]Worker(Op): `10.0.1.11` [cite: 10]
  - [cite_start]Worker(User-Fixed): `10.0.2.10` [cite: 11]
* [cite_start]**IAM Role**: SSM 접속 및 Cluster Autoscaler 권한 부여 [cite: 3, 4, 5]
* [cite_start]**Inventory 자동 생성**: Terraform 실행 후 `ansible/inventory/hosts.ini`가 자동 업데이트됩니다[cite: 1].

## 🛠 실행 방법
```bash
terraform init
terraform apply