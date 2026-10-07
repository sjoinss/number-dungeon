"use client";

import { useRef, useState } from "react";
import { DEFAULT_MONSTERS } from "@/sprites/defaults";
import { useGameData } from "../GameData";
import { SettingsPanel } from "../SettingsPanel";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { useToast } from "../ui/Toast";
import { ScreenLayout } from "./ScreenLayout";
import styles from "./SettingsScreen.module.css";

type Danger = "progress" | "sprites" | null;

/** 설정: 소리·모션 + 데이터 지우기(위험 동작은 맨 아래, 확인창 기본 포커스는 취소) */
export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const { resetProgress, saveCustom } = useGameData();
  const toast = useToast();
  const [confirm, setConfirm] = useState<Danger>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const doIt = async () => {
    if (confirm === "progress") {
      resetProgress();
      toast.show("진행 기록을 지웠어요.", "success");
    } else if (confirm === "sprites") {
      const ok = await saveCustom({ hero: null, boss: null, monsters: DEFAULT_MONSTERS.map(() => null) });
      toast.show(ok ? "모든 그림을 기본으로 되돌렸어요." : "저장하지 못했어요. 저장 공간을 확인해 주세요.", ok ? "success" : "error");
    }
    setConfirm(null);
  };

  return (
    <ScreenLayout title="설정" onBack={onBack} backLabel="처음 화면으로">
      <div className={styles.sections}>
        <SettingsPanel />
        <section className={styles.section} aria-labelledby="set-data">
          <h2 id="set-data" className={styles.title}>
            데이터
          </h2>
          <p className={styles.help}>진행 기록은 이 기기의 브라우저에만 저장돼요.</p>
          <Button variant="danger" icon="trash" onClick={() => setConfirm("progress")}>
            진행 기록 지우기
          </Button>
          <Button variant="danger" icon="trash" onClick={() => setConfirm("sprites")}>
            꾸민 그림 모두 기본으로
          </Button>
        </section>
      </div>

      <Dialog
        open={confirm !== null}
        title={confirm === "progress" ? "진행 기록을 지울까요?" : "그림을 모두 기본으로 돌릴까요?"}
        description={confirm === "progress" ? "클리어와 별이 모두 사라지고 되돌릴 수 없어요." : "주인공·보스·몬스터 그림이 기본으로 바뀌고 되돌릴 수 없어요."}
        onClose={() => setConfirm(null)}
        initialFocusRef={cancelRef}
        actions={
          <>
            <Button ref={cancelRef} onClick={() => setConfirm(null)}>
              취소
            </Button>
            <Button variant="danger" onClick={doIt}>
              지우기
            </Button>
          </>
        }
      />
    </ScreenLayout>
  );
}
