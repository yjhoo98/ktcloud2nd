# K3s 클러스터 Ansible 자동화

K3s control-plane 노드를 AWS EC2에 설치하는 Ansible 플레이북입니다.
워커 노드는 Terraform ASG user_data로 자동 조인되므로 Ansible 대상에서 제외됩니다.

## 디렉토리 구조

```
ansible/
├── ansible.cfg                        # Ansible 설정 (SSM, vault 등)
├── inventory/
│   └── hosts.ini                      # Terraform이 자동 생성 (git 제외)
├── vault/
│   ├── vault.yml                      # 암호화된 시크릿 (git 제외)
│   └── vault_pass                     # Vault 복호화 비밀번호 (git 제외)
├── playbooks/
│   └── setup_k3s_cluster.yml          # 마스터 노드 K3s 설치
└── roles/
    ├── k3s_master/tasks/main.yml      # K3s server 설치 태스크
    └── linkerd/                       # 추후 서비스 메시 적용 예정
```

## 사전 조건

### 로컬 환경

| 항목 | 확인 명령어 |
|------|------------|
| AWS CLI 설치 | `aws --version` |
| AWS credentials 설정 | `aws sts get-caller-identity` |
| SSM Session Manager Plugin 설치 | `session-manager-plugin --version` |
| SSH 키페어 (`~/.ssh/infra.pem`) | `ls ~/.ssh/infra.pem` |
| SSH 키 권한 600 | `chmod 600 ~/.ssh/infra.pem` |

### 필요 파일

아래 두 파일은 git에서 제외되므로 팀원에게 별도 전달받아야 합니다.

```bash
ansible/vault/vault.yml       # Ansible Vault 암호화 시크릿
ansible/vault/vault_pass      # Vault 복호화 비밀번호
```

### Terraform 선행 실행

`inventory/hosts.ini`는 Terraform compute 모듈이 자동으로 생성합니다.
Ansible 실행 전 반드시 Terraform이 apply 되어 있어야 합니다.

```bash
cd ../terraform/compute
terraform apply
```

## 실행

```bash
cd infra/aws/ansible
ansible-playbook -i inventory/hosts.ini playbooks/setup_k3s_cluster.yml
```

## 플레이북 동작 순서

```
master_a (AZ-A)
  ├── K3s server 설치 (PostgreSQL 데이터스토어 초기화)
  ├── kubeconfig 생성 대기
  └── systemd 서비스 활성화

master_c (AZ-C)
  ├── K3s server 설치 (동일 데이터스토어로 HA 합류)
  ├── kubeconfig 생성 대기
  └── systemd 서비스 활성화
```

`serial: 1` 설정으로 마스터 노드를 순차적으로 설치합니다.

## 시크릿 관리

`vault/vault.yml`에 아래 변수가 암호화되어 저장됩니다.

| 변수 | 설명 |
|------|------|
| `vault_k3s_shared_token` | K3s 서버/에이전트 공유 토큰 |
| `vault_db_password` | RDS PostgreSQL 비밀번호 |

vault 내용 확인:
```bash
ansible-vault view vault/vault.yml
```

vault 내용 수정:
```bash
ansible-vault edit vault/vault.yml
```

## 접속 방식

SSH 포트 없이 AWS SSM Session Manager로 접근합니다.
`ansible.cfg`의 `ansible_ssh_common_args`에 SSM ProxyCommand가 설정되어 있습니다.

```bash
# 마스터 노드 직접 접속
aws ssm start-session --target <instance-id> --region ap-northeast-2

# 클러스터 상태 확인
sudo kubectl get nodes
sudo kubectl get pods -A
```

## 설치 확인

플레이북 실행 후 마스터 노드에 접속하여 아래 명령어로 확인합니다.

```bash
# 전체 노드 상태 (모든 노드 Ready 여부)
sudo kubectl get nodes

# 노드 라벨 및 테인트 확인
sudo kubectl get nodes --show-labels
sudo kubectl describe nodes | grep -A3 "Taints"

# 시스템 파드 상태
sudo kubectl get pods -A

# HA 엔드포인트 확인 (마스터 2대 등록 여부)
sudo kubectl get endpoints -n default kubernetes
```

## 워커 노드

워커 노드는 Terraform ASG user_data로 자동 설치 및 클러스터 조인됩니다.
Ansible 개입 없이 인스턴스 생성 시 자동으로 처리됩니다.

- `worker-user-asg` → `role=user-worker`, `nodetype=user:NoSchedule`
- `worker-op-asg` → `role=operator-worker`, `nodetype=operator:NoSchedule`

## 관련 모듈

| 모듈 | 경로 | 역할 |
|------|------|------|
| network | `../terraform/network` | VPC, 서브넷, 보안그룹 |
| data | `../terraform/data` | RDS PostgreSQL |
| compute | `../terraform/compute` | EC2, NLB, ASG, inventory 생성 |
