variable "cluster_name" {
  description = "K3s 클러스터의 이름 및 Autoscaler 태그용 변수"
  type        = string
  default     = "8team-cluster"
}

variable "k3s_shared_token" {
  description = "K3s 마스터-워커 노드 간 조인을 위한 고정 보안 토큰"
  type        = string
  sensitive   = true
}

# ──────────────────────────────────────────
# 마스터 노드 고정 프라이빗 IP
# 각 서브넷 CIDR 범위 안에서 지정 (예: 10.0.1.0/24 → 10.0.1.10)
# AWS 예약 대역(.0/.1/.2/.3/.255) 제외
# ──────────────────────────────────────────
variable "master_a_private_ip" {
  description = "AZ-A 마스터 노드 고정 프라이빗 IP (private_subnet_a CIDR 내)"
  type        = string
  # default   = "10.0.1.10"  # 서브넷 CIDR 확인 후 주석 해제
}

variable "master_c_private_ip" {
  description = "AZ-C 마스터 노드 고정 프라이빗 IP (private_subnet_c CIDR 내)"
  type        = string
  # default   = "10.0.3.10"  # 서브넷 CIDR 확인 후 주석 해제
}
