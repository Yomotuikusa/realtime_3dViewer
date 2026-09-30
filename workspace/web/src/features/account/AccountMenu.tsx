import { useEffect, useState, type ReactElement } from "react";
import type { Account } from "@shared/account";
import { getAccount, logout } from "../../api/account";
import { saveName } from "../../app/display-name";
import { LoginDialog } from "./LoginDialog";
import { RecoveryCodeDialog } from "./RecoveryCodeDialog";
import { RegisterDialog } from "./RegisterDialog";
import {
  LOGIN_LABEL,
  LOGOUT_FAILED,
  LOGOUT_LABEL,
  REGISTER_LABEL,
  accountDisplayLabel,
} from "./account-labels";
import "./account.css";

type AccountLoadState =
  | { status: "pending" }
  | { status: "ready"; account: Account }
  | { status: "failed" };
type Dialog = "login" | "register" | null;

export function AccountMenu({ onAccountChange }: { onAccountChange: () => void }): ReactElement | null {
  const [state, setState] = useState<AccountLoadState>({ status: "pending" });
  const [dialog, setDialog] = useState<Dialog>(null);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState(false);

  useEffect(() => {
    let active = true;
    void getAccount()
      .then((account) => {
        if (active) setState({ status: "ready", account });
      })
      .catch((error: unknown) => {
        console.error(error);
        if (active) setState({ status: "failed" });
      });
    return () => {
      active = false;
    };
  }, []);

  if (state.status !== "ready") return null;

  const account = state.account;
  const handleLoginSuccess = (nextAccount: Account): void => {
    setState({ status: "ready", account: nextAccount });
    if (nextAccount.displayName) saveName(nextAccount.displayName);
    setDialog(null);
    onAccountChange();
  };

  const handleRegisterSuccess = (result: { account: Account; recoveryCode: string }): void => {
    setState({ status: "ready", account: result.account });
    if (result.account.displayName) saveName(result.account.displayName);
    setDialog(null);
    setRecoveryCode(result.recoveryCode);
    onAccountChange();
  };

  const handleLogout = (): void => {
    setLogoutBusy(true);
    setLogoutError(false);
    void logout()
      .then(() => getAccount())
      .then((nextAccount) => {
        setState({ status: "ready", account: nextAccount });
        setLogoutBusy(false);
        onAccountChange();
      })
      .catch(() => {
        setLogoutBusy(false);
        setLogoutError(true);
      });
  };

  return (
    <>
      <div className="account-menu">
        {account.loginId === null ? (
          <>
            <button className="btn" type="button" onClick={() => setDialog("login")}>
              {LOGIN_LABEL}
            </button>
            <button className="btn" type="button" onClick={() => setDialog("register")}>
              {REGISTER_LABEL}
            </button>
          </>
        ) : (
          <>
            <span className="account-menu__name">{accountDisplayLabel({
              loginId: account.loginId as string,
              displayName: account.displayName,
            })}</span>
            <span className="account-menu__id">@{account.loginId}</span>
            <button className="btn" type="button" onClick={handleLogout} disabled={logoutBusy}>
              {LOGOUT_LABEL}
            </button>
          </>
        )}
        {logoutError && <p className="alert account-menu__error" role="alert">{LOGOUT_FAILED}</p>}
      </div>
      {dialog === "login" && <LoginDialog onSuccess={handleLoginSuccess} onCancel={() => setDialog(null)} />}
      {dialog === "register" && (
        <RegisterDialog onSuccess={handleRegisterSuccess} onCancel={() => setDialog(null)} />
      )}
      {recoveryCode !== null && (
        <RecoveryCodeDialog code={recoveryCode} onClose={() => setRecoveryCode(null)} />
      )}
    </>
  );
}
