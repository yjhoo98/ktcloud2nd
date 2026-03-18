# 1. 마스터 노드 퍼블릭 IP (운영자 구역)
output "master_public_ip" {
  description = "K3s 마스터 노드 접속용 IP"
  value       = aws_instance.k3s_master.public_ip
}

# 2. 운영자용 고정 워커 IP (운영자 구역)
output "worker_op_public_ip" {
  description = "운영 관리용 고정 워커 노드 IP"
  value       = aws_instance.k3s_worker_op.public_ip
}

# 3. 사용자용 고정 워커 IP (사용자 구역)
output "worker_user_fixed_public_ip" {
  description = "사용자 서비스용 고정 워커 노드 IP"
  value       = aws_instance.k3s_worker_user_fixed.public_ip
}

# 4. 사용자용 ASG 워커 정보 (사용자 구역 - 유동적)
# ASG는 인스턴스가 생성되기 전까지 IP를 알 수 없으므로 이름과 상태만 출력합니다.
output "user_asg_name" {
  description = "사용자용 Auto Scaling Group 이름"
  value       = aws_autoscaling_group.k3s_worker_user_asg.name
}

# 5. 모든 고정 노드 IP 리스트 (앤서블 편의용)
output "all_fixed_ips" {
  value = {
    master      = aws_instance.k3s_master.public_ip
    worker_op   = aws_instance.k3s_worker_op.public_ip
    worker_user = aws_instance.k3s_worker_user_fixed.public_ip
  }
}