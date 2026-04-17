import express from 'express';
import { GoogleGenAI } from '@google/genai';

let _ai: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!_ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
    _ai = new GoogleGenAI({ apiKey });
  }
  return _ai;
}

export const generateTaskDescription = async (req: express.Request, res: express.Response) => {
  try {
    const { title } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const ai = getAI();
    const prompt = `Bạn là một trợ lý quản lý dự án. Hãy viết mô tả ngắn gọn (2-3 câu, bằng tiếng Việt) cho một task có tiêu đề sau:

"${title.trim()}"

Chỉ trả về nội dung mô tả, không thêm tiêu đề hay giải thích.`;

    // Try flash first, fallback to flash-lite if quota exceeded
    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      });
    } catch (e: any) {
      if (e.status === 429) {
        response = await ai.models.generateContent({
          model: 'gemini-2.0-flash-lite',
          contents: prompt,
        });
      } else {
        throw e;
      }
    }

    const description = response.text?.trim() ?? '';
    if (!description) {
      return res.status(500).json({ error: 'AI returned empty response' });
    }

    res.json({ description });
  } catch (error: any) {
    console.error('AI generate description error:', error);
    if (error.status === 429) {
      return res.status(429).json({ error: 'Gemini API quota exceeded. Please check your API key or billing at https://ai.dev/rate-limit' });
    }
    res.status(500).json({ error: error.message || 'Failed to generate description' });
  }
};
