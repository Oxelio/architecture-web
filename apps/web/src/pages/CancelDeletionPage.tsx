import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { cancelAccountDeletion } from "#services/api";

export function CancelDeletionPage() {
  const [parameters] = useSearchParams();
  const token = parameters.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "done" | "error">(
    "idle",
  );
  const submit = async () => {
    setStatus("pending");
    try {
      await cancelAccountDeletion(token, password, mfaCode || undefined);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };
  return (
    <section className="mx-auto max-w-lg rounded-[2rem] border border-slate-800 bg-slate-900/80 p-8">
      <p className="text-sm uppercase tracking-[0.25em] text-amber-300">
        Suppression du compte
      </p>
      <h2 className="mt-3 text-3xl font-semibold text-white">
        Annuler la suppression
      </h2>
      {status === "done" ? (
        <p className="mt-6 text-emerald-300">
          Le compte est réactivé. Les anciennes sessions restent révoquées.{" "}
          <Link className="font-semibold text-white" to="/signin">
            Se connecter
          </Link>
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mot de passe"
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          />
          <input
            value={mfaCode}
            onChange={(event) => setMfaCode(event.target.value)}
            placeholder="Code MFA si activé"
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          />
          {status === "error" ? (
            <p className="text-sm text-rose-300">
              Ce lien n’est plus utilisable ou la vérification a échoué.
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!token || !password || status === "pending"}
            className="w-full rounded-full bg-amber-400 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50"
          >
            Confirmer l’annulation
          </button>
        </div>
      )}
    </section>
  );
}
