"use client";

import {
  createContext,
  useContext,
  useTransition,
  type ReactNode,
  type TransitionStartFunction,
} from "react";

interface CompareTransitionContextValue {
  isPending: boolean;
  startTransition: TransitionStartFunction;
}

const CompareTransitionContext =
  createContext<CompareTransitionContextValue | null>(null);

/**
 * Shares one `useTransition` between the selector, swap/copy actions, and
 * the results table — all three are separate client islands around the
 * server-rendered table, but a filter change from any of them should dim
 * the same table while the page's RSC payload refetches.
 */
export function CompareTransitionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <CompareTransitionContext.Provider value={{ isPending, startTransition }}>
      {children}
    </CompareTransitionContext.Provider>
  );
}

export function useCompareTransition() {
  const context = useContext(CompareTransitionContext);
  if (!context) {
    throw new Error(
      "useCompareTransition must be used within a CompareTransitionProvider",
    );
  }
  return context;
}
