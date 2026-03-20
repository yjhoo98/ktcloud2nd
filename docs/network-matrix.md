# Network Matrix

## Baseline Assumption

This document reflects the current Phase 1 AWS network baseline for the team.

| Item | Value |
| --- | --- |
| AWS Region | `ap-northeast-2` |
| VPC CIDR | `10.0.0.0/16` |
| Availability Zones | `ap-northeast-2a`, `ap-northeast-2c` |
| NAT Strategy | Single NAT Gateway in `Public-A` |
| Internet Entry | `ALB` |
| Operations Access | `SSM Session Manager` |
| S3 Access | `Gateway VPC Endpoint` |
| WAF | Deferred for a later phase |
| RDS | One instance, DB subnets prepared in two AZs |

## Subnet Plan

| Subnet | AZ | CIDR | Purpose | Route |
| --- | --- | --- | --- | --- |
| Public-A | `ap-northeast-2a` | `10.0.0.0/24` | ALB, NAT Gateway | IGW |
| Public-C | `ap-northeast-2c` | `10.0.1.0/24` | ALB | IGW |
| Private-App-A | `ap-northeast-2a` | `10.0.10.0/24` | Shared app subnet for K3s control-plane and worker pools in AZ-A | NAT-1 |
| Private-App-C | `ap-northeast-2c` | `10.0.11.0/24` | Shared app subnet for K3s control-plane and worker pools in AZ-C | NAT-1 |
| Private-DB-A | `ap-northeast-2a` | `10.0.20.0/24` | RDS DB subnet group member | Local only |
| Private-DB-C | `ap-northeast-2c` | `10.0.21.0/24` | RDS DB subnet group member | Local only |

## Security Group Draft

| SG | Purpose | Inbound | Source | Outbound |
| --- | --- | --- | --- | --- |
| `alb-sg` | Public ALB | `80`, `443` | `0.0.0.0/0` | `k3s-nodes-sg` |
| `k3s-nodes-sg` | K3s master/worker nodes | All | `10.0.0.0/16` | All |
| `k3s-nodes-sg` | K3s master/worker nodes | `80`, `443` | `alb-sg` | All |
| `db-sg` | PostgreSQL / RDS | `5432` | `k3s-nodes-sg` | Default egress |

## Port Matrix

| Traffic | Protocol | Port | Source | Destination | Note |
| --- | --- | --- | --- | --- | --- |
| Internet -> ALB | TCP | `80` | Public internet | `alb-sg` | HTTP redirect or temporary open |
| Internet -> ALB | TCP | `443` | Public internet | `alb-sg` | Primary HTTPS |
| ALB -> App nodes | TCP | `80` | `alb-sg` | `k3s-nodes-sg` | Ingress HTTP |
| ALB -> App nodes | TCP | `443` | `alb-sg` | `k3s-nodes-sg` | Ingress HTTPS |
| App nodes -> RDS | TCP | `5432` | `k3s-nodes-sg` | `db-sg` | PostgreSQL |
| App nodes -> AWS SSM APIs | TCP | `443` | `k3s-nodes-sg` | AWS services via NAT | Session Manager connectivity |
| App nodes -> S3 | HTTPS | `443` | Private route tables | S3 via Gateway Endpoint | Artifact and import path |

## Route Table Draft

| Route Table | Attached Subnet | Default Route |
| --- | --- | --- |
| `public-rt` | Public-A, Public-C | `0.0.0.0/0 -> IGW` |
| `private-app-rt-a` | Private-App-A | `0.0.0.0/0 -> NAT-1` |
| `private-app-rt-c` | Private-App-C | `0.0.0.0/0 -> NAT-1` |
| `private-db-rt-a` | Private-DB-A | None |
| `private-db-rt-c` | Private-DB-C | None |

## Design Notes

- WAF remains a later-phase item and is not part of the current Terraform apply scope.
- ALB spans both public subnets.
- Bastion host is removed from the operations baseline. Day-2 access is handled through `SSM Session Manager`.
- The two Private App subnets are shared application tiers split by AZ, not operator-only or user-only subnets.
- Infra 2 separates control-plane and worker responsibilities through node placement plus Kubernetes labels and taints, not extra subnet tiers.
- Infra 2 must attach an EC2 IAM role with `AmazonSSMManagedInstanceCore` to K3s and utility instances that need Session Manager access.
- SSM traffic uses the existing NAT path for now. Dedicated VPC endpoints for `ssm`, `ssmmessages`, and `ec2messages` can be added later if the team wants a fully private management path.
- RDS is a single instance, but the DB subnet group still uses two subnets in different AZs.
- S3 Gateway Endpoint is associated with private route tables so the private subnets can reach S3 without public internet egress.

## Infra 1 Hand-off Outputs

- `vpc_id`
- `public_subnet_ids`
- `private_app_subnet_ids`
- `private_db_subnet_ids`
- `alb_sg_id`
- `k3s_nodes_sg_id`
- `db_sg_id`

## Networking Checklist

- Confirm VPC CIDR and AZ pair
- Keep the single NAT design in Terraform and docs
- Verify ALB placement on both public subnets
- Verify S3 Gateway Endpoint associations
- Verify DB subnet pair for the future DB subnet group
- Confirm SSM-based access design with Infra 2 before compute provisioning
