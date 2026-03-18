# Network Matrix

## Baseline Assumption

아래 값은 현재 팀 아키텍처와 요구사항을 반영한 인프라 1 기준 초안입니다. 실제 AWS apply 전에는 관리자 IP와 세부 포트만 최종 확인합니다.

| Item | Value |
| --- | --- |
| AWS Region | `ap-northeast-2` |
| VPC CIDR | `10.0.0.0/16` |
| Availability Zones | `ap-northeast-2a`, `ap-northeast-2c` |
| NAT Strategy | `Public-A`에 NAT Gateway 1개 |
| Internet Entry | `ALB` |
| S3 Access | `Gateway VPC Endpoint` |
| WAF | 후속 적용, 현재 구현 보류 |
| RDS | 인스턴스 1개, DB Subnet은 2개 준비 |

## Subnet Plan

| Subnet | AZ | CIDR | Purpose | Route |
| --- | --- | --- | --- | --- |
| Public-A | `ap-northeast-2a` | `10.0.0.0/24` | ALB, NAT, Bastion | IGW |
| Public-C | `ap-northeast-2c` | `10.0.1.0/24` | ALB | IGW |
| Private-App-A | `ap-northeast-2a` | `10.0.10.0/24` | 운영자 성격 App Subnet, K3s master 1 + worker 1 | NAT-1 |
| Private-App-C | `ap-northeast-2c` | `10.0.11.0/24` | 사용자 성격 App Subnet, worker 2대 | NAT-1 |
| Private-DB-A | `ap-northeast-2a` | `10.0.20.0/24` | RDS용 DB Subnet Group member | Local only |
| Private-DB-C | `ap-northeast-2c` | `10.0.21.0/24` | RDS용 DB Subnet Group member | Local only |

## Security Group Draft

| SG | Purpose | Inbound | Source | Outbound |
| --- | --- | --- | --- | --- |
| `alb-sg` | Public ALB | `80`, `443` | `0.0.0.0/0` | `k3s-nodes-sg` |
| `bastion-sg` | Bastion Host | `22` | 관리자 공인 IP | All |
| `k3s-nodes-sg` | K3s master/worker nodes | `22` | `bastion-sg` | All |
| `k3s-nodes-sg` | K3s master/worker nodes | `80`, `443` | `alb-sg` | All |
| `k3s-nodes-sg` | K3s internal traffic | All | `10.0.0.0/16` | All |
| `db-sg` | PostgreSQL / RDS | `5432` | `k3s-nodes-sg` | 제한적 또는 기본 egress |

## Port Matrix

| Traffic | Protocol | Port | Source | Destination | Note |
| --- | --- | --- | --- | --- | --- |
| Internet -> ALB | TCP | `80` | Public internet | `alb-sg` | HTTP redirect or temporary open |
| Internet -> ALB | TCP | `443` | Public internet | `alb-sg` | Primary HTTPS |
| Admin IP -> Bastion | TCP | `22` | Allowed admin IPs | `bastion-sg` | SSH |
| Bastion -> App nodes | TCP | `22` | `bastion-sg` | `k3s-nodes-sg` | Node SSH access |
| ALB -> App nodes | TCP | `80` | `alb-sg` | `k3s-nodes-sg` | Ingress HTTP |
| ALB -> App nodes | TCP | `443` | `alb-sg` | `k3s-nodes-sg` | Ingress HTTPS |
| App nodes -> RDS | TCP | `5432` | `k3s-nodes-sg` | `db-sg` | PostgreSQL |
| Bastion -> K3s API | TCP | `6443` | `bastion-sg` | `k3s-nodes-sg` | 필요 시에만 추가 |

## Route Table Draft

| Route Table | Attached Subnet | Default Route |
| --- | --- | --- |
| `public-rt` | Public-A, Public-C | `0.0.0.0/0 -> IGW` |
| `private-app-rt-a` | Private-App-A | `0.0.0.0/0 -> NAT-1` |
| `private-app-rt-c` | Private-App-C | `0.0.0.0/0 -> NAT-1` |
| `private-db-rt-a` | Private-DB-A | 없음 |
| `private-db-rt-c` | Private-DB-C | 없음 |

## Design Notes

- WAF는 아키텍처 요구사항이지만 현재 Phase 1 구현 범위에서는 제외합니다.
- ALB는 두 개의 Public Subnet에 걸쳐 배치합니다.
- Bastion Host는 `Public-A`에 1대만 두는 기준으로 문서화합니다.
- RDS는 1대만 생성하지만, DB Subnet Group은 서로 다른 AZ의 2개 Subnet을 사용합니다.
- S3 Gateway Endpoint는 Private Route Table과 연결해 NAT를 우회하는 내부 경로를 제공합니다.

## Infra 1 Hand-off Outputs

- `vpc_id`
- `public_subnet_ids`
- `private_app_subnet_ids`
- `private_db_subnet_ids`
- `alb_sg_id`
- `bastion_sg_id`
- `k3s_nodes_sg_id`
- `db_sg_id`

## Networking Checklist

- VPC CIDR 최종 승인
- 관리자 IP 목록 수집
- NAT 1대 구조 문서와 Terraform에 반영
- ALB Public Subnet 배치 검토
- S3 Gateway Endpoint 연결 라우트 검증
- RDS DB Subnet Group 대상 서브넷 재확인
