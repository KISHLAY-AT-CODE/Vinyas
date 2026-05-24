import React, { useState, useEffect } from 'react';
import FireSlider from './FireSlider';
import { useToast } from './ToastContext';

const NightlyWrapUpModal = ({ isOpen, onClose, routines, data, onLogDpp, onLogTextAndImage, onCompleteRoutine, initialTargetId }) => {
    const { showToast } = useToast();

    const [currentIndex, setCurrentIndex] = useState(0);
    const pendingRoutines = routines.filter(r => !r.done);
    const currentRoutine = pendingRoutines[currentIndex] || pendingRoutines[0]; // fallback to 0 if out of bounds
    
    // Local State for Inputs
    const [comp, setComp] = useState(0);
    const [acc, setAcc] = useState(0);
    const [textLog, setTextLog] = useState('');
    const [resourceNumber, setResourceNumber] = useState('');
    const [isSwitchingTemplate, setIsSwitchingTemplate] = useState(false);
    const [activeTemplate, setActiveTemplate] = useState('');

    // Initial targeting and close if all done
    useEffect(() => {
        if (!isOpen) return;

        if (pendingRoutines.length === 0) {
            onClose();
        } else if (initialTargetId) {
            const targetIdx = pendingRoutines.findIndex(r => r.id === initialTargetId);
            if (targetIdx !== -1) {
                setCurrentIndex(targetIdx);
            }
        } else {
            setCurrentIndex(0);
        }
    }, [isOpen, initialTargetId]); // explicitly only run on open or target change

    // Reset local state when routine changes
    useEffect(() => {
        if (currentRoutine) {
            setComp(0);
            setAcc(0);
            setTextLog('');
            setResourceNumber('');
            setIsSwitchingTemplate(false);
            setActiveTemplate(currentRoutine.template);
        }
    }, [currentRoutine]);

    if (!isOpen || pendingRoutines.length === 0 || !currentRoutine) return null;

    const handleNext = () => {
        if (currentIndex < pendingRoutines.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            setCurrentIndex(0); // Cycle back
        }
    };

    const handleSave = () => {
        const { sIdx, cIdx } = currentRoutine;
        const template = activeTemplate || currentRoutine.template;
        
        if (template === 'dpp') {
            onLogDpp(sIdx, cIdx, parseInt(comp), parseInt(acc), resourceNumber);
        } else {
            onLogTextAndImage(sIdx, cIdx, template, textLog, resourceNumber);
        }
        
        onCompleteRoutine(currentRoutine.id, template);
        
        // If it was the last one, it will auto-close via the useEffect.
        // Otherwise, it stays on the next one since the array shrinks.
        if (currentIndex >= pendingRoutines.length - 1) {
            setCurrentIndex(Math.max(0, pendingRoutines.length - 2));
        }
    };

    const handleSwitchTemplate = (newTemplate) => {
        setActiveTemplate(newTemplate);
        setIsSwitchingTemplate(false);
    };

    const templates = [
        { id: 'lecture', name: 'Lecture', icon: 'ph-video-camera' },
        { id: 'dpp', name: 'DPP', icon: 'ph-fire' },
        { id: 'notes', name: 'Notes', icon: 'ph-book-open' },
        { id: 'revision', name: 'Revision', icon: 'ph-arrows-clockwise' },
        { id: 'mock', name: 'Mock', icon: 'ph-exam' }
    ];

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-lg modal-animate">
            <div className="bg-slate-800 border border-slate-700 rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden flex flex-col relative">
                
                {/* Progress Header */}
                <div className="absolute top-0 left-0 w-full h-1 bg-slate-700">
                    <div className="h-full bg-orange-500 transition-all duration-300" style={{ width: `${((routines.length - pendingRoutines.length) / routines.length) * 100}%` }}></div>
                </div>

                <div className="p-6 border-b border-slate-700/50 flex justify-between items-start">
                    <div>
                        <h3 className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-1">Nightly Wrap-up</h3>
                        <h2 className="text-xl font-black text-white leading-tight">{currentRoutine.subjectName}</h2>
                        <p className="text-sm font-semibold text-slate-300 mt-1">{currentRoutine.chapterName}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white bg-slate-800 p-2 rounded-full transition-colors">
                        <i className="ph-bold ph-x"></i>
                    </button>
                </div>

                <div className="p-6 flex-1 flex flex-col justify-center min-h-[300px]">
                    {/* Template Switcher */}
                    <div className="mb-6 flex justify-between items-center bg-slate-900/50 p-2 rounded-xl border border-slate-700/50">
                        <div className="flex items-center gap-2">
                            <i className={`ph-fill ${templates.find(t => t.id === activeTemplate)?.icon} text-lg text-orange-400`}></i>
                            <span className="text-sm font-bold text-white capitalize">{activeTemplate} Template</span>
                        </div>
                        <button onClick={() => setIsSwitchingTemplate(!isSwitchingTemplate)} className="text-xs font-bold text-slate-400 hover:text-white underline">Switch</button>
                    </div>

                    {isSwitchingTemplate ? (
                        <div className="grid grid-cols-2 gap-2 animate-pop-in">
                            {templates.map(t => (
                                <button key={t.id} onClick={() => handleSwitchTemplate(t.id)} className="p-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-bold text-white transition-colors flex items-center justify-center gap-2">
                                    <i className={`ph-bold ${t.icon}`}></i> {t.name}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="animate-pop-in space-y-4">
                            <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl px-4 py-3">
                                <span className="text-sm font-bold text-slate-400 mr-2 capitalize">{activeTemplate} #</span>
                                <input 
                                    type="number" 
                                    value={resourceNumber} 
                                    onChange={(e) => setResourceNumber(e.target.value)}
                                    placeholder="Optional (e.g. 1)"
                                    className="bg-transparent text-white font-bold w-full outline-none placeholder-slate-600"
                                />
                            </div>

                            {activeTemplate === 'dpp' ? (
                                <>
                                    <FireSlider label="Completion" value={comp} onChange={(e) => setComp(e.target.value)} />
                                    <FireSlider label="Accuracy" value={acc} onChange={(e) => setAcc(e.target.value)} />
                                </>
                            ) : (
                                <>
                                    <textarea 
                                        autoFocus 
                                        value={textLog} 
                                        onChange={e => setTextLog(e.target.value)} 
                                        placeholder={`Log your ${activeTemplate} progress for ${currentRoutine.chapterName}...`} 
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-slate-200 h-24 outline-none focus:border-orange-500 transition-colors resize-none text-sm"
                                    ></textarea>
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-6 pt-0 flex gap-3">
                    {pendingRoutines.length > 1 && (
                        <button onClick={handleNext} className="w-14 h-14 flex items-center justify-center bg-slate-700/50 hover:bg-slate-700 text-white font-bold rounded-2xl transition-colors">
                            <i className="ph-bold ph-arrow-right text-xl"></i>
                        </button>
                    )}
                    <button onClick={handleSave} className="flex-1 h-14 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-black rounded-2xl shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all flex items-center justify-center gap-2">
                        <i className="ph-bold ph-check-circle text-xl"></i> Log & Continue
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NightlyWrapUpModal;
