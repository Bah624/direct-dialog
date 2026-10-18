import { useState, useRef, useCallback, useEffect } from 'react';
import { voiceAgent, VoiceAgentOutputType } from 'zitejs/api';
import { Mic, MicOff, Volume2, Trash2, Bot } from 'lucide-react';
import { Button } from '@project/components/ui/button';
import { ScrollArea } from '@project/components/ui/scroll-area';
import { cn } from '@project/components/lib/utils';
import { toast } from 'sonner';
import { Toaster } from '@project/components/ui/sonner';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  audioBase64?: string;
};

export default function AgentPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const stopAnimLoop = () => {
    cancelAnimationFrame(animFrameRef.current);
    setAudioLevel(0);
  };

  const startLevelMonitor = (stream: MediaStream) => {
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += Math.abs(data[i] - 128);
      setAudioLevel(Math.min(1, (sum / data.length) / 30));
      animFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
  };

  const startRecording = useCallback(async () => {
    if (processing) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      startLevelMonitor(stream);

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stopAnimLoop();
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        await processAudio(blob, mimeType);
      };

      recorder.start();
      setRecording(true);
    } catch {
      toast.error("Impossible d'accéder au microphone");
    }
  }, [processing, messages]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }, []);

  const processAudio = async (blob: Blob, mimeType: string) => {
    setProcessing(true);
    try {
      const base64 = await blobToBase64(blob);
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const result = await voiceAgent({ audioBase64: base64, mimeType, messages: history, conversationId });

      const userMsg: Message = { role: 'user', content: result.transcript };
      const assistantMsg: Message = {
        role: 'assistant',
        content: result.responseText,
        audioBase64: result.audioBase64,
      };

      setMessages(prev => [...prev, userMsg, assistantMsg]);
      if (result.conversationId) setConversationId(result.conversationId);
      playAudio(result.audioBase64, result.mimeType);
    } catch {
      toast.error("Erreur lors du traitement audio");
    } finally {
      setProcessing(false);
    }
  };

  const playAudio = (base64: string, mimeType: string) => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    const url = `data:${mimeType};base64,${base64}`;
    const audio = new Audio(url);
    currentAudioRef.current = audio;
    audio.play().catch(() => toast.error("Impossible de lire l'audio"));
  };

  const replayMessage = (msg: Message) => {
    if (msg.audioBase64) playAudio(msg.audioBase64, 'audio/mpeg');
  };

  const clearConversation = () => {
    if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current = null; }
    setMessages([]);
    setConversationId(undefined);
  };

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto gap-4">
      <Toaster />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-md shadow-primary/30">
            <Bot className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Assistant DIRECT DIALOG</h2>
            <p className="text-xs text-muted-foreground">
              Agent vocal IA · Base de données connectée
              {conversationId && <span className="ml-2 text-green-600">● Conversation sauvegardée</span>}
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearConversation} className="gap-1.5 text-muted-foreground">
            <Trash2 className="w-3.5 h-3.5" />Effacer
          </Button>
        )}
      </div>

      {/* Conversation */}
      <div className="flex-1 min-h-0 rounded-xl border border-border bg-card overflow-hidden flex flex-col">
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Mic className="w-8 h-8 text-primary opacity-60" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Commencez à parler</p>
                <p className="text-xs text-muted-foreground mt-1">Maintenez le bouton pour enregistrer votre message</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5 text-primary-foreground" />
                    </div>
                  )}
                  <div className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-sm'
                      : 'bg-muted text-foreground rounded-tl-sm'
                  )}>
                    <p className="leading-relaxed">{msg.content}</p>
                    {msg.role === 'assistant' && msg.audioBase64 && (
                      <button
                        onClick={() => replayMessage(msg)}
                        className="mt-1.5 flex items-center gap-1 text-xs opacity-60 hover:opacity-100 transition-opacity"
                      >
                        <Volume2 className="w-3 h-3" /> Réécouter
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <div ref={scrollRef} />
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Recording control */}
      <div className="flex flex-col items-center gap-3 pb-2">
        {processing && (
          <p className="text-xs text-muted-foreground animate-pulse">Traitement en cours…</p>
        )}
        {recording && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-destructive font-medium animate-pulse">● Enregistrement…</span>
            <div className="flex items-end gap-0.5 h-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-destructive rounded-full transition-all duration-75"
                  style={{ height: `${Math.max(4, audioLevel * 16 * (0.5 + Math.random() * 0.5))}px` }}
                />
              ))}
            </div>
          </div>
        )}

        <button
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={e => { e.preventDefault(); startRecording(); }}
          onTouchEnd={e => { e.preventDefault(); stopRecording(); }}
          disabled={processing}
          className={cn(
            'w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200 select-none',
            'shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            recording
              ? 'bg-destructive scale-110 shadow-destructive/40 shadow-xl'
              : processing
              ? 'bg-muted cursor-not-allowed opacity-50'
              : 'bg-primary hover:bg-primary/90 hover:scale-105 active:scale-95 shadow-primary/30'
          )}
        >
          {recording
            ? <MicOff className="w-8 h-8 text-white" />
            : <Mic className="w-8 h-8 text-primary-foreground" />
          }
        </button>

        <p className="text-xs text-muted-foreground">
          {recording ? 'Relâchez pour envoyer' : processing ? 'Patience…' : 'Maintenez pour parler'}
        </p>
      </div>
    </div>
  );
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
