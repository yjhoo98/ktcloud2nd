#ansible/inventory/hosts.ini 파일 생성

resource "local_file" "ansible_inventory" {
  # 1. 파일이 생성될 경로 (앤서블 폴더 위치에 맞게 수정하세요)
  filename = "${path.module}/../../ansible/inventory/hosts.ini"

  # 2. 파일에 들어갈 내용 (HEREDOC 방식)
  content  = <<-EOF
[all:vars]
ansible_user=ec2-user
ansible_ssh_private_key_file=~/.ssh/8team-key.pem
ansible_ssh_common_args='-o StrictHostKeyChecking=no'

[masters]
# 마스터 노드 IP 자동 삽입
${aws_instance.k3s_master.public_ip}

[workers]
# 운영자용 고정 워커
${aws_instance.k3s_worker_op.public_ip}
# 사용자용 고정 워커
${aws_instance.k3s_worker_user_fixed.public_ip}

[k8s_cluster:children]
masters
workers
EOF
}