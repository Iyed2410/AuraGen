
import React, { useState } from 'react';
import { PromptCategory } from '../types';

interface PromptBuilderProps {
  onSelect: (tag: string, mode: 'positive' | 'negative') => void;
}

const CATEGORIES: PromptCategory[] = [
  {
    label: 'Art Style',
    options: ['Photorealistic', 'Digital Art', 'Oil Painting', 'Cyberpunk', 'Studio Ghibli', '3D Render', 'Watercolor', 'Minimalist', 'Anime', 'Fantasy Art', 'Sci-Fi', 'Abstract']
  },
  {
    label: 'Artistic Mediums',
    options: ['Charcoal Sketch', 'Acrylic on Canvas', 'Lithograph', 'Digital Painting', '3D Clay Model', 'Glass Art', 'Embroidery', 'Pencil Drawing']
  },
  {
    label: 'Camera Lenses',
    options: ['35mm Lens', '85mm Bokeh', 'Wide Angle', 'Macro Lens', 'Telephoto', 'GoPro POV', 'Anamorphic', 'Fisheye']
  },
  {
    label: 'Emotional Tones',
    options: ['Melancholic', 'Joyful', 'Aggressive', 'Zen', 'Loneliness', 'Triumph', 'Mystery', 'Hopeful', 'Dark']
  },
  {
    label: 'Lighting',
    options: ['Cinematic', 'Golden Hour', 'Neon', 'Soft Bokeh', 'Volumetric', 'Hard Shadows', 'Studio Lighting', 'Moonlight', 'Natural Light']
  }
];

const PromptBuilder: React.FC<PromptBuilderProps> = ({ onSelect }) => {
  const [mode, setMode] = useState<'positive' | 'negative'>('positive');

  return (
    <div className="space-y-4">
      <div className="flex bg-slate-800 p-1 rounded-lg">
        <button
          onClick={() => setMode('positive')}
          className={`flex-1 text-[10px] font-bold py-1.5 rounded-md transition-all ${mode === 'positive' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
        >
          INCLUDE
        </button>
        <button
          onClick={() => setMode('negative')}
          className={`flex-1 text-[10px] font-bold py-1.5 rounded-md transition-all ${mode === 'negative' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
        >
          EXCLUDE
        </button>
      </div>

      <div className="h-48 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
        {CATEGORIES.map((cat) => (
          <div key={cat.label} className="space-y-2">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">{cat.label}</span>
            <div className="flex flex-wrap gap-1.5">
              {cat.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => onSelect(opt, mode)}
                  className={`text-[10px] px-2 py-1 rounded-md border transition-all ${
                    mode === 'positive' 
                    ? 'bg-slate-800 hover:bg-indigo-600/20 text-slate-400 hover:text-indigo-400 border-slate-700 hover:border-indigo-500/50' 
                    : 'bg-slate-800 hover:bg-red-600/20 text-slate-400 hover:text-red-400 border-slate-700 hover:border-red-500/50'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PromptBuilder;
