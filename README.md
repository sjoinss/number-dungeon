# 숫자 던전

주인공 머리 위의 숫자보다 **작은 숫자**의 몬스터에 부딪히면 이기고 그 숫자를 흡수합니다. 같거나 큰 몬스터에 부딪히면 그 스테이지를 처음부터 다시 합니다.
누구를 먼저 잡고 무엇을 건너뛸지 순서를 정해 보스를 잡는 퍼즐입니다. 힌트·광고는 없습니다.

- 기획: [`number-absorb-puzzle-spec.md`](number-absorb-puzzle-spec.md)
- 분석·구성안·검토: [`docs/ui-plan.md`](docs/ui-plan.md)

## 개발

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 단위 테스트 (node:test) — 모든 스테이지 풀이 가능 여부 포함
npm run build      # 정적 파일을 out/ 에 생성
npm run levels     # 스테이지 다시 만들기 (src/game/levels.json)
```

Next.js(App Router, 정적 내보내기) + TypeScript, 외부 라이브러리 없이 만듭니다. 디자인과 도트 에디터·스킨 변환은 [점프점프](../jumping)에서 가져왔습니다.
진행 기록·설정은 localStorage, 꾸민 그림은 IndexedDB에만 저장하며 서버로 보내지 않습니다.

마크모드의 마인크래프트 몹 텍스처는 이 저장소에 들어 있지 않습니다. 켤 때 공개 에셋 미러에서 받아 브라우저 안에서 변환합니다.
