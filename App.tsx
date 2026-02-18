
import React, { useState, useRef } from 'react';
import { 
  AnalysisResult, 
  RectifyResponse, 
  ResumeSource, 
  AnalysisAnnotation, 
  ResumeDraft, 
  PersonalInfo, 
  EducationEntry, 
  ExperienceEntry, 
  SkillCategory 
} from './types';
import { analyzeResume, rectifyResume } from './services/geminiService';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const SkillPill: React.FC<{ label: string }> = ({ label }) => (
  <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-md text-[10px] font-bold border border-indigo-100 uppercase tracking-tighter shadow-sm">
    {label}
  </span>
);

const Header = ({ score, prevScore, mode }: { score?: number, prevScore?: number, mode?: string }) => (
  <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-[100] shadow-sm">
    <div className="flex items-center space-x-4">
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black text-xs">AB</div>
        <h1 className="text-lg font-black text-slate-900 tracking-tighter uppercase">ATS <span className="text-indigo-600">BRIDGE</span></h1>
      </div>
      {mode && (
        <span className="bg-indigo-50 text-indigo-600 text-[10px] font-black px-3 py-1 rounded-full border border-indigo-100 uppercase tracking-widest">
          {mode === 'specific' ? 'Targeted' : 'General'} Audit
        </span>
      )}
    </div>
    
    <div className="flex items-center space-x-6">
      {score !== undefined && (
        <div className="flex items-center space-x-4 animate-in fade-in slide-in-from-right-4">
          {prevScore !== undefined && prevScore !== score && (
            <div className="flex flex-col items-end leading-none">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Baseline</span>
              <span className="text-xs font-bold text-slate-400 line-through">{prevScore}%</span>
            </div>
          )}
          <div className="flex items-center space-x-3 bg-slate-900 px-5 py-2.5 rounded-full shadow-lg shadow-indigo-500/20 border border-slate-800">
            <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Neural Match:</span>
            <span className={`text-sm font-black ${score > 85 ? 'text-emerald-400' : score > 60 ? 'text-amber-400' : 'text-rose-400'}`}>{score}%</span>
          </div>
        </div>
      )}
    </div>
  </header>
);

export default function App() {
  const [resumeSource, setResumeSource] = useState<ResumeSource | null>(null);
  const [jobDescription, setJobDescription] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [prevScore, setPrevScore] = useState<number | undefined>();
  const [isRectifying, setIsRectifying] = useState(false);
  const [draft, setDraft] = useState<ResumeDraft | null>(null);
  const cvPreviewRef = useRef<HTMLDivElement>(null);

  const resetAll = () => {
    setResumeSource(null);
    setJobDescription('');
    setAnalysis(null);
    setDraft(null);
    setPrevScore(undefined);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setResumeSource({ file: { data: base64, mimeType: file.type, name: file.name } });
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!resumeSource) return;
    setIsAnalyzing(true);
    try {
      const res = await analyzeResume(resumeSource, jobDescription);
      setAnalysis(res);
      setPrevScore(res.match_score);
      setDraft({
        personal_info: res.personal_info,
        education: res.education,
        experience: res.experience,
        skills: res.skills,
        certifications: res.certifications,
        summary: res.impact_analysis
      });
    } catch (err) {
      alert("Extraction failed. Please ensure the document is not password protected.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRectify = async () => {
    if (!analysis || !draft) return;
    setIsRectifying(true);
    try {
      const res = await rectifyResume(analysis, jobDescription);
      const newDraft = {
        ...draft,
        summary: res.revisedSummary,
        experience: res.revisedExperience
      };
      setDraft(newDraft);
      
      const fullContent = `${newDraft.summary}\n\n${newDraft.experience.map(e => `${e.role}\n${e.bullets.join('\n')}`).join('\n')}`;
      const reScore = await analyzeResume({ text: fullContent }, jobDescription);
      setAnalysis(prev => prev ? ({ ...prev, match_score: reScore.match_score }) : null);
    } catch (err) {
      alert("The surgery was interrupted. Please try again.");
    } finally {
      setIsRectifying(false);
    }
  };

  const handleExport = async () => {
    if (!cvPreviewRef.current || !draft) return;
    
    // Create temporary styles to ensure we capture the whole scrollable area
    const originalStyle = cvPreviewRef.current.style.height;
    cvPreviewRef.current.style.height = 'auto';

    const canvas = await html2canvas(cvPreviewRef.current, {
      scale: 3, // Higher quality
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowHeight: cvPreviewRef.current.scrollHeight
    });
    
    cvPreviewRef.current.style.height = originalStyle;
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4'
    });
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${draft.personal_info.name.replace(/\s+/g, '_')}_Final_CV.pdf`);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header score={analysis?.match_score} prevScore={prevScore} mode={analysis?.mode} />

      <main className="flex-1 workspace-grid">
        {/* LEFT PANEL: FIXED CONTROLS */}
        <section className="bg-white border-r border-slate-200 flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-2"></span>
              Configuration Core
            </h2>
            {!resumeSource ? (
              <div className="space-y-4">
                <input type="file" id="cv-upload" onChange={handleFileUpload} className="hidden" accept=".pdf,.txt" />
                <label htmlFor="cv-upload" className="w-full border-2 border-dashed border-slate-200 rounded-2xl p-6 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all flex flex-col items-center text-center group">
                  <svg className="w-8 h-8 text-slate-300 group-hover:text-indigo-400 mb-2 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                  <span className="text-xs font-bold text-slate-500 group-hover:text-indigo-600">Upload Source Document</span>
                </label>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-top-2">
                <div className="bg-white border border-slate-200 p-4 rounded-xl flex items-center justify-between shadow-sm">
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z"/></svg>
                    </div>
                    <span className="text-xs font-bold text-slate-700 truncate">{resumeSource.file?.name || "Text Stream"}</span>
                  </div>
                  <button onClick={() => setResumeSource(null)} className="text-rose-500 hover:bg-rose-50 p-1 rounded">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 p-6 flex flex-col space-y-6 overflow-y-auto custom-scrollbar">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Role Target</label>
              <textarea 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none h-48 resize-none transition-all placeholder:text-slate-300 shadow-inner"
                placeholder="Paste the Job Description to align achievements..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
              />
            </div>

            <div className="space-y-3 pt-4">
              <button 
                onClick={handleAnalyze} 
                disabled={isAnalyzing || !resumeSource}
                className="w-full py-4 bg-slate-900 text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-xl hover:bg-indigo-600 transition-all flex items-center justify-center space-x-2 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
              >
                {isAnalyzing ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span>Extracting...</span>
                  </>
                ) : "Execute Extraction"}
              </button>
              
              {analysis && (
                <button 
                  onClick={handleRectify}
                  disabled={isRectifying}
                  className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {isRectifying ? "Performing Surgery..." : "Neural Optimization"}
                </button>
              )}
            </div>

            {analysis && (
              <div className="bg-slate-900 rounded-xl p-5 space-y-4 shadow-xl animate-in slide-in-from-bottom-4">
                <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Neural Insights</h3>
                <div className="space-y-3">
                  {analysis.formatting_issues.slice(0, 3).map((issue, i) => (
                    <div key={i} className="flex items-start space-x-3">
                      <div className="w-1 h-1 bg-indigo-400 rounded-full mt-1.5 shrink-0"></div>
                      <p className="text-[10px] font-bold text-slate-300 leading-tight">{issue}</p>
                    </div>
                  ))}
                  {analysis.formatting_issues.length === 0 && <p className="text-[10px] font-bold text-emerald-400">Formatting verified as ATS-optimal.</p>}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT PANEL: FULL-PAGE SCROLLABLE PREVIEW */}
        <section className="bg-slate-100 flex-1 overflow-y-auto custom-scrollbar p-12 relative flex flex-col items-center">
          {!draft ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60 text-center max-w-sm">
              <div className="w-20 h-20 border-4 border-slate-200 rounded-[2.5rem] flex items-center justify-center font-black text-3xl mb-8 italic text-slate-300">AB</div>
              <p className="text-xs font-black uppercase tracking-[0.2em] leading-relaxed">
                Reconstructing High-Fidelity Professional Architecture. Waiting for Ingestion.
              </p>
            </div>
          ) : (
            <div className="w-full max-w-[210mm] animate-in zoom-in-95 duration-500">
               {/* Fixed Export Utility */}
               <div className="flex justify-end mb-6 sticky top-0 z-50 pointer-events-none">
                  <button onClick={handleExport} className="pointer-events-auto bg-emerald-500 text-white px-6 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-emerald-600 transition-all flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                    <span>Download Master PDF</span>
                  </button>
               </div>

              {/* A4 PAPER CONTAINER */}
              <div 
                ref={cvPreviewRef}
                className="cv-page-container grid grid-cols-10"
              >
                {/* LEFT COLUMN: MAIN CONTENT (70%) */}
                <div className="col-span-7 p-12 pr-10 border-r border-slate-50">
                  <div className="mb-12">
                    <h1 className="text-[42px] font-black text-slate-900 tracking-tighter mb-2 uppercase leading-none">{draft.personal_info.name}</h1>
                    <div className="flex items-center space-x-3">
                      <span className="text-indigo-600 font-black text-[13px] uppercase tracking-[0.3em]">{draft.personal_info.role || "Professional Candidate"}</span>
                      <div className="h-px flex-1 bg-slate-100"></div>
                    </div>
                  </div>

                  <div className="space-y-12">
                    <section className="highlight-entry p-1">
                      <h3 className="text-[12px] font-black text-slate-900 uppercase tracking-[0.2em] mb-4 flex items-center">
                        Executive Summary
                      </h3>
                      <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                        {draft.summary}
                      </p>
                    </section>

                    <section>
                      <h3 className="text-[12px] font-black text-slate-900 uppercase tracking-[0.2em] mb-8 flex items-center">
                        Professional Milestones
                      </h3>
                      <div className="space-y-10">
                        {draft.experience.map((exp, i) => (
                          <div key={i} className="highlight-entry p-2 -ml-2 rounded-xl group">
                            <div className="flex justify-between items-baseline mb-2">
                              <h4 className="text-[13px] font-black text-slate-800 uppercase tracking-tight">{exp.role}</h4>
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-md">{exp.date}</span>
                            </div>
                            <p className="text-[11px] font-black text-indigo-500 mb-4">{exp.company}</p>
                            <ul className="space-y-3">
                              {exp.bullets.map((bullet, bi) => (
                                <li key={bi} className="text-[10px] text-slate-600 leading-relaxed flex items-start">
                                  <span className="text-indigo-400 mr-2.5 shrink-0 mt-1.5 w-1 h-1 bg-indigo-400 rounded-full"></span>
                                  <span>{bullet}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section>
                      <h3 className="text-[12px] font-black text-slate-900 uppercase tracking-[0.2em] mb-6 flex items-center">
                        Academic Credentials
                      </h3>
                      <div className="space-y-6">
                        {draft.education.map((edu, i) => (
                          <div key={i} className="flex justify-between items-start bg-slate-50/50 p-4 rounded-xl">
                            <div>
                              <p className="text-[11px] font-black text-slate-800 uppercase">{edu.institution}</p>
                              <p className="text-[10px] text-slate-500 font-bold italic mt-0.5">{edu.degree}</p>
                            </div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{edu.date}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                </div>

                {/* RIGHT COLUMN: SIDEBAR (30%) */}
                <div className="col-span-3 bg-slate-50/50 p-10 py-12 flex flex-col h-full border-l border-slate-100">
                  <div className="space-y-12">
                    <section>
                      <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-6 pb-2 border-b border-slate-200">Personal Access</h3>
                      <div className="space-y-5 text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                        <div className="flex flex-col group">
                          <span className="text-[7px] text-indigo-400 font-black mb-1 tracking-[0.2em]">Primary Email</span>
                          <span className="truncate group-hover:text-indigo-600 transition-colors">{draft.personal_info.email}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[7px] text-indigo-400 font-black mb-1 tracking-[0.2em]">Contact Line</span>
                          <span>{draft.personal_info.phone}</span>
                        </div>
                        {draft.personal_info.location && (
                          <div className="flex flex-col">
                            <span className="text-[7px] text-indigo-400 font-black mb-1 tracking-[0.2em]">Geographic Base</span>
                            <span>{draft.personal_info.location}</span>
                          </div>
                        )}
                        {draft.personal_info.linkedin && (
                          <div className="flex flex-col">
                            <span className="text-[7px] text-indigo-400 font-black mb-1 tracking-[0.2em]">Professional Network</span>
                            <span className="truncate">{draft.personal_info.linkedin}</span>
                          </div>
                        )}
                      </div>
                    </section>

                    <section>
                      <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-8 pb-2 border-b border-slate-200">Neural Stack</h3>
                      <div className="space-y-8">
                        {draft.skills.map((cat, i) => (
                          <div key={i} className="animate-in fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                            <p className="text-[8px] font-black text-slate-400 uppercase mb-3 tracking-widest">{cat.category}</p>
                            <div className="flex flex-wrap gap-2">
                              {cat.items.map((it, ii) => <SkillPill key={ii} label={it} />)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    {draft.certifications.length > 0 && (
                      <section>
                        <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-6 pb-2 border-b border-slate-200">Verifications</h3>
                        <div className="space-y-3">
                          {draft.certifications.map((cert, i) => (
                            <p key={i} className="text-[9px] text-slate-600 font-bold leading-tight flex items-start">
                              <span className="text-indigo-400 mr-2 shrink-0 mt-0.5">▪</span>
                              {cert}
                            </p>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>

                  <div className="mt-auto pt-16 flex flex-col items-center">
                    <div className="w-12 h-1 bg-indigo-200 rounded-full mb-4"></div>
                    <p className="text-[7px] text-slate-400 font-black uppercase tracking-[0.4em] text-center">Neural Validation v3.1</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      <footer className="h-10 bg-slate-900 border-t border-slate-800 px-6 flex items-center justify-between text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] shrink-0">
        <div className="flex items-center space-x-6">
          <span className="flex items-center space-x-2"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span><span>System: Reconstruction Live</span></span>
          <span>Buffer Integrity: 100% Zero-Loss</span>
        </div>
        <div className="flex space-x-4">
          <span className="text-indigo-400 tracking-normal font-mono lowercase">@powered_by_gemini_3_pro</span>
        </div>
      </footer>
    </div>
  );
}
