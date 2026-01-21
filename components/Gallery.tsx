
import React, { useState, useMemo } from 'react';
import { GeneratedImage, SortOrder, ImageSize } from '../types';
import Notification, { NotificationType } from './Notification';

interface GalleryProps {
  items: GeneratedImage[];
  onUpdate: (id: string, updates: Partial<GeneratedImage>) => void;
  onDelete: (id: string) => void;
  onSave?: (item: GeneratedImage) => void;
}

const Gallery: React.FC<GalleryProps> = ({ items, onUpdate, onDelete, onSave }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [comparisonPair, setComparisonPair] = useState<{ original: GeneratedImage; processed: GeneratedImage } | null>(null);
  const [notification, setNotification] = useState<{message: string, type: NotificationType} | null>(null);

  const notify = (message: string, type: NotificationType = 'info') => {
    setNotification({ message, type });
  };

  const filteredItems = useMemo(() => {
    let result = [...items];
    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(item => item.prompt.toLowerCase().includes(lowerSearch));
    }
    result.sort((a, b) => sortOrder === 'newest' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp);
    return result;
  }, [items, searchTerm, sortOrder]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const batchPurge = () => {
    selectedIds.forEach(id => onDelete(id));
    notify(`${selectedIds.size} items purged.`, "info");
    setSelectedIds(new Set());
  };

  const batchExport = () => {
    selectedIds.forEach(id => {
      const item = items.find(i => i.id === id);
      if (item) {
        const link = document.createElement('a');
        link.href = item.url;
        link.download = `auragen-batch-${item.id}.png`;
        link.click();
      }
    });
    notify(`Exporting ${selectedIds.size} items.`, "success");
    setSelectedIds(new Set());
  };

  const showComparison = (processed: GeneratedImage) => {
    // Attempt to find original if this is an edit/upscale
    // In this demo, we check if the prompt matches a native generated one
    if (processed.sourceType === 'generated') return;
    const original = items.find(i => i.sourceType === 'generated' && processed.prompt.includes(i.prompt));
    if (original) {
      setComparisonPair({ original, processed });
    } else {
      notify("Original source not found in vault.", "info");
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-24 relative">
      {notification && <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}

      {comparisonPair && (
        <div className="fixed inset-0 z-[200] bg-slate-950/95 flex flex-col p-8 md:p-20 overflow-y-auto backdrop-blur-xl">
          <div className="flex justify-between items-center mb-12">
            <h3 className="text-4xl font-black uppercase tracking-tighter">Render Comparison</h3>
            <button onClick={() => setComparisonPair(null)} className="text-slate-400 hover:text-white p-4">CLOSE</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
            <div className="space-y-4">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Original Context</span>
              <img src={comparisonPair.original.url} className="w-full rounded-3xl border border-white/5" />
            </div>
            <div className="space-y-4">
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Processed Result</span>
              <img src={comparisonPair.processed.url} className="w-full rounded-3xl border border-indigo-500/30" />
            </div>
          </div>
        </div>
      )}

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-white/5 pb-10">
        <h2 className="text-6xl font-black tracking-tighter uppercase italic text-white">The Vault</h2>
        
        <div className="flex flex-wrap gap-4 items-center">
          {selectedIds.size > 0 && (
            <div className="flex gap-2 animate-in fade-in zoom-in">
              <button onClick={batchExport} className="bg-white text-black px-6 py-3 rounded-xl text-[10px] font-black uppercase">Export ({selectedIds.size})</button>
              <button onClick={batchPurge} className="bg-red-600/10 text-red-500 px-6 py-3 rounded-xl text-[10px] font-black uppercase border border-red-500/30">Purge</button>
              <button onClick={() => setSelectedIds(new Set())} className="text-slate-500 text-[10px] font-black uppercase">Cancel</button>
            </div>
          )}
          <input 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search vault..."
            className="bg-slate-900 border border-white/5 rounded-2xl px-6 py-3 text-sm text-white focus:outline-none"
          />
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {filteredItems.map(item => (
          <div 
            key={item.id} 
            className={`group relative rounded-[2.5rem] overflow-hidden border transition-all duration-500 ${selectedIds.has(item.id) ? 'border-indigo-500 shadow-2xl scale-95' : 'border-white/5'}`}
          >
            <div className="aspect-square relative cursor-pointer" onClick={() => selectedIds.size > 0 ? toggleSelect(item.id) : showComparison(item)}>
              <img src={item.url} className="w-full h-full object-cover" />
              <div className="absolute top-4 left-4">
                <button 
                  onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
                  className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${selectedIds.has(item.id) ? 'bg-indigo-600 border-indigo-400' : 'bg-black/50 border-white/20'}`}
                >
                  {selectedIds.has(item.id) && <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </button>
              </div>
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                {item.sourceType !== 'generated' && <span className="text-[10px] font-black uppercase tracking-widest text-white">Compare</span>}
              </div>
            </div>
            <div className="p-6 bg-slate-900 flex items-center justify-between">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{item.sourceType}</span>
              <button onClick={() => onDelete(item.id)} className="text-red-500 hover:text-red-400 text-[10px] font-black uppercase">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Gallery;
