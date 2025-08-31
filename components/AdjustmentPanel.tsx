/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';

interface AdjustmentPanelProps {
  onApplyAdjustment: (prompt: string) => void;
  isLoading: boolean;
}

const AdjustmentPanel: React.FC<AdjustmentPanelProps> = ({ onApplyAdjustment, isLoading }) => {
  const [selectedPresetPrompt, setSelectedPresetPrompt] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');

  const presets = [
    { name: 'Flouter l\'arrière-plan', prompt: 'Appliquez un effet de profondeur de champ réaliste, rendant l\'arrière-plan flou tout en gardant le sujet principal net.' },
    { name: 'Effet Bokeh', prompt: 'Ajoutez un effet bokeh doux et naturel à l\'arrière-plan de l\'image, en rendant les lumières de fond douces et circulaires.' },
    { name: 'Améliorer les détails', prompt: 'Améliorez légèrement la netteté et les détails de l\'image sans la rendre artificielle.' },
    { name: 'Éclairage plus chaud', prompt: 'Ajustez la température de couleur pour donner à l\'image un éclairage plus chaud, de style "golden hour".' },
    { name: 'Lumière de studio', prompt: 'Ajoutez un éclairage de studio professionnel et dramatique au sujet principal.' },
    { name: 'Forêt ensoleillée', prompt: 'Remplacez l\'arrière-plan actuel de l\'image par un arrière-plan de forêt paisible sous un ciel ensoleillé. Assurez-vous que la fusion entre le sujet et le nouvel arrière-plan est réaliste.' },
  ];

  const activePrompt = selectedPresetPrompt || customPrompt;

  const handlePresetClick = (prompt: string) => {
    setSelectedPresetPrompt(prompt);
    setCustomPrompt('');
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomPrompt(e.target.value);
    setSelectedPresetPrompt(null);
  };

  const handleApply = () => {
    if (activePrompt) {
      onApplyAdjustment(activePrompt);
    }
  };

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-center text-gray-300">Appliquer un ajustement professionnel</h3>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {presets.map(preset => (
          <button
            key={preset.name}
            onClick={() => handlePresetClick(preset.prompt)}
            disabled={isLoading}
            className={`w-full text-center bg-white/10 border border-transparent text-gray-200 font-semibold py-3 px-4 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/20 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed ${selectedPresetPrompt === preset.prompt ? 'ring-2 ring-offset-2 ring-offset-gray-800 ring-blue-500' : ''}`}
          >
            {preset.name}
          </button>
        ))}
      </div>

      <input
        type="text"
        value={customPrompt}
        onChange={handleCustomChange}
        placeholder="Ou décrivez un ajustement (ex: 'changer l'arrière-plan en forêt')"
        className="flex-grow bg-gray-800 border border-gray-600 text-gray-200 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base"
        disabled={isLoading}
      />

      {activePrompt && (
        <div className="animate-fade-in flex flex-col gap-4 pt-2">
            <button
                onClick={handleApply}
                className="w-full bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                disabled={isLoading || !activePrompt.trim()}
            >
                Appliquer l'ajustement
            </button>
        </div>
      )}
    </div>
  );
};

export default AdjustmentPanel;