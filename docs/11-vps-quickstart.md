# VPS 한 대로 서버 띄우기 (내부 테스트용 빠른 시작)

> 中文提要：本页是给韩文使用者的「一台 VPS 起内测服务器」步骤；命令与 docs/10-deployment.md §2.1 相同。

APK는 클라이언트일 뿐입니다. 판정·정산·봇·지갑은 모두 서버(Node + PostgreSQL + Redis)가 하므로 서버 한 대가 반드시 필요합니다.
Firebase 같은 서버리스 플랫폼은 이 구조(상시 WebSocket 게임 프로세스 + 관계형 원장)에 맞지 않고, 중국 본토에서는 Google 서비스 접속 자체가 막혀 있어 쓰지 않습니다.
가장 싸고 확실한 방법은 작은 VPS 한 대에 아래 명령 한 줄입니다. 사용자가 늘면 같은 구성 그대로 더 큰 서버로 옮기거나 api/game 노드를 늘리면 됩니다 (docs/10-deployment.md §2).

## 1. 서버 고르기

| 항목 | 값 |
|---|---|
| 사양 | 2 vCPU / 2 GB RAM / 20 GB 디스크 이상 (1 GB도 되지만 빌드가 느림) |
| OS | Ubuntu 22.04 / 24.04 (Debian, CentOS 계열도 가능) |
| 네트워크 | 공인 IP 1개, 보안그룹(방화벽)에서 **TCP 80** 인바운드 허용, SSH(22) 허용 |
| 비용 | 월 5~10 USD 수준 (또는 Oracle Cloud Always Free ARM VM: 무료) |

플레이어 위치에 따라 리전을 고릅니다.

- **중국 본토(연변) 플레이어**: 阿里云 / 腾讯云 轻量应用服务器 (예: 北京·上海·广州, 2C2G). 중국 밖 서버는 지연이 크고 접속이 불안정할 수 있습니다.
- **한국 플레이어**: Vultr / DigitalOcean / Linode의 서울·도쿄 리전, 또는 국내 VPS(가비아, iwinv 등).
- **둘 다**: 홍콩 또는 도쿄 리전이 절충안입니다.

Oracle Cloud Always Free(ARM, 4 OCPU / 24 GB)는 무료지만 가입·인스턴스 생성이 까다로울 수 있습니다. 그래도 되면 성능은 충분합니다.

## 2. 서버에 코드 올리기

두 가지 중 하나를 택합니다.

**A. 소스 tar 파일 업로드 (저장소 권한 불필요, 권장)**

로컬 PC에서 `bash tools/pack-server.sh`로 만든 `build/yanbian-server-*.tar.gz` 를 서버에 올립니다. (이미 받은 파일이 있으면 그것을 씁니다.)

```bash
scp yanbian-server-*.tar.gz root@<서버IP>:~/
ssh root@<서버IP>
tar xzf yanbian-server-*.tar.gz && cd yanbian
```

**B. git clone (GitHub 접근 권한이 있는 경우)**

```bash
ssh root@<서버IP>
git clone https://github.com/dyeyu8088-art/boheomcam-feedback.git yanbian && cd yanbian
```

비공개 저장소라면 GitHub Personal Access Token을 만들어 `https://<토큰>@github.com/...` 형태로 clone 합니다.

## 3. 설치 (한 줄)

```bash
bash deploy/install-test-server.sh
```

스크립트가 하는 일: Docker 설치 → `.env` 생성(랜덤 비밀번호·키, Git에 올라가지 않음) → 이미지 4개 빌드(첫 회 5~10분) → DB 마이그레이션·초기 관리자 생성 → 기동. 끝나면 이렇게 출력됩니다.

```
 APK / H5 登录页「服务器设置」填:  http://<서버IP>
 管理后台:                        http://<서버IP>/admin/   账号 admin   初始密码: xxxxxxxx（首登强制改密）
```

- **중국 서버에서 이미지 pull이 실패하면**: 스크립트가 안내하는 대로 `/etc/docker/daemon.json`에 镜像加速器 주소를 넣고 `systemctl restart docker` 후 다시 실행합니다. npm이 느리면 `.env`에 `NPM_REGISTRY=https://registry.npmmirror.com`을 추가하고 다시 실행합니다.
- 다시 실행해도 안전합니다 (`.env` 유지, 마이그레이션 멱등, 이미지 증분 빌드, 데이터 보존).

## 4. APK 연결

1. 폰에 `yanbian-test.apk` 설치.
2. 로그인 화면 하단 「服务器设置 / 서버 설정」→ `http://<서버IP>` 입력 → 「保存并重启」.
3. 「游客快速开始」로 입장. 마작·홍십은 매칭 시 봇이 자동으로 자리를 채웁니다.

폰 브라우저에서 `http://<서버IP>/` 를 열면 설치 없이 H5로도 같은 서버에 붙습니다. 관리자 페이지는 `http://<서버IP>/admin/` 입니다.

## 5. 운영 명령

```bash
cd ~/yanbian
docker compose -f deploy/docker-compose.test.yml --env-file .env ps            # 상태
docker compose -f deploy/docker-compose.test.yml --env-file .env logs -f api game   # 로그
docker compose -f deploy/docker-compose.test.yml --env-file .env restart        # 재시작
docker compose -f deploy/docker-compose.test.yml --env-file .env down           # 중지(데이터 유지)
```

새 버전 배포: 새 tar 파일을 풀어 덮어쓰거나 `git pull` 한 뒤 `bash deploy/install-test-server.sh`를 다시 실행합니다. nginx는 컨테이너 IP를 동적으로 찾으므로 재시작이 필요 없습니다.

## 6. 이 구성의 한계 (내부 테스트 전용)

- HTTP 평문입니다. 도메인·인증서 없이 IP로만 접속합니다. 외부 공개 서비스는 docs/10-deployment.md §2의 HTTPS/WSS 구성(prod compose: 백업·모니터링·WAL 아카이브 포함)으로 올려야 합니다.
- api 1개, game 1개 노드입니다. 동시 접속이 수백 명을 넘기 시작하면 서버 사양을 올리고 prod compose로 전환하세요 (api replicas, game 노드 추가는 nginx upstream 한 줄).
- 코인·다이아는 모두 게임 내 가상 오락 자산이며 현금 교환·환전 기능은 없습니다. 실물 가치가 개입되는 기능은 별도의 법률·라이선스 검토 없이는 추가하지 않습니다.
