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