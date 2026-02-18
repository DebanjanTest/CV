
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
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const isGeneralized = !jobDescription || jobDescription.trim().length === 0;
  
  const systemPrompt = `You are the High-Fidelity CV Data Architect. 
  TASK: Perform a FULL EXTRACTION of the provided CV. 
  
  STRICT RULES:
  1. DO NOT TRUNCATE professional experience. Capture EVERY bullet point provided in the source.
  2. If a section like 'Education' or 'Skills' exists, it MUST be extracted 100%. 
  3. Map personal data exactly. Fix logical errors (e.g. '2025' should be 'Present' if relevant to current employment).
  
  ANALYSIS:
  - Mode: ${isGeneralized ? 'GENERAL' : 'SPECIFIC ALIGNMENT'}.
  - Be critical about the ATS score (0-100).
  - List keywords missing relative to the JD.
  
  OUTPUT FORMAT: JSON ONLY. DO NOT ADD MARKDOWN WRAPPERS.`;

  const parts: any[] = [{ text: systemPrompt }];

  if (source.file) {
    parts.push({
      inlineData: { data: source.file.data, mimeType: source.file.mimeType }
    });
  } else if (source.text) {
    parts.push({ text: `CV CONTENT:\n${source.text}` });
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: ANALYSIS_SCHEMA,
      thinkingConfig: { thinkingBudget: 8000 }
    }
  });

  return JSON.parse(response.text.trim() || '{}');
}

export async function rectifyResume(analysis: AnalysisResult, jobDescription?: string): Promise<RectifyResponse> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const keywordsList = [...analysis.missing_keywords, ...analysis.hard_skill_gaps].join(', ');
  
  const prompt = `You are a Senior Resume Surgeon. 
  TASK: Refactor professional bullets for maximum impact without losing information.
  
  ZERO-LOSS RECTIFICATION RULES:
  1. Use the Action-Result format for ALL bullets.
  2. Maintain 100% of the roles and companies from the input. 
  3. DO NOT cut the middle of text. Each bullet must be a complete sentence.
  4. Inject these keywords naturally: [${keywordsList}].
  
  INPUT EXPERIENCE:
  ${JSON.stringify(analysis.experience)}
  
  INPUT SUMMARY:
  ${analysis.impact_analysis}`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: RECTIFY_SCHEMA,
      thinkingConfig: { thinkingBudget: 8000 }
    }
  });

  return JSON.parse(response.text.trim() || '{}');
}
