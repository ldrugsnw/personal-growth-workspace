import { afterEach, beforeEach, expect, it } from "vitest";
import {
  GrowthDB,
  Repository,
  type Activity,
  type ActivityLog,
} from "./repository";
let db: GrowthDB, repo: Repository;
const a: Activity = {
  id: "a",
  title: "React 학습",
  type: "learning",
  status: "active",
  currentState: "초기",
  nextAction: "연습",
  currentStateSourceLogId: null,
  nextActionSourceLogId: null,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};
const l: ActivityLog = {
  id: "l",
  activityId: "a",
  summary: "훅 연습",
  learning: "상태 관리",
  achievement: "폼 구현",
  occurredAt: "2026-01-02",
  createdAt: "2026-01-02",
  updatedAt: "2026-01-02",
};
beforeEach(async () => {
  db = new GrowthDB("test-" + crypto.randomUUID());
  repo = new Repository(db);
  await repo.saveActivity(a);
});
afterEach(async () => {
  await db.delete();
});
it("새 DB 연결에서도 활동과 기록이 유지된다", async () => {
  await repo.saveLog(l);
  db.close();
  await db.open();
  expect((await repo.read()).logs[0].summary).toBe(l.summary);
  expect((await repo.read()).activities[0].title).toBe(a.title);
});
it("출처 수정은 확인이 필요하고 유지 및 비우기는 명시적으로 적용된다", async () => {
  await repo.saveLog(l, { currentState: "학습 완료", nextAction: "복습" });
  await expect(repo.saveLog({ ...l, summary: "수정" })).rejects.toThrow("확인");
  expect((await repo.read()).logs[0].summary).toBe(l.summary);
  await repo.saveLog({ ...l, summary: "수정" }, {}, "keep");
  expect((await repo.read()).activities[0].currentState).toBe("학습 완료");
  await repo.saveLog({ ...l, summary: "다시 수정" }, {}, "clear");
  expect((await repo.read()).activities[0].currentState).toBe("");
});
it("출처 삭제를 취소하면 변경되지 않으며 유지 선택은 값 보존 및 출처 해제", async () => {
  await repo.saveLog(l, { currentState: "완료" });
  await expect(repo.deleteLog(l.id)).rejects.toThrow("확인");
  expect((await repo.read()).logs).toHaveLength(1);
  await repo.deleteLog(l.id, "keep");
  const result = await repo.read();
  expect(result.activities[0].currentState).toBe("완료");
  expect(result.activities[0].currentStateSourceLogId).toBeNull();
  expect(result.logs).toHaveLength(0);
});
it("과거 기록 수정 및 삭제는 다른 출처 상태를 바꾸지 않는다", async () => {
  await repo.saveLog(l);
  await repo.saveLog({ ...l, id: "new" }, { currentState: "최신" });
  await repo.saveLog({ ...l, summary: "과거 수정" });
  await repo.deleteLog(l.id);
  expect((await repo.read()).activities[0].currentState).toBe("최신");
});
it("관련 기록이 있는 활동은 확인 없이 삭제되지 않는다", async () => {
  await repo.saveLog(l);
  await expect(repo.deleteActivity(a.id)).rejects.toThrow("확인");
  expect((await repo.read()).activities).toHaveLength(1);
  await repo.deleteActivity(a.id, true);
  expect(await repo.read()).toEqual({ activities: [], logs: [] });
});
it("없는 활동의 기록은 저장하지 않는다", async () => {
  await expect(repo.saveLog({ ...l, activityId: "missing" })).rejects.toThrow();
  expect((await repo.read()).logs).toHaveLength(0);
});
