# AWS Compute Module

Terraform baseline for Infra 2.

## Included Scope

- EC2 control-plane nodes
- Launch templates for worker pools
- Auto Scaling Groups
- Internal NLB for the K3s API endpoint
- IAM instance profile for SSM and Cluster Autoscaler
- Ansible inventory generation

## Architecture Assumption

- The module reuses the two `Private App` subnets created by Infra 1.
- Control-plane and worker nodes share the same application tier and are spread by AZ.
- Worker responsibilities are separated with Kubernetes labels and taints, not dedicated subnets.
- Operational access is `SSM Session Manager`, not SSH bastion access.

## Current Placement Model

- `Private-App-A`
  - one control-plane node
  - worker nodes from both workload pools can be placed here by ASG
- `Private-App-C`
  - one control-plane node
  - worker nodes from both workload pools can be placed here by ASG
- `k3s_nlb`
  - internal endpoint used by workers and cluster operations that need a stable API address

## Worker Pools

- `worker_user_asg`
  - user workload worker pool
  - joins the shared control-plane endpoint
  - applies `nodetype=user:NoSchedule`
  - applies `role=user-worker`
- `worker_op_asg`
  - operator workload worker pool
  - joins the shared control-plane endpoint
  - applies `nodetype=operator:NoSchedule`
  - applies `role=operator-worker`

## Required Inputs

- `network_state_path`
  - local Terraform state path for the Infra 1 network module
- `k3s_shared_token`
  - shared join token for K3s servers and agents
- `master_a_private_ip`
  - fixed private IP inside `Private-App-A`
- `master_c_private_ip`
  - fixed private IP inside `Private-App-C`

## Run Order

```bash
terraform init
terraform plan
terraform apply
```

## Notes

- This module assumes the Infra 1 outputs already exist in `../network/terraform.tfstate`.
- The current structure is aligned with the adopted AZ-based shared app subnet design.
- If the team later revisits K3s HA, control-plane node count and datastore design should be reviewed separately.
