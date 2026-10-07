/**
 * 스테이지 만들기: 앞 5개는 손으로 만든 튜토리얼, 뒤 7개는 생성기(src/game/generator.ts)로 찾아 검증한 것.
 * 실행: npm run levels  →  src/game/levels.json 을 다시 쓴다 (결과를 눈으로 검수한 뒤 커밋)
 */
const g = require(process.cwd()+'/.test-build/src/game/generator.js');
const s = require(process.cwd()+'/.test-build/src/game/solver.js');
const fs = require('fs');
const R = (id, type, col, row, links, extra={}) => ({ id, type, pos:[col,row], links, ...extra });
const hand = [
 { id:'s01', title:'첫 걸음', intro:'나보다 작은 숫자의 몬스터에 부딪히면 이기고 그 숫자를 흡수해요. 보스를 잡으면 클리어!', heroStart:3, undoLimit:null, rooms:[
   R('a','start',1,3,['b','c']), R('b','monster',0,2,['d'],{power:2}), R('c','monster',2,2,['d'],{power:6}),
   R('d','monster',1,1,[],{power:4}), R('e','boss',1,0,['d'],{power:8}) ]},
 { id:'s02', title:'어디부터 갈까', intro:'같거나 큰 숫자에 부딪히면 져요. 지면 처음부터 다시 시작해요.', heroStart:4, undoLimit:null, rooms:[
   R('a','start',1,4,['b','c']), R('b','monster',0,3,['d'],{power:3}), R('c','monster',2,3,['e'],{power:9}),
   R('d','monster',0,2,['f'],{power:5}), R('e','monster',2,2,['f'],{power:7}), R('f','monster',1,1,[],{power:14}), R('g','boss',1,0,['f'],{power:25}) ]},
 { id:'s03', title:'독 버섯', intro:'초록 몬스터는 독이 있어 이겨도 숫자가 줄어요. 되돌리기는 이제 3번까지.', heroStart:5, undoLimit:3, rooms:[
   R('a','start',1,3,['b','c']), R('b','monster',0,2,['d'],{power:2, reward:-4}), R('c','monster',2,2,['d'],{power:4}),
   R('d','monster',1,1,[],{power:8}), R('e','boss',1,0,['d'],{power:15}) ]},
 { id:'s04', title:'좁은 문', intro:'문에 적힌 숫자보다 크면 지나갈 수 없어요. 너무 커지지 않게 조심!', heroStart:5, undoLimit:3, rooms:[
   R('a','start',1,4,['b','g']), R('b','monster',0,3,['c'],{power:3}), R('c','monster',0,2,[],{power:6}),
   R('g','gate',2,3,['h'],{maxPower:10}), R('h','monster',2,2,['i'],{power:7}), R('i','empty',2,1,['j']), R('j','boss',1,1,[],{power:14}) ]},
 { id:'s05', title:'물약과 함정', intro:'물약은 숫자를 늘리고, 함정은 줄여요. 언제 밟느냐가 중요해요.', heroStart:6, undoLimit:3, rooms:[
   R('a','start',1,4,['b','t','i']), R('b','monster',0,4,[],{power:5}), R('i','item',2,4,[],{effect:'+4'}),
   R('t','trap',1,3,['h'],{effect:'/2'}), R('h','empty',1,2,['m','n','z']), R('m','monster',0,2,[],{power:4}), R('n','monster',2,2,[],{power:8}),
   R('z','boss',1,1,[],{power:21}) ]},
];
const gen = [
 ['s06','보물 상자','상자는 하나만 열 수 있어요. 무엇이 들었는지는 열어 봐야 알아요. 고른 뒤에는 되돌릴 수 없어요.', { gates:1, items:0, traps:0, poison:1, chests:1, size:9, cols:3 }],
 ['s07','두 갈래 문','문이 둘. 어느 쪽을 먼저 지나갈지 순서를 잘 정해요.', { gates:2, items:0, traps:0, poison:1, chests:0, size:10 }],
 ['s08','곱하기 물약','×2 물약은 늦게 마실수록 이득이에요.', { gates:1, items:2, traps:1, poison:1, chests:0, size:11 }],
 ['s09','함정 지대','함정이 여럿. 숫자가 작을 때 밟는 편이 손해가 적어요.', { gates:1, items:1, traps:2, poison:1, chests:1, size:12 }],
 ['s10','서둘러!','이동 횟수가 정해져 있어요. 시계 몬스터는 움직일 때마다 커져요.', { gates:1, items:1, traps:1, poison:1, chests:0, size:11, moveLimit:true, grow:1, undoLimit:2 }],
 ['s11','숨은 숫자','?는 부딪혀 봐야 알 수 있어요. 되돌리기는 1번.', { gates:1, items:1, traps:1, poison:1, chests:1, size:12, hidden:2, undoLimit:1 }],
 ['s12','마지막 탑','되돌리기 없이 끝까지. 지금까지 배운 것을 모두 써요.', { gates:2, items:1, traps:1, poison:1, chests:1, size:14, cols:4, rows:6, moveLimit:true, grow:1, hidden:1, undoLimit:0 }],
];
const out = [...hand];
for (const h of hand) { const r=s.solve(h); console.log(h.id, 'solvable', r.solvable, 'sol', r.solutions, 'greedy', s.greedyWins(h), r.plan.join(',')); }
const seeds = JSON.parse(process.argv[2]||'{}');
for (const [id,title,intro,cfg] of gen) {
  let res=null;
  for (let k = seeds[id]||1; k < 500 && !res; k++) res = g.generateStage(k*104729, { id, title, tries: 40, maxSolutions: 6, ...cfg });
  if (!res) { console.log(id,'FAILED'); continue; }
  res.stage.intro = intro;
  out.push(res.stage);
  console.log(id, 'seed', res.seed, 'sol', res.solutions, 'greedy', s.greedyWins(res.stage), 'rooms', res.stage.rooms.length, 'moveLimit', res.stage.moveLimit, 'plan', s.solve(res.stage).plan.join(','));
}
fs.writeFileSync(process.cwd()+'/src/game/levels.json', JSON.stringify(out, null, 1));
