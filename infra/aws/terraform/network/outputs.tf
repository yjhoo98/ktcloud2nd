output "vpc_id" {
  description = "VPC identifier."
  value       = aws_vpc.this.id
}

output "public_subnet_ids" {
  description = "Public subnet identifiers."
  value       = aws_subnet.public[*].id
}

output "private_app_subnet_ids" {
  description = "Private application subnet identifiers."
  value       = aws_subnet.private_app[*].id
}

output "db_subnet_ids" {
  description = "Database subnet identifiers."
  value       = aws_subnet.db[*].id
}

output "public_route_table_id" {
  description = "Public route table identifier."
  value       = aws_route_table.public.id
}

output "private_app_route_table_ids" {
  description = "Private application route table identifiers."
  value       = aws_route_table.private_app[*].id
}

output "db_route_table_ids" {
  description = "DB route table identifiers."
  value       = aws_route_table.db[*].id
}

output "nat_gateway_ids" {
  description = "NAT gateway identifiers."
  value       = aws_nat_gateway.this[*].id
}

output "alb_arn" {
  description = "Public ALB ARN."
  value       = aws_lb.public.arn
}

output "alb_dns_name" {
  description = "Public ALB DNS name."
  value       = aws_lb.public.dns_name
}

output "user_app_host" {
  description = "Public hostname for the user application."
  value       = var.user_app_host
}

output "operator_app_host" {
  description = "Public hostname for the operator application."
  value       = var.operator_app_host
}

output "alb_sg_id" {
  description = "ALB security group identifier."
  value       = aws_security_group.alb.id
}

output "k3s_nodes_sg_id" {
  description = "K3s nodes security group identifier."
  value       = aws_security_group.k3s_nodes.id
}

output "db_sg_id" {
  description = "Database security group identifier."
  value       = aws_security_group.db.id
}

output "alb_target_group_arn" {
  description = "ALB worker HTTP target group ARN."
  value       = aws_lb_target_group.worker_http.arn
}

output "security_group_ids" {
  description = "Core security group identifiers."
  value = {
    alb       = aws_security_group.alb.id
    k3s_nodes = aws_security_group.k3s_nodes.id
    db        = aws_security_group.db.id
  }
}
