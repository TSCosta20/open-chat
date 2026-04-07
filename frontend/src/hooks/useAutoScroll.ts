import { useEffect, type RefObject } from "react";

export function useAutoScroll(
  ref: RefObject<HTMLElement | null>,
  deps: unknown[]
) {
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
