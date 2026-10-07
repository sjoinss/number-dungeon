"use client";

import { useEffect, useId, useReducer, useRef, useState, type ChangeEvent } from "react";
import { DotCanvas } from "@/editor/DotCanvas";
import { ACCEPT_ATTR, removeCornerBackground, rgbaToSprite } from "@/editor/imageConvert";
import { loadImageFile } from "@/editor/imageLoad";
import { Palette } from "@/editor/Palette";
import { createEditor, current, editorReducer, isDirty } from "@/editor/session";
import { fetchSkinByName } from "@/editor/skinFetch";
import { Toolbar } from "@/editor/Toolbar";
import { MAX_MONSTER_SLOTS, type CustomSprites, type GridSize, type PixelSprite } from "@/lib/schema";
import { isSkinSize, skinToChibi } from "@/sprites/chibi";
import { DEFAULT_BOSS, DEFAULT_HERO, DEFAULT_MONSTERS, DEFAULT_MONSTER_NAMES } from "@/sprites/defaults";
import { useGameData } from "../GameData";
import { NumberChip } from "../NumberChip";
import { SpriteImg } from "../SpriteImg";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { InlineMessage } from "../ui/InlineMessage";
import { Segmented } from "../ui/Segmented";
import { useToast } from "../ui/Toast";
import { ScreenLayout } from "./ScreenLayout";
import styles from "./CustomizeScreen.module.css";

/** 편집 칸: 주인공 / 보스 / 몬스터 n번 */
type Slot = { kind: "hero" } | { kind: "boss" } | { kind: "monster"; index: number };

const PALETTE_KEY = "number-dungeon.palette";
const DEFAULT_PALETTE = ["#3d2c5e", "#fffdf8", "#ff9cc6", "#c9b6ff", "#a8e6c8", "#ffe39a", "#9fd0f5", "#ff8f8f", "#ffdcc0", "#8a5a3c"];

function slotKey(s: Slot) {
  return s.kind === "monster" ? `m${s.index}` : s.kind;
}

function slotName(s: Slot) {
  if (s.kind === "hero") return "주인공";
  if (s.kind === "boss") return "보스";
  return `몬스터 ${s.index + 1}`;
}

function defaultFor(s: Slot): PixelSprite | null {
  if (s.kind === "hero") return DEFAULT_HERO;
  if (s.kind === "boss") return DEFAULT_BOSS;
  return s.index < DEFAULT_MONSTERS.length ? DEFAULT_MONSTERS[s.index] : null;
}

function spriteOf(custom: CustomSprites, s: Slot): PixelSprite {
  if (s.kind === "hero") return custom.hero ?? DEFAULT_HERO;
  if (s.kind === "boss") return custom.boss ?? DEFAULT_BOSS;
  return custom.monsters[s.index] ?? defaultFor(s) ?? DEFAULT_MONSTERS[0];
}

function sameSprite(a: PixelSprite, b: PixelSprite | null) {
  return !!b && a.width === b.width && a.pixels.every((p, i) => p === b.pixels[i]);
}

/** 기본 그림과 같으면 null로 저장 (기본 그림이 바뀌면 따라가게) */
function withSprite(custom: CustomSprites, s: Slot, sprite: PixelSprite | null): CustomSprites {
  const value = sprite && sameSprite(sprite, defaultFor(s)) ? null : sprite;
  if (s.kind === "hero") return { ...custom, hero: value };
  if (s.kind === "boss") return { ...custom, boss: value };
  const monsters = custom.monsters.slice();
  monsters[s.index] = value;
  return { ...custom, monsters };
}

function loadPalette(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(PALETTE_KEY) ?? "null");
    if (Array.isArray(raw) && raw.every((c) => typeof c === "string" && /^#[0-9a-f]{6}$/.test(c))) return raw;
  } catch {
    // 기본 팔레트
  }
  return DEFAULT_PALETTE;
}

/**
 * 꾸미기 (기획서 10장): 주인공·보스·몬스터 그림을 도트 에디터로 고치거나, 이미지·마크 스킨으로 바꾼다.
 * 칸 목록 → 에디터(캔버스 · 도구 · 색) → 미리보기(게임 크기 + 숫자 칩) → 저장.
 */
export function CustomizeScreen({ onBack }: { onBack: () => void }) {
  const { custom, saveCustom, ready } = useGameData();
  const toast = useToast();
  const [slot, setSlot] = useState<Slot>({ kind: "hero" });
  const [editor, dispatch] = useReducer(editorReducer, DEFAULT_HERO, (s) => createEditor(s));
  const [palette, setPalette] = useState<string[]>(DEFAULT_PALETTE);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [saving, setSaving] = useState(false);
  const stayRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setPalette(loadPalette()), []);

  // 저장소를 다 읽으면 지금 칸을 연다
  useEffect(() => {
    if (ready) dispatch({ type: "open", sprite: spriteOf(custom, slot) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const sprite = current(editor);
  const dirty = isDirty(editor);
  const def = defaultFor(slot);

  /** 저장 안 한 그림이 있으면 먼저 묻는다 */
  const guard = (then: () => void) => {
    if (dirty) setPending(() => then);
    else then();
  };

  const open = (s: Slot, from: CustomSprites = custom) => {
    setSlot(s);
    dispatch({ type: "open", sprite: spriteOf(from, s) });
  };

  const save = async (): Promise<boolean> => {
    setSaving(true);
    const next = withSprite(custom, slot, sprite);
    const ok = await saveCustom(next);
    setSaving(false);
    if (ok) {
      dispatch({ type: "saved" });
      toast.show(`${slotName(slot)} 그림을 저장했어요.`, "success");
    } else {
      toast.show("저장하지 못했어요. 브라우저 저장 공간을 확인하고 다시 해 주세요.", "error", 6000);
    }
    return ok;
  };

  const addMonster = () =>
    guard(() => {
      const index = custom.monsters.length;
      const next = { ...custom, monsters: [...custom.monsters, DEFAULT_MONSTERS[index % DEFAULT_MONSTERS.length]] };
      void saveCustom(next);
      open({ kind: "monster", index }, next);
    });

  const removeMonster = async () => {
    if (slot.kind !== "monster" || slot.index < DEFAULT_MONSTERS.length) return;
    const next = { ...custom, monsters: custom.monsters.filter((_, i) => i !== slot.index) };
    const ok = await saveCustom(next);
    toast.show(ok ? "몬스터 칸을 지웠어요." : "저장하지 못했어요.", ok ? "success" : "error");
    open({ kind: "hero" }, next);
  };

  const onPalette = (p: string[]) => {
    setPalette(p);
    try {
      localStorage.setItem(PALETTE_KEY, JSON.stringify(p));
    } catch {
      // 이번 실행 동안만
    }
  };

  const slots: Slot[] = [{ kind: "hero" }, { kind: "boss" }, ...custom.monsters.map((_, index) => ({ kind: "monster" as const, index }))];
  const size = sprite.width as GridSize;

  return (
    <ScreenLayout title="꾸미기" onBack={() => guard(onBack)} backLabel="처음 화면으로">
      <div className={styles.layout}>
        <nav className={styles.slots} aria-label="꾸밀 그림 고르기">
          <ul>
            {slots.map((s) => {
              const active = slotKey(s) === slotKey(slot);
              return (
                <li key={slotKey(s)}>
                  <button
                    type="button"
                    className={styles.slot}
                    aria-current={active ? "true" : undefined}
                    onClick={() => !active && guard(() => open(s))}
                  >
                    <SpriteImg sprite={active ? sprite : spriteOf(custom, s)} className={styles.slotImg} />
                    <span>{slotName(s)}</span>
                  </button>
                </li>
              );
            })}
            <li>
              <button
                type="button"
                className={`${styles.slot} ${styles.add}`}
                onClick={addMonster}
                disabled={custom.monsters.length >= MAX_MONSTER_SLOTS}
                aria-describedby="add-help"
              >
                <span className={styles.plus} aria-hidden="true">
                  +
                </span>
                <span>몬스터 추가</span>
              </button>
            </li>
          </ul>
          <p id="add-help" className={styles.help}>
            {custom.monsters.length >= MAX_MONSTER_SLOTS
              ? `몬스터는 ${MAX_MONSTER_SLOTS}개까지 등록할 수 있어요.`
              : "몬스터 외형은 몬스터마다 정해진 칸에서 고정으로 골라져요."}
          </p>
        </nav>

        <section className={styles.editor} aria-labelledby="editor-title">
          <div className={styles.editorHead}>
            <h2 id="editor-title" className={styles.h2}>
              {slotName(slot)} 그리기
            </h2>
            {dirty && <span className={styles.dirty}>저장 안 됨</span>}
          </div>

          <div className={styles.work}>
            <div className={styles.canvasBox}>
              <DotCanvas
                sprite={sprite}
                showGrid={editor.grid}
                symmetry={editor.symmetry}
                tool={editor.tool}
                label={`${slotName(slot)} 그림 ${size}×${size} 칸. 누르고 끌어서 칠해요`}
                onCell={(phase, x, y) => dispatch({ type: "pointer", phase, x, y })}
              />
            </div>

            <div className={styles.tools}>
              <Toolbar
                tool={editor.tool}
                onTool={(tool) => dispatch({ type: "tool", tool })}
                symmetry={editor.symmetry}
                grid={editor.grid}
                canUndo={editor.history.past.length > 0}
                canRedo={editor.history.future.length > 0}
                onUndo={() => dispatch({ type: "undo" })}
                onRedo={() => dispatch({ type: "redo" })}
                onToggleSymmetry={() => dispatch({ type: "symmetry" })}
                onToggleGrid={() => dispatch({ type: "grid" })}
                onFlip={() => dispatch({ type: "flip" })}
                onClear={() => dispatch({ type: "clear" })}
              />
              <Palette color={editor.color} palette={palette} onColor={(color) => dispatch({ type: "color", color })} onPaletteChange={onPalette} />
              <Segmented<GridSize>
                label="격자 크기"
                options={[
                  { value: 16, label: "16×16" },
                  { value: 32, label: "32×32" },
                ]}
                value={size}
                onChange={(v) => dispatch({ type: "resize", size: v })}
              />
              <Preview sprite={sprite} slot={slot} />
            </div>
          </div>

          <div className={styles.actions}>
            <Button variant="primary" icon="check" onClick={save} disabled={!dirty} loading={saving} loadingLabel="저장 중…">
              저장
            </Button>
            {def && (
              <Button variant="ghost" icon="restart" onClick={() => dispatch({ type: "replace", sprite: def })} disabled={sameSprite(sprite, def)}>
                기본 그림으로
              </Button>
            )}
            {slot.kind === "monster" && slot.index >= DEFAULT_MONSTERS.length && (
              <Button variant="danger" icon="trash" onClick={removeMonster}>
                이 몬스터 칸 지우기
              </Button>
            )}
          </div>

          <Importers size={size} onSprite={(s) => dispatch({ type: "replace", sprite: s })} />
        </section>
      </div>

      <Dialog
        open={pending !== null}
        title="저장하지 않은 그림이 있어요"
        description={`${slotName(slot)} 그림을 바꿨어요. 어떻게 할까요?`}
        onClose={() => setPending(null)}
        initialFocusRef={stayRef}
        actions={
          <>
            <Button ref={stayRef} onClick={() => setPending(null)}>
              계속 그리기
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const then = pending;
                setPending(null);
                then?.();
              }}
            >
              버리고 이동
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                const then = pending;
                setPending(null);
                if (await save()) then?.();
              }}
            >
              저장하고 이동
            </Button>
          </>
        }
      />
    </ScreenLayout>
  );
}

/** 게임에서 보이는 크기로 미리보기 + 숫자 칩이 그림을 가리지 않는지 */
function Preview({ sprite, slot }: { sprite: PixelSprite; slot: Slot }) {
  return (
    <figure className={styles.preview}>
      <div className={styles.previewStage} aria-hidden="true">
        <NumberChip value={slot.kind === "hero" ? 12 : slot.kind === "boss" ? 30 : 7} tone={slot.kind === "hero" ? "hero" : slot.kind === "boss" ? "boss" : "plain"} />
        <SpriteImg sprite={sprite} className={styles.previewImg} />
      </div>
      <figcaption className={styles.help}>미리보기: 게임 속 크기와 머리 위 숫자</figcaption>
    </figure>
  );
}

type ImportProps = { size: GridSize; onSprite: (s: PixelSprite) => void };

/** 이미지 불러오기 · 마크 스킨(아이디/파일) 가져오기 — 로딩·오류·성공 상태를 글자로 */
function Importers({ size, onSprite }: ImportProps) {
  const toast = useToast();
  const imageInput = useRef<HTMLInputElement>(null);
  const skinInput = useRef<HTMLInputElement>(null);
  const nameId = useId();
  const [removeBg, setRemoveBg] = useState(true);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<"image" | "name" | "skin" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fromImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setBusy("image");
    const res = await loadImageFile(file);
    setBusy(null);
    if (!res.ok) return setError(res.message);
    let s = rgbaToSprite(res.value.rgba, res.value.width, res.value.height, size);
    if (removeBg) s = removeCornerBackground(s);
    onSprite(s);
    toast.show(`이미지를 ${size}×${size} 도트로 바꿨어요. 마음에 들면 저장을 눌러 주세요.`, "success");
  };

  const applySkin = async (file: File) => {
    const res = await loadImageFile(file);
    if (!res.ok) return setError(res.message);
    if (!isSkinSize(res.value.width, res.value.height)) {
      return setError(`마인크래프트 스킨은 64×64 또는 64×32 PNG예요. 고른 파일은 ${res.value.width}×${res.value.height}이에요.`);
    }
    // 스킨은 32×32 꼬마로 조립된다 (16칸으로 줄이면 얼굴이 뭉개져서 격자도 32×32로 바꾼다)
    onSprite(skinToChibi(res.value));
    toast.show(size === 32 ? "스킨을 꼬마 도트로 바꿨어요. 저장을 눌러 주세요." : "스킨을 꼬마 도트로 바꾸고 격자를 32×32로 키웠어요. 저장을 눌러 주세요.", "success", 5000);
  };

  const fromName = async () => {
    setError(null);
    setBusy("name");
    const res = await fetchSkinByName(name);
    if (!res.ok) {
      setBusy(null);
      return setError(res.message);
    }
    await applySkin(res.file);
    setBusy(null);
  };

  const fromSkinFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setBusy("skin");
    await applySkin(file);
    setBusy(null);
  };

  return (
    <section className={styles.import} aria-labelledby="import-title">
      <h3 id="import-title" className={styles.h3}>
        그림 가져오기
      </h3>
      {error && (
        <InlineMessage tone="error" title="가져오지 못했어요">
          {error}
        </InlineMessage>
      )}

      <div className={styles.importGroup}>
        <p className={styles.importLabel}>내 이미지</p>
        <p className={styles.help}>PNG·JPEG·WebP·GIF, 2MB 이하. 지금 격자({size}×{size})에 맞춰 도트로 다시 그려요.</p>
        <label className={styles.check}>
          <input type="checkbox" checked={removeBg} onChange={(e) => setRemoveBg(e.target.checked)} />
          네 모서리와 같은 배경색 지우기
        </label>
        <Button icon="image" onClick={() => imageInput.current?.click()} loading={busy === "image"} loadingLabel="여는 중…">
          이미지 불러오기
        </Button>
        <input ref={imageInput} type="file" accept={ACCEPT_ATTR} hidden onChange={fromImage} />
      </div>

      <div className={styles.importGroup}>
        <p className={styles.importLabel}>마인크래프트 스킨</p>
        <p className={styles.help}>머리는 크게, 몸은 작게 꼬마 비율로 바꿔요. 바꾼 뒤 도트로 더 고칠 수 있어요.</p>
        <label htmlFor={nameId} className={styles.fieldLabel}>
          마인크래프트 아이디
        </label>
        <div className={styles.nameRow}>
          <input
            id={nameId}
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && fromName()}
            autoComplete="off"
            spellCheck={false}
            maxLength={16}
            aria-describedby={`${nameId}-help`}
          />
          <Button icon="download" onClick={fromName} disabled={!name.trim()} loading={busy === "name"} loadingLabel="받는 중…">
            가져오기
          </Button>
        </div>
        <p id={`${nameId}-help`} className={styles.help}>
          영문·숫자·밑줄 3~16자. 아이디만 공개 스킨 서비스(minotar.net)로 보내요.
        </p>
        <Button variant="ghost" icon="upload" onClick={() => skinInput.current?.click()} loading={busy === "skin"} loadingLabel="여는 중…">
          스킨 파일 고르기
        </Button>
        <input ref={skinInput} type="file" accept="image/png" hidden onChange={fromSkinFile} />
      </div>
    </section>
  );
}
