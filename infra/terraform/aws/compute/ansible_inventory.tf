resource "local_file" "ansible_inventory" {
  filename = "${path.root}/../ansible/inventory/hosts.ini"
  content  = <<-EOF
[all:vars]
ansible_user=ubuntu
ansible_ssh_private_key_file=~/.ssh/key.pem
# ProxyCommand에서 %h가 인스턴스 ID를 받도록 설정 유지
ansible_ssh_common_args='-o StrictHostKeyChecking=no -o ProxyCommand="aws ssm start-session --target %h --document-name AWS-StartSSHSession --parameters portNumber=%p"'

[masters]
# ansible_host를 ID로 설정해야 SSM 접속이 가능합니다.
master_node ansible_host=${aws_instance.k3s_master.id} private_ip=${aws_instance.k3s_master.private_ip}

[workers]
worker_op ansible_host=${aws_instance.k3s_worker_op.id} private_ip=${aws_instance.k3s_worker_op.private_ip}
worker_user ansible_host=${aws_instance.k3s_worker_user_fixed.id} private_ip=${aws_instance.k3s_worker_user_fixed.private_ip}

[k8s_cluster:children]
masters
workers
EOF
}