# AWS Network Baseline

Terraform baseline for the Infra 1 scope.

## Included Resources

- VPC
- Public / Private App / Private DB subnets
- Internet Gateway
- NAT Gateway
- Route tables and associations
- S3 Gateway VPC Endpoint
- Core security groups
- Internet-facing ALB baseline
- Public Route53 alias records for the user/operator app domains

## Files

- `versions.tf`: Terraform and AWS provider versions
- `variables.tf`: Network input values
- `main.tf`: Network resource definitions
- `outputs.tf`: Values shared with other infrastructure scopes
- `terraform.tfvars.example`: Example baseline values

## Suggested Next Steps

1. Confirm CIDR blocks and AZs from `docs/network-matrix.md`
2. Align Infra 2 on `SSM Session Manager` as the operations access path
3. Add ALB listener and target group integration points with Infra 2
4. Handle WAF only after the ALB baseline is fixed
5. Confirm `public_hosted_zone_name`, `user_app_host`, and `operator_app_host` match the purchased domain
