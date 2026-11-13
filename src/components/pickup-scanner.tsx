"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function PickupScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const video = videoRef.current;
    return () => {
      const stream = video?.srcObject;
      if (stream instanceof MediaStream) {
        for (const track of stream.getTracks()) track.stop();
      }
    };
  }, []);

  async function start() {
    const Detector = (window as Window & { BarcodeDetector?: new (opts: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setMessage("This browser has no camera scanner. Paste the pickup link, or use a handheld scanner in the field.");
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream;
    await videoRef.current.play();
    const detector = new Detector({ formats: ["qr_code"] });
    const tick = async () => {
      if (!videoRef.current) return;
      const codes = await detector.detect(videoRef.current).catch(() => []);
      const value = codes[0]?.rawValue;
      if (value) {
        const parsed = value.includes("/pickup/") ? value.split("/pickup/").pop() ?? value : value;
        router.push(`/admin/pickup?token=${encodeURIComponent(parsed.split(/[?#]/)[0] ?? "")}`);
        return;
      }
      window.setTimeout(tick, 400);
    };
    void tick();
  }

  return (
    <form action="/admin/pickup" className="grid gap-3">
      <label>
        Pickup code or link
        <input
          name="token"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          autoFocus
          placeholder="Scan or paste"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit">Look up</button>
        <button type="button" className="secondary" onClick={() => void start()}>
          Open camera
        </button>
      </div>
      <video ref={videoRef} className="max-h-64 w-full bg-ink" muted playsInline />
      {message ? <p className="text-sm">{message}</p> : null}
    </form>
  );
}
