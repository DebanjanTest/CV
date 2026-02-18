import React, { useState, useRef } from 'react';
import { 
  AnalysisResult, 
  RectifyResponse, 
  ResumeSource, 
  ResumeDraft, 
  SkillCategory 
} from './types';
import { analyzeResume, rectifyResume } from './services/geminiService';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const SkillPill: React.FC<{ label: string }> = ({ label }) => (
  <span className="px-2 py-1 bg-slate-50 text-slate-700 rounded-md text-[9px] font-bold border border-slate-200 uppercase tracking-tighter">
    {label}
  </span>
);

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <h3 className="text-[12px] font-black text-slate-900 uppercase tracking-[0.2em] mb-4 flex items-center">
    {title}
    <span className="flex-1 h-[0.5pt] bg-slate-200 ml-4"></span>
  </h3>
);

const Header = ({ score, prevScore, mode }: { score?: number; prevScore?: number; mode?: string }) => (
  <header className="app-header bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-[100] shadow-sm">
    <div className="flex items-center space-x-4">
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black text-sm">AB</div>
        <h1 className="text-xl font-black text-slate-900 tracking-tighter uppercase">ATS <span className="text-indigo-600">BRIDGE</span></h1>
      </div>
      {mode && (
        <div className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-full border border-indigo-100 uppercase tracking-widest animate-in fade-in zoom-in-95">
          {mode === 'specific' ? 'Targeted' : 'General'} Audit
        </div>
      )}
    </div>
    
    <div className="flex items-center space-x-6">
      {score !== undefined && (
        <div className="flex items-center space-x-5 animate-in slide-in-from-right-4 duration-500">
          {prevScore !== undefined && prevScore !== score && (
            <div className="flex flex-col items-end leading-none">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Initial</span>
              <span className="text-xs font-bold text-slate-400 line-through">{prevScore}%</span>
            </div>
          )}
          <div className="flex items-center space-x-3 bg-slate-900 px-6 py-2.5 rounded-full shadow-lg shadow-indigo-500/20 border border-slate-800">
            <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Match Score:</span>
            <span className={`text-base font-black ${score > 85 ? 'text-emerald-400' : score > 65 ? 'text-amber-400' : 'text-rose-400'}`}>{score}%</span>
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
    } catch (err: any) {
      console.error("ANALYSIS_ERROR:", err);
      alert(`Audit failed: ${err.message || 'Check connection/API key'}. Please check the browser console for details.`);
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
      
      const fullText = `${newDraft.summary}\n\n${newDraft.experience.map(e => `${e.role} at ${e.company}\n${e.bullets.join('\n')}`).join('\n')}`;
      const reScore = await analyzeResume({ text: fullText }, jobDescription);
      setAnalysis(prev => prev ? ({ ...prev, match_score: reScore.match_score }) : null);
    } catch (err: any) {
      console.error("RECTIFY_ERROR:", err);
      alert("Optimization gateway timed out. Please try again.");
    } finally {
      setIsRectifying(false);
    }
  };

  const handleExport = async () => {
    if (!cvPreviewRef.current || !draft) return;
    const originalHeight = cvPreviewRef.current.style.height;
    cvPreviewRef.current.style.height = 'auto';

    const canvas = await html2canvas(cvPreviewRef.current, {
      scale: 3,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowHeight: cvPreviewRef.current.scrollHeight
    });
    
    cvPreviewRef.current.style.height = originalHeight;
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${draft.personal_info.name.replace(/\s+/g, '_')}_Final_CV.pdf`);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden">
      <Header score={analysis?.match_score} prevScore={prevScore} mode={analysis?.mode} />
      <main className="workspace-grid bg-slate-100">
        <section className="bg-white border-r border-slate-200 flex flex-col overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-2"></span>
              Controller
            </h2>
            {!resumeSource ? (
              <div className="space-y-4">
                <input type="file" id="cv-upload-main" onChange={handleFileUpload} className="hidden" accept=".pdf,.txt" />
                <label htmlFor="cv-upload-main" className="w-full border-2 border-dashed border-slate-200 rounded-2xl p-8 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all flex flex-col items-center text-center group">
                  <svg className="w-8 h-8 text-slate-300 group-hover:text-indigo-400 mb-2 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                  <span className="text-xs font-bold text-slate-500 group-hover:text-indigo-600">Upload Dossier</span>
                </label>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 p-4 rounded-xl flex items-center justify-between shadow-sm">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z"/></svg>
                  </div>
                  <span className="text-[10px] font-black text-slate-700 truncate">{resumeSource.file?.name}</span>
                </div>
                <button onClick={resetAll} className="text-rose-500 hover:bg-rose-50 p-1 rounded transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            )}
          </div>
          <div className="flex-1 p-6 flex flex-col space-y-6 overflow-y-auto custom-scrollbar">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Benchmarks</label>
              <textarea 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none h-48 resize-none transition-all placeholder:text-slate-300 shadow-inner"
                placeholder="Paste requirements..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
              />
            </div>
            <div className="space-y-3 pt-4">
              <button onClick={handleAnalyze} disabled={isAnalyzing || !resumeSource} className="w-full py-4 bg-slate-900 text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-xl hover:bg-indigo-600 transition-all flex items-center justify-center space-x-2 disabled:bg-slate-100">
                {isAnalyzing ? "Processing..." : "Execute Audit"}
              </button>
              {analysis && (
                <button onClick={handleRectify} disabled={isRectifying} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50">
                  {isRectifying ? "Optimizing..." : "Apply Rectification"}
                </button>
              )}
            </div>
            {analysis && (
              <div className="bg-slate-900 rounded-xl p-5 space-y-4 shadow-xl border border-slate-800 animate-in slide-in-from-bottom-4">
                <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Logs</h3>
                <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                  {analysis.formatting_issues.map((issue, i) => (
                    <div key={i} className="flex items-start space-x-3">
                      <div className="w-1 h-1 bg-indigo-400 rounded-full mt-1.5 shrink-0"></div>
                      <p className="text-[10px] font-bold text-slate-300 leading-tight">{issue}</p>
                    </div>
                  ))}
                  {analysis.formatting_issues.length === 0 && <p className="text-[10px] font-bold text-emerald-400">All systems green.</p>}
                </div>
              </div>
            )}
          </div>
        </section>
        <section className="flex-1 overflow-y-auto custom-scrollbar p-12 relative flex flex-col items-center bg-slate-100">
          {!draft ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60 text-center max-w-sm animate-pulse">
              <div className="w-24 h-24 border-4 border-slate-200 rounded-[3rem] flex items-center justify-center font-black text-4xl mb-8 italic text-slate-200">AB</div>
              <p className="text-[11px] font-black uppercase tracking-[0.3em]">Awaiting Reconstruction.</p>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center animate-in zoom-in-95 duration-700 pb-20">
               <div className="w-[210mm] flex justify-end mb-8 sticky top-0 z-50">
                  <button onClick={handleExport} className="bg-emerald-500 text-white px-8 py-3 rounded-full font-black text-[11px] uppercase tracking-widest shadow-2xl hover:bg-emerald-600 transition-all flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                    <span>Download PDF</span>
                  </button>
               </div>
              <div ref={cvPreviewRef} className="cv-a4-surface text-slate-800">
                <div className="col-span-7 p-16 pr-12 flex flex-col h-full border-r border-slate-50">
                  <header className="mb-12">
                    <h1 className="text-[48px] font-black text-slate-900 tracking-tighter mb-2 uppercase leading-none">{draft.personal_info.name}</h1>
                    <div className="flex items-center space-x-4">
                      <span className="text-indigo-600 font-black text-[14px] uppercase tracking-[0.4em] whitespace-nowrap">{draft.personal_info.role || "Professional Candidate"}</span>
                      <div className="h-[1pt] flex-1 bg-slate-100"></div>
                    </div>
                  </header>
                  <div className="space-y-16">
                    <section className="highlight-entry">
                      <SectionHeader title="Profile" />
                      <p className="text-[11px] text-slate-600 leading-[1.8] font-medium text-justify">{draft.summary}</p>
                    </section>
                    <section>
                      <SectionHeader title="Trajectory" />
                      <div className="space-y-12">
                        {draft.experience.map((exp, i) => (
                          <div key={i} className="group">
                            <div className="flex justify-between items-baseline mb-3">
                              <h4 className="text-[14px] font-black text-slate-900 uppercase tracking-tight leading-none">{exp.role}</h4>
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-md border border-slate-100 whitespace-nowrap ml-4">{exp.date}</span>
                            </div>
                            <p className="text-[12px] font-black text-indigo-500 mb-5 leading-none">{exp.company.toUpperCase()}</p>
                            <ul className="space-y-4">
                              {exp.bullets.map((bullet, bi) => (
                                <li key={bi} className="text-[10px] text-slate-600 leading-relaxed flex items-start">
                                  <span className="w-1.5 h-1.5 bg-indigo-200 rounded-full mt-1.5 mr-4 shrink-0 group-hover:bg-indigo-400 transition-colors"></span>
                                  <span className="flex-1">{bullet}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </section>
                    <section>
                      <SectionHeader title="Foundation" />
                      <div className="space-y-8">
                        {draft.education.map((edu, i) => (
                          <div key={i} className="flex justify-between items-start bg-slate-50/40 p-5 rounded-2xl border border-slate-50">
                            <div>
                              <p className="text-[12px] font-black text-slate-900 uppercase mb-2">{edu.institution}</p>
                              <p className="text-[11px] text-slate-500 font-bold italic">{edu.degree}</p>
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap ml-6">{edu.date}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                </div>
                <div className="col-span-3 bg-slate-50/50 p-12 flex flex-col h-full border-l border-slate-100">
                  <div className="space-y-16">
                    <section>
                      <h3 className="text-[12px] font-black text-slate-900 uppercase tracking-widest mb-6 pb-2 border-b-2 border-slate-200">Connect</h3>
                      <div className="space-y-6 text-[11px] font-bold text-slate-600 uppercase tracking-tight overflow-hidden">
                        <div className="flex flex-col">
                          <span className="text-[8px] text-indigo-400 font-black mb-1.5 tracking-[0.2em]">Email</span>
                          <span className="truncate">{draft.personal_info.email}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[8px] text-indigo-400 font-black mb-1.5 tracking-[0.2em]">Phone</span>
                          <span>{draft.personal_info.phone}</span>
                        </div>
                        {draft.personal_info.linkedin && (
                          <div className="flex flex-col">
                            <span className="text-[8px] text-indigo-400 font-black mb-1.5 tracking-[0.2em]">LinkedIn</span>
                            <span className="truncate">{draft.personal_info.linkedin}</span>
                          </div>
                        )}
                      </div>
                    </section>
                    <section>
                      <h3 className="text-[12px] font-black text-slate-900 uppercase tracking-widest mb-8 pb-2 border-b-2 border-slate-200">Skills</h3>
                      <div className="space-y-10">
                        {draft.skills.map((cat, i) => (
                          <div key={i}>
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-4 tracking-widest">{cat.category}</p>
                            <div className="flex flex-wrap gap-2">
                              {cat.items.map((it, ii) => <SkillPill key={ii} label={it} />)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                    {draft.certifications.length > 0 && (
                      <section>
                        <h3 className="text-[12px] font-black text-slate-900 uppercase tracking-widest mb-6 pb-2 border-b-2 border-slate-200">Verify</h3>
                        <div className="space-y-4">
                          {draft.certifications.map((cert, i) => (
                            <p key={i} className="text-[10px] text-slate-600 font-bold leading-tight flex items-start">
                              <span className="text-indigo-400 mr-2.5 shrink-0 mt-1">▪</span>{cert}
                            </p>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                  <div className="mt-auto pt-20 flex flex-col items-center">
                    <div className="w-16 h-1 bg-indigo-200 rounded-full mb-6"></div>
                    <p className="text-[8px] text-slate-400 font-black uppercase tracking-[0.5em] text-center">Neural Output</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
      <footer className="app-footer bg-slate-900 border-t border-slate-800 px-8 flex items-center justify-between text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] z-[100]">
        <div className="flex items-center space-x-8">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-lg shadow-emerald-500/20"></span>
            <span>Gateway: RECON-4.2-STABLE</span>
          </div>
          <span className="opacity-40">|</span>
          <span>Status: 100% Zero-Loss</span>
        </div>
        <div>&copy; 2025 ATS Bridge Global Suite</div>
      </footer>
    </div>
  );
}