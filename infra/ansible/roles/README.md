# Roles

Role definitions used by the Ansible playbooks.

- `k3s_master`
  - bootstraps the control-plane nodes
- `k3s_worker`
  - helper role for worker bootstrap logic when the team wants to run it through Ansible
- `linkerd`
  - reserved for future service mesh bootstrap
