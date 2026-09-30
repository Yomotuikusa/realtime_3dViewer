import { useEffect, useRef, useState, type ReactElement } from "react";
import type { Account, AccountWithRecoveryCode } from "@shared/account";
import { getAccount, logout } from "../../api/account";
import { saveName } from "../../app/display-name";
import { AccountSettingsDialog } from "./AccountSettingsDialog";
import { ForgotPasswordDialog } from "./ForgotPasswordDialog";
import { LoginDialog } from "./LoginDialog";
import { RecoveryCodeDialog } from "./RecoveryCodeDialog";
import { RegisterDialog } from "./RegisterDialog";
import {
  LOGIN_LABEL,
  ACCOUNT_SETTINGS_LABEL,
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
type Dialog = "login" | "register" | "settings" | "forgot" | null;

export function AccountMenu({ onAccountChange }: { onAccountChange: () => void }): ReactElement | null {
  const [state, setState] = useState<AccountLoadState>({ status: "pending" });
  const [dialog, setDialog] = useState<Dialog>(null);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    let active = true;
    mountedRef.current = true;
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
      mountedRef.current = false;
    };
  }, [mountedRef]);

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

  const handleResetSuccess = (result: AccountWithRecoveryCode): void => {
    setState({ status: "ready", account: result.account });
    if (result.account.displayName) saveName(result.account.displayName);
    setDialog(null);
    setRecoveryCode(result.recoveryCode);
    onAccountChange();
  };

  const handleRecoveryCode = (code: string): void => {
    setDialog(null);
    setRecoveryCode(code);
  };

  const handleLogout = (): void => {
    setLogoutBusy(true);
    setLogoutError(false);
    void logout()
      .then(() => getAccount())
      .then((nextAccount) => {
        if (!mountedRef.current) return;
        setState({ status: "ready", account: nextAccount });
        setLogoutBusy(false);
        onAccountChange();
      })
      .catch(() => {
        if (!mountedRef.current) return;
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
            <button className="btn" type="button" onClick={() => setDialog("settings")}>
              {ACCOUNT_SETTINGS_LABEL}
            </button>
            <button className="btn" type="button" onClick={handleLogout} disabled={logoutBusy}>
              {LOGOUT_LABEL}
            </button>
          </>
        )}
        {logoutError && <p className="alert account-menu__error" role="alert">{LOGOUT_FAILED}</p>}
      </div>
      {dialog === "login" && (
        <LoginDialog
          onSuccess={handleLoginSuccess}
          onCancel={() => setDialog(null)}
          onForgotPassword={() => setDialog("forgot")}
        />
      )}
      {dialog === "register" && (
        <RegisterDialog onSuccess={handleRegisterSuccess} onCancel={() => setDialog(null)} />
      )}
      {dialog === "settings" && account.loginId !== null && (
        <AccountSettingsDialog
          account={{ loginId: account.loginId, displayName: account.displayName }}
          onRecoveryCode={handleRecoveryCode}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "forgot" && <ForgotPasswordDialog onSuccess={handleResetSuccess} onCancel={() => setDialog(null)} />}
      {recoveryCode !== null && (
        <RecoveryCodeDialog code={recoveryCode} onClose={() => setRecoveryCode(null)} />
      )}
    </>
  );
}
