export type OS = "windows" | "mac" | "android" | "ios" | "linux" | "unknown";

export function detectOS(): OS {
  if (typeof window === "undefined") return "unknown";
  const ua = navigator.userAgent;
  // Android must come before Linux (Android UA contains "Linux")
  if (/android/i.test(ua)) return "android";
  // iPad with iOS 13+ reports as Mac but has touch points
  if (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  )
    return "ios";
  if (/Win/.test(navigator.platform)) return "windows";
  if (/Mac/.test(navigator.platform)) return "mac";
  if (/Linux/.test(navigator.platform)) return "linux";
  return "unknown";
}
