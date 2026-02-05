
import React, { useState, useEffect, useCallback } from 'react';
import { View, GeneratedImage } from './types';
import Sidebar from './components/Sidebar';
import ImageGenerator from './components/ImageGenerator';
import ImageEditor from './components/ImageEditor';
import ChatBot from './components/ChatBot';
import Gallery from './components/Gallery';
import LoginView from './components/LoginView';
import { setGeminiApiKey } from './lib/getGeminiApiKey';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.GENERATE);
  const [gallery, setGallery] = useState<GeneratedImage[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      console.error("Global App Error:", error);
      setHasError(true);
      setErrorMessage(error.message || "A critical rendering error occurred.");
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  useEffect(() => {
    const session = localStorage.getItem('auragen_session');
    if (session === 'active') {
      setIsAuthenticated(true);
    }

    try {
      const savedGallery = localStorage.getItem('auragen_gallery');
      if (savedGallery) {
        const parsed = JSON.parse(savedGallery);
        if (Array.isArray(parsed)) {
          setGallery(parsed);
        }
      }
    } catch (e) {
      console.error("Corrupted gallery data detected, resetting vault.", e);
      localStorage.removeItem('auragen_gallery');
    }
  }, []);

  useEffect(() => {
    if (gallery.length === 0) return;
    try {
      const trimmedGallery = gallery.slice(0, 15);
      localStorage.setItem('auragen_gallery', JSON.stringify(trimmedGallery));
    } catch (e) {
      console.error("Vault storage failed (likely quota reached).", e);
    }
  }, [gallery]);

  const handleLoginSuccess = useCallback(() => {
    setIsAuthenticated(true);
    localStorage.setItem('auragen_session', 'active');
  }, []);

  const handleLogout = useCallback(() => {
    setIsAuthenticated(false);
    localStorage.removeItem('auragen_session');
  }, []);

  const addToGallery = useCallback((item: GeneratedImage) => {
    setGallery(prev => {
      if (prev.some(i => i.id === item.id)) return prev;
      return [item, ...prev];
    });
  }, []);

  const updateGalleryItem = useCallback((id: string, updates: Partial<GeneratedImage>) => {
    setGallery(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  }, []);

  const deleteFromGallery = useCallback((id: string) => {
    setGallery(prev => prev.filter(item => item.id !== id));
  }, []);

  const resetApp = () => {
    localStorage.clear();
    window.location.reload();
  };

  // Global listener for API Key reset events from components
  useEffect(() => {
    const handleKeyReset = () => {
      setGeminiApiKey('');
      handleLogout();
    };
    window.addEventListener('auragen:reset_key', handleKeyReset);
    return () => window.removeEventListener('auragen:reset_key', handleKeyReset);
  }, [handleLogout]);

  if (hasError) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        </div>
        <h1 className="text-2xl font-black uppercase tracking-tighter mb-2">Engine Failure</h1>
        <p className="text-slate-400 text-sm max-w-md mb-8">{errorMessage}</p>
        <button 
          onClick={resetApp}
          className="bg-white text-black px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
        >
          Factory Reset Engine
        </button>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden text-slate-100 font-sans">
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} onLogout={handleLogout} />
      
      <main className="flex-1 relative flex flex-col overflow-hidden bg-slate-950">
        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          {currentView === View.GENERATE && <ImageGenerator onSave={addToGallery} />}
          {currentView === View.EDIT && <ImageEditor onSave={addToGallery} />}
          {currentView === View.CHAT && <ChatBot />}
          {currentView === View.GALLERY && (
            <Gallery 
              items={gallery} 
              onUpdate={updateGalleryItem} 
              onDelete={deleteFromGallery} 
              onSave={addToGallery}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
