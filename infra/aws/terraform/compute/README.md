# Compute Module

K3s 클러스터의 컴퓨팅 리소스를 프로비저닝하는 Terraform 모듈입니다.

## 구성 범위

| 리소스 | 설명 |
|--------|------|
| EC2 (마스터 2대) | K3s control-plane 노드 (AZ-A, AZ-C 각 1대) |
| Launch Template | user / operator 워커 풀 AMI 및 user_data 정의 |
| Auto Scaling Group | 워커 풀 자동 확장 (user: 2~6대, operator: 2~4대) |
| Internal NLB | K3s API 서버 공유 엔드포인트 (:6443) |
| IAM Instance Profile | SSM 접근 + Cluster Autoscaler 권한 |
| Ansible Inventory | `hosts.ini` 자동 생성 |

## 아키텍처

```
                ┌──────────────────────────┐
                │     Internal NLB :6443    │
                └────────────┬─────────────┘
                             │
           ┌─────────────────┴─────────────────┐
           │                                   │
  ┌────────▼────────┐                 ┌────────▼────────┐
  │   master_a      │                 │   master_c      │
  │  10.0.10.10     │                 │  10.0.11.10     │
  │  Private-App-A  │                 │  Private-App-C  │
  └─────────────────┘                 └─────────────────┘
           │                                   │
           └─────────────────┬─────────────────┘
                             │
              ┌──────────────▼──────────────────┐
              │         RDS PostgreSQL           │
              │      K3s 공유 데이터스토어         │
              └─────────────────────────────────┘

  ┌───────────────────────┐    ┌───────────────────────┐
  │   worker-user-asg     │    │    worker-op-asg       │
  │  desired: 2 / max: 6  │    │  desired: 2 / max: 4   │
  │  role=user-worker     │    │  role=operator-worker  │
  │  taint: nodetype=user │    │  taint: nodetype=op    │
  └───────────────────────┘    └───────────────────────┘
```

## 사전 조건

- Infra 1 (network 모듈) 이 먼저 apply 되어 있어야 합니다.
- `../network/terraform.tfstate` 파일이 존재해야 합니다.
- `../data/terraform.tfstate` 파일이 존재해야 합니다.

## 입력 변수

| 변수 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `aws_region` | | `ap-northeast-2` | AWS 리전 |
| `network_state_path` | | `../network/terraform.tfstate` | network 모듈 state 경로 |
| `data_state_path` | | `../data/terraform.tfstate` | data 모듈 state 경로 |
| `cluster_name` | | `8team-cluster` | Cluster Autoscaler용 클러스터 이름 |
| `k3s_shared_token` | ✅ | - | K3s 서버/에이전트 공유 토큰 |
| `master_a_private_ip` | ✅ | - | AZ-A 마스터 고정 IP |
| `master_c_private_ip` | ✅ | - | AZ-C 마스터 고정 IP |
| `name_prefix` | | `ktcloud2nd-dev` | 리소스 이름 접두사 |
| `ami_id` | | `ami-084a56dceed3eb9bb` | Ubuntu 22.04 AMI (ap-northeast-2) |
| `instance_type` | | `t3.small` | EC2 인스턴스 타입 |
| `key_name` | | `infra` | EC2 키페어 이름 |

## 출력 값

| 출력 | 설명 |
|------|------|
| `master_a_private_ip` | AZ-A 마스터 노드 프라이빗 IP |
| `master_c_private_ip` | AZ-C 마스터 노드 프라이빗 IP |
| `k3s_nlb_dns` | K3s API 서버 NLB DNS |
| `worker_user_asg_name` | user 워커 ASG 이름 |
| `worker_op_asg_name` | operator 워커 ASG 이름 |

## 실행 순서

```bash
# 1. terraform.tfvars 파일 생성
cp terraform.tfvars.example terraform.tfvars
vi terraform.tfvars  # k3s_shared_token, master IP 등 입력

# 2. 초기화
terraform init

# 3. 플랜 확인
terraform plan

# 4. 적용
terraform apply
```

## 워커 노드 분리 전략

마스터 설치 후 ASG가 워커 노드를 자동으로 생성하고 K3s 클러스터에 조인합니다.
user / operator 워크로드는 라벨과 테인트로 분리됩니다.

**user-worker에 파드 배포 시**
```yaml
tolerations:
  - key: "nodetype"
    operator: "Equal"
    value: "user"
    effect: "NoSchedule"
nodeSelector:
  role: user-worker
```

**operator-worker에 파드 배포 시**
```yaml
tolerations:
  - key: "nodetype"
    operator: "Equal"
    value: "operator"
    effect: "NoSchedule"
nodeSelector:
  role: operator-worker
```

## 노드 접근 방법

SSH 포트 없이 AWS SSM Session Manager로 접근합니다.

```bash
# 마스터 노드 접속
aws ssm start-session --target <instance-id> --region ap-northeast-2

# 클러스터 상태 확인
sudo kubectl get nodes
sudo kubectl get pods -A
```

## 관련 모듈

| 모듈 | 경로 | 역할 |
|------|------|------|
| network | `../network` | VPC, 서브넷, 보안그룹 |
| data | `../data` | RDS PostgreSQL (K3s 데이터스토어) |
| compute | `../compute` | EC2, NLB, ASG (현재 모듈) |

## K3s 마스터 설치

마스터 노드 K3s 설치는 Ansible로 별도 진행합니다.

```bash
cd ../../ansible
ansible-playbook -i inventory/hosts.ini playbooks/setup_k3s_cluster.yml
```

자세한 내용은 `../../ansible/README.md` 참고.
