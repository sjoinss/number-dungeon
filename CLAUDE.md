@AGENTS.md

# 숫자 던전 — 작업 안내

나보다 작은 숫자의 몬스터를 흡수하며 보스를 잡는 방 그래프 퍼즐 (Next.js 정적 내보내기 + DOM, 외부 라이브러리 없음).
분위기·디자인 시스템·스킨 변환은 상위 폴더 `../jumping`(점프점프)에서 가져왔다.

## 문서 우선순위

1. **사용자 결정** — 아래 "사용자 결정" 절 (기획서와 다르면 이쪽이 우선)
2. `number-absorb-puzzle-spec.md` (기획서), `../jumping/UI제작원칙.md`
3. `docs/ui-plan.md` (분석·구성안·자체 검토)

## 명령

| 명령 | 내용 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | `tsconfig.test.json`으로 `.test-build/`에 컴파일 후 `node --test` (규칙·솔버·스테이지·에디터·치비·대비) |
| `npm run build` | `out/` 정적 내보내기 |
| `npm run levels` | `scripts/build-levels.cjs`로 `src/game/levels.json` 다시 만들기 (손으로 만든 1~5 + 생성기 6~12) |

- 이 PC(Windows)의 `python`은 MS Store 스텁 → 스크립트는 **node**로.
- 배포 워크플로(`.github/workflows/deploy.yml`)는 점프점프 것 그대로 (main 푸시 → test → build → Pages). 아직 저장소 없음.

## 구조

```
src/
  game/       types · rules(판정, 순수) · attempt(시도·되돌리기·세션) · solver(DFS+메모, 상자 AND 노드, 탐욕 시뮬) ·
              generator(역방향 생성, 시드) · levels.json/levels.ts · stars · messages(화면·스크린리더 문장)
  sprites/    defaults(기본 도트) · chibi(스킨 → 꼬마 비율 조립, 표 기반) · assign(외형 배정) · draw
  editor/     session(에디터 reducer) · imageConvert/imageLoad · skinFetch · DotCanvas/Toolbar/Palette/ColorPicker/grid/history(점프점프에서)
  components/ App(화면 전환) · GameData(저장·설정·효과음) · Board · screens/ · ui/(점프점프 공통 컴포넌트)
  lib/        schema(꾸민 그림 검증) · prefs(진행·설정, localStorage) · storage(IndexedDB) · sound
  styles/tokens.css  점프점프 기본 테마 토큰 + 보드 색 (tests/contrast.test.ts가 대비 확인)
```

## 핵심 규칙

- 판정 `hero > monster`, **동점은 패배**(`TIE_RESULT`). 이기면 `hero += reward`(없으면 power). 1 밑으로 떨어지면 패배.
- 문은 **단순 막힘**(상태 그대로 + 안내). 상자는 들어가면 하나를 꼭 골라야 나갈 수 있고, 고르면 undo 스택을 비운다.
- 별: 페널티(재시작+되돌리기) 0 → 3, 1~3 → 2, 그 외 1 (`STAR_RULES`).
- 솔버의 "풀 수 있음"은 **상자 결과 전부**에서 깰 수 있다는 뜻. 4번 스테이지부터는 탐욕 전략으로 풀리면 테스트 실패.
- 스테이지를 고치면 `npm test`가 풀이 가능·연결선 겹침·탐욕 실패를 확인한다. 솔버 해답을 실제 규칙(attempt)으로 따라가는 테스트도 있다.
- 숫자 칩은 그림과 다른 층(`NumberChip`). 승패 힌트(✓/✕, 색) 금지 — `roomSpeech`도 보이는 정보만.

## 사용자 결정 (기획서보다 우선)

- 기술 스택: **Next.js + TS** (점프점프와 같게, 공통 컴포넌트·에디터·스킨 변환 재사용).
- **마크모드(몬스터를 마크 몹 외형으로) 없음** (2026-10-07, "징그럽다" — 만들었다가 뺌. 기획서 12장 제외). 다시 넣지 않는다. 예전 캐시 키 `mc.mobs.v1`은 시작할 때 지운다. 꾸미기의 마크 스킨 가져오기(내 그림으로 바꾸기)는 그대로.
- 에디터 격자: **16×16 / 32×32** (기획서대로). 스킨은 32×32 꼬마로 조립 → 스킨을 가져오면 격자도 32로.
- 범위: 기획서 1~3단계 (+ 생성기가 있어 "오늘의 도전"도 넣음). 4단계(마크모드)는 위 결정으로 제외.

## 확인 요령 (브라우저)

- 탭이 뒤에 있으면 렌더가 밀려서 JS로 연달아 누르면 상태 읽기가 어긋난다 → 스크린샷(탭 활성화)으로 확인하거나 한 번에 하나씩.
- 360·768px 확인은 `/__audit` 같은 404 주소에서 body를 비우고 같은 출처 iframe을 띄운다 (Chrome 창은 500px 밑으로 안 줄어든다).
- 스테이지 잠금 풀기: localStorage `number-dungeon.progress`에 `{ "s01": { "stars": 3, "bestPenalty": 0 }, … }`.
