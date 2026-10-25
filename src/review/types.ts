import type { ComponentType, Dispatch, SetStateAction } from "react";
import type { State } from "../model";
import type { Language } from "../i18n";

export interface ReviewSupport {
  initialState: () => State;
  createFixture: (kind: string, language: Language) => State;
  Controls: ComponentType<{ state: State; reset: (kind: string) => void; setState: Dispatch<SetStateAction<State>> }>;
  Design: ComponentType;
}
