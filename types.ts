
export interface PersonalInfo {
  name: string;
  role?: string;
  email: string;
  phone: string;
  location?: string;
  linkedin?: string;
  links?: string[];
}

export interface EducationEntry {
  institution: string;
  degree: string;
  date?: string;
  description?: string;
}

export interface SkillCategory {
  category: string;
  items: string[];
}

export interface ExperienceEntry {
  company: string;
  role: string;
  date: string;
  bullets: string[];
}

export interface AnalysisAnnotation {
  text_segment: string;
  critique: string;
  severity: 'low' | 'medium' | 'high';
  suggested_fix?: string;
}

export interface AnalysisResult {
  match_score: number;
  previous_score?: number;
  personal_info: PersonalInfo;
  education: EducationEntry[];
  experience: ExperienceEntry[];
  skills: SkillCategory[];
  certifications: string[];
  missing_keywords: string[];
  hard_skill_gaps: string[];
  soft_skill_gaps: string[];
  formatting_issues: string[];
  impact_analysis: string;
  impact_score: number;
  original_text: string;
  annotations: AnalysisAnnotation[];
  mode: 'generalized' | 'specific';
}

export interface RectifiedBullet {
  id: string;
  original: string;
  suggested: string;
  explanation: string;
}

export interface RectifyResponse {
  revisedSummary: string;
  revisedExperience: ExperienceEntry[];
}

export interface ResumeSource {
  text?: string;
  file?: {
    data: string;
    mimeType: string;
    name: string;
    raw?: File;
  };
}

export interface ResumeDraft {
  personal_info: PersonalInfo;
  education: EducationEntry[];
  experience: ExperienceEntry[];
  skills: SkillCategory[];
  certifications: string[];
  summary: string;
}
