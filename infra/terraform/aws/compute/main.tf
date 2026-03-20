locals {
  ami_id        = "ami-084a56dceed3eb9bb"
  instance_type = "t3.small"
  name_prefix   = "8team"
  key_name      = "8team-key"

  # 마스터/워커 공용 단일 프라이빗 서브넷 (AZ별)
  private_subnet_a = data.terraform_remote_state.network.outputs.private_subnet_ids[0]
  private_subnet_c = data.terraform_remote_state.network.outputs.private_subnet_ids[1]

  k3s_sg_id = data.terraform_remote_state.network.outputs.security_group_ids.k3s_nodes
}

# ──────────────────────────────────────────
# [1] Internal NLB (마스터 API 서버용)
# ──────────────────────────────────────────
resource "aws_lb" "k3s_nlb" {
  name               = "${local.name_prefix}-k3s-nlb"
  internal           = true
  load_balancer_type = "network"
  subnets            = [local.private_subnet_a, local.private_subnet_c]
}

resource "aws_lb_target_group" "k3s_api_tg" {
  name     = "${local.name_prefix}-k3s-api-tg"
  port     = 6443
  protocol = "TCP"
  vpc_id   = data.terraform_remote_state.network.outputs.vpc_id

  health_check {
    protocol = "TCP"
    port     = "6443"
    interval = 10
  }
}

resource "aws_lb_listener" "k3s_api_listener" {
  load_balancer_arn = aws_lb.k3s_nlb.arn
  port              = 6443
  protocol          = "TCP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.k3s_api_tg.arn
  }
}

# ──────────────────────────────────────────
# [2] 고정 마스터 노드 (AZ-A / AZ-C 각 1대)
# ──────────────────────────────────────────
resource "aws_instance" "k3s_master_a" {
  ami                    = local.ami_id
  instance_type          = local.instance_type
  key_name               = local.key_name
  subnet_id              = local.private_subnet_a
  vpc_security_group_ids = [local.k3s_sg_id]
  iam_instance_profile   = aws_iam_instance_profile.k3s_node_profile.name

  # 프라이빗 서브넷 CIDR 범위 내에서 고정 IP 지정
  # 예) 서브넷이 10.0.1.0/24 이면 10.0.1.x 범위 내에서 선택
  private_ip = var.master_a_private_ip

  tags = {
    Name = "${local.name_prefix}-master-a"
    Role = "master"
  }
}

resource "aws_instance" "k3s_master_c" {
  ami                    = local.ami_id
  instance_type          = local.instance_type
  key_name               = local.key_name
  subnet_id              = local.private_subnet_c
  vpc_security_group_ids = [local.k3s_sg_id]
  iam_instance_profile   = aws_iam_instance_profile.k3s_node_profile.name

  # AZ-C 서브넷 CIDR 범위 내에서 고정 IP 지정
  private_ip = var.master_c_private_ip

  tags = {
    Name = "${local.name_prefix}-master-c"
    Role = "master"
  }
}

resource "aws_lb_target_group_attachment" "master_a" {
  target_group_arn = aws_lb_target_group.k3s_api_tg.arn
  target_id        = aws_instance.k3s_master_a.id
}

resource "aws_lb_target_group_attachment" "master_c" {
  target_group_arn = aws_lb_target_group.k3s_api_tg.arn
  target_id        = aws_instance.k3s_master_c.id
}

# ──────────────────────────────────────────
# [3] Launch Template - 사용자용 워커
# ASG 인스턴스는 기동 시 user_data로 자동 클러스터 조인
# ──────────────────────────────────────────
resource "aws_launch_template" "k3s_worker_user_lt" {
  name_prefix   = "${local.name_prefix}-worker-user-"
  image_id      = local.ami_id
  instance_type = local.instance_type
  key_name      = local.key_name

  iam_instance_profile {
    name = aws_iam_instance_profile.k3s_node_profile.name
  }

  vpc_security_group_ids = [local.k3s_sg_id]

  # 인스턴스 기동 시 K3s agent 자동 설치 및 클러스터 조인
  user_data = base64encode(<<-EOF
    #!/bin/bash
    curl -sfL https://get.k3s.io | \
      K3S_URL=https://${aws_lb.k3s_nlb.dns_name}:6443 \
      K3S_TOKEN="${var.k3s_shared_token}" \
      sh -s - agent \
        --node-taint nodetype=user:NoSchedule \
        --node-label role=user-worker
  EOF
  )

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "${local.name_prefix}-worker-user"
      Role = "user"
    }
  }
}

# ──────────────────────────────────────────
# [4] Launch Template - 운영자용 워커
# ──────────────────────────────────────────
resource "aws_launch_template" "k3s_worker_op_lt" {
  name_prefix   = "${local.name_prefix}-worker-op-"
  image_id      = local.ami_id
  instance_type = local.instance_type
  key_name      = local.key_name

  iam_instance_profile {
    name = aws_iam_instance_profile.k3s_node_profile.name
  }

  vpc_security_group_ids = [local.k3s_sg_id]

  user_data = base64encode(<<-EOF
    #!/bin/bash
    curl -sfL https://get.k3s.io | \
      K3S_URL=https://${aws_lb.k3s_nlb.dns_name}:6443 \
      K3S_TOKEN="${var.k3s_shared_token}" \
      sh -s - agent \
        --node-taint nodetype=operator:NoSchedule \
        --node-label role=operator-worker
  EOF
  )

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "${local.name_prefix}-worker-op"
      Role = "operator"
    }
  }
}

# ──────────────────────────────────────────
# [5] ASG - 사용자용 워커
# desired=2 → AZ-A·AZ-C 각 1대로 자동 분산
# ──────────────────────────────────────────
resource "aws_autoscaling_group" "worker_user_asg" {
  name                = "${local.name_prefix}-worker-user-asg"
  desired_capacity    = 2
  min_size            = 2
  max_size            = 6
  vpc_zone_identifier = [local.private_subnet_a, local.private_subnet_c]

  launch_template {
    id      = aws_launch_template.k3s_worker_user_lt.id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "${local.name_prefix}-worker-user"
    propagate_at_launch = true
  }
  tag {
    key                 = "k8s.io/cluster-autoscaler/enabled"
    value               = "true"
    propagate_at_launch = true
  }
  tag {
    key                 = "k8s.io/cluster-autoscaler/${var.cluster_name}"
    value               = "owned"
    propagate_at_launch = true
  }
}

# ──────────────────────────────────────────
# [6] ASG - 운영자용 워커
# desired=2 → AZ-A·AZ-C 각 1대로 자동 분산
# ──────────────────────────────────────────
resource "aws_autoscaling_group" "worker_op_asg" {
  name                = "${local.name_prefix}-worker-op-asg"
  desired_capacity    = 2
  min_size            = 2
  max_size            = 4
  vpc_zone_identifier = [local.private_subnet_a, local.private_subnet_c]

  launch_template {
    id      = aws_launch_template.k3s_worker_op_lt.id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "${local.name_prefix}-worker-op"
    propagate_at_launch = true
  }
  tag {
    key                 = "k8s.io/cluster-autoscaler/enabled"
    value               = "true"
    propagate_at_launch = true
  }
  tag {
    key                 = "k8s.io/cluster-autoscaler/${var.cluster_name}"
    value               = "owned"
    propagate_at_launch = true
  }
}
