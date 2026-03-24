resource "local_file" "ansible_inventory" {
  filename = "${path.root}/../../ansible/inventory/hosts.ini"

  content = <<-EOF
[all:vars]
ansible_user=ubuntu
ansible_ssh_common_args='-o StrictHostKeyChecking=accept-new -o ProxyCommand="aws ssm start-session --target %h --document-name AWS-StartSSHSession --parameters portNumber=%p"'
nlb_dns=${aws_lb.k3s_nlb.dns_name}
db_endpoint=${data.terraform_remote_state.data.outputs.db_endpoint}
db_name=${data.terraform_remote_state.data.outputs.db_name}
db_port=${data.terraform_remote_state.data.outputs.db_port}
db_username=dbadmin

[masters]
master_a ansible_host=${aws_instance.k3s_master_a.id} private_ip=${aws_instance.k3s_master_a.private_ip}
master_c ansible_host=${aws_instance.k3s_master_c.id} private_ip=${aws_instance.k3s_master_c.private_ip}

[k8s_cluster:children]
masters
EOF
}
