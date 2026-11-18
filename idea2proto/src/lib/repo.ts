import "server-only";
import { all, db, newId, now, one, run } from "./db";
import type { Idea, IdeaSpec, InputMode, Message, Publication, SkillId, TurnSkill, Version } from "./types";

/* ───────────── ideas ───────────── */

type IdeaRow = {
  id: string; title: string; one_liner: string; spec_json: string; skill: string;
  raw_input: string; input_mode: string; current_version: number | null;
  created_at: number; updated_at: number;
};

const toIdea = (r: IdeaRow): Idea => ({
  id: r.id,
  title: r.title,
  oneLiner: r.one_liner,
  spec: JSON.parse(r.spec_json),
  skill: r.skill as SkillId,
  rawInput: r.raw_input,
  inputMode: r.input_mode as InputMode,
  currentVersion: r.current_version,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export function createIdea(userId: string, spec: IdeaSpec, rawInput: string, inputMode: InputMode): Idea {
  const id = newId();
  const t = now();
  run(
    `INSERT INTO ideas (id,user_id,title,one_liner,spec_json,skill,raw_input,input_mode,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    id, userId, spec.title, spec.oneLiner, JSON.stringify(spec), spec.suggestedSkill, rawInput, inputMode, t, t,
  );
  return getIdea(userId, id)!;
}

export function getIdea(userId: string, id: string): Idea | null {
  const r = one<IdeaRow>(`SELECT * FROM ideas WHERE id=? AND user_id=?`, id, userId);
  return r ? toIdea(r) : null;
}

export function updateSpec(userId: string, id: string, spec: IdeaSpec) {
  run(
    `UPDATE ideas SET spec_json=?, title=?, one_liner=?, skill=?, updated_at=? WHERE id=? AND user_id=?`,
    JSON.stringify(spec), spec.title, spec.oneLiner, spec.suggestedSkill, now(), id, userId,
  );
}

export function deleteIdea(userId: string, id: string) {
  run(`DELETE FROM ideas WHERE id=? AND user_id=?`, id, userId);
}

export interface JournalQuery { q?: string; skill?: string; limit?: number }
export interface JournalEntry extends Idea { messageCount: number; published: boolean }

export function listIdeas(userId: string, { q, skill, limit = 100 }: JournalQuery = {}): JournalEntry[] {
  const where = ["i.user_id = ?"];
  const params: unknown[] = [userId];
  if (skill) { where.push("i.skill = ?"); params.push(skill); }
  if (q && q.trim()) {
    const like = `%${q.trim().replace(/[%_]/g, (m) => "\\" + m)}%`;
    where.push(`(i.title LIKE ? ESCAPE '\\' OR i.one_liner LIKE ? ESCAPE '\\' OR i.raw_input LIKE ? ESCAPE '\\'
      OR EXISTS (SELECT 1 FROM messages m WHERE m.idea_id = i.id AND m.content LIKE ? ESCAPE '\\'))`);
    params.push(like, like, like, like);
  }
  params.push(limit);
  const rows = all<IdeaRow & { message_count: number; published: number }>(
    `SELECT i.*,
       (SELECT COUNT(*) FROM messages m WHERE m.idea_id = i.id) AS message_count,
       EXISTS (SELECT 1 FROM publications p WHERE p.idea_id = i.id AND p.revoked_at IS NULL) AS published
     FROM ideas i WHERE ${where.join(" AND ")} ORDER BY i.updated_at DESC LIMIT ?`,
    ...params,
  );
  return rows.map((r) => ({ ...toIdea(r), messageCount: r.message_count, published: !!r.published }));
}

const touch = (id: string) => run(`UPDATE ideas SET updated_at=? WHERE id=?`, now(), id);

/* ───────────── messages ───────────── */

type MsgRow = {
  id: string; role: string; content: string; skill: string | null; version_n: number | null;
  feedback: number | null; created_at: number;
};
const toMsg = (r: MsgRow): Message => ({
  id: r.id,
  role: r.role as Message["role"],
  content: r.content,
  skill: r.skill as TurnSkill | null,
  versionN: r.version_n,
  feedback: r.feedback as Message["feedback"],
  createdAt: r.created_at,
});

export function listMessages(ideaId: string): Message[] {
  return all<MsgRow>(`SELECT * FROM messages WHERE idea_id=? ORDER BY created_at, rowid`, ideaId).map(toMsg);
}

export function addMessage(ideaId: string, m: Pick<Message, "role" | "content"> & Partial<Message>): Message {
  const id = newId();
  // strictly increasing timestamps keep ordering stable within a single millisecond
  const last = one<{ t: number }>(`SELECT MAX(created_at) t FROM messages WHERE idea_id=?`, ideaId)?.t ?? 0;
  const t = Math.max(now(), last + 1);
  run(
    `INSERT INTO messages (id,idea_id,role,content,skill,version_n,created_at) VALUES (?,?,?,?,?,?,?)`,
    id, ideaId, m.role, m.content, m.skill ?? null, m.versionN ?? null, t,
  );
  touch(ideaId);
  return toMsg(one<MsgRow>(`SELECT * FROM messages WHERE id=?`, id)!);
}

export function getMessage(ideaId: string, id: string): Message | null {
  const r = one<MsgRow>(`SELECT * FROM messages WHERE idea_id=? AND id=?`, ideaId, id);
  return r ? toMsg(r) : null;
}

/** Remove a message and everything after it (used by regenerate / edit-and-rerun). */
export function truncateFrom(ideaId: string, messageId: string) {
  const m = getMessage(ideaId, messageId);
  if (!m) return;
  run(`DELETE FROM messages WHERE idea_id=? AND created_at >= ?`, ideaId, m.createdAt);
}

export function setFeedback(ideaId: string, id: string, feedback: -1 | 0 | 1) {
  run(`UPDATE messages SET feedback=? WHERE idea_id=? AND id=?`, feedback, ideaId, id);
}

/* ───────────── versions ───────────── */

type VerRow = { n: number; html: string; skill: string; note: string; created_at: number };
const toVer = (r: VerRow): Version => ({ n: r.n, html: r.html, skill: r.skill as SkillId, note: r.note, createdAt: r.created_at });

export function addVersion(ideaId: string, html: string, skill: SkillId, note: string): Version {
  const n = (one<{ n: number }>(`SELECT MAX(n) n FROM versions WHERE idea_id=?`, ideaId)?.n ?? 0) + 1;
  run(`INSERT INTO versions (idea_id,n,html,skill,note,created_at) VALUES (?,?,?,?,?,?)`, ideaId, n, html, skill, note, now());
  run(`UPDATE ideas SET current_version=?, updated_at=? WHERE id=?`, n, now(), ideaId);
  return getVersion(ideaId, n)!;
}

export function getVersion(ideaId: string, n: number): Version | null {
  const r = one<VerRow>(`SELECT * FROM versions WHERE idea_id=? AND n=?`, ideaId, n);
  return r ? toVer(r) : null;
}

export function listVersions(ideaId: string): Omit<Version, "html">[] {
  return all<VerRow>(`SELECT n,skill,note,created_at,'' html FROM versions WHERE idea_id=? ORDER BY n`, ideaId).map(toVer);
}

/** Revert = point current_version at an older version. History is never rewritten. */
export function setCurrentVersion(ideaId: string, n: number) {
  run(`UPDATE ideas SET current_version=?, updated_at=? WHERE id=?`, n, now(), ideaId);
}

/* ───────────── publications ───────────── */

type PubRow = { slug: string; version_n: number; url: string; created_at: number; revoked_at: number | null };
const toPub = (r: PubRow): Publication => ({ slug: r.slug, versionN: r.version_n, url: r.url, createdAt: r.created_at, revokedAt: r.revoked_at });

export function activePublication(ideaId: string): Publication | null {
  const r = one<PubRow>(`SELECT * FROM publications WHERE idea_id=? AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1`, ideaId);
  return r ? toPub(r) : null;
}
/** Insert, or re-point an existing slug at a new version (republish keeps the same link). */
export function upsertPublication(ideaId: string, slug: string, versionN: number, url: string) {
  run(
    `INSERT INTO publications (slug,idea_id,version_n,url,created_at) VALUES (?,?,?,?,?)
     ON CONFLICT(slug) DO UPDATE SET version_n=excluded.version_n, url=excluded.url, revoked_at=NULL`,
    slug, ideaId, versionN, url, now(),
  );
}
export function revokePublication(slug: string) {
  run(`UPDATE publications SET revoked_at=? WHERE slug=?`, now(), slug);
}
export function publicationBySlug(slug: string): (Publication & { ideaId: string }) | null {
  const r = one<PubRow & { idea_id: string }>(`SELECT * FROM publications WHERE slug=?`, slug);
  return r ? { ...toPub(r), ideaId: r.idea_id } : null;
}
export function userPublicationSlugs(userId: string): string[] {
  return all<{ slug: string }>(
    `SELECT p.slug FROM publications p JOIN ideas i ON i.id = p.idea_id WHERE i.user_id=? AND p.revoked_at IS NULL`, userId,
  ).map((r) => r.slug);
}

/* ───────────── account ───────────── */

export function exportUserData(userId: string) {
  const user = one(`SELECT id,name,email,plan,register,pics_accepted_at,training_opt_in,created_at FROM users WHERE id=?`, userId);
  const ideas = listIdeas(userId, { limit: 100000 }).map((i) => ({
    ...i,
    messages: listMessages(i.id),
    versions: all<VerRow>(`SELECT * FROM versions WHERE idea_id=? ORDER BY n`, i.id).map(toVer),
    publications: all<PubRow>(`SELECT * FROM publications WHERE idea_id=?`, i.id).map(toPub),
  }));
  return { exportedAt: new Date().toISOString(), user, ideas };
}

export function deleteUser(userId: string) {
  db.exec("BEGIN");
  try {
    run(`DELETE FROM users WHERE id=?`, userId); // cascades to accounts, ideas, messages, versions, publications, usage
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
