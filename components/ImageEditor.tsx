
import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { GeneratedImage, AspectRatio } from '../types';
import { getGeminiApiKey } from '../lib/getGeminiApiKey';
import Notification, { NotificationType } from './Notification';

interface ImageEditorProps {
  onSave?: (item: GeneratedImage) => void;
}

interface EditorState {
  imageUrl: string;
  aspectRatio: AspectRatio;
  params: {
    brightness: number;
    contrast: number;
    saturation: number;
    exposure: number;
    crop: number; // Percentage from center
  }
}

const INITIAL_PARAMS = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  exposure: 100,
  crop: 0
};

const RATIO_OPTIONS: { label: string, value: AspectRatio, icon: string }[] = [
  { label: '1:1', value: '1:1', icon: '⬜' },
  { label: '3:4', value: '3:4', icon: '▯' },
  { label: '4:3', value: '4:3', icon: '▭' },
  { label: '9:16', value: '9:16', icon: '📱' },
  { label: '16:9', value: '16:9', icon: '🖥️' }
];

const ImageEditor: React.FC<ImageEditorProps> = ({ onSave }) => {
  const [history, setHistory] = useState<EditorState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [params, setParams] = useState(INITIAL_PARAMS);
  const [targetRatio, setTargetRatio] = useState<AspectRatio>("1:1");
  const [notification, setNotification] = useState<{message: string, type: NotificationType} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const notify = useCallback((message: string, type: NotificationType = 'info') => {
    setNotification({ message, type });
  }, []);

  const addToHistory = (state: EditorState) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(state);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) return notify("File too large.", "error");
      setMimeType(file.type);
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setSourceImage(result);
        addToHistory({ imageUrl: result, aspectRatio: "1:1", params: INITIAL_PARAMS });
        notify("Source imported.", "success");
      };
      reader.readAsDataURL(file);
    }
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      const state = history[historyIndex - 1];
      setSourceImage(state.imageUrl);
      setParams(state.params);
      setTargetRatio(state.aspectRatio);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      const state = history[historyIndex + 1];
      setSourceImage(state.imageUrl);
      setParams(state.params);
      setTargetRatio(state.aspectRatio);
    }
  };

  const editImage = async () => {
    if (!sourceImage) return;
    setIsProcessing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });
      const base64Data = sourceImage.split(',')[1];
      
      const manualContext = `Apply adjustments: brightness ${params.brightness}%, contrast ${params.contrast}%, saturation ${params.saturation}%.`;
      
      // Auto-complete (Outpainting) Logic
      // If the target ratio changed or is explicitly requested, we instruct the model to outpaint.
      const ratioContext = `Expand and reformat the image into a ${targetRatio} aspect ratio by intelligently outpainting and generating new matching content to fill the frame seamlessly.`;
      
      const finalPrompt = `${ratioContext} ${prompt.trim() ? prompt : 'Enhance the details'}. ${manualContext}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: mimeType } },
            { text: `Execute the following changes: ${finalPrompt}` }
          ],
        },
        config: {
          imageConfig: { aspectRatio: targetRatio }
        }
      });

      const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      if (part?.inlineData) {
        const resultUrl = `data:image/png;base64,${part.inlineData.data}`;
        setSourceImage(resultUrl);
        addToHistory({ imageUrl: resultUrl, aspectRatio: targetRatio, params });
        if (onSave) onSave({
          id: `edit_${Date.now()}`,
          url: resultUrl,
          prompt: finalPrompt,
          aspectRatio: targetRatio,
          size: "1K",
          timestamp: Date.now(),
          sourceType: 'edited'
        });
        notify("Neural edit finalized.", "success");
      }
    } catch (err) {
      notify("Pipeline error.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const sliderClass = "w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer";

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-24 relative min-h-screen">
      {notification && <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}

      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-6xl font-black tracking-tighter uppercase text-white">Advanced Editor</h2>
          <p className="text-slate-500 text-[10px] uppercase font-black tracking-[0.4em]">Granular Neural Control</p>
        </div>
        <div className="flex gap-4">
          <button onClick={undo} disabled={historyIndex <= 0} className="px-6 py-3 bg-slate-900 border border-white/5 rounded-xl text-[10px] font-black uppercase disabled:opacity-20">Undo</button>
          <button onClick={redo} disabled={historyIndex >= history.length - 1} className="px-6 py-3 bg-slate-900 border border-white/5 rounded-xl text-[10px] font-black uppercase disabled:opacity-20">Redo</button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900 rounded-[3rem] p-10 border border-white/5 space-y-8 shadow-2xl">
            
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Target Aspect Ratio (AutoComplete)</label>
              <div className="grid grid-cols-5 gap-2">
                {RATIO_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTargetRatio(opt.value)}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${
                      targetRatio === opt.value 
                        ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' 
                        : 'bg-slate-950/50 border-white/5 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <span className="text-sm mb-1">{opt.icon}</span>
                    <span className="text-[8px] font-black">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Manual Correction</label>
              
              <div className="space-y-4">
                {Object.entries(params).map(([key, val]) => (
                  <div key={key} className="space-y-2">
                    <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-400">
                      <span>{key}</span>
                      <span>{val}%</span>
                    </div>
                    <input 
                      type="range" 
                      min={key === 'crop' ? 0 : 0} 
                      max={key === 'crop' ? 50 : 200} 
                      value={val} 
                      onChange={(e) => setParams({...params, [key]: parseInt(e.target.value)})}
                      className={sliderClass} 
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 pt-6 border-t border-white/5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Neural Directives</label>
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="E.g., transform to watercolor..."
                className="w-full bg-slate-950 border border-white/5 rounded-xl px-6 py-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
              <button 
                onClick={editImage} 
                disabled={!sourceImage || isProcessing}
                className="w-full py-6 rounded-2xl bg-white text-black font-black uppercase tracking-widest hover:bg-slate-200 transition-all shadow-xl disabled:opacity-30"
              >
                {isProcessing ? 'RENDERING...' : 'INITIALIZE RENDER'}
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8">
          <div 
            className="bg-slate-900/10 min-h-[600px] rounded-[4rem] border border-white/5 flex items-center justify-center relative overflow-hidden cursor-pointer"
            onClick={() => !sourceImage && fileInputRef.current?.click()}
          >
            {sourceImage ? (
              <div className="p-12 w-full h-full flex items-center justify-center">
                <div 
                  className="relative overflow-hidden rounded-2xl border border-white/5 shadow-2xl transition-all duration-300"
                  style={{ 
                    filter: `brightness(${params.brightness}%) contrast(${params.contrast}%) saturate(${params.saturation}%)`,
                    transform: `scale(${1 + params.crop/50})`
                  }}
                >
                  <img src={sourceImage} className="max-w-full max-h-[500px] object-contain" />
                </div>
              </div>
            ) : (
              <p className="text-[10px] font-black uppercase tracking-[1em] opacity-20">Import Source</p>
            )}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageEditor;
