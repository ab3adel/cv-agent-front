import React, { useState, useRef, useEffect, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff } from "lucide-react";
import { BACKEND_URL, EMAILSTATUS } from "../helper/constants";
import { Actions } from "./actions";


export default function VoiceMode() {
  const [recording, setRecording] = useState(false);
  const [debounce, setDebounce] = useState(false)
  const [transcript, setTranscript] = useState("");
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioUnlocked = useRef<boolean>(false);
  //const audioCtx: AudioContext= 
  const workletNode = useRef<AudioWorkletNode | null>(null)


  const userUUID = useRef<string>(null)
  const requestId = useRef<string>(null)
  const textController = useRef<AbortController | null>(null)
  const audioController = useRef<AbortController | null>(null)
  const isRecordingRef = useRef(false);
  const recordingRef = useRef(false);
  const transcriptRef = useRef('')

  const streamRef = useRef<MediaStream | null>(null);
  const currentStreamId = useRef(0);
  const isSpeakingRef = useRef<boolean>(false)
  const messageEventSourceRef = useRef<EventSource | null>(null);
   const actionEventSourceRef = useRef<EventSource | null>(null);
  const [displayedText, setDisplayedText] = useState("");
  const previousLengthRef = useRef(0);
  const [action,setAction]=useState<{action:string,emailContent:
    string|null,status:typeof EMAILSTATUS[keyof typeof EMAILSTATUS]|null}>
  ({action:'',emailContent:null,status:null})

  let rafId: number | null = null;
  let analysisStream: MediaStream | null = null;
  let analysisAudioCtx: AudioContext | null = null;
  const previousAnswer = useRef<string | null>(null)

  // 1. Separate the silence detector logic
  const startAudioAnalysis = (stream: MediaStream) => {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    let interruptStart = 0;
    analyser.fftSize = 2048;
    source.connect(analyser);

    const data = new Uint8Array(analyser.fftSize);
    const SPEECH_THRESHOLD = 0.02;
    const INTERRUPT_THRESHOLD = SPEECH_THRESHOLD * 3
    const SILENCE_DURATION = 1500; // 1.5s is usually better for UX
    let silenceStart = 0;
    let hasInterrupted = false

    const detect = () => {
      analyser.getByteTimeDomainData(data);

      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      if (isSpeakingRef.current) {
        if (rms > INTERRUPT_THRESHOLD) {
          if (!interruptStart) interruptStart = performance.now();

          if (!hasInterrupted && performance.now() - interruptStart > 200) {
            currentStreamId.current++;
            audioController.current?.abort();
            workletNode.current?.port.postMessage({ type: "reset" });
            isSpeakingRef.current = false;
            isRecordingRef.current = true;
            silenceStart = 0;

            hasInterrupted = true;
          }
        }
        else {
          interruptStart = 0;
        }
      }
      else {
        if (rms > SPEECH_THRESHOLD) {
          isRecordingRef.current = true;
          silenceStart = 0;

        } else if (isRecordingRef.current) {
          if (!silenceStart) silenceStart = performance.now();



          if (performance.now() - silenceStart > SILENCE_DURATION) {
            isRecordingRef.current = false;
            silenceStart = 0;
            hasInterrupted = false; // allow next interruption

            // CHECK REF INSTEAD OF STATE
            if (transcriptRef.current.trim()) {
              console.log('🤫 Silence detected. Sending:', transcriptRef.current);
              sendTextToBackend(transcriptRef.current, recordingRef.current);


              // Optional: Clear transcript after sending
              transcriptRef.current = "";
            }
          }
        }
      }
      requestAnimationFrame(detect);
    };

    rafId = requestAnimationFrame(detect);
  };

  const stopAudioAnalysis = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    analysisStream?.getTracks().forEach(t => t.stop());
    analysisStream = null;

    analysisAudioCtx?.close();
    analysisAudioCtx = null;
  };




  const sendTextToBackend = async (text: string,enableAudio:boolean) => {
    console.log('silence triggered sending text', text)

    textController.current?.abort();
    textController.current = new AbortController();
     if (!text) return
    let key = crypto.randomUUID();
    requestId.current=key
    if(enableAudio) startStreaming(key);
    subscribeMessage(key)
    subscribeAction(key)
   
    let buffer = 'The Answer : ';
   
    
    
    const res = await fetch(`${BACKEND_URL}/cv/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text
        , key
        , userId: userUUID.current
        , assistantAnswer:previousAnswer.current
      }),
      signal: textController.current.signal,
    });



    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });;
      setTranscript(buffer);
      

    }


  };

  const subscribeMessage = (requestId: string) => {

    if (messageEventSourceRef.current) {
      messageEventSourceRef.current.close();
      messageEventSourceRef.current = null;
    }
    const eventSource = new EventSource(
      `${BACKEND_URL}/update/${requestId}`
    );

    messageEventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.status) {
       

          setTranscript(data.status);
        
      }



      if (data.type === "done") {
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };
  }


  
    const subscribeAction= (requestId: string) => {

    if (actionEventSourceRef.current) {
      actionEventSourceRef.current.close();
      actionEventSourceRef.current = null;
    }

    const eventSource = new EventSource(
      `${BACKEND_URL}/actions/${requestId}`
    );

    actionEventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.status) {
        console.log('action',data)
         if (data.status === 'SEND_EMAIL'){
          let [status,emailContent]= data.content?.split('/')
           previousAnswer.current = status===EMAILSTATUS.Pending?emailContent:null
           console.log('setting previousAnswer',previousAnswer.current)
          setAction(pre=>({emailContent,status,action:data.status}))
        }
        else {
        console.log('action',data.status)
         previousAnswer.current=null
        setAction(pre=>({action:data.status,emailContent:null,status:null}));
        }
      }



      if (data.type === "done") {
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };
  }

  async function initAudioOnce() {
    if (audioUnlocked.current) return;

    audioCtxRef.current = new AudioContext({
      sampleRate: 16000,
    });

    await audioCtxRef.current.resume();

    try {
      await audioCtxRef.current.audioWorklet.addModule("/pcm-player-processor.js");

    } catch (e) {
      console.error("worklet load failed", e);
    }

    workletNode.current = new AudioWorkletNode(
      audioCtxRef.current,
      "pcm-player"
    );

    workletNode.current.connect(audioCtxRef.current.destination);

    audioUnlocked.current = true;
    audioCtxRef.current.onstatechange = () => {
      console.log("AudioContext state:", audioCtxRef.current?.state);
    };
    workletNode.current.onprocessorerror = (e) => {
      console.error("Worklet crashed:", e);
    };
  }



  function int16ToFloat32(input: Int16Array) {
    const output = new Float32Array(input.length);

    for (let i = 0; i < input.length; i++) {
      output[i] = input[i] / 32768;
    }

    return output;
  }

  async function startStreaming(key: string | null) {
    if (!key) return
    if (audioController.current) audioController.current?.abort()
    const streamId = ++currentStreamId.current;
    audioController.current = new AbortController();
    const params = new URLSearchParams({
      key,
      userId: userUUID.current as string
    })
    const res = await fetch(`${BACKEND_URL}/cv/audio/stream?${params}`,
      { signal: audioController.current.signal });

    const reader = res.body!.getReader();
    let leftover: Uint8Array | null = null;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      if (streamId !== currentStreamId.current) {
        break
      }
      let chunk = value;
      if (leftover) {
        const merged = new Uint8Array(leftover.length + chunk.length);

        chunk = merged;
        leftover = null;
      }

      // save odd trailing byte
      if (chunk.byteLength % 2 !== 0) {
        leftover = chunk.slice(chunk.byteLength - 1);
        chunk = chunk.slice(0, chunk.byteLength - 1);
      }
      // Convert incoming bytes to Int16 PCM
      const int16 = new Int16Array(
        value.buffer,
        value.byteOffset,
        value.byteLength / 2
      );
      let min = 32767;
      let max = -32768;

      for (let i = 0; i < int16.length; i++) {
        const v = int16[i];
        if (v < min) min = v;
        if (v > max) max = v;
      }

      const float32 = int16ToFloat32(int16);

      // Send to AudioWorklet

      const BLOCK = 2048;
      isSpeakingRef.current = true
      for (let i = 0; i < float32.length; i += BLOCK) {
        workletNode.current?.port.postMessage(
          float32.subarray(i, i + BLOCK)
        );
      }
      //workletNode.current?.port.postMessage(float32);
    }
  }



  useEffect(() => {
    let shouldRestart = true;
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();

    recognition.continuous = true;
    recognition.interimResults = true;

    const init = async () => {
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        startAudioAnalysis(streamRef.current);
      } catch (err) {
        console.error("Mic access denied", err);
      }
    };

    init(); //

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      if (!isSpeakingRef.current) {
        setTranscript(text);
        transcriptRef.current = text;
      }
    };

    recognition.onend = () => {
      if (shouldRestart) {
        try {
          recognition.start();
        } catch (err) {
          console.error("Restart failed", err);
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech error", event.error);
      if (event.error === 'not-allowed') shouldRestart = false;
    };

    recognition.start();

    return () => {
      shouldRestart = false;
      recognition.stop();
      stopAudioAnalysis();   // ← cleanup on unmount
      audioController.current?.abort();
      workletNode.current?.port.postMessage({ type: "reset" });
      streamRef.current?.getTracks().forEach(track => track.stop());

    };
  }, []);

 const unlock =async ()=>{
  setRecording(prev => {
    const next = !prev;
    recordingRef.current = next;

    if (next) {
      initAudioOnce();
      
    }

    return next;
  });
 }
  // useEffect(() => {
 
  //   window.addEventListener("click", unlock, { once: true });
  //   window.addEventListener("touchstart", unlock, { once: true });

  //   return () => {
  //     window.removeEventListener("click", unlock);
  //     window.removeEventListener("touchstart", unlock);
  //   };
  // }, []);

  useEffect(() => {
    if (!userUUID.current) userUUID.current = crypto.randomUUID()
  }, [])

  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

useEffect(() => {
  if (!transcript) return;

  const prevLength = previousLengthRef.current;

  // If transcript shrinks (new message), reset
  if (transcript.length < prevLength) {
    setDisplayedText(transcript);
    previousLengthRef.current = transcript.length;
    return;
  }

  // Only append the new part
  const newPart = transcript.slice(prevLength);

  if (newPart.length > 0) {
    setDisplayedText(prev => prev + newPart);
    previousLengthRef.current = transcript.length;
  }

}, [transcript]);

console.log('assistant answer',previousAnswer.current)
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-8
    w-full md:w-[500px] md:max-w-[500px]">
      {/* Animated bars while recording */}
      <AnimatePresence>
        {recording && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="flex gap-2"
          >
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="w-2 h-10 bg-white rounded-full"
                animate={{ scaleY: [0.5, 1.2, 0.5] }}
                transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.1 }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mic button */}
      <button
         onClick={unlock}
        className="w-20 h-20 rounded-full bg-white text-black flex items-center justify-center shadow-xl"
      >
        {recording ?  <Mic size={32} /> : <MicOff size={32} /> }
      </button>

      {/* Optional transcript */}
      <div className="max-w-xl text-center px-6">

        <AnimatePresence mode="wait">
          <motion.p
            key={transcript}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="text-lg"
          >
            {status }
          </motion.p>
        </AnimatePresence>
        <p className="text-lg">{displayedText || "—"}</p>
        
      </div>
       <Actions action={action.action} emailContent={action.emailContent} status={action.status}  />
    </div>
  );
}
