import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff } from "lucide-react";



export default function VoiceModeApp() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const recognitionRef = useRef<SpeechRecognition|null>(null);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event:SpeechRecognitionEvent) => {
      
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      setTranscript(text);
    };

    recognitionRef.current = recognition;
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
      speak("I heard you say: " + transcript);
      setResponse("I heard you say: " + transcript);
    } else {
      setTranscript("");
      setResponse("");
      recognitionRef.current.start();
      setListening(true);
    }
  };
 
  const speak = (text:string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-8">
      <AnimatePresence>
        {listening && (
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
                animate={{
                  scaleY: [0.5, 1.2, 0.5],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 0.8,
                  delay: i * 0.1,
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={toggleListening}
        className="w-20 h-20 rounded-full bg-white text-black flex items-center justify-center shadow-xl"
      >
        {listening ? <MicOff size={32} /> : <Mic size={32} />}
      </button>

      <div className="max-w-xl text-center px-6">
        <p className="text-gray-400 text-sm mb-2">You said</p>
        <p className="text-lg">{transcript || "—"}</p>

        {response && (
          <>
            <p className="text-gray-400 text-sm mt-6 mb-2">Assistant</p>
            <p className="text-lg">{response}</p>
          </>
        )}
      </div>
    </div>
  );
}
