
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { ChatMessage } from '../types';
import { getGeminiApiKey } from '../lib/getGeminiApiKey';

interface Attachment {
  data: string;
  mime: string;
  url: string;
  type: 'image' | 'video' | 'audio';
}

const ChatBot: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Hello! I am AuraGen. I can analyze images, understand videos, transcribe your voice, and solve complex problems. Everything here is free to use!' }
  ]);
  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'audio';
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result;
        if (typeof url === 'string') {
          const data = url.split(',')[1];
          setAttachment({ data, mime: file.type, url, type });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        transcribeAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (blob: Blob) => {
    setIsLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });
        const result = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [{
            parts: [
              { inlineData: { data: base64, mimeType: 'audio/webm' } },
              { text: "Transcribe this audio exactly. Only return the transcription text." }
            ]
          }]
        });
        setInput(prev => (prev ? prev + " " + result.text : result.text || ""));
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error("Transcription failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const generateSpeech = async (text: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const binaryStr = atob(base64Audio);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        // Use DataView for safer buffer reading
        const buffer = audioContext.createBuffer(1, bytes.length / 2, 24000);
        const channelData = buffer.getChannelData(0);
        const dataView = new DataView(bytes.buffer);
        
        for (let i = 0; i < channelData.length; i++) {
          // Read Int16 values (2 bytes each) and normalize
          const val = dataView.getInt16(i * 2, true);
          channelData[i] = val / 32768.0;
        }

        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start();
      }
    } catch (err) {
      console.error("TTS output failed:", err);
    }
  };

  const sendMessage = async () => {
    if ((!input.trim() && !attachment) || isLoading) return;

    const userText = input || (attachment ? `Analyze this ${attachment.type}.` : "");
    const currentAttachment = attachment;
    const currentThinking = isThinking;
    
    setInput('');
    setAttachment(null);
    setMessages(prev => [...prev, { 
      role: 'user', 
      text: userText + (currentAttachment ? ` [${currentAttachment.type.toUpperCase()} Attached]` : "") 
    }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });
      const config: any = {};
      if (currentThinking) {
        config.thinkingConfig = { thinkingBudget: 0 }; // Defaulting to zero if issues persist, or valid budget
      }

      const contents: any[] = [{
        parts: []
      }];

      if (currentAttachment) {
        contents[0].parts.push({ 
          inlineData: { 
            data: currentAttachment.data, 
            mimeType: currentAttachment.mime 
          } 
        });
      }
      contents[0].parts.push({ text: userText });

      const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents,
        config
      });
      
      const response = result.text;
      setMessages(prev => [...prev, { role: 'model', text: response || "Analysis complete." }]);
    } catch (err) {
      console.error("Inference failure:", err);
      setMessages(prev => [...prev, { role: 'model', text: "Service temporarily unavailable. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-160px)] flex flex-col">
      <header className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tighter italic">Intelligence</h2>
          <p className="text-slate-500 font-bold uppercase tracking-[0.4em] text-[10px]">Multimodal Consultant</p>
        </div>
        <div className="flex items-center gap-3 bg-slate-900 border border-white/5 p-3 rounded-2xl shadow-xl">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Thought Budget</span>
          <button 
            onClick={() => setIsThinking(!isThinking)}
            className={`w-12 h-6 rounded-full transition-all relative ${isThinking ? 'bg-indigo-600' : 'bg-slate-700'}`}
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isThinking ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
      </header>

      <div className="flex-1 bg-slate-900/50 rounded-3xl border border-white/5 flex flex-col overflow-hidden shadow-2xl relative backdrop-blur-3xl">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-8">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`relative group max-w-[85%] p-6 rounded-3xl ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-200 rounded-tl-none border border-white/5 shadow-2xl'}`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                {msg.role === 'model' && (
                  <button 
                    onClick={() => generateSpeech(msg.text)}
                    className="absolute -right-12 top-0 opacity-0 group-hover:opacity-100 p-3 text-slate-500 hover:text-indigo-400 transition-all"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                  </button>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-800 p-6 rounded-3xl rounded-tl-none border border-white/5 flex flex-col gap-3 shadow-2xl">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-75"></div>
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-150"></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {attachment && (
          <div className="px-8 py-4 bg-indigo-900/20 border-t border-white/5 flex items-center gap-4 animate-in slide-in-from-bottom-2 duration-300">
            {attachment.type === 'image' && <img src={attachment.url} className="h-14 w-14 object-cover rounded-xl border border-white/20 shadow-2xl" alt="Preview" />}
            <div className="flex-1">
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest italic">{attachment.type} Context Attached</span>
            </div>
            <button onClick={() => setAttachment(null)} className="bg-red-500/10 hover:bg-red-600 text-red-500 hover:text-white p-2 rounded-xl transition-all shadow-lg active:scale-90">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}

        <div className="p-6 bg-slate-900 border-t border-white/5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-5 bg-slate-800 hover:bg-indigo-600/20 text-slate-400 hover:text-indigo-400 rounded-2xl border border-white/5 transition-all shadow-xl active:scale-95"
            >
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </button>
            
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              className={`p-5 rounded-2xl border transition-all shadow-xl active:scale-95 ${isRecording ? 'bg-red-600 border-red-500 animate-pulse text-white' : 'bg-slate-800 border-white/5 text-slate-400 hover:text-red-400'}`}
            >
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            </button>

            <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*,audio/*" onChange={handleFile} />
            
            <div className="relative flex-1">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Direct neural inquiry..."
                className="w-full bg-slate-800 border border-white/5 rounded-2xl pl-6 pr-16 py-5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-600/40 transition-all shadow-inner"
              />
              <button
                onClick={sendMessage}
                disabled={(!input.trim() && !attachment) || isLoading}
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-xl transition-all ${(!input.trim() && !attachment) || isLoading ? 'text-slate-600' : 'text-indigo-400 hover:text-white hover:bg-indigo-600 shadow-xl'}`}
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatBot;
