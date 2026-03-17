# 1. 인프라 2에서 사용할 추가 변수 (이미 variables.tf에 있다면 생략 가능)
variable "instance_key_name" {
  description = "EC2에 접속하기 위한 기존 AWS 키페어 이름"
  type        = string
  default     = "8team-key" 
}

# 2. Bastion Host (Public 영역)
resource "aws_instance" "bastion" {
  ami           = "ami-0c02fb55956c7d316" # Ubuntu 24.04 LTS (ap-northeast-2)
  instance_type = "t3.micro"
  key_name      = var.instance_key_name

  # 첫 번째 공용 서브넷에 배치
  subnet_id              = aws_subnet.public[0].id
  vpc_security_group_ids = [aws_security_group.bastion.id]

  tags = {
    Name = "${var.name_prefix}-bastion"
    Tier = "public"
  }
}

# 3. K3s Master Node (Private App 영역)
resource "aws_instance" "k3s_master" {
  ami           = "ami-0c02fb55956c7d316"
  instance_type = "t3.medium" # K3s + Linkerd 권장 사양
  key_name      = var.instance_key_name

  # 첫 번째 프라이빗 앱 서브넷에 배치
  subnet_id              = aws_subnet.private_app[0].id
  vpc_security_group_ids = [aws_security_group.k3s_nodes.id]

  # Ansible 연동을 위한 기본 설정
  user_data = <<-EOF
              #!/bin/bash
              sudo apt-get update
              sudo apt-get install -y python3
              EOF

  tags = {
    Name = "${var.name_prefix}-k3s-master"
    Role = "master"
  }
}

# 4. K3s Worker Nodes (ASG 활용)
resource "aws_launch_template" "k3s_worker_lt" {
  name_prefix   = "${var.name_prefix}-k3s-worker-lt-"
  image_id      = "ami-0c02fb55956c7d316"
  instance_type = "t3.medium"
  key_name      = var.instance_key_name

  network_interfaces {
    associate_public_ip_address = false
    security_groups             = [aws_security_group.k3s_nodes.id]
  }

  user_data = base64encode(<<-EOF
              #!/bin/bash
              sudo apt-get update
              sudo apt-get install -y python3
              EOF
  )

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "${var.name_prefix}-k3s-worker"
      Role = "worker"
    }
  }
}

resource "aws_autoscaling_group" "k3s_worker_asg" {
  name                = "${var.name_prefix}-k3s-worker-asg"
  desired_capacity    = 2
  max_size            = 3
  min_size            = 1
  # 모든 프라이빗 앱 서브넷(2개 AZ)에 걸쳐 생성
  vpc_zone_identifier = aws_subnet.private_app[*].id

  launch_template {
    id      = aws_launch_template.k3s_worker_lt.id
    version = "$Latest"
  }
}