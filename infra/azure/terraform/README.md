## 접속 가이드 (Access Guide)

본 프로젝트는 보안을 위해 프라이빗 서브넷을 사용하며, 모든 접속은 **Bastion Host**를 경유합니다.<br>
편리한 접속을 위해 로컬 환경의 SSH 설정을 권장합니다.

### 1. SSH Config 설정
로컬 PC의 `~/.ssh/config` (Windows는 `C:\Users\<User>\.ssh\config`) 파일에 아래 내용을 추가하세요.

```text
Host bastion
    HostName <BASTION_PUBLIC_IP>
    User palja
    IdentityFile <PATH_TO_PEM_KEY>
    ForwardAgent yes

Host consumer
    HostName 10.0.2.4
    User palja
    IdentityFile <PATH_TO_PEM_KEY>
    ProxyJump bastion
    StrictHostKeyChecking no
    UserKnownHostsFile /dev/null
```

### 2. 접속 명령어
설정이 완료되면 로컬 터미널에서 아래 한 줄로 컨슈머 서버에 즉시 접속할 수 있습니다.

```text
ssh consumer
```

### 3. 실시간 로그 모니터링 (Troubleshooting)
접속 후 데이터 유입을 확인하려면 다음 명령어를 실행하세요.

```text
# 파이썬 정제기 로그 확인
docker logs -f python-processor
```
