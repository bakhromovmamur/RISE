import { validatePersonalDraft } from "./contracts/personalCommands";
import { createContext, useContext, useMemo, useState, type SetStateAction, type ReactNode } from "react";
import { FlaskConical, LockKeyhole } from "lucide-react";
import { useApp } from "./context";

import { createTranslator, type Language } from "./i18n";

export const LocaleContext = createContext<Language>("en");
export function useText() {
  const language = useContext(LocaleContext);
  return useMemo(() => createTranslator(language), [language]);
}
export function PreviewLabel({ children }: { children?: ReactNode }) {
  const t = useText();
  return <div className="life-preview"><FlaskConical size={15} /><span>{children ?? t("Interactive preview · only on this browser", "Interaktiv namuna · faqat shu brauzerda")}</span></div>;
}
export function PrivacyNote({ children }: { children: ReactNode }) {
  return <p className="life-privacy"><LockKeyhole size={16} /><span>{children}</span></p>;
}
export function LifeIntro({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return <header className="life-intro"><h1>{title}</h1><p>{text}</p>{children}</header>;
}
/** Drafts live independently of the sheet stack, so nested previews and reloads keep them. */
export function useLifeDraft<T>(key: string, initial: () => T) {
  const { state, dispatch, storage } = useApp();
  const [fallback, setFallback] = useState(initial);
  const read = (saved: unknown): T => {
    if (saved === undefined) return fallback;
    try { validatePersonalDraft(key, saved); return saved as T; }
    catch { return fallback; } // Retain an unsupported legacy draft in storage until the user explicitly edits it.
  };
  const value = read(state.life.drafts[key]);
  const set = (action: SetStateAction<T>) => {
    const current = read(storage.getSnapshot().state.life.drafts[key]);
    const next = typeof action === "function" ? (action as (value: T) => T)(current) : action;
    setFallback(() => next);
    dispatch({ kind: "draft.save", key, value: next });
  };
  const clear = () => dispatch({ kind: "draft.clear", key });
  return [value, set, clear] as const;
}
