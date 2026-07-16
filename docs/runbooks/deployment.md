# 배포 런북 (Vercel, 클라이언트 스크리닝 런칭 모드)

이 문서는 Honey Case Adventure를 Vercel에 배포하기 위한 실제 절차입니다.
현재 런칭 구성은 다음 두 가지 의도적인 임시 결정을 전제로 합니다:

- `OTP_VERIFICATION_ENABLED=false`: 클라이언트 전화번호 SMS 인증 단계를 건너뜁니다.
  실제 SMS 발급 연동(Twilio 등)이 아직 없기 때문입니다. 개인정보/약관 동의(체크박스)는
  그대로 필수로 남아있고, 서버는 여전히 초대장에 등록된 전화번호와 일치하는지 확인합니다.
  전화 소유 여부만 검증하지 않습니다.
- `SCHEDULER_ENABLED=false`: 백그라운드 알림 워커(모바일 푸시 리마인더)는 이번 런칭에
  포함하지 않습니다. 클라이언트는 앱을 열어서 진행 상황을 확인해야 하며, 푸시 알림은
  오지 않습니다.

두 가지 모두 나중에 언제든 다시 켤 수 있게 코드가 되어 있습니다 (env 값만 바꾸면 됨).

## 0. 알아둘 것

- 스태프/관리자 로그인은 프로덕션에서 항상 비활성화됩니다 (`DEV_STAFF_AUTH_ENABLED`는
  `NODE_ENV=production`일 때 반드시 `false`여야 하고, 코드가 이를 강제합니다). 즉,
  지금 배포하면 `/staff/login`으로 아무도 못 들어갑니다. Google Workspace 로그인 연동이
  되기 전까지는 스태프용 화면(제출된 답변 확인, 콘텐츠 승인 등)을 쓸 수 없습니다.
  필요하시면 임시로 안전한 비밀번호 로그인을 하나 만들어 붙일 수 있어요 — 원하시면 말씀해주세요.
- `git push`는 이 세션(샌드박스)에서 대신 실행해드릴 수 없었어요. 마운트된 프로젝트
  폴더에서 `.git/index.lock` 파일을 지울 권한이 없어서 git 쓰기 작업이 막혀 있습니다
  (Downloads 폴더가 iCloud 등과 동기화 중이면 종종 발생). 아래 git 명령은 사장님
  맥 터미널에서 직접 실행해주세요.
- Vercel 연동에 있는 "파일 직접 배포" 도구도 써봤는데, 이건 방금 만든 작은 앱을 올리는
  용도라 이 프로젝트처럼 패키지가 여러 개인 모노레포(80개 넘는 소스 파일)를 통째로
  넣기엔 안 맞았어요(용량 문제). 그래서 DB는 실제로 만들어뒀고, 나머지는 GitHub 경유가
  맞습니다 — 아래 순서대로 하시면 5분이면 끝나요.

## 1. GitHub에 코드 올리기 (로컬 터미널에서)

```bash
cd ~/Downloads/honey-codex-senior-engineering-pack
git add -A
git commit -m "Arcade theme, mobile optimization, launch-mode OTP bypass"
git branch -M main
git remote add origin https://github.com/suhyunmoon1998/Honey_screen.git
git push -u origin main
```

이미 `origin`이 설정되어 있다면 `git remote add origin ...` 줄은 건너뛰세요.

참고: `git status`로 확인해보니 이번 세션에서 제가 건드리지 않은 변경사항도 이미 많이
쌓여있었어요 (워커/알림/스키마/문서 등, README에 적힌 Task 03 작업으로 보입니다). 위
명령은 그 변경사항도 함께 커밋/푸시합니다. 혹시 그 중에 아직 완성되지 않은 게 있다면
커밋 전에 `git status` / `git diff`로 한 번 확인해보시는 게 안전해요.

## 2. Postgres DB — CaseSync 사용

기존 Supabase 프로젝트 `CaseSync`를 복구해서 이 앱의 DB로 붙였습니다 (처음엔 새 프로젝트
`honey-screen`을 만들었었는데, 요청하신 대로 CaseSync로 다시 바꿨어요 — `honey-screen`은
사용 안 하는 채로 일시정지해뒀습니다. 무료 플랜은 활성 프로젝트 2개 제한이 있어서, 안 쓰는
JackLaw/honey-screen은 계속 일시정지 상태로 둘게요).

- 프로젝트: `CaseSync` (Supabase, us-east-1)
- 스키마는 비어 있는 상태였고(테이블 없음), 접속용 `app_user` role을 새로 만들어서 public
  스키마 전체 권한만 부여했습니다 (postgres 슈퍼유저 계정은 안 씁니다).
- 아래 4단계 `DATABASE_URL`에 완성된 연결 문자열을 넣어뒀습니다. 그대로 복사해서 쓰시면
  `pnpm vercel-build`가 배포 시 자동으로 스키마 마이그레이션을 적용합니다.

CaseSync에 혹시 이전에 쓰던 다른 데이터가 있었다면, 이번 마이그레이션으로 이 앱의 테이블
(Client, Mission, Invitation 등)이 새로 생성됩니다. 기존 테이블과 이름이 겹치지 않는 한
문제 없어요.

## 3. Vercel 프로젝트 생성 및 설정

1. Vercel 대시보드 → Add New → Project → 방금 올린 GitHub 저장소(`Honey_screen`) 선택
2. **Root Directory**: `apps/web`
3. **Build Command**: 아래로 직접 오버라이드

   ```bash
   cd ../.. && pnpm vercel-build
   ```

   (`vercel-build` 스크립트는 `prisma migrate deploy`로 DB 스키마를 적용한 뒤 웹 앱을
   빌드합니다. 루트 `package.json`에 이미 추가해뒀습니다.)

4. **Install Command / Output Directory**: 기본값 그대로 두면 됩니다 (Vercel이
   pnpm-workspace.yaml을 감지해서 루트에서 설치합니다).

## 4. 환경 변수 설정 (Vercel → Settings → Environment Variables, Production)

| 변수                             | 값                                                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                       | `production`                                                                                                |
| `APP_URL`                        | `https://<프로젝트이름>.vercel.app` (프로젝트 생성 시 정해짐, 나중에 커스텀 도메인 연결하면 그 값으로 교체) |
| `DATABASE_URL`                   | Supabase에서 새로 발급한 최소 권한 애플리케이션 DB 연결 문자열 (`sslmode=require`)                          |
| `SESSION_COOKIE_NAME`            | `honey_session`                                                                                             |
| `SESSION_TTL_HOURS`              | `24`                                                                                                        |
| `DEV_OTP_ENABLED`                | `false`                                                                                                     |
| `DEV_STAFF_AUTH_ENABLED`         | `false`                                                                                                     |
| `DEV_STAFF_PASSWORD`             | 새로 생성한 32자 이상의 임의 문자열 (프로덕션에서는 인증에 사용되지 않음)                                   |
| `OTP_VERIFICATION_ENABLED`       | `false`                                                                                                     |
| `INVITATION_SIGNING_SECRET`      | 비밀 관리자에서 새로 생성한 32바이트 이상의 임의 문자열                                                     |
| `PRIVACY_POLICY_VERSION`         | `2026-07-10`                                                                                                |
| `ORGANIZATION_DEFAULT_TIME_ZONE` | `America/Los_Angeles` (로펌 실제 시간대로 바꾸세요)                                                         |
| `SCHEDULER_ENABLED`              | `false`                                                                                                     |
| `ALLOW_DEMO_CONTENT`             | `false`                                                                                                     |

나머지 `WORKER_*`, `SMS_REMINDERS_ENABLED`, `PUSH_*`, `VAPID_*` 값은 안 넣어도 됩니다
(기본값이 안전하게 꺼진 상태로 잡혀 있어요).

비밀값은 문서나 Git에 기록하지 말고 Vercel 환경 변수와 비밀 관리자에만 보관하세요.
과거에 문서나 채팅에 노출된 값은 재사용하지 말고 폐기·교체해야 합니다.

## 5. 배포 및 확인

1. 환경 변수 저장 후 Deploy
2. 배포 완료되면 `https://<도메인>/invite/<실제토큰>` 형태의 링크를 만들어서 본인 번호로
   테스트 (실제 초대장은 스태프 도구로 발급해야 하는데, 이 부분은 아직 스태프 로그인이
   막혀 있어서 DB에 직접 초대 레코드를 만들어야 할 수도 있어요 — 필요하시면 도와드릴게요)
3. 문제 없으면 그 링크를 클라이언트에게 문자로 직접 보내시면 됩니다

## 나중에 되돌리기

- 실제 SMS 인증을 붙이면: `OTP_VERIFICATION_ENABLED=true`로 바꾸고 Twilio 등 연동 코드 추가
- 알림 워커를 켜려면: 워커를 Railway/Render 같은 상시 실행 호스팅에 별도 배포하고,
  `SCHEDULER_ENABLED=true` + `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`PUSH_ENCRYPTION_KEY_B64` 설정
