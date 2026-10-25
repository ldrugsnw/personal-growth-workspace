import { afterEach, beforeEach, expect, it } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { db, repository, type Activity } from "./repository";
beforeEach(async () => {
  await db.activities.clear();
  await db.logs.clear();
});
afterEach(cleanup);
it("활동 생성 → 기록 저장 → 상세·성장 확인 → 수정 → 새로 마운트 후 유지", async () => {
  const user = userEvent.setup();
  const view = render(<App />);
  await user.click(await screen.findByText("첫 활동 만들기 +"));
  await user.type(screen.getByLabelText("활동 제목"), "React 배우기");
  await user.click(screen.getByText("활동 저장"));
  await user.click(
    await screen.findByRole("button", { name: /프로젝트.*React 배우기/ }),
  );
  await user.click(screen.getByText("기록 추가"));
  await user.type(screen.getByLabelText("요약 (필수)"), "폼 만들기");
  await user.type(screen.getByLabelText("배운 점"), "제어 컴포넌트");
  await user.click(screen.getByText("기록 저장"));
  expect(
    await screen.findByRole("heading", { name: "폼 만들기" }),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "성장" }));
  expect(await screen.findByText("제어 컴포넌트")).toBeInTheDocument();
  await user.click(screen.getByText("기록 수정"));
  await user.clear(screen.getByLabelText("요약 (필수)"));
  await user.type(screen.getByLabelText("요약 (필수)"), "폼 완성");
  await user.click(screen.getByText("기록 저장"));
  expect(
    await screen.findByRole("heading", { name: "폼 완성" }),
  ).toBeInTheDocument();
  view.unmount();
  render(<App />);
  expect(
    await screen.findByRole("heading", { name: "폼 완성" }),
  ).toBeInTheDocument();
});
it("성장 화면에서 활동별 필터를 적용한다", async () => {
  const base: Activity = {
    id: "a",
    title: "활동 A",
    type: "project",
    status: "active",
    currentState: "",
    nextAction: "",
    currentStateSourceLogId: null,
    nextActionSourceLogId: null,
    createdAt: "2026",
    updatedAt: "2026",
  };
  for (const id of ["a", "b"]) {
    await repository.saveActivity({ ...base, id, title: `활동 ${id}` });
    await repository.saveLog({
      id,
      activityId: id,
      summary: `기록 ${id}`,
      learning: "",
      achievement: "",
      occurredAt: "2026-01-01",
      createdAt: "2026",
      updatedAt: "2026",
    });
  }
  const user = userEvent.setup();
  render(<App />);
  await screen.findByText("최근 기록");
  await user.click(screen.getByRole("button", { name: "성장" }));
  await user.selectOptions(screen.getByLabelText("활동별 보기"), "a");
  expect(screen.getByText("기록 a")).toBeInTheDocument();
  expect(screen.queryByText("기록 b")).not.toBeInTheDocument();
});
it("출처 기록 수정 및 활동 삭제에 확인 화면을 표시한다", async () => {
  const a: Activity = {
    id: "a",
    title: "출처 활동",
    type: "project",
    status: "active",
    currentState: "",
    nextAction: "",
    currentStateSourceLogId: null,
    nextActionSourceLogId: null,
    createdAt: "2026",
    updatedAt: "2026",
  };
  await repository.saveActivity(a);
  await repository.saveLog(
    {
      id: "l",
      activityId: "a",
      summary: "원본",
      learning: "",
      achievement: "",
      occurredAt: "2026-01-01",
      createdAt: "2026",
      updatedAt: "2026",
    },
    { currentState: "보존할 상태" },
  );
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByText("기록 수정"));
  await user.type(screen.getByLabelText("요약 (필수)"), " 변경");
  await user.click(screen.getByText("기록 저장"));
  await user.click(within(screen.getByRole("alertdialog")).getByText("취소"));
  expect((await repository.read()).logs[0].summary).toBe("원본");
  await user.click(screen.getByText("기록 저장"));
  await user.click(screen.getByText("상태 유지하고 진행"));
  expect(await screen.findByText("원본 변경")).toBeInTheDocument();
  expect((await repository.read()).activities[0].currentState).toBe(
    "보존할 상태",
  );
  await user.click(screen.getByRole("button", { name: "활동" }));
  await user.click(screen.getByRole("button", { name: /프로젝트.*출처 활동/ }));
  await user.click(screen.getByText("활동 삭제"));
  expect(screen.getByRole("alertdialog")).toHaveTextContent("관련 기록 1개");
  await user.click(within(screen.getByRole("alertdialog")).getByText("취소"));
  expect((await repository.read()).activities).toHaveLength(1);
});
