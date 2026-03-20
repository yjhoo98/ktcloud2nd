# K3s Cluster Automation (Ansible)

Ansible is used for control-plane bootstrap and shared cluster setup on the AWS compute layer.

## Current Scope

- `playbooks/setup_k3s_cluster.yml`
  - bootstraps the K3s control-plane nodes
  - runs serially across the `masters` group
- worker nodes are currently joined through Terraform launch template `user_data`
- operational access is expected through AWS SSM Session Manager

## Inventory

- Terraform writes the generated inventory to `infra/ansible/inventory/hosts.ini`
- the current inventory must at least contain the `masters` group before running the playbook

## Secrets

- the current bootstrap flow reads `k3s_shared_token` from the generated inventory
- `vault/vault.yml` is kept only as an optional placeholder for future Ansible Vault usage
- if the team later decides to use Ansible Vault, pass `--vault-password-file` explicitly at runtime

## Run

```bash
ansible-playbook -i inventory/hosts.ini playbooks/setup_k3s_cluster.yml
```
