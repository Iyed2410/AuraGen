
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { AspectRatio, ImageSize, GeneratedImage } from '../types';
import Notification, { NotificationType } from './Notification';

interface ImageGeneratorProps {
  onSave?: (item: GeneratedImage) => void;
}

interface StylePreset {
  id: string;
  name: string;
  tags: string;
  icon: string;
  isCustom?: boolean;
}

const DEFAULT_STYLE_PRESETS: StylePreset[] = [
  { id: 'anime', name: 'Anime', tags: 'Anime style, vibrant colors, expressive eyes, cel shaded', icon: '🎨' },
  { id: 'fantasy', name: 'Fantasy', tags: 'Fantasy art, ethereal, mystical, intricate details, epic scale', icon: '🏰' },
  { id: 'scifi', name: 'Sci-Fi', tags: 'Sci-fi, futuristic, cinematic, high tech, industrial', icon: '🚀' },
  { id: 'abstract', name: 'Abstract', tags: 'Abstract expressionism, bold shapes, conceptual, artistic texture', icon: '🌀' },
  { id: 'cyberpunk', name: 'Cyberpunk', tags: 'Cyberpunk aesthetic, neon lights, rainy city, futuristic noir', icon: '🏙️' },
  { id: 'retro', name: 'Retro', tags: 'Vintage 80s, synthwave, retro-futurism, VHS aesthetic', icon: '📻' }
];

const RATIO_OPTIONS: { label: string, value: AspectRatio, icon: string }[] = [
  { label: '1:1', value: '1:1', icon: '⬜' },
  { label: '3:4', value: '3:4', icon: '▯' },
  { label: '4:3', value: '4:3', icon: '▭' },
  { label: '9:16', value: '9:16', icon: '📱' },
  { label: '16:9', value: '16:9', icon: '🖥️' }
];

const ImageGenerator: React.FC<ImageGeneratorProps> = ({ onSave }) => {
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genStep, setGenStep] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [imageSize, setImageSize] = useState<ImageSize>("1K");
  const [results, setResults] = useState<GeneratedImage[]>([]);
  const [notification, setNotification] = useState<{message: string, type: NotificationType} | null>(null);
  const [customPresets, setCustomPresets] = useState<StylePreset[]>([]);
  const [newPresetName, setNewPresetName] = useState('');
  const [isAddingPreset, setIsAddingPreset] = useState(false);
  
  const [referenceImage, setReferenceImage] = useState<{data: string, mime: string, url: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('auragen_custom_presets');
    if (saved) {
      try {
        setCustomPresets(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load custom presets");
      }
    }
  }, []);

  const notify = (message: string, type: NotificationType = 'info') => {
    setNotification({ message, type });
  };

  const saveCustomPreset = () => {
    if (!newPresetName.trim() || !prompt.trim()) return;
    const newPreset: StylePreset = {
      id: `custom_${Date.now()}`,
      name: newPresetName.trim(),
      tags: prompt.trim(),
      icon: '✨',
      isCustom: true
    };
    const updated = [...customPresets, newPreset];
    setCustomPresets(updated);
    localStorage.setItem('auragen_custom_presets', JSON.stringify(updated));
    setNewPresetName('');
    setIsAddingPreset(false);
    notify("Custom style archived.", "success");
  };

  const deletePreset = (id: string) => {
    const updated = customPresets.filter(p => p.id !== id);
    setCustomPresets(updated);
    localStorage.setItem('auragen_custom_presets', JSON.stringify(updated));
    notify("Style removed.", "info");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        notify("Source file too large.", "error");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const res = event.target?.result as string;
        if (res) {
          setReferenceImage({ 
            data: res.split(',')[1], 
            mime: file.type,
            url: res 
          });
          notify("Reference synchronized.", "success");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const downloadImage = (url: string, id: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `auragen-render-${id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify("Downloading render...", "info");
  };

  const generateImage = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setGenStep('Initializing pipeline...');
    try {
      // Create new instance right before call for fresh API key
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const parts: any[] = [{ text: prompt }];
      if (negativePrompt.trim()) parts[0].text += `. Exclude: ${negativePrompt}.`;
      
      if (referenceImage) {
        const sourceId = `src_${Date.now()}`;
        onSave?.({
          id: sourceId,
          url: referenceImage.url,
          prompt: "Reference Context Source",
          aspectRatio: "1:1",
          size: "1K",
          timestamp: Date.now(),
          sourceType: 'generated'
        });
        
        parts.unshift({ 
          inlineData: { data: referenceImage.data, mimeType: referenceImage.mime } 
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: { imageConfig: { aspectRatio } },
      });

      const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      if (part?.inlineData) {
        const newImg: GeneratedImage = {
          id: `img_${Date.now()}`,
          url: `data:image/png;base64,${part.inlineData.data}`,
          prompt, aspectRatio, size: imageSize, timestamp: Date.now(), sourceType: 'generated', tags: []
        };
        setResults(prev => [newImg, ...prev]);
        notify("Render successful. Source context vaulted.", "success");
      }
    } catch (err: any) {
      console.error(err);
      if (err?.message?.includes("Requested entity was not found")) {
        notify("API Key invalid or restricted. Re-authenticating...", "error");
        window.dispatchEvent(new CustomEvent('auragen:reset_key'));
      } else {
        notify("Pipeline error. Check prompt integrity.", "error");
      }
    } finally {
      setIsGenerating(false);
      setGenStep('');
    }
  };

  const allPresets = [...DEFAULT_STYLE_PRESETS, ...customPresets];

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24 relative min-h-screen">
      {notification && <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
      
      {isGenerating && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/90 backdrop-blur-3xl animate-in fade-in duration-500">
          <div className="bg-slate-900 border border-white/5 p-20 rounded-[4rem] text-center space-y-8 shadow-2xl">
            <div className="w-24 h-24 border-b-4 border-indigo-500 rounded-full animate-spin mx-auto"></div>
            <p className="text-indigo-400 font-black uppercase tracking-[0.5em] animate-pulse">{genStep}</p>
          </div>
        </div>
      )}

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-6xl font-black tracking-tighter uppercase text-white">Aura Studio</h2>
          <p className="text-slate-500 font-bold uppercase tracking-[0.4em] text-[10px] italic">Neural Image Synthesis Engine</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900 rounded-[3rem] p-8 border border-white/5 space-y-8 shadow-2xl">
            
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Dimensions</label>
              <div className="grid grid-cols-5 gap-2">
                {RATIO_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setAspectRatio(opt.value)}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${
                      aspectRatio === opt.value 
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

            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Source Context</label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`relative group h-32 rounded-3xl border-2 border-dashed transition-all flex items-center justify-center cursor-pointer overflow-hidden ${
                  referenceImage ? 'bg-indigo-600/10 border-indigo-500 shadow-xl' : 'bg-slate-950/50 border-white/5 hover:border-indigo-500/40'
                }`}
              >
                {referenceImage ? (
                  <div className="w-full h-full flex items-center gap-4 px-6 animate-in fade-in duration-300">
                    <img src={referenceImage.url} className="w-16 h-16 rounded-xl object-cover border border-white/20 shadow-lg" alt="Ref" />
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-white uppercase truncate">Guidance Active</p>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setReferenceImage(null); }}
                        className="text-[9px] font-black text-red-500 uppercase mt-1 hover:underline"
                      >
                        Clear Source
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center opacity-30 group-hover:opacity-60 transition-opacity">
                    <svg className="w-8 h-8 mx-auto mb-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span className="text-[9px] font-black uppercase tracking-widest">Import Context</span>
                  </div>
                )}
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Neural Directives</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your creative vision..."
                className="w-full h-32 bg-slate-950/50 border border-white/5 rounded-2xl p-6 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600 transition-all resize-none shadow-inner"
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Style Presets</label>
                <button 
                  onClick={() => setIsAddingPreset(!isAddingPreset)}
                  className="text-[10px] text-indigo-400 font-black uppercase hover:text-white transition-colors"
                >
                  {isAddingPreset ? 'Cancel' : '+ New Style'}
                </button>
              </div>

              {isAddingPreset && (
                <div className="flex gap-2 animate-in slide-in-from-top-2 duration-300">
                  <input 
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    placeholder="Style name..."
                    className="flex-1 bg-slate-950 border border-white/5 rounded-xl px-4 py-2 text-[10px] text-white outline-none focus:ring-1 focus:ring-indigo-600"
                  />
                  <button onClick={saveCustomPreset} className="bg-indigo-600 px-4 py-2 rounded-xl text-[10px] font-black text-white hover:bg-indigo-500 transition-colors">SAVE</button>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                {allPresets.map(s => (
                  <div key={s.id} className="relative group">
                    <button 
                      onClick={() => setPrompt(s.tags)}
                      className="w-full flex flex-col items-center gap-2 text-[9px] bg-slate-950/50 hover:bg-indigo-600/20 border border-white/5 hover:border-indigo-500/50 py-4 rounded-2xl text-slate-400 hover:text-white font-black transition-all"
                    >
                      <span className="text-xl group-hover:scale-110 transition-transform">{s.icon}</span>
                      {s.name}
                    </button>
                    {s.isCustom && (
                      <button 
                        onClick={() => deletePreset(s.id)}
                        className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px] transition-opacity shadow-lg"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button 
              onClick={generateImage} 
              disabled={isGenerating || !prompt.trim()}
              className="w-full py-7 rounded-3xl bg-white text-black font-black uppercase tracking-[0.4em] shadow-xl hover:bg-slate-100 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              GENERATE ART
            </button>
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="bg-slate-900/10 min-h-[700px] h-full rounded-[4rem] border border-white/5 p-12 backdrop-blur-3xl shadow-2xl relative overflow-hidden">
            {results.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                {results.map(img => (
                  <div key={img.id} className="rounded-[2.5rem] overflow-hidden border border-white/5 group bg-slate-950 shadow-2xl hover:scale-[1.02] transition-all duration-500">
                    <div className="aspect-square relative">
                      <img src={img.url} className="w-full h-full object-cover" loading="lazy" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                        <button 
                          onClick={() => onSave?.(img)}
                          className="bg-white text-black p-4 rounded-2xl shadow-2xl hover:bg-indigo-600 hover:text-white transition-all active:scale-90"
                          title="Save to Vault"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                        </button>
                        <button 
                          onClick={() => downloadImage(img.url, img.id)}
                          className="bg-indigo-600 text-white p-4 rounded-2xl shadow-2xl hover:bg-white hover:text-indigo-600 transition-all active:scale-90"
                          title="Quick Download"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        </button>
                      </div>
                    </div>
                    <div className="p-6 bg-slate-900/50 flex flex-col gap-2">
                      <p className="text-[10px] text-slate-400 font-medium italic truncate">"{img.prompt}"</p>
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{img.aspectRatio} • {img.size}</span>
                        <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Render Ready</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center opacity-20 space-y-8">
                <div className="w-32 h-32 bg-slate-800 rounded-[3rem] border-2 border-dashed border-white/10 flex items-center justify-center">
                  <svg className="w-16 h-16 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <p className="font-black uppercase tracking-[1em] text-sm">Studio Idle</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageGenerator;
