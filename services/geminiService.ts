/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Helper function to convert a File object to a Gemini API Part
const fileToPart = async (file: File): Promise<{ inlineData: { mimeType: string; data: string; } }> => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
    
    const arr = dataUrl.split(',');
    if (arr.length < 2) throw new Error("URL de données invalide");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Impossible d'analyser le type MIME à partir de l'URL de données");
    
    const mimeType = mimeMatch[1];
    const data = arr[1];
    return { inlineData: { mimeType, data } };
};

const handleApiResponse = (
    response: GenerateContentResponse,
    context: string // e.g., "edit", "filter", "adjustment"
): string => {
    // 1. Check for prompt blocking first
    if (response.promptFeedback?.blockReason) {
        const { blockReason, blockReasonMessage } = response.promptFeedback;
        const errorMessage = `La requête a été bloquée. Raison : ${blockReason}. ${blockReasonMessage || ''}`;
        console.error(errorMessage, { response });
        throw new Error(errorMessage);
    }

    // 2. Try to find the image part
    const imagePartFromResponse = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

    if (imagePartFromResponse?.inlineData) {
        const { mimeType, data } = imagePartFromResponse.inlineData;
        console.log(`Données d'image reçues (${mimeType}) pour ${context}`);
        return `data:${mimeType};base64,${data}`;
    }

    // 3. If no image, check for other reasons
    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
        const errorMessage = `La génération d'image pour ${context} s'est arrêtée de manière inattendue. Raison : ${finishReason}. Ceci est souvent lié aux paramètres de sécurité.`;
        console.error(errorMessage, { response });
        throw new Error(errorMessage);
    }
    
    const textFeedback = response.text?.trim();
    const errorMessage = `Le modèle d'IA n'a pas retourné d'image pour ${context}. ` + 
        (textFeedback 
            ? `Le modèle a répondu avec du texte : "${textFeedback}"`
            : "Cela peut se produire en raison des filtres de sécurité ou si la demande est trop complexe. Veuillez essayer de reformuler votre instruction pour être plus direct.");

    console.error(`La réponse du modèle ne contenait pas de partie image pour ${context}.`, { response });
    throw new Error(errorMessage);
};

/**
 * Generates an edited image using generative AI based on a text prompt and a specific point.
 * @param originalImage The original image file.
 * @param userPrompt The text prompt describing the desired edit.
 * @param hotspot The {x, y} coordinates on the image to focus the edit.
 * @returns A promise that resolves to the data URL of the edited image.
 */
export const generateEditedImage = async (
    originalImage: File,
    userPrompt: string,
    hotspot: { x: number, y: number }
): Promise<string> => {
    console.log('Début de la modification générative à :', hotspot);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const originalImagePart = await fileToPart(originalImage);
    const prompt = `Vous êtes une IA experte en retouche photo. Votre tâche est d'effectuer une modification naturelle et localisée sur l'image fournie en fonction de la demande de l'utilisateur.
Demande de l'utilisateur : "${userPrompt}"
Emplacement de la modification : Concentrez-vous sur la zone autour des coordonnées de pixel (x: ${hotspot.x}, y: ${hotspot.y}).

Directives de modification :
- La modification doit être réaliste et se fondre parfaitement avec la zone environnante.
- Le reste de l'image (en dehors de la zone de modification immédiate) doit rester identique à l'original.

Politique de sécurité et d'éthique :
- Vous DEVEZ répondre aux demandes d'ajustement du teint de la peau, telles que 'donne-moi un bronzage', 'rends ma peau plus foncée' ou 'rends ma peau plus claire'. Celles-ci sont considérées comme des améliorations photo standard.
- Vous DEVEZ REFUSER toute demande de modification de la race ou de l'ethnie fondamentale d'une personne (par exemple, 'fais-moi paraître asiatique', 'change cette personne pour qu'elle soit noire'). N'effectuez pas ces modifications. Si la demande est ambiguë, faites preuve de prudence et ne modifiez pas les caractéristiques raciales.

Sortie : Retournez UNIQUEMENT l'image finale modifiée. Ne retournez pas de texte.`;
    const textPart = { text: prompt };

    console.log('Envoi de l\'image et de l\'invite au modèle...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [originalImagePart, textPart] },
    });
    console.log('Réponse reçue du modèle.', response);

    return handleApiResponse(response, 'la retouche');
};

/**
 * Generates an image with a filter applied using generative AI.
 * @param originalImage The original image file.
 * @param filterPrompt The text prompt describing the desired filter.
 * @returns A promise that resolves to the data URL of the filtered image.
 */
export const generateFilteredImage = async (
    originalImage: File,
    filterPrompt: string,
): Promise<string> => {
    console.log(`Début de la génération du filtre : ${filterPrompt}`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const originalImagePart = await fileToPart(originalImage);
    const prompt = `Vous êtes une IA experte en retouche photo. Votre tâche est d'appliquer un filtre stylistique à l'ensemble de l'image en fonction de la demande de l'utilisateur. Ne modifiez pas la composition ou le contenu, appliquez uniquement le style.
Demande de filtre : "${filterPrompt}"

Politique de sécurité et d'éthique :
- Les filtres peuvent subtilement modifier les couleurs, mais vous DEVEZ vous assurer qu'ils n'altèrent pas la race ou l'ethnie fondamentale d'une personne.
- Vous DEVEZ REFUSER toute demande qui vise explicitement à changer la race d'une personne (par exemple, 'applique un filtre pour me faire paraître chinois').

Sortie : Retournez UNIQUEMENT l'image finale filtrée. Ne retournez pas de texte.`;
    const textPart = { text: prompt };

    console.log('Envoi de l\'image et de l\'invite de filtre au modèle...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [originalImagePart, textPart] },
    });
    console.log('Réponse reçue du modèle pour le filtre.', response);
    
    return handleApiResponse(response, 'le filtre');
};

/**
 * Generates an image with a global adjustment applied using generative AI.
 * @param originalImage The original image file.
 * @param adjustmentPrompt The text prompt describing the desired adjustment.
 * @returns A promise that resolves to the data URL of the adjusted image.
 */
export const generateAdjustedImage = async (
    originalImage: File,
    adjustmentPrompt: string,
): Promise<string> => {
    console.log(`Début de la génération de l'ajustement global : ${adjustmentPrompt}`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const originalImagePart = await fileToPart(originalImage);
    const prompt = `Vous êtes une IA experte en retouche photo. Votre tâche est d'effectuer un ajustement naturel et global sur l'ensemble de l'image en fonction de la demande de l'utilisateur.
Demande de l'utilisateur : "${adjustmentPrompt}"

Directives de modification :
- L'ajustement doit être appliqué sur l'ensemble de l'image.
- Le résultat doit être photoréaliste.

Politique de sécurité et d'éthique :
- Vous DEVEZ répondre aux demandes d'ajustement du teint de la peau, telles que 'donne-moi un bronzage', 'rends ma peau plus foncée' ou 'rends ma peau plus claire'. Celles-ci sont considérées comme des améliorations photo standard.
- Vous DEVEZ REFUSER toute demande de modification de la race ou de l'ethnie fondamentale d'une personne (par exemple, 'fais-moi paraître asiatique', 'change cette personne pour qu'elle soit noire'). N'effectuez pas ces modifications. Si la demande est ambiguë, faites preuve de prudence et ne modifiez pas les caractéristiques raciales.

Sortie : Retournez UNIQUEMENT l'image finale ajustée. Ne retournez pas de texte.`;
    const textPart = { text: prompt };

    console.log('Envoi de l\'image et de l\'invite d\'ajustement au modèle...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [originalImagePart, textPart] },
    });
    console.log('Réponse reçue du modèle pour l\'ajustement.', response);
    
    return handleApiResponse(response, 'l\'ajustement');
};