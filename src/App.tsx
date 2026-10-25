import { useEffect, useState, type FormEvent } from "react";
import {
  repository,
  type Activity,
  type ActivityLog,
  type SourcePolicy,
} from "./repository";
const types = {
  project: "프로젝트",
  learning: "학습·독서",
  certification: "자격증·시험",
};
const statuses = { active: "진행 중", paused: "보류", completed: "완료" };
const now = () => new Date().toISOString();
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const blankActivity = (): Activity => ({
  id: crypto.randomUUID(),
  title: "",
  type: "project",
  status: "active",
  currentState: "",
  nextAction: "",
  currentStateSourceLogId: null,
  nextActionSourceLogId: null,
  createdAt: now(),
  updatedAt: now(),
});
export default function App() {
  const [data, setData] = useState<{
    activities: Activity[];
    logs: ActivityLog[];
  }>({ activities: [], logs: [] });
  const [page, setPage] = useState("home"),
    [selected, setSelected] = useState(""),
    [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<Activity | null>(null),
    [log, setLog] = useState<ActivityLog | null>(null);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{
    title: string;
    source?: boolean;
    run: (p: SourcePolicy) => Promise<void>;
  } | null>(null);
  useEffect(() => {
    if (!editing && !log && !confirm) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialogs = document.querySelectorAll<HTMLElement>(
      '[role="dialog"], [role="alertdialog"]',
    );
    const dialog = dialogs[dialogs.length - 1];
    const elements = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), textarea, select:not(:disabled)",
        ) || [],
      );
    elements()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = elements();
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [!!editing, !!log, !!confirm]);
  const refresh = async () => setData(await repository.read());
  useEffect(() => {
    refresh()
      .catch(() =>
        setError(
          "로컬 저장소를 열 수 없습니다. 브라우저 저장 공간 및 설정을 확인한 뒤 새로고침해 주세요.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);
  async function act(fn: () => Promise<void>, message: string) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
      setNotice(message);
      return true;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "저장하지 못했습니다. 다시 시도해 주세요.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  const activity = data.activities.find((a) => a.id === selected);
  const startLog = (activityId = selected || data.activities[0]?.id || "") =>
    setLog({
      id: crypto.randomUUID(),
      activityId,
      summary: "",
      learning: "",
      achievement: "",
      occurredAt: today(),
      createdAt: now(),
      updatedAt: now(),
    });
  const sourced = (l: ActivityLog) => {
    const a = data.activities.find((a) => a.id === l.activityId);
    return (
      a?.currentStateSourceLogId === l.id || a?.nextActionSourceLogId === l.id
    );
  };
  function logCards(logs: ActivityLog[]) {
    return logs.length ? (
      logs.map((l) => (
        <article className="log-card" key={l.id}>
          <div className="meta">
            <span>
              {data.activities.find((a) => a.id === l.activityId)?.title}
            </span>
            <time dateTime={l.occurredAt}>{l.occurredAt}</time>
          </div>
          <h3>{l.summary}</h3>
          {l.learning && (
            <p className="learning">
              <b>배운 점</b>
              {l.learning}
            </p>
          )}
          {l.achievement && (
            <p className="achievement">
              <b>성취</b>
              {l.achievement}
            </p>
          )}
          <div className="actions">
            <button onClick={() => setLog(l)}>기록 수정</button>
            <button
              className="danger"
              onClick={() =>
                setConfirm({
                  title: sourced(l)
                    ? "이 기록은 현재 상태 또는 다음 행동의 출처입니다. 연결된 상태를 어떻게 처리할까요?"
                    : "이 기록을 삭제할까요?",
                  source: sourced(l),
                  run: async (p) => {
                    if (
                      await act(
                        () => repository.deleteLog(l.id, p),
                        "기록을 삭제했습니다.",
                      )
                    )
                      setConfirm(null);
                  },
                })
              }
            >
              기록 삭제
            </button>
          </div>
        </article>
      ))
    ) : (
      <div className="empty">
        아직 기록이 없습니다. 작은 배움부터 남겨 보세요.
      </div>
    );
  }
  return (
    <div className="shell">
      <aside>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("home");
          }}
        >
          pg<span>workspace</span>
        </a>
        <p className="sidebar-label">PERSONAL GROWTH</p>
        <nav aria-label="주 메뉴">
          {[
            ["home", "오늘의 기록"],
            ["activities", "활동"],
            ["growth", "성장"],
          ].map(([key, label]) => (
            <button
              key={key}
              aria-current={page === key ? "page" : undefined}
              onClick={() => {
                setPage(key);
                setSelected("");
              }}
            >
              {label}
              <span aria-hidden="true">
                {key === "home" ? "↗" : key === "activities" ? "◻" : "⌁"}
              </span>
            </button>
          ))}
        </nav>
        <p className="local-note">
          나만의 속도로, 꾸준히.
          <br />
          <span>이 브라우저에 안전하게 기록됩니다.</span>
        </p>
      </aside>
      <main>
        <header>
          <span>
            MY WORKSPACE /{" "}
            {page === "home"
              ? "JOURNAL"
              : page === "growth"
                ? "GROWTH"
                : "ACTIVITIES"}
          </span>
          <span>LOCAL ONLY</span>
        </header>
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="notice">
            {notice}
          </div>
        )}
        {loading ? (
          <p>기록을 불러오는 중…</p>
        ) : (
          <>
            {page === "home" && (
              <>
                <div className="heading">
                  <p className="eyebrow">ONE STEP AT A TIME</p>
                  <h1>오늘, 무엇을 배웠나요?</h1>
                  <p>작은 시도와 배움이 모여 당신의 성장이 됩니다.</p>
                </div>
                <section className="compose">
                  <span className="eyebrow">오늘의 한 걸음</span>
                  <h2>기억하고 싶은 순간을 남겨 보세요.</h2>
                  <p>
                    진행한 일, 새롭게 알게 된 것, 다음에 해보고 싶은 일까지.
                  </p>
                  <button
                    className="primary"
                    onClick={() =>
                      data.activities.length
                        ? startLog()
                        : setEditing(blankActivity())
                    }
                  >
                    {data.activities.length
                      ? "기록 작성하기 +"
                      : "첫 활동 만들기 +"}
                  </button>
                </section>
                <div className="section-heading">
                  <h2>최근 기록</h2>
                  <button onClick={() => setPage("growth")}>
                    모든 기록 보기 →
                  </button>
                </div>
                {logCards(data.logs.slice(0, 5))}
              </>
            )}
            {page === "activities" && (
              <>
                <div className="heading row">
                  <div>
                    <p className="eyebrow">MAKE ROOM FOR PROGRESS</p>
                    <h1>{activity ? activity.title : "나의 활동"}</h1>
                    <p>진행 중인 일과 다음 한 걸음을 한눈에.</p>
                  </div>
                  <button
                    className="primary"
                    onClick={() => setEditing(blankActivity())}
                  >
                    활동 추가 +
                  </button>
                </div>
                {activity ? (
                  <>
                    <button onClick={() => setSelected("")}>← 활동 목록</button>
                    <section className="activity-detail">
                      <div className="meta">
                        {types[activity.type]} · {statuses[activity.status]}
                      </div>
                      <h2>현재 상태</h2>
                      <p>
                        {activity.currentState || "아직 작성하지 않았습니다."}
                      </p>
                      <h2>다음 행동</h2>
                      <p>
                        {activity.nextAction || "다음 한 걸음을 정해 보세요."}
                      </p>
                      <div className="actions">
                        <button onClick={() => setEditing(activity)}>
                          활동 수정
                        </button>
                        <button onClick={() => startLog(activity.id)}>
                          기록 추가
                        </button>
                        <button
                          className="danger"
                          onClick={() =>
                            setConfirm({
                              title: `활동을 삭제할까요? 관련 기록 ${data.logs.filter((l) => l.activityId === activity.id).length}개도 함께 삭제됩니다. 삭제 후 복구할 수 없습니다.`,
                              run: async () => {
                                if (
                                  await act(
                                    () =>
                                      repository.deleteActivity(
                                        activity.id,
                                        true,
                                      ),
                                    "활동과 관련 기록을 삭제했습니다.",
                                  )
                                ) {
                                  setConfirm(null);
                                  setSelected("");
                                }
                              },
                            })
                          }
                        >
                          활동 삭제
                        </button>
                      </div>
                    </section>
                    <h2>활동 기록</h2>
                    {logCards(
                      data.logs.filter((l) => l.activityId === activity.id),
                    )}
                  </>
                ) : (
                  <div className="activity-grid">
                    {data.activities.length ? (
                      data.activities.map((a) => (
                        <button
                          className="activity-card"
                          key={a.id}
                          onClick={() => setSelected(a.id)}
                        >
                          <div className="meta">
                            {types[a.type]}
                            <span className={`badge ${a.status}`}>
                              {statuses[a.status]}
                            </span>
                          </div>
                          <h2>{a.title}</h2>
                          <small>현재 상태</small>
                          <p>{a.currentState || "아직 작성하지 않았습니다."}</p>
                          <small>다음 행동 →</small>
                          <p>{a.nextAction || "다음 한 걸음을 정해 보세요."}</p>
                        </button>
                      ))
                    ) : (
                      <div className="empty">
                        첫 활동을 만들어 성장을 기록해 보세요.
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
            {page === "growth" && (
              <>
                <div className="heading">
                  <p className="eyebrow">YOUR JOURNEY, IN YOUR WORDS</p>
                  <h1>쌓여가는 성장</h1>
                  <p>그동안의 배움과 성취를 다시 만나 보세요.</p>
                </div>
                <label className="filter">
                  활동별 보기
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="">전체 활동</option>
                    {data.activities.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="muted">발생일 최신순</p>
                {logCards(
                  data.logs.filter((l) => !filter || l.activityId === filter),
                )}
              </>
            )}
          </>
        )}
      </main>
      {editing && (
        <div className="overlay">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="활동 편집"
            className="modal"
          >
            <h2>
              {data.activities.some((a) => a.id === editing.id)
                ? "활동 수정"
                : "새 활동"}
            </h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await act(
                    () =>
                      repository.saveActivity({ ...editing, updatedAt: now() }),
                    "활동을 저장했습니다.",
                  )
                ) {
                  setEditing(null);
                  setPage("activities");
                  setSelected("");
                }
              }}
            >
              <label>
                활동 제목
                <input
                  autoFocus
                  required
                  value={editing.title}
                  onChange={(e) =>
                    setEditing({ ...editing, title: e.target.value })
                  }
                />
              </label>
              <label>
                유형
                <select
                  value={editing.type}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      type: e.target.value as Activity["type"],
                    })
                  }
                >
                  {Object.entries(types).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                진행 상태
                <select
                  value={editing.status}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      status: e.target.value as Activity["status"],
                    })
                  }
                >
                  {Object.entries(statuses).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              {(["currentState", "nextAction"] as const).map((f, i) => (
                <label key={f}>
                  {i ? "다음 행동" : "현재 상태"}
                  <textarea
                    value={editing[f]}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        [f]: e.target.value,
                        [`${f}SourceLogId`]: null,
                      })
                    }
                  />
                </label>
              ))}
              <div className="actions">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setEditing(null)}
                >
                  취소
                </button>
                <button className="primary" disabled={busy}>
                  활동 저장
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {log && (
        <LogForm
          key={log.id}
          log={log}
          activities={data.activities}
          existing={data.logs.some((l) => l.id === log.id)}
          busy={busy}
          close={() => setLog(null)}
          save={async (l, u) => {
            const run = async (p?: SourcePolicy) => {
              if (
                await act(
                  () => repository.saveLog(l, u, p),
                  "기록을 저장했습니다.",
                )
              ) {
                setLog(null);
                setConfirm(null);
              }
            };
            if (data.logs.some((x) => x.id === l.id) && sourced(l))
              setConfirm({
                title:
                  "현재 상태 또는 다음 행동의 출처 기록을 수정합니다. 기존에 연결된 상태를 유지할까요, 비울까요? 선택한 새 상태 갱신은 이후 적용됩니다.",
                source: true,
                run,
              });
            else await run();
          }}
        />
      )}
      {confirm && (
        <div className="overlay confirmation">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-label="변경 확인"
            className="modal"
          >
            <h2>변경 전 확인</h2>
            <p>{confirm.title}</p>
            {confirm.source && (
              <p>
                유지하면 상태 값은 그대로 남습니다. 기록 삭제 시 출처 연결만
                해제합니다. 비우면 이 기록에 연결된 필드만 비웁니다.
              </p>
            )}
            <div className="actions">
              <button disabled={busy} onClick={() => setConfirm(null)}>
                취소
              </button>
              {confirm.source ? (
                <>
                  <button disabled={busy} onClick={() => confirm.run("keep")}>
                    상태 유지하고 진행
                  </button>
                  <button disabled={busy} onClick={() => confirm.run("clear")}>
                    연결된 상태 비우고 진행
                  </button>
                </>
              ) : (
                <button
                  className="danger"
                  disabled={busy}
                  onClick={() => confirm.run("keep")}
                >
                  함께 삭제
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
function LogForm({
  log,
  activities,
  existing,
  busy,
  close,
  save,
}: {
  log: ActivityLog;
  activities: Activity[];
  existing: boolean;
  busy: boolean;
  close: () => void;
  save: (
    l: ActivityLog,
    u: Partial<Pick<Activity, "currentState" | "nextAction">>,
  ) => Promise<void>;
}) {
  const [draft, setDraft] = useState(log),
    [state, setState] = useState(""),
    [next, setNext] = useState(""),
    [updateState, setUpdateState] = useState(false),
    [updateNext, setUpdateNext] = useState(false);
  function submit(e: FormEvent) {
    e.preventDefault();
    void save(
      { ...draft, updatedAt: now() },
      {
        ...(updateState ? { currentState: state } : {}),
        ...(updateNext ? { nextAction: next } : {}),
      },
    );
  }
  return (
    <div className="overlay">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="기록 편집"
        className="modal"
      >
        <h2>{existing ? "기록 수정" : "오늘의 기록"}</h2>
        <form onSubmit={submit}>
          <label>
            활동 선택
            <select
              required
              disabled={existing}
              value={draft.activityId}
              onChange={(e) =>
                setDraft({ ...draft, activityId: e.target.value })
              }
            >
              <option value="">활동을 선택하세요</option>
              {activities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            발생일
            <input
              type="date"
              required
              value={draft.occurredAt}
              onChange={(e) =>
                setDraft({ ...draft, occurredAt: e.target.value })
              }
            />
          </label>
          {(["summary", "learning", "achievement"] as const).map((f, i) => (
            <label key={f}>
              {["요약 (필수)", "배운 점", "성취"][i]}
              <textarea
                autoFocus={i === 0}
                required={i === 0}
                value={draft[f]}
                onChange={(e) => setDraft({ ...draft, [f]: e.target.value })}
              />
            </label>
          ))}
          <label className="checkbox">
            <input
              type="checkbox"
              checked={updateState}
              onChange={(e) => setUpdateState(e.target.checked)}
            />
            현재 상태도 갱신
          </label>
          {updateState && (
            <label>
              새 현재 상태
              <textarea
                value={state}
                onChange={(e) => setState(e.target.value)}
              />
            </label>
          )}
          <label className="checkbox">
            <input
              type="checkbox"
              checked={updateNext}
              onChange={(e) => setUpdateNext(e.target.checked)}
            />
            다음 행동도 갱신
          </label>
          {updateNext && (
            <label>
              새 다음 행동
              <textarea
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
            </label>
          )}
          <div className="actions">
            <button type="button" disabled={busy} onClick={close}>
              취소
            </button>
            <button className="primary" disabled={busy}>
              기록 저장
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
