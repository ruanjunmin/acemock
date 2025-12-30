import React, { useState, useEffect } from 'react';
import { playTextToSpeech, stopAudio } from '../services/audioService';
import { SpeakerIcon, StopIcon, SettingsAdjustIcon, CopyIcon, CheckCircleIcon, RefreshIcon } from './Icons';

interface Props {
    text: string;
    className?: string;
    showCopy?: boolean;
}

const VOICES = [
    { id: 'Kore', label: '知性女声', gender: '♀', desc: '端庄稳重，适合深度解析', tags: ['专业'] },
    { id: 'Puck', label: '活力男声', gender: '♂', desc: '轻松幽默，缓解考试焦虑', tags: ['亲和'] },
    { id: 'Charon', label: '沉稳男声', gender: '♂', desc: '低沉有力，如同资深教授', tags: ['严肃'] },
    { id: 'Fenrir', label: '磁性男声', gender: '♂', desc: '充满力量，提神醒脑', tags: ['磁性'] },
    { id: 'Zephyr', label: '温柔女声', gender: '♀', desc: '如沐春风，听感极其舒适', tags: ['舒缓'] },
];

const TTSControl: React.FC<Props> = ({ text, className = "", showCopy = true }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [copied, setCopied] = useState(false);

    // 参数设置状态
    const [voiceName, setVoiceName] = useState('Kore');
    const [speed, setSpeed] = useState(1.0);
    const [volume, setVolume] = useState(1.0);
    const [isTestPlaying, setIsTestPlaying] = useState<string | null>(null);
    const [saveStatus, setSaveStatus] = useState<'IDLE' | 'SUCCESS'>('IDLE');

    // 初始化加载
    useEffect(() => {
        const sVoice = localStorage.getItem('aceMock_voice');
        const sSpeed = localStorage.getItem('aceMock_speed');
        const sVolume = localStorage.getItem('aceMock_volume');
        
        if (sVoice) setVoiceName(sVoice);
        if (sSpeed) setSpeed(parseFloat(sSpeed));
        if (sVolume) setVolume(parseFloat(sVolume));
    }, [showSettings]);

    const handleSave = () => {
        localStorage.setItem('aceMock_voice', voiceName);
        localStorage.setItem('aceMock_speed', speed.toString());
        localStorage.setItem('aceMock_volume', volume.toString());
        
        setSaveStatus('SUCCESS');
        setTimeout(() => {
            setSaveStatus('IDLE');
            // 自动关闭面板
            setTimeout(() => setShowSettings(false), 500);
        }, 1500);
    };

    const handlePlay = async () => {
        if (isPlaying) {
            stopAudio();
            setIsPlaying(false);
            return;
        }

        setIsLoading(true);
        try {
            // 确保此处传入的是最新的状态值
            await playTextToSpeech(text, voiceName, speed, volume);
            setIsPlaying(true);
            setIsLoading(false);
            setIsPlaying(false);
        } catch (e) {
            setIsLoading(false);
            setIsPlaying(false);
        }
    };

    const handlePreviewVoice = async (vId: string) => {
        if (isTestPlaying === vId) {
            stopAudio();
            setIsTestPlaying(null);
            return;
        }
        
        setIsTestPlaying(vId);
        try {
            await playTextToSpeech("这是当前人声的朗读效果。", vId, speed, volume);
        } catch (e) {
            console.warn("Preview failed");
        } finally {
            setIsTestPlaying(null);
        }
    };

    const handleReset = () => {
        setSpeed(1.0);
        setVolume(1.0);
        setVoiceName('Kore');
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className={`relative inline-flex items-center space-x-1 ${className}`}>
            {/* Main Play Button */}
            <button 
                onClick={handlePlay}
                disabled={isLoading}
                className={`p-1.5 rounded-lg transition-all flex items-center space-x-1.5 text-xs font-bold shadow-sm active:scale-95
                    ${isPlaying 
                        ? 'bg-red-500 text-white hover:bg-red-600' 
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }
                    ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}
                `}
            >
                {isLoading ? (
                     <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : isPlaying ? (
                     <><StopIcon /><span>停止</span></>
                ) : (
                     <><SpeakerIcon /><span>朗读答案</span></>
                )}
            </button>

            {/* Toggle Settings */}
            <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-1.5 rounded-lg border transition-all ${showSettings ? 'bg-indigo-100 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50'}`}
                title="语音偏好设置"
            >
                <SettingsAdjustIcon />
            </button>

            {/* Copy Button */}
            {showCopy && (
                <button
                    onClick={handleCopy}
                    className="p-1.5 bg-white text-slate-400 hover:text-green-600 hover:bg-green-50 border border-slate-200 hover:border-green-100 rounded-lg transition-all"
                    title="复制内容"
                >
                    {copied ? <CheckCircleIcon className="w-4 h-4 text-green-600" /> : <CopyIcon />}
                </button>
            )}

            {/* Advanced Settings Popover - Using fixed positioning to avoid overflow clipping */}
            {showSettings && (
                <>
                    <div className="fixed inset-0 z-[9998]" onClick={() => setShowSettings(false)}></div>
                    <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-[9999] animate-in fade-in zoom-in-95 overflow-hidden flex flex-col">
                        
                        <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center">
                                <SpeakerIcon className="mr-2 text-indigo-600"/> 语音偏好
                            </h4>
                            <div className="flex items-center space-x-3">
                                <button 
                                    onClick={handleReset}
                                    className="text-[10px] font-bold text-slate-400 hover:text-red-500 flex items-center transition-colors"
                                >
                                    <RefreshIcon className="w-3 h-3 mr-1" /> 重置
                                </button>
                                <button 
                                    onClick={() => setShowSettings(false)}
                                    className="text-slate-400 hover:text-slate-600"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>

                        <div className="p-4 space-y-5 flex-grow overflow-y-auto custom-scrollbar max-h-[50vh]">
                            {/* Sliders */}
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between items-center mb-1.5">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase">语速 (Speed)</label>
                                        <span className="text-[11px] font-mono font-bold text-indigo-600">{speed.toFixed(1)}x</span>
                                    </div>
                                    <input 
                                        type="range" min="0.5" max="2.0" step="0.1" value={speed}
                                        onChange={(e) => setSpeed(parseFloat(e.target.value))}
                                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                    />
                                </div>
                                <div>
                                    <div className="flex justify-between items-center mb-1.5">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase">音量 (Volume)</label>
                                        <span className="text-[11px] font-mono font-bold text-indigo-600">{Math.round(volume * 100)}%</span>
                                    </div>
                                    <input 
                                        type="range" min="0" max="1.0" step="0.1" value={volume}
                                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                    />
                                </div>
                            </div>

                            <div className="border-t border-slate-100 my-1"></div>

                            {/* Voice List */}
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-2">选择人声角色</label>
                                <div className="space-y-1.5 pr-1">
                                    {VOICES.map(v => (
                                        <div 
                                            key={v.id}
                                            className={`relative p-3 rounded-xl border-2 transition-all cursor-pointer group
                                                ${voiceName === v.id 
                                                    ? 'border-indigo-600 bg-indigo-50/50 shadow-sm' 
                                                    : 'border-slate-100 bg-white hover:border-slate-200'
                                                }
                                            `}
                                            onClick={() => setVoiceName(v.id)}
                                        >
                                            <div className="flex justify-between items-center">
                                                <div className="flex-1">
                                                    <div className="flex items-center space-x-2">
                                                        <span className={`text-xs font-bold ${voiceName === v.id ? 'text-indigo-700' : 'text-slate-700'}`}>
                                                            {v.gender} {v.label}
                                                        </span>
                                                        <span className="text-[9px] px-1 bg-white border border-slate-200 rounded text-slate-400 font-medium">{v.tags[0]}</span>
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 mt-1 leading-tight">{v.desc}</div>
                                                </div>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handlePreviewVoice(v.id); }}
                                                    className={`p-1.5 rounded-md transition-colors ${isTestPlaying === v.id ? 'bg-indigo-600 text-white animate-pulse' : 'bg-slate-100 text-slate-400 group-hover:text-indigo-600'}`}
                                                    title="试听"
                                                >
                                                    {isTestPlaying === v.id ? <StopIcon className="w-3 h-3"/> : <SpeakerIcon className="w-3 h-3" />}
                                                </button>
                                            </div>
                                            {voiceName === v.id && (
                                                <div className="absolute -top-2 -right-2 bg-indigo-600 text-white rounded-full p-0.5 shadow-sm border-2 border-white">
                                                    <CheckCircleIcon className="w-3 h-3" />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Save Button Section */}
                        <div className="p-4 bg-slate-50 border-t border-slate-200">
                            <button
                                onClick={handleSave}
                                className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all shadow-md active:scale-[0.98] flex items-center justify-center space-x-2
                                    ${saveStatus === 'SUCCESS' 
                                        ? 'bg-green-500 text-white shadow-green-200' 
                                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'
                                    }
                                `}
                            >
                                {saveStatus === 'SUCCESS' ? (
                                    <><CheckCircleIcon className="w-4 h-4"/> <span>配置已保存</span></>
                                ) : (
                                    <span>保存配置并应用</span>
                                )}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default TTSControl;