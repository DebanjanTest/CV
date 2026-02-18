import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, RectifyResponse, ResumeSource } from "../types";

const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    match_score: { type: Type.NUMBER },
    personal_info: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        role: { type: Type.STRING },
        email: { type: Type.STRING },
        phone: { type: Type.STRING },
        location: { type: Type.STRING },
        linkedin: { type: Type.STRING },
        links: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["name", "email", "phone"]
    },
    education: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          institution: { type: Type.STRING },
          degree: { type: Type.STRING },
          date: { type: Type.STRING },
          description: { type: Type.STRING }
        },
        required: ["institution", "degree"]
      }
    },
    experience: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          company: { type: Type.STRING },
          role: { type: Type.STRING },
          date: { type: Type.STRING },
          bullets: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["company", "role", "bullets"]
      }
    },
    skills: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          items: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["category", "items"]
      }
    },
    certifications: { type: Type.ARRAY, items: { type: Type.STRING } },
    missing_keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
    hard_skill_gaps: { type: Type.ARRAY, items: { type: Type.STRING } },
    soft_skill_gaps: { type: Type.ARRAY, items: { type: Type.STRING } },
    formatting_issues: { type: Type.ARRAY, items: { type: Type.STRING } },
    impact_analysis: { type: Type.STRING },
    impact_score: { type: Type.NUMBER },
    original_text: { type: Type.STRING },
    annotations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text_segment: { type: Type.STRING },
          critique: { type: Type.STRING },
          severity: { type: Type.STRING, enum: ["low", "medium", "high"] },
          suggested_fix: { type: Type.STRING }
        },
        required: ["text_segment", "critique", "severity"]
      }
    },
    mode: { type: Type.STRING, enum: ["generalized", "specific"] }
  },
  required: ["match_score", "personal_info", "education", "experience", "skills", "certifications", "missing_keywords", "hard_skill_gaps", "soft_skill_gaps", "formatting_issues", "impact_analysis", "impact_score", "original_text", "annotations", "mode"]
};

const RECTIFY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    revisedSummary: { type: Type.STRING },
    revisedExperience: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          company: { type: Type.STRING },
          role: { type: Type.STRING },
          date: { type: Type.STRING },
          bullets: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["company", "role", "bullets"]
      }
    }
  },
  required: ["revisedSummary", "revisedExperience"]
};

export async function analyzeResume(source: ResumeSource, jobDescription?: string): Promise<AnalysisResult> {
  if (!process.env.API_KEY) {
    console.error("Gemini API Key is missing. Please set API_KEY in your environment variables.");
    throw new Error("Missing API Key");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const isGeneralized = !jobDescription || jobDescription.trim().length === 0;
  
  const systemPrompt = `You are a Senior Full-Stack AI Engineer and CV Data Architect. 
  TASK: Perform a lossless high-fidelity extraction and analysis.
  
  ZERO-LOSS PROTOCOL:
  1. Capture 100% of roles, companies, and bullet points.
  2. Map personal data exactly. Use 'Present' for current roles.
  3. Categorize skills into logical groups.
  
  OUTPUT: Strict JSON matching the schema. No text wrapping.`;

  const parts: any[] = [{ text: systemPrompt }];

  if (source.file) {
    parts.push({
      inlineData: { data: source.file.data, mimeType: source.file.mimeType }
    });
  } else if (source.text) {
    parts.push({ text: `RAW CONTENT:\n${source.text}` });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: ANALYSIS_SCHEMA,
        thinkingConfig: { thinkingBudget: 4000 }
      }
    });

    if (!response.text) throw new Error("Empty response from AI");
    return JSON.parse(response.text.trim());
  } catch (error: any) {
    console.error("AI Analysis Error:", error);
    throw error;
  }
}

export async function rectifyResume(analysis: AnalysisResult, jobDescription?: string): Promise<RectifyResponse> {
  if (!process.env.API_KEY) throw new Error("Missing API Key");
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const keywordsList = [...analysis.missing_keywords, ...analysis.hard_skill_gaps].join(', ');
  
  const prompt = `You are an expert Resume Surgeon. 
  TASK: Transform bullets to Action-Result format without omitting ANY existing data.
  
  STRICT RULES:
  1. Maintain 100% of roles and companies.
  2. Integrate: [${keywordsList}].
  3. DO NOT cut the middle of text.
  
  INPUT:
  Summary: ${analysis.impact_analysis}
  Experience: ${JSON.stringify(analysis.experience)}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: RECTIFY_SCHEMA,
        thinkingConfig: { thinkingBudget: 4000 }
      }
    });

    if (!response.text) throw new Error("Empty response from AI");
    return JSON.parse(response.text.trim());
  } catch (error: any) {
    console.error("AI Rectification Error:", error);
    throw error;
  }
}