# 1. 마스터 노드 고정 프라이빗 IP
output "master_a_private_ip" {
  description = "K3s 마스터 노드 A (AZ-A) 고정 프라이빗 IP"
  value       = aws_instance.k3s_master_a.private_ip
}

output "master_c_private_ip" {
  description = "K3s 마스터 노드 C (AZ-C) 고정 프라이빗 IP"
  value       = aws_instance.k3s_master_c.private_ip
}

# 2. NLB DNS (워커 노드 조인 및 kubectl 접근 엔드포인트)
output "k3s_nlb_dns" {
  description = "K3s API 서버 NLB DNS"
  value       = aws_lb.k3s_nlb.dns_name
}

# 3. ASG 이름 (Cluster Autoscaler 참조용)
output "worker_user_asg_name" {
  description = "사용자용 워커 Auto Scaling Group 이름"
  value       = aws_autoscaling_group.worker_user_asg.name
}

output "worker_op_asg_name" {
  description = "운영자용 워커 Auto Scaling Group 이름"
  value       = aws_autoscaling_group.worker_op_asg.name
}
