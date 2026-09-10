import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { AuthBrand } from "../ui/Brand";
import "./AuthPages.css";

/**
 * Landing page for an invite link. Auth is already guaranteed by ProtectedRoute, so all this does is
 * redeem the token and bounce into the board. `POST /join/:token` is idempotent, so re-opening a
 * link you've already used just takes you back to the board.
 */
export default function JoinBoard() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const redeemed = useRef(false);

  useEffect(() => {
    if (!token || redeemed.current) return;
    redeemed.current = true;
    api
      .joinByToken(token)
      .then(({ boardId }) => navigate(`/board/${boardId}`, { replace: true }))
      .catch((err) => setError(err instanceof ApiError ? err.message : "That invite link didn't work"));
  }, [token, navigate]);

  return (
    <main className="auth-page">
      <AuthBrand />
      <div className="auth-card">
        <h1>{error ? "Can't join" : "Joining board…"}</h1>
        {error ? (
          <>
            <div className="auth-error">{error}</div>
            <p className="auth-switch">
              <Link to="/">Go to your boards</Link>
            </p>
          </>
        ) : (
          <p className="subtitle">Hang tight, opening the board.</p>
        )}
      </div>
    </main>
  );
}
