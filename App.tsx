/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import { generateEditedImage, generateFilteredImage, generateAdjustedImage } from './services/geminiService';
// FIX: Changed to a default import for the Header component, which is more conventional.
import Header from './components/Header';
import Spinner from './components/Spinner';
import FilterPanel from './components/FilterPanel';
import AdjustmentPanel from './components/AdjustmentPanel';
import CropPanel from './components/CropPanel';
import { UndoIcon, RedoIcon, EyeIcon, SideBySideIcon } from './components/icons';
import StartScreen from './components/StartScreen';

// Helper to convert a data URL string to a File object
const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    if (arr.length < 2) throw new Error("URL de données invalide");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Impossible d'analyser le type MIME à partir de l'URL de données");

    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
}

type Tab = 'retouch' | 'adjust' | 'filters' | 'crop';

const tabDisplayNames: Record<Tab, string> = {
  retouch: 'Retouche',
  adjust: 'Ajuster',
  filters: 'Filtres',
  crop: 'Rogner',
};

const App: React.FC = () => {
  const [history, setHistory] = useState<File[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [editHotspot, setEditHotspot] = useState<{ x: number, y: number } | null>(null);
  const [displayHotspot, setDisplayHotspot] = useState<{ x: number, y: number } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('retouch');
  
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [aspect, setAspect] = useState<number | undefined>();
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [isSideBySide, setIsSideBySide] = useState<boolean>(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const currentImage = history[historyIndex] ?? null;
  const originalImage = history[0] ?? null;

  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);

  // Effect to create and revoke object URLs safely for the current image
  useEffect(() => {
    if (currentImage) {
      const url = URL.createObjectURL(currentImage);
      setCurrentImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setCurrentImageUrl(null);
    }
  }, [currentImage]);
  
  // Effect to create and revoke object URLs safely for the original image
  useEffect(() => {
    if (originalImage) {
      const url = URL.createObjectURL(originalImage);
      setOriginalImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setOriginalImageUrl(null);
    }
  }, [originalImage]);


  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const addImageToHistory = useCallback((newImageFile: File) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newImageFile);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    // Reset transient states after an action
    setCrop(undefined);
    setCompletedCrop(undefined);
  }, [history, historyIndex]);

  const handleImageUpload = useCallback((file: File) => {
    setError(null);
    setHistory([file]);
    setHistoryIndex(0);
    setEditHotspot(null);
    setDisplayHotspot(null);
    setActiveTab('retouch');
    setCrop(undefined);
    setCompletedCrop(undefined);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!currentImage) {
      setError('Aucune image chargée à modifier.');
      return;
    }
    
    if (!prompt.trim()) {
        setError('Veuillez entrer une description pour votre modification.');
        return;
    }

    if (!editHotspot) {
        setError("Veuillez cliquer sur l'image pour sélectionner une zone à modifier.");
        return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
        const editedImageUrl = await generateEditedImage(currentImage, prompt, editHotspot);
        const newImageFile = dataURLtoFile(editedImageUrl, `modifiee-${Date.now()}.png`);
        addImageToHistory(newImageFile);
        setEditHotspot(null);
        setDisplayHotspot(null);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Une erreur inconnue est survenue.';
        setError(`Échec de la génération de l'image. ${errorMessage}`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, prompt, editHotspot, addImageToHistory]);
  
  const handleApplyFilter = useCallback(async (filterPrompt: string) => {
    if (!currentImage) {
      setError("Aucune image chargée pour appliquer un filtre.");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
        const filteredImageUrl = await generateFilteredImage(currentImage, filterPrompt);
        const newImageFile = dataURLtoFile(filteredImageUrl, `filtree-${Date.now()}.png`);
        addImageToHistory(newImageFile);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Une erreur inconnue est survenue.';
        setError(`Échec de l'application du filtre. ${errorMessage}`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);
  
  const handleApplyAdjustment = useCallback(async (adjustmentPrompt: string) => {
    if (!currentImage) {
      setError("Aucune image chargée pour appliquer un ajustement.");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
        const adjustedImageUrl = await generateAdjustedImage(currentImage, adjustmentPrompt);
        const newImageFile = dataURLtoFile(adjustedImageUrl, `ajustee-${Date.now()}.png`);
        addImageToHistory(newImageFile);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Une erreur inconnue est survenue.';
        setError(`Échec de l'application de l'ajustement. ${errorMessage}`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);

  const handleApplyCrop = useCallback(() => {
    if (!completedCrop || !imgRef.current) {
        setError('Veuillez sélectionner une zone à rogner.');
        return;
    }

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        setError('Impossible de traiter le rognage.');
        return;
    }

    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = completedCrop.width * pixelRatio;
    canvas.height = completedCrop.height * pixelRatio;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height,
    );
    
    const croppedImageUrl = canvas.toDataURL('image/png');
    const newImageFile = dataURLtoFile(croppedImageUrl, `rognee-${Date.now()}.png`);
    addImageToHistory(newImageFile);

  }, [completedCrop, addImageToHistory]);

  const handleUndo = useCallback(() => {
    if (canUndo) {
      setHistoryIndex(historyIndex - 1);
      setEditHotspot(null);
      setDisplayHotspot(null);
    }
  }, [canUndo, historyIndex]);
  
  const handleRedo = useCallback(() => {
    if (canRedo) {
      setHistoryIndex(historyIndex + 1);
      setEditHotspot(null);
      setDisplayHotspot(null);
    }
  }, [canRedo, historyIndex]);

  const handleReset = useCallback(() => {
    if (history.length > 0 && window.confirm("Êtes-vous sûr de vouloir réinitialiser l'image à son état original ? Toutes les modifications seront perdues.")) {
      setHistoryIndex(0);
      setError(null);
      setEditHotspot(null);
      setDisplayHotspot(null);
      setCrop(undefined);
      setCompletedCrop(undefined);
    }
  }, [history]);

  const handleNewImage = useCallback(() => {
    if (window.confirm("Êtes-vous sûr de vouloir commencer avec une nouvelle image ? Toutes les modifications non sauvegardées seront perdues.")) {
      setHistory([]);
      setHistoryIndex(-1);
      setError(null);
      setEditHotspot(null);
      setDisplayHotspot(null);
      setCrop(undefined);
      setCompletedCrop(undefined);
    }
  }, []);
  
  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (activeTab !== 'retouch' || isLoading) return;
    const imgElement = e.currentTarget;
    const { naturalWidth, naturalHeight } = imgElement;
    const rect = imgElement.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * naturalWidth);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * naturalHeight);
    
    const displayX = (e.clientX - rect.left);
    const displayY = (e.clientY - rect.top);
    
    setEditHotspot({ x, y });
    setDisplayHotspot({ x: displayX, y: displayY });
  };
  
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (isSideBySide && (tab === 'retouch' || tab === 'crop')) {
        setIsSideBySide(false);
    }
  }

  if (!currentImage) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-transparent">
        <StartScreen onFileSelect={(files) => files && files.length > 0 && handleImageUpload(files[0])} />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col text-gray-200 bg-transparent">
      <Header />
      <main className="flex-grow flex flex-col md:flex-row gap-8 p-4 md:p-8">
        {/* Panneau de contrôle latéral */}
        <div className="w-full md:w-96 flex-shrink-0 flex flex-col gap-6 order-2 md:order-1">
          {/* Sélecteur d'onglets */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-1.5 flex justify-around backdrop-blur-sm">
            {Object.entries(tabDisplayNames).map(([key, name]) => (
              <button
                key={key}
                onClick={() => handleTabChange(key as Tab)}
                disabled={isLoading}
                className={`w-full text-center font-semibold py-3 px-4 rounded-md transition-all duration-200 text-base ${activeTab === key ? 'bg-blue-600 text-white shadow-md' : 'text-gray-300 hover:bg-white/10'}`}
              >
                {name}
              </button>
            ))}
          </div>

          {/* Panneaux conditionnels */}
          {activeTab === 'retouch' && (
             <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
                 <h3 className="text-lg font-semibold text-center text-gray-300">Retouche ponctuelle</h3>
                 <p className="text-sm text-center -mt-2 text-gray-400">Cliquez sur une partie de l'image que vous souhaitez modifier, puis décrivez la modification ci-dessous.</p>
                 <textarea
                     value={prompt}
                     onChange={(e) => setPrompt(e.target.value)}
                     placeholder="Exemples : 'supprimer la personne en arrière-plan', 'changer la couleur de la chemise en rouge', 'ajouter un chapeau de fête sur sa tête'"
                     rows={4}
                     className="flex-grow bg-gray-800 border border-gray-600 text-gray-200 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base"
                     disabled={isLoading}
                 />
                 <button
                     onClick={handleGenerate}
                     className="w-full bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                     disabled={isLoading || !prompt.trim() || !editHotspot}
                 >
                     Générer la retouche
                 </button>
             </div>
          )}

          {activeTab === 'adjust' && <AdjustmentPanel onApplyAdjustment={handleApplyAdjustment} isLoading={isLoading} />}
          {activeTab === 'filters' && <FilterPanel onApplyFilter={handleApplyFilter} isLoading={isLoading} />}
          {activeTab === 'crop' && <CropPanel onApplyCrop={handleApplyCrop} onSetAspect={setAspect} isLoading={isLoading} isCropping={!!completedCrop?.width} />}
          
          {error && <div className="bg-red-500/20 border border-red-500/50 text-red-300 p-4 rounded-lg animate-fade-in text-center">{error}</div>}

          {/* Boutons d'action */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2 flex flex-col gap-2 backdrop-blur-sm">
              <button onClick={handleReset} className="w-full text-center bg-white/10 text-gray-200 font-semibold py-3 px-4 rounded-md transition-all duration-200 hover:bg-white/20 active:scale-95 text-base disabled:opacity-50" disabled={isLoading || history.length < 2}>Réinitialiser</button>
              <button onClick={handleNewImage} className="w-full text-center bg-white/10 text-gray-200 font-semibold py-3 px-4 rounded-md transition-all duration-200 hover:bg-white/20 active:scale-95 text-base disabled:opacity-50" disabled={isLoading}>Téléverser une nouvelle</button>
          </div>
        </div>
        
        {/* Zone d'affichage de l'image */}
        <div className="flex-grow flex flex-col gap-4 items-center justify-center order-1 md:order-2">
            <div className={`relative flex justify-center items-center w-full h-full aspect-auto transition-all duration-300 ${isComparing ? 'opacity-0' : ''}`}>
                
                {isSideBySide && originalImageUrl && (
                    <div className="flex w-full h-full gap-2">
                        <div className="w-1/2 flex flex-col items-center gap-2">
                            <img src={originalImageUrl} alt="Original" className="max-w-full max-h-[70vh] object-contain rounded-lg" />
                            <span className="text-sm font-semibold text-gray-400">Originale</span>
                        </div>
                        <div className="w-1/2 flex flex-col items-center gap-2">
                            {currentImageUrl && <img src={currentImageUrl} alt="Modifiée" className="max-w-full max-h-[70vh] object-contain rounded-lg" />}
                            <span className="text-sm font-semibold text-gray-400">Modifiée</span>
                        </div>
                    </div>
                )}

                {!isSideBySide && (
                    <div className="relative">
                        {activeTab === 'crop' ? (
                            <ReactCrop
                                crop={crop}
                                onChange={c => setCrop(c)}
                                onComplete={c => setCompletedCrop(c)}
                                aspect={aspect}
                            >
                                <img
                                    ref={imgRef}
                                    src={currentImageUrl!}
                                    alt="Image à rogner"
                                    className="max-w-full max-h-[75vh] object-contain rounded-lg"
                                />
                            </ReactCrop>
                        ) : (
                            <img
                                ref={imgRef}
                                src={currentImageUrl!}
                                alt="Image actuelle"
                                onClick={handleImageClick}
                                className={`max-w-full max-h-[75vh] object-contain rounded-lg ${activeTab === 'retouch' && !isLoading ? 'cursor-crosshair' : ''}`}
                            />
                        )}
                        {displayHotspot && activeTab === 'retouch' && !isLoading && (
                            <div className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ left: displayHotspot.x, top: displayHotspot.y }}>
                                <div className="w-full h-full bg-blue-500/50 rounded-full border-2 border-white animate-ping"></div>
                                <div className="absolute top-0 left-0 w-full h-full bg-blue-500 rounded-full border-2 border-white shadow-xl"></div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            {isComparing && originalImageUrl && (
                <img
                    src={originalImageUrl}
                    alt="Original"
                    className="absolute max-w-full max-h-[75vh] object-contain rounded-lg transition-opacity duration-300 opacity-100 pointer-events-none"
                />
            )}
            {isLoading && <Spinner />}

            {/* Barre d'outils de l'image */}
            <div className="flex items-center gap-2 bg-gray-800/50 border border-gray-700 rounded-lg p-2 backdrop-blur-sm">
                <button onClick={handleUndo} disabled={!canUndo || isLoading} className="p-3 bg-white/10 rounded-md hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors active:scale-95"><UndoIcon className="w-6 h-6" /></button>
                <button onClick={handleRedo} disabled={!canRedo || isLoading} className="p-3 bg-white/10 rounded-md hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors active:scale-95"><RedoIcon className="w-6 h-6" /></button>
                <button 
                    onMouseDown={() => !isSideBySide && setIsComparing(true)}
                    onMouseUp={() => setIsComparing(false)}
                    onMouseLeave={() => setIsComparing(false)}
                    onTouchStart={() => !isSideBySide && setIsComparing(true)}
                    onTouchEnd={() => setIsComparing(false)}
                    disabled={isLoading || history.length < 2 || isSideBySide} 
                    className="p-3 bg-white/10 rounded-md hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors active:scale-95 flex items-center gap-2"
                >
                    <EyeIcon className="w-6 h-6" /> <span className="hidden sm:inline">Comparer</span>
                </button>
                <button
                    onClick={() => setIsSideBySide(!isSideBySide)}
                    disabled={isLoading || history.length < 2 || activeTab === 'retouch' || activeTab === 'crop'}
                    className={`p-3 rounded-md transition-colors active:scale-95 flex items-center gap-2 ${isSideBySide ? 'bg-blue-600 text-white' : 'bg-white/10 hover:bg-white/20'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    <SideBySideIcon className="w-6 h-6" /> <span className="hidden sm:inline">Côte à côte</span>
                </button>
            </div>
        </div>
      </main>
    </div>
  );
};

export default App;