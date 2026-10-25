import Dexie, { type Table } from "dexie";
export type Activity = {
  id: string;
  title: string;
  type: "project" | "learning" | "certification";
  status: "active" | "paused" | "completed";
  currentState: string;
  nextAction: string;
  currentStateSourceLogId: string | null;
  nextActionSourceLogId: string | null;
  createdAt: string;
  updatedAt: string;
};
export type ActivityLog = {
  id: string;
  activityId: string;
  summary: string;
  learning: string;
  achievement: string;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
};
export type SourcePolicy = "keep" | "clear";
export class GrowthDB extends Dexie {
  activities!: Table<Activity, string>;
  logs!: Table<ActivityLog, string>;
  constructor(name = "personal-growth-workspace") {
    super(name);
    this.version(1).stores({
      activities: "id, status, type",
      logs: "id, activityId, occurredAt",
    });
  }
}
export const db = new GrowthDB();
export class Repository {
  constructor(public database: GrowthDB) {}
  async read() {
    return this.database.transaction(
      "r",
      this.database.activities,
      this.database.logs,
      async () => ({
        activities: await this.database.activities.toArray(),
        logs: (await this.database.logs.toArray()).sort(
          (a, b) =>
            b.occurredAt.localeCompare(a.occurredAt) ||
            b.createdAt.localeCompare(a.createdAt),
        ),
      }),
    );
  }
  async saveActivity(a: Activity) {
    if (!a.title.trim()) throw Error("활동 제목을 입력해 주세요.");
    await this.database.activities.put(a);
  }
  async saveLog(
    log: ActivityLog,
    updates: Partial<Pick<Activity, "currentState" | "nextAction">> = {},
    policy?: SourcePolicy,
  ) {
    if (!log.summary.trim()) throw Error("요약을 입력해 주세요.");
    await this.database.transaction(
      "rw",
      this.database.activities,
      this.database.logs,
      async () => {
        const a = await this.database.activities.get(log.activityId);
        if (!a) throw Error("활동을 찾을 수 없습니다.");
        const old = await this.database.logs.get(log.id);
        if (
          old &&
          (a.currentStateSourceLogId === log.id ||
            a.nextActionSourceLogId === log.id) &&
          !policy
        )
          throw Error("출처 기록의 상태 처리 확인이 필요합니다.");
        if (old && policy === "clear") this.clearSource(a, log.id);
        for (const field of ["currentState", "nextAction"] as const)
          if (updates[field] !== undefined) {
            a[field] = updates[field]!;
            a[`${field}SourceLogId`] = log.id;
          }
        a.updatedAt = new Date().toISOString();
        await this.database.logs.put(log);
        await this.database.activities.put(a);
      },
    );
  }
  private clearSource(a: Activity, id: string) {
    for (const field of ["currentState", "nextAction"] as const)
      if (a[`${field}SourceLogId`] === id) {
        a[field] = "";
        a[`${field}SourceLogId`] = null;
      }
  }
  async deleteLog(id: string, policy?: SourcePolicy) {
    await this.database.transaction(
      "rw",
      this.database.activities,
      this.database.logs,
      async () => {
        const log = await this.database.logs.get(id);
        if (!log) return;
        const a = await this.database.activities.get(log.activityId);
        if (a) {
          const sourced =
            a.currentStateSourceLogId === id || a.nextActionSourceLogId === id;
          if (sourced && !policy)
            throw Error("출처 기록의 상태 처리 확인이 필요합니다.");
          if (policy === "clear") this.clearSource(a, id);
          else
            for (const field of ["currentState", "nextAction"] as const)
              if (a[`${field}SourceLogId`] === id)
                a[`${field}SourceLogId`] = null;
          a.updatedAt = new Date().toISOString();
          await this.database.activities.put(a);
        }
        await this.database.logs.delete(id);
      },
    );
  }
  async deleteActivity(id: string, confirmed = false) {
    await this.database.transaction(
      "rw",
      this.database.activities,
      this.database.logs,
      async () => {
        if (
          (await this.database.logs.where("activityId").equals(id).count()) &&
          !confirmed
        )
          throw Error("관련 기록 삭제 확인이 필요합니다.");
        await this.database.logs.where("activityId").equals(id).delete();
        await this.database.activities.delete(id);
      },
    );
  }
}
export const repository = new Repository(db);
