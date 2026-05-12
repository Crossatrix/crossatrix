import { useEffect, useRef, useState } from "react";
import * as faceapi from "@vladmandic/face-api";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model";

async function callFn(name: string, body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session?.access_token}`,
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Verification failed");
  return d;
}

export default function TwoFactorChallenge({ method, onSuccess, onCancel }: {
  method: "email" | "sms" | "file" | "face";
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (method === "face") {
      (async () => {
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      })().catch((e) => toast.error(e.message));
    }
    return () => {
      const v = videoRef.current;
      if (v?.srcObject) (v.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
    };
  }, [method]);

  const submitCode = async () => {
    setBusy(true);
    try { await callFn("twofa-verify", { code }); onSuccess(); }
    catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };

  const submitFile = async (file: File) => {
    setBusy(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      await callFn("twofa-verify", { secret_key: parsed.secret_key });
      onSuccess();
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };

  const submitFace = async () => {
    if (!videoRef.current) return;
    setBusy(true);
    try {
      const det = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks().withFaceDescriptor();
      if (!det) throw new Error("No face detected");
      await callFn("twofa-verify", { face_descriptor: Array.from(det.descriptor) });
      onSuccess();
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm p-6 rounded-2xl border border-border bg-card shadow-vault space-y-4">
        <h2 className="text-xl font-semibold">2-Step Authentication</h2>
        <p className="text-sm text-muted-foreground">Verify with your {method} method to continue.</p>

        {(method === "email" || method === "sms") && (
          <>
            <Input placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} />
            <Button variant="signal" className="w-full" onClick={submitCode} disabled={busy || code.length !== 6}>Verify</Button>
          </>
        )}

        {method === "file" && (
          <>
            <input ref={fileInputRef} type="file" accept=".crossauth,application/json" className="hidden"
              onChange={(e) => e.target.files?.[0] && submitFile(e.target.files[0])} />
            <Button variant="signal" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={busy}>
              Upload Account.crossauth
            </Button>
          </>
        )}

        {method === "face" && (
          <>
            <video ref={videoRef} className="w-full rounded-lg bg-black" autoPlay muted playsInline />
            <Button variant="signal" className="w-full" onClick={submitFace} disabled={busy}>{busy ? "Processing…" : "Scan Face"}</Button>
          </>
        )}

        <Button variant="ghost" className="w-full" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
