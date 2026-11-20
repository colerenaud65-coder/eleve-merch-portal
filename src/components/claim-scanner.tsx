"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Detector = {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
};

function stopStream(video: HTMLVideoElement | null) {
  const stream = video?.srcObject;
  if (stream instanceof MediaStream) {
    for (const track of stream.getTracks()) track.stop();
  }
}

function claimCodeFrom(value: string) {
  const match = value.match(/\/claim\/([A-Za-z0-9_-]+)/);
  const code = match?.[1] ?? value.trim();
  return code.split(/[?#]/)[0] ?? "";
}

export function ClaimScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const video = videoRef.current;
    return () => stopStream(video);
  }, []);

  async function openCamera() {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "environment" },
      });
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setMessage(
          "Camera permission is off. On iPhone, open Settings, then Safari, then Camera, and allow this site. Then tap Start camera again.",
        );
        return null;
      }
      if (name === "OverconstrainedError") {
        try {
          return await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        } catch {
          setMessage("The camera did not start. Paste the claim link instead.");
          return null;
        }
      }
      setMessage("The camera did not start. Paste the claim link instead.");
      return null;
    }
  }

  async function start() {
    setMessage("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage("This browser cannot open the camera. Paste the claim link.");
      return;
    }
    stopStream(videoRef.current);
    const stream = await openCamera();
    if (!stream) return;
    const video = videoRef.current;
    if (!video) {
      for (const track of stream.getTracks()) track.stop();
      return;
    }
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.srcObject = stream;
    await video.play();

    const DetectorCtor = (
      window as Window & { BarcodeDetector?: new (opts: { formats: string[] }) => Detector }
    ).BarcodeDetector;
    if (!DetectorCtor) {
      setMessage("Camera is on. This browser cannot read the code, so paste the claim link.");
      return;
    }
    const detector = new DetectorCtor({ formats: ["qr_code"] });
    const tick = async () => {
      if (!videoRef.current || videoRef.current.srcObject !== stream) return;
      const codes = await detector.detect(videoRef.current).catch(() => []);
      const value = codes[0]?.rawValue;
      if (value) {
        const parsed = claimCodeFrom(value);
        if (parsed) router.push(`/claim/${encodeURIComponent(parsed)}`);
        return;
      }
      window.setTimeout(tick, 400);
    };
    void tick();
  }

  return (
    <form action="/claim/open" className="grid gap-3">
      <label>
        Claim code or link
        <input
          name="code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          autoFocus
          placeholder="Scan or paste"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit">Open code</button>
        <button type="button" className="secondary" onClick={() => void start()}>
          Start camera
        </button>
      </div>
      <video ref={videoRef} className="max-h-64 w-full bg-ink" muted playsInline autoPlay />
      {message ? <p className="text-sm">{message}</p> : null}
    </form>
  );
}
