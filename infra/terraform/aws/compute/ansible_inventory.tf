resource "local_file" "ansible_inventory" {
  filename = "${path.root}/../ansible/inventory/hosts.ini"

  # ASG 워커 노드는 user_data로 자동 조인하므로 정적 인벤토리 불필요
  # Ansible은 마스터 노드 설정(K3s 설치, Helm, Cluster Autoscaler)만 담당
  content = <<-EOF
[all:vars]
ansible_user=ubuntu
ansible_ssh_common_args='-o StrictHostKeyChecking=no -o ProxyCommand="aws ssm start-session --target %h --document-name AWS-StartSSHSession --parameters portNumber=%p"'
nlb_dns=${aws_lb.k3s_nlb.dns_name}

[masters]
master_a ansible_host=${aws_instance.k3s_master_a.id} private_ip=${aws_instance.k3s_master_a.private_ip}
master_c ansible_host=${aws_instance.k3s_master_c.id} private_ip=${aws_instance.k3s_master_c.private_ip}

[k8s_cluster:children]
masters
EOF
}
