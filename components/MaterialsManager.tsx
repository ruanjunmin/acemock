import React, { useRef, useState } from 'react';
import { Material } from '../types';
import { UploadIcon, FileIcon, TrashIcon, CheckboxCheckedIcon, CheckboxUncheckedIcon, BrainIcon } from './Icons';

interface Props {
  materials: Material[];
  setMaterials: React.Dispatch<React.SetStateAction<Material[]>>;
  selectedIds: string[];
  onToggleSelection: (ids: string[]) => void;
  onGenerateGuide: () => void; // New callback
}

const MaterialsManager: React.FC<Props> = ({ materials, setMaterials, selectedIds, onToggleSelection, onGenerateGuide }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const utf8_to_b64 = (str: string) => {
      return window.btoa(unescape(encodeURIComponent(str)));
  }

  const processFile = async (file: File) => {
    return new Promise<Material>(async (resolve, reject) => {
      try {
        const fileType = file.type;
        const fileName = file.name.toLowerCase();

        // 1. Word (.docx)
        if (fileName.endsWith('.docx') || fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            if (!(window as any).mammoth) {
                throw new Error("Mammoth library not loaded");
            }
            const arrayBuffer = await file.arrayBuffer();
            const result = await (window as any).mammoth.extractRawText({ arrayBuffer });
            const text = result.value; // The raw text
            // Convert text to base64 safely handling UTF-8
            const base64 = utf8_to_b64(text);
            
            resolve({
                id: Math.random().toString(36).substr(2, 9),
                name: file.name,
                mimeType: 'text/plain', // Send as text/plain to Gemini
                data: base64,
                size: file.size
            });
            return;
        }

        // 2. Excel (.xlsx, .xls)
        if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileType.includes('spreadsheet') || fileType.includes('excel')) {
             if (!(window as any).XLSX) {
                 throw new Error("XLSX library not loaded");
             }
             const arrayBuffer = await file.arrayBuffer();
             const workbook = (window as any).XLSX.read(arrayBuffer, { type: 'array' });
             let text = "";
             workbook.SheetNames.forEach((sheetName: string) => {
                 const sheet = workbook.Sheets[sheetName];
                 // Convert to CSV as a simple text representation
                 text += `--- Sheet: ${sheetName} ---\n`;
                 text += (window as any).XLSX.utils.sheet_to_csv(sheet) + "\n\n";
             });
             const base64 = utf8_to_b64(text);
             resolve({
                id: Math.random().toString(36).substr(2, 9),
                name: file.name,
                mimeType: 'text/plain',
                data: base64,
                size: file.size
            });
            return;
        }

        // 3. Text / Markdown / Code
        if (fileType.startsWith('text/') || fileName.endsWith('.md') || fileName.endsWith('.txt') || fileName.endsWith('.json')) {
             const text = await file.text();
             const base64 = utf8_to_b64(text);
             resolve({
                id: Math.random().toString(36).substr(2, 9),
                name: file.name,
                mimeType: 'text/plain',
                data: base64,
                size: file.size
            });
            return;
        }

        // 4. Default (PDF, Images) - Read as Data URL
        // Gemini supports 'application/pdf', 'image/png', 'image/jpeg' directly via inlineData
        const reader = new FileReader();
        reader.onload = () => {
            const base64String = (reader.result as string).split(',')[1];
            resolve({
              id: Math.random().toString(36).substr(2, 9),
              name: file.name,
              mimeType: file.type, // Keep original mime for PDF/Images
              data: base64String,
              size: file.size
            });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);

      } catch (e) {
        console.error("File processing error", e);
        reject(e);
      }
    });
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const newMaterials: Material[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const mat = await processFile(file);
        newMaterials.push(mat);
      } catch (e) {
        console.error("Failed to process file", file.name, e);
        alert(`无法读取文件 ${file.name}。请确保它是有效的文档格式。`);
      }
    }
    
    // Update materials and auto-select new ones
    setMaterials(prev => {
        const updated = [...prev, ...newMaterials];
        // Auto select newly added files
        const newIds = newMaterials.map(m => m.id);
        onToggleSelection([...selectedIds, ...newIds]);
        return updated;
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeMaterial = (id: string) => {
    setMaterials(prev => prev.filter(m => m.id !== id));
    onToggleSelection(selectedIds.filter(sid => sid !== id));
  };

  const toggleMaterial = (id: string) => {
      if (selectedIds.includes(id)) {
          onToggleSelection(selectedIds.filter(sid => sid !== id));
      } else {
          onToggleSelection([...selectedIds, id]);
      }
  };

  const toggleSelectAll = () => {
      if (selectedIds.length === materials.length) {
          onToggleSelection([]);
      } else {
          onToggleSelection(materials.map(m => m.id));
      }
  };

  const isAllSelected = materials.length > 0 && selectedIds.length === materials.length;
  const hasSelected = selectedIds.length > 0;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 h-full flex flex-col transition-all duration-300">
      <div className="mb-6 pb-4 border-b border-slate-100 flex justify-between items-end">
         <div>
            <h2 className="text-2xl font-bold text-slate-800">参考资料</h2>
            <p className="text-sm text-slate-400 mt-1">AI 将基于<span className="text-blue-600 font-bold mx-1">选中的</span>文档生成试题</p>
         </div>
         <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
             {materials.length} 份文件
         </span>
      </div>
      
      <div 
        className={`flex-grow border-2 border-dashed rounded-2xl p-10 transition-all duration-300 text-center cursor-pointer flex flex-col items-center justify-center min-h-[200px] mb-6
          ${isDragging 
            ? 'border-blue-500 bg-blue-50/50 scale-[1.02]' 
            : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50/50'}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className={`p-4 rounded-full mb-4 transition-colors ${isDragging ? 'bg-blue-100' : 'bg-slate-100'}`}>
           <div className="text-blue-500"><UploadIcon /></div>
        </div>
        <h3 className="text-lg font-bold text-slate-700 mb-1">点击上传或拖拽文件</h3>
        <p className="text-slate-400 text-sm max-w-xs mx-auto">支持 PDF, Word, Excel, 图片, Markdown 等常见格式</p>
        
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          multiple 
          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.md,.jpg,.png" 
          onChange={(e) => handleFiles(e.target.files)} 
        />
      </div>

      {materials.length > 0 && (
        <div className="flex-grow overflow-y-auto max-h-[400px]">
          <div className="flex justify-between items-center mb-3 px-1">
             <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider">已上传文件 ({selectedIds.length} 已选)</h4>
             <div className="flex gap-2">
                 <button 
                   onClick={toggleSelectAll}
                   className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                 >
                   {isAllSelected ? '取消全选' : '全选'}
                 </button>
             </div>
          </div>
          
          <div className="grid gap-3 mb-4">
            {materials.map(m => {
              const isSelected = selectedIds.includes(m.id);
              // Simple icon logic
              const isXls = m.name.endsWith('.xls') || m.name.endsWith('.xlsx');
              const isDoc = m.name.endsWith('.doc') || m.name.endsWith('.docx');
              
              return (
                <div 
                  key={m.id} 
                  onClick={() => toggleMaterial(m.id)}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer group select-none
                    ${isSelected 
                        ? 'bg-blue-50/60 border-blue-200 shadow-sm' 
                        : 'bg-white border-slate-200 hover:border-blue-200 hover:bg-slate-50'
                    }`}
                >
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <div className="text-blue-600 flex-shrink-0">
                        {isSelected ? <CheckboxCheckedIcon /> : <CheckboxUncheckedIcon />}
                    </div>
                    <div className={`p-2 rounded-lg flex-shrink-0 border border-slate-100 ${isXls ? 'bg-green-50 text-green-600' : isDoc ? 'bg-blue-50 text-blue-600' : 'bg-white text-slate-500'}`}>
                      <FileIcon />
                    </div>
                    <div className="truncate">
                      <p className={`text-sm font-bold truncate transition-colors ${isSelected ? 'text-blue-800' : 'text-slate-700'}`}>{m.name}</p>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{(m.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeMaterial(m.id); }}
                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="删除"
                  >
                    <TrashIcon />
                  </button>
                </div>
              )
            })}
          </div>

          {/* Generate Study Guide Button */}
          <button
              onClick={onGenerateGuide}
              disabled={!hasSelected}
              className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center space-x-2 transition-all
                ${hasSelected 
                   ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md hover:shadow-lg active:scale-95' 
                   : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }
              `}
          >
              <BrainIcon />
              <span>生成智能学习导图 (Study Guide)</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default MaterialsManager;