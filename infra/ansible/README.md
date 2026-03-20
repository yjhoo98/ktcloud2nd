이 폴더는 생성된 서버에 K3s를 설치하고 운영 도구를 배포합니다.

```markdown
# K3s Cluster Automation (Ansible)

Terraform으로 생성된 노드들에 K3s 마스터 및 에이전트를 설치합니다.

## 🔐 보안 (Ansible Vault)
* `vault/vault.yml`에는 K3s 조인 토큰 등 민감 정보가 암호화되어 있습니다.
* **주의**: `vault_password` 파일은 절대 Git에 커밋하지 마세요 (현재 `.gitignore` 적용됨).

## 📝 실행 방법
```bash
# 전체 클러스터 구축
ansible-playbook -i inventory/hosts.ini setup_k3s_cluster.yml --vault-password-file vault/vault_password