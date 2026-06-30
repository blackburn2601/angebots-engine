"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export function NavigationProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const prevPathname = useRef(pathname);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function start() {
    if (tickRef.current) clearInterval(tickRef.current);
    if (completeRef.current) clearTimeout(completeRef.current);
    setVisible(true);
    setProgress(8);
    tickRef.current = setInterval(() => {
      setProgress((p) => p + (88 - p) * 0.12);
    }, 180);
  }

  function finish() {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    setProgress(100);
    completeRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 320);
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || /^https?:\/\//.test(href) || href.startsWith("mailto:")) return;
      const targetPath = href.split("?")[0];
      if (targetPath === pathname) return;
      start();
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [pathname]);

  useEffect(() => {
    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname;
      finish();
    }
  }, [pathname]);

  useEffect(() => () => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (completeRef.current) clearTimeout(completeRef.current);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="nav-progress-bar"
      style={{ width: `${progress}%` }}
    />
  );
}
