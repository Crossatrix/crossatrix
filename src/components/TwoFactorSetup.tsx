import { useEffect, useRef, useState } from "react";
import * as faceapi from "@vladmandic/face-api";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model";

type Method = "email" | "sms" | "file" | "face";

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
  if (!r.ok) throw new Error(d.error || "Request failed");
  return d;
}

export default function TwoFactorSetup({
  open, method, onClose, onEnabled,
}: { open: boolean; method: Method | null; onClose: () => void; onEnabled: () => void }) {
  const [step, setStep] = useState<"start" | "code" | "file" | "face">("start");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [secretKey, setSecretKey] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [modelsReady, setModelsReady] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep("start"); setPhone(""); setCode(""); setSecretKey(null);
    }
  }, [open]);

  const start = async () => {
    if (!method) return;
    setBusy(true);
    try {
      if (method === "email") {
        await callFn("twofa-setup", { method });
        setStep("code");
      } else if (method === "sms") {
        if (!phone) { toast.error("Enter phone (E.164, e.g. +491234567890)"); setBusy(false); return; }
        await callFn("twofa-setup", { method, phone });
        setStep("code");
      } else if (method === "file") {
        const r = await callFn("twofa-setup", { method });
        setSecretKey(r.secret_key);
        setUserId(r.user_id);
        setStep("file");
      } else if (method === "face") {
        setStep("face");
        await loadModels();
        await startCamera();
      }
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };

  const loadModels = async () => {
    if (modelsReady) return;
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    setModelsReady(true);
  };

  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
  };

  const stopCamera = () => {
    const v = videoRef.current;
    if (v?.srcObject) (v.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
  };

  const verifyCode = async () => {
    setBusy(true);
    try {
      await callFn("twofa-verify-setup", { method, code, phone: method === "sms" ? phone : undefined });
      toast.success("2-Step Authentication enabled");
      onEnabled(); onClose();
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };

  const downloadFile = () => {
    if (!secretKey || !userId) return;
    const blob = new Blob([JSON.stringify({ user_id: userId, secret_key: secretKey, created_at: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "Account.crossauth"; a.click();
    URL.revokeObjectURL(url);
  };

  const confirmFile = async () => {
    if (!secretKey) return;
    setBusy(true);
    try {
      await callFn("twofa-verify-setup", { method: "file", secret_key: secretKey });
      toast.success("2-Step Authentication enabled");
      onEnabled(); onClose();
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };

  const captureFace = async () => {
    if (!videoRef.current) return;
    setBusy(true);
    try {
      const det = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks().withFaceDescriptor();
      if (!det) throw new Error("No face detected");
      const desc = Array.from(det.descriptor);
      await callFn("twofa-verify-setup", { method: "face", face_descriptor: desc });
      stopCamera();
      toast.success("Face Scan enabled");
      onEnabled(); onClose();
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };

  const handleClose = () => { stopCamera(); onClose(); };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle>Enable {labelOf(method)}</DialogTitle>
          <DialogDescription>Set up 2-Step Authentication for your account.</DialogDescription>
        </DialogHeader>

        {step === "start" && (
          <div className="space-y-4">
            {method === "sms" && (
              <Input placeholder="+491234567890" value={phone} onChange={(e) => setPhone(e.target.value)} />
            )}
            {method === "email" && <p className="text-sm text-muted-foreground">A code will be sent to your account email.</p>}
            {method === "file" && <p className="text-sm text-muted-foreground">A unique key will be generated and downloaded as <code>Account.crossauth</code>.</p>}
            {method === "face" && <p className="text-sm text-muted-foreground">Your camera will be used to capture a face descriptor (no images stored).</p>}
            <Button variant="signal" className="w-full" onClick={start} disabled={busy}>Continue</Button>
          </div>
        )}

        {step === "code" && (
          <div className="space-y-4">
            <Input placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} />
            <Button variant="signal" className="w-full" onClick={verifyCode} disabled={busy || code.length !== 6}>Verify</Button>
          </div>
        )}

        {step === "file" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Download your account file and keep it safe. You'll need it to sign in.</p>
            <Button onClick={downloadFile} className="w-full" variant="outline">Download Account.crossauth</Button>
            <Button variant="signal" className="w-full" onClick={confirmFile} disabled={busy}>I've saved it — Enable</Button>
          </div>
        )}

        {step === "face" && (
          <div className="space-y-4">
            <video ref={videoRef} className="w-full rounded-lg bg-black" autoPlay muted playsInline />
            <Button variant="signal" className="w-full" onClick={captureFace} disabled={busy}>{busy ? "Processing…" : "Capture & Enable"}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function labelOf(m: Method | null) {
  return m === "email" ? "Email Verification"
    : m === "sms" ? "SMS Verification"
    : m === "file" ? "Account File"
    : m === "face" ? "Face Scan" : "";
}
