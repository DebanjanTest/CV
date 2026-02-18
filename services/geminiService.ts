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
  
  const systemPrompt = `You are a Senior Full-Stack AI Engineer and CV Data Architect. 
  TASK: Perform a lossless high-fidelity extraction and analysis of the provided resume.
  
  ZERO-LOSS PROTOCOL:
  1. DO NOT discard or summarize sections out of existence.
  2. Extract 100% of the roles, companies, dates, and bullet points. 
  3. Ensure 'Present' is used for current roles instead of future-dated years like '2025'.
  4. Categorize skills into logical groups (e.g., Languages, Frameworks, Tools).
  
  ANALYSIS:
  - If a JD is provided, match strictly against it. 
  - If not, audit against universal ATS formatting and impact best practices.
  
  OUTPUT: Strict JSON matching the schema.`;

  const parts: any[] = [{ text: systemPrompt }];

  if (source.file) {
    parts.push({
      inlineData: { data: source.file.data, mimeType: source.file.mimeType }
    });
  } else if (source.text) {
    parts.push({ text: `RAW CONTENT:\n${source.text}` });
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
  
  const prompt = `You are an expert Resume Surgeon. 
  TASK: Optimize the summary and experience bullets while maintaining a strictly ZERO-LOSS approach.
  
  SURGERY RULES:
  1. Transform every experience bullet into an 'Action-Result' masterpiece (e.g., 'Enhanced system throughput by 40% via implementation of X').
  2. Maintain EVERY role and company. DO NOT omit history to save space.
  3. Integrate keywords naturally: [${keywordsList}].
  4. Ensure sentences are complete and professional. No "cut-out" text.
  
  INPUT DATA:
  Summary: ${analysis.impact_analysis}
  Experience: ${JSON.stringify(analysis.experience)}`;

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