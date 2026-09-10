import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { api, ApiError, type BoardMember, type InviteLink, type SharableRole } from "../api/client";
import "./ShareDialog.css";

const ROLES: { id: SharableRole; label: string; hint: string }[] = [
  { id: "editor", label: "Editor", hint: "Can add, move and edit notes" },
  { id: "commenter", label: "Commenter", hint: "Can view and comment, not edit" },
  { id: "viewer", label: "Viewer", hint: "Can view only" },
];

function RoleSelect({
  value,
  onChange,
  disabled,
}: {
  value: SharableRole;
  onChange: (role: SharableRole) => void;
  disabled?: boolean;
}) {
  return (
    <select className="shd-role" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as SharableRole)}>
      {ROLES.map((r) => (
        <option key={r.id} value={r.id}>
          {r.label}
        </option>
      ))}
    </select>
  );
}

/**
 * `canManage` mirrors the server: GET /boards/:id/members only needs board access, but every
 * mutation requires ownership — so a shared-in editor sees who else is here and nothing they'd get
 * a 403 for.
 */
export function ShareDialog({
  boardId,
  boardTitle,
  canManage,
  onClose,
}: {
  boardId: number;
  boardTitle: string;
  canManage: boolean;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [link, setLink] = useState<InviteLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<SharableRole>("editor");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, l] = await Promise.all([
        api.listMembers(boardId),
        canManage ? api.getInviteLink(boardId).catch(() => null) : Promise.resolve(null),
      ]);
      setMembers(m);
      setLink(l);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load sharing settings");
    } finally {
      setLoading(false);
    }
  }, [boardId, canManage]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2400);
    return () => clearTimeout(t);
  }, [notice]);

  const inviteUrl = link ? `${window.location.origin}/join/${link.token}` : null;

  async function run(fn: () => Promise<void>, ok?: string) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      if (ok) setNotice(ok);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;
    await run(async () => {
      const member = await api.addMember(boardId, value, inviteRole);
      setMembers((prev) => [...prev.filter((m) => m.id !== member.id), member]);
      setEmail("");
    }, "Invited");
  }

  async function copyLink() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setNotice("Link copied");
    } catch {
      setError("Couldn't copy — select the link and copy manually");
    }
  }

  return createPortal(
    <>
      <div className="shd-backdrop" onClick={onClose} />
      <div className="shd" role="dialog" aria-label={`Share ${boardTitle}`}>
        <header className="shd-head">
          <div>
            <h2>Share board</h2>
            <p className="shd-sub">{boardTitle}</p>
          </div>
          <button className="shd-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        {error && <div className="shd-error">{error}</div>}
        {notice && <div className="shd-notice">{notice}</div>}

        {canManage && (
          <>
            <form className="shd-invite" onSubmit={handleInvite}>
              <input
                className="shd-input"
                type="email"
                placeholder="Invite by email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <RoleSelect value={inviteRole} onChange={setInviteRole} />
              <button className="shd-btn primary" type="submit" disabled={busy || !email.trim()}>
                Invite
              </button>
            </form>
            <p className="shd-hint">{ROLES.find((r) => r.id === inviteRole)?.hint}</p>
          </>
        )}

        {canManage && (
          <section className="shd-section">
            <h3>Invite link</h3>
            {inviteUrl ? (
            <>
              <div className="shd-linkrow">
                <input className="shd-input shd-linkinput" readOnly value={inviteUrl} onFocus={(e) => e.target.select()} />
                <button className="shd-btn" type="button" onClick={copyLink}>
                  Copy
                </button>
              </div>
              <div className="shd-linkmeta">
                <span>Anyone with the link joins as</span>
                <RoleSelect
                  value={link!.role}
                  disabled={busy}
                  onChange={(role) =>
                    run(async () => {
                      await api.updateInviteLinkRole(boardId, role);
                      setLink((prev) => (prev ? { ...prev, role } : prev));
                    }, "Link role updated")
                  }
                />
                <button
                  className="shd-btn danger"
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await api.revokeInviteLink(boardId);
                      setLink(null);
                    }, "Link revoked")
                  }
                >
                  Revoke
                </button>
              </div>
            </>
          ) : (
            <div className="shd-linkrow">
              <p className="shd-hint shd-grow">No link yet — anyone you send it to can join without an account first.</p>
              <button
                className="shd-btn"
                type="button"
                disabled={busy}
                onClick={() => run(async () => setLink(await api.createInviteLink(boardId, inviteRole)), "Link created")}
              >
                Create link
              </button>
            </div>
            )}
          </section>
        )}

        <section className="shd-section">
          <h3>People with access</h3>
          {loading ? (
            <p className="shd-hint">Loading…</p>
          ) : members.length === 0 ? (
            <p className="shd-hint">Just you so far.</p>
          ) : (
            <ul className="shd-members">
              {members.map((m) => (
                <li key={m.id}>
                  <span className="shd-avatar">{m.name.slice(0, 1).toUpperCase()}</span>
                  <span className="shd-who">
                    <span className="shd-name">{m.name}</span>
                    <span className="shd-email">{m.email}</span>
                  </span>
                  {canManage ? (
                    <>
                      <RoleSelect
                        value={m.role}
                        disabled={busy}
                        onChange={(role) =>
                          run(async () => {
                            await api.updateMemberRole(boardId, m.id, role);
                            setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, role } : x)));
                          }, "Role updated")
                        }
                      />
                      <button
                        className="shd-remove"
                        type="button"
                        title={`Remove ${m.name}`}
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            await api.removeMember(boardId, m.id);
                            setMembers((prev) => prev.filter((x) => x.id !== m.id));
                          }, "Removed")
                        }
                      >
                        ×
                      </button>
                    </>
                  ) : (
                    <span className="shd-hint">{ROLES.find((r) => r.id === m.role)?.label}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>,
    document.body
  );
}
