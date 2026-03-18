# 1. 네트워크 정보 가져오기
data "terraform_remote_state" "network" {
  backend = "local"
  config = {
    path = "../network/terraform.tfstate"
  }
}

# 2. 공통 설정 (로컬 변수)
locals {
  ami_id        = "ami-084a56dceed3eb9bb"
  instance_type = "t3.small"
  name_prefix   = "8team"
  key_name      = "8team-key"
  
  # 서브넷 ID 매핑 (팀원의 Output 이름에 따라 인덱스를 확인하세요)
  # index[0] = App-A (운영자용), index[1] = App-C (사용자용)
  op_subnet_id   = data.terraform_remote_state.network.outputs.private_app_subnet_ids[0]
  user_subnet_id = data.terraform_remote_state.network.outputs.private_app_subnet_ids[1]
  
  k3s_sg_id      = data.terraform_remote_state.network.outputs.security_group_ids.k3s_nodes
}

# 3. K3s Master Node (운영자용 서브넷 App-A 배치)
resource "aws_instance" "k3s_master" {
  ami           = local.ami_id
  instance_type = local.instance_type
  key_name      = local.key_name
  subnet_id     = local.op_subnet_id
  vpc_security_group_ids = [local.k3s_sg_id]

  user_data = <<-EOF
    #!/bin/bash
    curl -sfL https://get.k3s.io | sh -s - server \
    --token "my-shared-secret-token-1234" \
    --write-kubeconfig-mode 644 \
    --tls-san ${self.public_ip}
    EOF

  tags = {
    Name = "${local.name_prefix}-k3s-master"
    Role = "master"
  }
}

# 4. 운영자용 워커 노드 (운영자용 서브넷 App-A 배치 / 고정 1대)
resource "aws_instance" "k3s_worker_op" {
  ami           = local.ami_id
  instance_type = local.instance_type
  key_name      = local.key_name
  subnet_id     = local.op_subnet_id
  vpc_security_group_ids = [local.k3s_sg_id]

  tags = {
    Name = "${local.name_prefix}-k3s-worker-op"
    Role = "worker-operator"
  }
}

# 5. 사용자용 고정 워커 노드 (사용자용 서브넷 App-C 배치 / 고정 1대)
resource "aws_instance" "k3s_worker_user_fixed" {
  ami           = local.ami_id
  instance_type = local.instance_type
  key_name      = local.key_name
  subnet_id     = local.user_subnet_id
  vpc_security_group_ids = [local.k3s_sg_id]

  tags = {
    Name = "${local.name_prefix}-k3s-worker-user-fixed"
    Role = "worker-user"
  }
}

# 6. 사용자용 ASG 워커 (사용자용 서브넷 App-C 배치 / 유동적)
resource "aws_launch_template" "k3s_worker_user_lt" {
  name_prefix   = "${local.name_prefix}-user-worker-lt-"
  image_id      = local.ami_id
  instance_type = local.instance_type
  key_name      = local.key_name

  network_interfaces {
    associate_public_ip_address = false
    security_groups             = [local.k3s_sg_id]
  }

  user_data = base64encode(<<-EOF
    #!/bin/bash
    # 마스터 노드의 Private IP를 참조하여 자동으로 조인합니다.
    curl -sfL https://get.k3s.io | \
    K3S_URL="https://${aws_instance.k3s_master.private_ip}:6443" \
    K3S_TOKEN="my-shared-secret-token-1234" \
    sh -
    EOF
  )

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "${local.name_prefix}-k3s-worker-user-asg"
      Role = "worker-user-asg"
    }
  }
}

resource "aws_autoscaling_group" "k3s_worker_user_asg" {
  name                = "${local.name_prefix}-k3s-worker-user-asg"
  desired_capacity    = 1
  max_size            = 3
  min_size            = 1
  
  vpc_zone_identifier = [local.user_subnet_id]

  launch_template {
    id      = aws_launch_template.k3s_worker_user_lt.id
    version = "$Latest"
  }

  # --- 여기부터 Cluster Autoscaler 연동 태그 시작 ---

  tag {
    key                 = "k8s.io/cluster-autoscaler/enabled"
    value               = "true"
    propagate_at_launch = true # 이 태그를 생성되는 EC2 인스턴스에도 복사함
  }

  tag {
    # var.cluster_name이 "8team-cluster"라면 k8s.io/cluster-autoscaler/8team-cluster 가 됩니다.
    key                 = "k8s.io/cluster-autoscaler/${var.cluster_name}"
    value               = "owned"
    propagate_at_launch = true
  }

  tag {
    key                 = "Name"
    value               = "${local.name_prefix}-k3s-worker-user-asg"
    propagate_at_launch = true
  }
}
