import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
 X, Scroll, Shield, Compass, Target, Info, ZoomIn,
 ZoomOut, Maximize, MousePointer2, Plus, Trash2,
 Upload, Save, Lock, Unlock, Landmark, Home, Star,
 Map as MapIcon, ChevronRight, Eye, Link as LinkIcon, User, Activity
} from 'lucide-react';


// --- Tactical Categories & Default Colors ---
const MARKER_TYPES = {
 VILLAGE: {
   id: 'VILLAGE',
   label: 'Hidden Village',
   icon: Landmark,
   defaultColor: '#f59e0b' // Amber
 },
 MINOR_VILLAGE: {
   id: 'MINOR_VILLAGE',
   label: 'Minor Hidden Village',
   icon: Home,
   defaultColor: '#3b82f6' // Blue
 },
 SPECIAL: {
   id: 'SPECIAL',
   label: 'Special Locations',
   icon: Star,
   defaultColor: '#a855f7' // Purple
 }
};


export default function App() {
 // Auth
 const [isAdmin, setIsAdmin] = useState(false);
 const [authInput, setAuthInput] = useState("");
 const [showLogin, setShowLogin] = useState(false);


 // Map Data
 const [mapImage, setMapImage] = useState(null);
 const [markers, setMarkers] = useState([]);
 const [selectedId, setSelectedId] = useState(null);
 const [isAdding, setIsAdding] = useState(false);
  // Viewport
 const [scale, setScale] = useState(1);
 const [position, setPosition] = useState({ x: 0, y: 0 });
 const [isDragging, setIsDragging] = useState(false);
 const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
 const [hasMoved, setHasMoved] = useState(false);
  // Mobile Zoom
 const [initialPinchDistance, setInitialPinchDistance] = useState(null);
 const [initialScale, setInitialScale] = useState(1);


 // UI
 const [showSidebar, setShowSidebar] = useState(false);
 const [showEditor, setShowEditor] = useState(null);
 const [tempMarker, setTempMarker] = useState({
   name: '',
   type: 'VILLAGE',
   symbol: '火',
   color: '#f59e0b',
   description: '',
   links: [{ text: '', url: '' }],
   status: '',
   leader: '',
 });


 const mapContainerRef = useRef(null);
 const fileInputRef = useRef(null);


 // --- Auth ---
 const handleLogin = (e) => {
   e.preventDefault();
   if (authInput.toUpperCase() === "NARP") {
     setIsAdmin(true);
     setShowLogin(false);
     setAuthInput("");
   } else {
     setAuthInput("");
   }
 };


 const handleImageUpload = (e) => {
   if (!isAdmin) return;
   const file = e.target.files[0];
   if (file) {
     const reader = new FileReader();
     reader.onload = (event) => {
       setMapImage(event.target.result);
       setMarkers([]);
       resetZoom();
     };
     reader.readAsDataURL(file);
   }
 };


 // --- Navigation (Mouse + Pinch Zoom) ---
 const handleZoom = useCallback((direction, factor = 0.3) => {
   setScale(prev => {
     const newScale = direction === 'in' ? prev + factor : prev - factor;
     return Math.min(Math.max(newScale, 1), 6);
   });
 }, []);


 const resetZoom = () => {
   setScale(1);
   setPosition({ x: 0, y: 0 });
 };


 const getDistance = (t1, t2) => {
   return Math.sqrt(Math.pow(t2.clientX - t1.clientX, 2) + Math.pow(t2.clientY - t1.clientY, 2));
 };


 const startDrag = (e) => {
   if (!e.touches) e.preventDefault();
  
   if (e.touches && e.touches.length === 2) {
     const d = getDistance(e.touches[0], e.touches[1]);
     setInitialPinchDistance(d);
     setInitialScale(scale);
     return;
   }
   const clientX = e.touches ? e.touches[0].clientX : e.clientX;
   const clientY = e.touches ? e.touches[0].clientY : e.clientY;
   setIsDragging(true);
   setHasMoved(false);
   setDragStart({ x: clientX - position.x, y: clientY - position.y });
 };


 const onDrag = (e) => {
   if (e.touches && e.touches.length === 2 && initialPinchDistance) {
     const currentD = getDistance(e.touches[0], e.touches[1]);
     const factor = currentD / initialPinchDistance;
     const newScale = Math.min(Math.max(initialScale * factor, 1), 6);
     setScale(newScale);
     return;
   }


   if (!isDragging) return;
   setHasMoved(true);
   const clientX = e.touches ? e.touches[0].clientX : e.clientX;
   const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  
   let newX = clientX - dragStart.x;
   let newY = clientY - dragStart.y;
  
   if (mapContainerRef.current) {
     const rect = mapContainerRef.current.getBoundingClientRect();
     const maxX = (rect.width * (scale - 1)) / 2;
     const maxY = (rect.height * (scale - 1)) / 2;
     newX = Math.min(Math.max(newX, -maxX), maxX);
     newY = Math.min(Math.max(newY, -maxY), maxY);
   }
   setPosition({ x: newX, y: newY });
 };


 const endDrag = (e) => {
   const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
   const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;


   if (!hasMoved) {
     if (isAdmin && isAdding && mapContainerRef.current && (!e.touches || e.touches.length === 0)) {
       const rect = mapContainerRef.current.getBoundingClientRect();
       const clickX = clientX - rect.left;
       const clickY = clientY - rect.top;
       const centerX = rect.width / 2;
       const centerY = rect.height / 2;
       const relativeX = (clickX - centerX - position.x) / scale + centerX;
       const relativeY = (clickY - centerY - position.y) / scale + centerY;
       const leftPercent = (relativeX / rect.width) * 100;
       const topPercent = (relativeY / rect.height) * 100;
       setShowEditor({ top: topPercent, left: leftPercent });
     } else {
       setSelectedId(null);
       setShowSidebar(false);
     }
   }
   setIsDragging(false);
   setInitialPinchDistance(null);
 };


 const saveMarker = () => {
   if (!tempMarker.name) return;
   const newMarker = {
     ...tempMarker,
     id: Date.now(),
     top: `${showEditor.top}%`,
     left: `${showEditor.left}%`,
   };
   setMarkers([...markers, newMarker]);
   setShowEditor(null);
   setTempMarker({ name: '', type: 'VILLAGE', symbol: '火', color: '#f59e0b', description: '', links: [{ text: '', url: '' }], status: '', leader: '' });
 };


 const deleteMarker = (id) => {
   setMarkers(markers.filter(m => m.id !== id));
   if (selectedId === id) setSelectedId(null);
 };


 const updateLink = (index, field, value) => {
   const newLinks = [...tempMarker.links];
   newLinks[index][field] = value;
   setTempMarker({ ...tempMarker, links: newLinks });
 };
 const addLink = () => setTempMarker({ ...tempMarker, links: [...tempMarker.links, { text: '', url: '' }] });
 const removeLink = (index) => setTempMarker({ ...tempMarker, links: tempMarker.links.filter((_, i) => i !== index) });


 const selectedLoc = markers.find(m => m.id === selectedId);


 return (
   <div className="min-h-screen bg-[#0c0a09] text-[#e7e5e4] font-serif selection:bg-amber-500 selection:text-black flex flex-col overflow-x-hidden" style={{ WebkitTapHighlightColor: 'transparent' }}>
     <header className="sticky top-0 z-[60] bg-[#0c0a09]/90 backdrop-blur-md border-b border-[#292524] px-4 py-3 md:px-8 md:py-5 flex justify-between items-center shadow-lg">
       <div className="flex items-center gap-3">
         <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20 hidden md:block">
           <MapIcon className="text-amber-500 w-5 h-5 md:w-6 md:h-6" />
         </div>
         <div>
           <h1 className="text-lg md:text-2xl font-black tracking-tighter text-white uppercase leading-none">
             NARP <span className="text-amber-500">Interactive Map</span>
           </h1>
           <p className="text-[8px] md:text-[9px] uppercase tracking-[0.4em] text-[#78716c] font-bold mt-1">Ninja Art Roleplay World</p>
         </div>
       </div>
      
       <div className="flex items-center gap-2">
         {isAdmin ? (
           <div className="flex items-center gap-2">
             <button
               onClick={() => setIsAdding(!isAdding)}
               className={`p-2 md:px-4 md:py-2 rounded-lg border transition-all text-xs font-bold uppercase tracking-widest flex items-center gap-2
                 ${isAdding ? 'bg-amber-500 text-black border-amber-400' : 'bg-[#1c1917] text-white border-[#292524]'}
               `}
             >
               {isAdding ? <Save size={16}/> : <Plus size={16}/>}
               <span className="hidden sm:inline">{isAdding ? 'Finalize' : 'Add Pin'}</span>
             </button>
             <button onClick={() => setIsAdmin(false)} className="p-2 md:px-4 md:py-2 bg-red-900/10 text-red-500 rounded-lg border border-red-900/40 text-xs font-bold uppercase"><Lock size={16} /></button>
           </div>
         ) : (
           <button onClick={() => setShowLogin(true)} className="flex items-center gap-2 px-4 py-2 bg-[#1c1917] hover:bg-amber-500 hover:text-black rounded-lg border border-[#292524] transition-all text-[10px] md:text-xs font-bold uppercase tracking-widest">
             <Unlock size={14} /> <span className="hidden sm:inline">Admin Panel</span>
           </button>
         )}
       </div>
     </header>


     <main className="flex-grow relative flex flex-col lg:flex-row h-[calc(100vh-68px)] overflow-hidden">
       <div className="flex-grow relative bg-[#0c0a09] h-full">
         {!mapImage ? (
           <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center bg-[#0c0a09]">
             <div className="w-20 h-20 rounded-full bg-[#1c1917] flex items-center justify-center mb-6 shadow-2xl border border-[#292524]">
               <Compass size={40} className="text-[#292524] animate-pulse" />
             </div>
             <h2 className="text-lg font-bold text-white/40 uppercase tracking-widest mb-2">No Map Uploaded</h2>
             {isAdmin && (
               <button
                 onClick={() => fileInputRef.current.click()}
                 className="mt-6 px-10 py-4 bg-amber-500 text-black font-black uppercase tracking-widest rounded-xl shadow-[0_10px_30px_rgba(245,158,11,0.2)] hover:scale-105 transition-all"
               >
                 Upload Map Data
               </button>
             )}
             <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
           </div>
         ) : (
           <div className="h-full w-full relative touch-none select-none">
             <div className="absolute top-4 right-4 z-40 flex flex-col gap-2">
               <button onClick={() => handleZoom('in')} className="bg-black/70 hover:bg-amber-500 p-3 rounded-xl border border-white/10 text-white hover:text-black transition-all shadow-xl active:scale-90"><ZoomIn size={20}/></button>
               <button onClick={() => handleZoom('out')} className="bg-black/70 hover:bg-amber-500 p-3 rounded-xl border border-white/10 text-white hover:text-black transition-all shadow-xl active:scale-90"><ZoomOut size={20}/></button>
               <button onClick={resetZoom} className="bg-black/70 hover:bg-amber-500 p-3 rounded-xl border border-white/10 text-white hover:text-black transition-all shadow-xl active:scale-90"><Maximize size={20}/></button>
             </div>


             <div
               ref={mapContainerRef}
               className={`h-full w-full overflow-hidden transition-all duration-300 ${isAdding ? 'ring-inset ring-4 ring-amber-500/10 cursor-crosshair' : ''}`}
               onMouseDown={startDrag}
               onMouseMove={onDrag}
               onMouseUp={endDrag}
               onTouchStart={startDrag}
               onTouchMove={onDrag}
               onTouchEnd={endDrag}
             >
               <div
                 className="relative origin-center transition-transform duration-200 ease-out"
                 style={{ width: '100%', height: '100%', transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)` }}
               >
                 <img src={mapImage} alt="Map" draggable="false" className="w-full h-full object-contain pointer-events-none brightness-[0.85] contrast-[1.1]" />


                 {markers.map((m) => (
                   <div
                     key={m.id}
                     className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20"
                     style={{ top: m.top, left: m.left, transform: `translate(-50%, -50%) scale(${Math.max(0.4, 1.2 / Math.sqrt(scale))})` }}
                   >
                     <FancyMarker
                       isSelected={selectedId === m.id}
                       type={m.type}
                       symbol={m.symbol}
                       color={m.color}
                       onClick={() => {
                         setSelectedId(m.id);
                         if (window.innerWidth < 1024) setShowSidebar(true);
                       }}
                     />
                   </div>
                 ))}


                 {showEditor && (
                   <div className="absolute transform -translate-x-1/2 -translate-y-1/2 z-30 animate-bounce" style={{ top: `${showEditor.top}%`, left: `${showEditor.left}%` }}>
                     <div className="w-10 h-10 rounded-full bg-amber-500 border-4 border-white flex items-center justify-center text-black font-black text-xl shadow-[0_0_30px_rgba(245,158,11,0.6)]">?</div>
                   </div>
                 )}
               </div>
             </div>


             {showEditor && (
               <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-300" onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
                 <div className="bg-[#1c1917] p-6 md:p-8 rounded-2xl border border-amber-500/20 shadow-2xl max-w-lg w-full space-y-5 overflow-y-auto max-h-[90vh] custom-scrollbar">
                   <div className="flex justify-between items-center border-b border-[#292524] pb-4">
                     <h3 className="font-black text-white uppercase tracking-[0.2em] text-xs">Pin Info</h3>
                     <button onClick={() => setShowEditor(null)} className="p-2 text-[#78716c] hover:text-white"><X size={20}/></button>
                   </div>
                  
                   <div className="grid grid-cols-2 gap-4">
                     <div>
                       <label className="text-[9px] text-[#78716c] uppercase font-black block mb-1.5">Pin name</label>
                       <input value={tempMarker.name} onChange={e => setTempMarker({...tempMarker, name: e.target.value})} className="w-full bg-black border border-[#292524] rounded-lg p-3 text-sm focus:border-amber-500/50 outline-none" placeholder="Enter Name" />
                     </div>
                     <div>
                       <label className="text-[9px] text-[#78716c] uppercase font-black block mb-1.5">Symbol</label>
                       <input value={tempMarker.symbol} onChange={e => setTempMarker({...tempMarker, symbol: e.target.value})} className="w-full bg-black border border-[#292524] rounded-lg p-3 text-center text-lg" maxLength={2} />
                     </div>
                   </div>


                   <div>
                     <label className="text-[9px] text-[#78716c] uppercase font-black block mb-1.5">Classification</label>
                     <div className="grid grid-cols-3 gap-2">
                       {Object.values(MARKER_TYPES).map(type => (
                         <button
                           key={type.id}
                           onClick={() => setTempMarker({...tempMarker, type: type.id, color: type.defaultColor})}
                           className={`px-2 py-2 rounded-lg border text-[9px] text-center font-bold uppercase transition-all flex flex-col items-center gap-1
                             ${tempMarker.type === type.id ? 'bg-white/10 border-white text-white' : 'bg-black border-[#292524] text-[#78716c]'}
                           `}
                         >
                           <type.icon size={16} />
                           {type.label}
                         </button>
                       ))}
                     </div>
                   </div>


                   <div>
                     <label className="text-[9px] text-[#78716c] uppercase font-black block mb-1.5">Pin Color</label>
                     <div className="flex gap-2">
                       <input type="color" value={tempMarker.color} onChange={e => setTempMarker({...tempMarker, color: e.target.value})} className="h-11 w-12 bg-black border border-[#292524] rounded-lg cursor-pointer p-0.5" />
                       <input type="text" value={tempMarker.color} onChange={e => setTempMarker({...tempMarker, color: e.target.value})} className="flex-grow bg-black border border-[#292524] rounded-lg p-3 text-sm focus:border-amber-500/50 outline-none uppercase font-mono tracking-wider" placeholder="#HEXCODE" />
                     </div>
                   </div>


                   <div className="grid grid-cols-2 gap-4">
                     <div>
                       <label className="text-[9px] text-[#78716c] uppercase font-black block mb-1.5">Status (Optional)</label>
                       <input value={tempMarker.status} onChange={e => setTempMarker({...tempMarker, status: e.target.value})} className="w-full bg-black border border-[#292524] rounded-lg p-3 text-sm focus:border-amber-500/50 outline-none" placeholder="e.g. Active" />
                     </div>
                     <div>
                       <label className="text-[9px] text-[#78716c] uppercase font-black block mb-1.5">Local Leader (Optional)</label>
                       <input value={tempMarker.leader} onChange={e => setTempMarker({...tempMarker, leader: e.target.value})} className="w-full bg-black border border-[#292524] rounded-lg p-3 text-sm focus:border-amber-500/50 outline-none" placeholder="Leader name" />
                     </div>
                   </div>


                   <div>
                     <div className="flex justify-between items-end mb-1.5">
                       <label className="text-[9px] text-[#78716c] uppercase font-black">Hyperlinks</label>
                       <button onClick={addLink} className="text-[9px] text-amber-500 font-bold hover:underline">+ Add Link</button>
                     </div>
                     <div className="space-y-2">
                       {tempMarker.links.map((link, idx) => (
                         <div key={idx} className="flex gap-2 items-center">
                           <input value={link.text} onChange={e => updateLink(idx, 'text', e.target.value)} className="flex-1 bg-black border border-[#292524] rounded-lg p-2.5 text-xs focus:border-amber-500/50 outline-none" placeholder="Display Text" />
                           <input value={link.url} onChange={e => updateLink(idx, 'url', e.target.value)} className="flex-1 bg-black border border-[#292524] rounded-lg p-2.5 text-xs focus:border-amber-500/50 outline-none" placeholder="URL (Optional)" />
                           {tempMarker.links.length > 1 && (
                             <button onClick={() => removeLink(idx)} className="p-2 text-red-500 hover:bg-red-500/20 rounded-lg"><X size={14}/></button>
                           )}
                         </div>
                       ))}
                     </div>
                   </div>


                   <div>
                     <label className="text-[9px] text-[#78716c] uppercase font-black block mb-1.5">Description...</label>
                     <textarea value={tempMarker.description} onChange={e => setTempMarker({...tempMarker, description: e.target.value})} className="w-full bg-black border border-[#292524] rounded-lg p-3 text-sm h-20 focus:border-amber-500/50 outline-none resize-none" placeholder="Add info here..." />
                   </div>


                   <button onClick={saveMarker} className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-[0.2em] py-4 rounded-xl shadow-lg transition-all">Create Pin</button>
                 </div>
               </div>
             )}
           </div>
         )}
       </div>


       <aside className={`
         absolute lg:relative z-[55] lg:z-10
         inset-x-0 bottom-0 lg:inset-auto
         h-[75vh] lg:h-full lg:w-[420px]
         bg-[#1c1917] border-t lg:border-t-0 lg:border-l border-[#292524]
         transition-transform duration-500 ease-in-out shadow-2xl
         ${showSidebar ? 'translate-y-0' : 'translate-y-full'} lg:translate-y-0 lg:translate-x-0 lg:block
       `}>
         <div className="lg:hidden w-full flex justify-center py-4 border-b border-[#292524]" onClick={() => setShowSidebar(false)}>
           <div className="w-12 h-1 bg-[#292524] rounded-full" />
         </div>


         <div className="h-full overflow-y-auto custom-scrollbar p-6 md:p-10">
           {selectedLoc ? (
             <div className="flex flex-col h-full animate-in fade-in duration-500">
               <div className="flex justify-between items-start mb-8">
                 <div
                   className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl border shadow-[0_0_20px_rgba(0,0,0,0.4)] text-black"
                   style={{ backgroundColor: selectedLoc.color, borderColor: selectedLoc.color }}
                 >
                   {selectedLoc.symbol}
                 </div>
                 <div className="flex gap-2">
                   {isAdmin && (
                     <button onClick={() => deleteMarker(selectedLoc.id)} className="p-3.5 bg-red-900/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all border border-red-900/20">
                       <Trash2 size={20} />
                     </button>
                   )}
                   <button onClick={() => { setSelectedId(null); if (window.innerWidth < 1024) setShowSidebar(false); }} className="p-3.5 bg-[#292524] text-[#78716c] hover:text-white rounded-xl border border-white/5">
                     <X size={20} />
                   </button>
                 </div>
               </div>
              
               <div className="mb-8">
                 <span
                   className="inline-block text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest mb-3 text-black"
                   style={{ backgroundColor: selectedLoc.color }}
                 >
                   {MARKER_TYPES[selectedLoc.type]?.label || 'Location'}
                 </span>
                 <h2 className="text-4xl font-black text-white tracking-tight uppercase leading-tight">{selectedLoc.name}</h2>
               </div>
              
               <div className="space-y-6 flex-grow">
                 {(selectedLoc.description || !selectedLoc.description) && (
                   <div className="bg-black/40 rounded-2xl p-6 border border-white/5 space-y-4 shadow-inner">
                     <div className="flex items-center gap-2 text-[#78716c] uppercase font-black text-[10px] tracking-widest border-b border-white/5 pb-3">
                       <Target size={14} /> Description
                     </div>
                     <p className="text-sm text-[#d6d3d1] leading-relaxed italic opacity-90 whitespace-pre-wrap">
                       {selectedLoc.description ? `"${selectedLoc.description}"` : 'No info available.'}
                     </p>
                   </div>
                 )}


                 {(selectedLoc.status || selectedLoc.leader) && (
                   <div className="grid grid-cols-2 gap-4">
                     {selectedLoc.status && (
                       <div className="bg-[#12100e] p-4 rounded-xl border border-white/5">
                         <div className="flex items-center gap-2 text-[9px] font-black text-[#57534e] uppercase mb-1">
                           <Activity size={10} /> Status
                         </div>
                         <p className="text-xs font-bold text-green-500 uppercase tracking-widest">{selectedLoc.status}</p>
                       </div>
                     )}
                     {selectedLoc.leader && (
                       <div className="bg-[#12100e] p-4 rounded-xl border border-white/5">
                         <div className="flex items-center gap-2 text-[9px] font-black text-[#57534e] uppercase mb-1">
                           <User size={10} /> Local Leader
                         </div>
                         <p className="text-xs font-bold text-white tracking-widest uppercase">{selectedLoc.leader}</p>
                       </div>
                     )}
                   </div>
                 )}


                 {selectedLoc.links && selectedLoc.links.some(l => l.text) && (
                   <div className="space-y-3">
                     {selectedLoc.links.map((link, idx) => {
                       if (!link.text) return null;
                       if (link.url) {
                         return (
                           <a key={idx} href={link.url} target="_blank" rel="noopener noreferrer" className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-start gap-4 group cursor-pointer hover:bg-white/10 transition-colors block">
                             <div className="p-2 bg-white/10 rounded-lg" style={{ color: selectedLoc.color }}>
                               <LinkIcon size={16} />
                             </div>
                             <p className="text-xs font-bold leading-relaxed group-hover:underline mt-1" style={{ color: selectedLoc.color }}>
                               {link.text}
                             </p>
                           </a>
                         );
                       }
                       return (
                         <div key={idx} className="p-4 bg-[#12100e] rounded-2xl border border-white/5 flex items-start gap-4">
                           <div className="p-2 bg-white/5 rounded-lg text-[#78716c]">
                             <Info size={16} />
                           </div>
                           <p className="text-xs text-[#d6d3d1] font-bold leading-relaxed mt-1">{link.text}</p>
                         </div>
                       );
                     })}
                   </div>
                 )}
               </div>


               <div className="mt-10 pt-8 border-t border-[#292524] text-center">
                  <p className="text-[10px] font-bold text-[#44403c] uppercase tracking-[0.4em]">Property of Allied Forces</p>
               </div>
             </div>
           ) : (
             <div className="flex-grow flex flex-col items-center justify-center p-12 text-center space-y-8">
               <div className="relative">
                 <div className="absolute inset-0 border border-dashed border-amber-500/20 rounded-full animate-[spin_20s_linear_infinite]" />
                 <Target size={56} className="text-[#292524] animate-pulse relative z-10" />
               </div>
               <div>
                 <h3 className="text-white font-black uppercase tracking-[0.5em] text-xs mb-4">Pin Menu</h3>
                 <p className="text-[10px] text-[#57534e] uppercase tracking-widest leading-relaxed max-w-[220px] mx-auto">Select a pin to show info.</p>
               </div>
              
               {markers.length > 0 && (
                 <div className="w-full text-left bg-black/30 p-5 rounded-2xl border border-white/5 space-y-4">
                   <p className="text-[9px] font-black text-amber-500 uppercase tracking-[0.5em] mb-2">Active Signals</p>
                   <div className="space-y-2 max-h-[180px] overflow-y-auto custom-scrollbar pr-2">
                     {markers.map(m => (
                       <button
                         key={m.id}
                         onClick={() => setSelectedId(m.id)}
                         className="w-full flex items-center justify-between p-3.5 hover:bg-white/5 rounded-xl transition-all group border border-transparent hover:border-white/5"
                       >
                         <div className="flex items-center gap-4">
                           <span className="text-lg">{m.symbol}</span>
                           <span className="text-[11px] font-bold text-[#78716c] group-hover:text-white uppercase tracking-widest">{m.name}</span>
                         </div>
                         <ChevronRight size={14} className="text-[#292524] group-hover:text-amber-500" />
                       </button>
                     ))}
                   </div>
                 </div>
               )}
             </div>
           )}
         </div>
       </aside>
     </main>


     <nav className="lg:hidden sticky bottom-0 z-[60] bg-[#0c0a09]/95 backdrop-blur-md border-t border-[#292524] flex justify-around p-4 pb-8 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
       <button onClick={() => { setShowSidebar(false); resetZoom(); }} className="flex flex-col items-center gap-1.5 text-[#78716c]">
         <MapIcon size={22} />
         <span className="text-[8px] font-black uppercase tracking-widest">Map</span>
       </button>
       <button onClick={() => setShowSidebar(!showSidebar)} className={`flex flex-col items-center gap-1.5 ${showSidebar ? 'text-amber-500' : 'text-[#78716c]'}`}>
         <Eye size={22} />
         <span className="text-[8px] font-black uppercase tracking-widest">Info</span>
       </button>
       {isAdmin && (
          <button onClick={() => setIsAdding(!isAdding)} className={`flex flex-col items-center gap-1.5 ${isAdding ? 'text-amber-500' : 'text-[#78716c]'}`}>
          <Plus size={22} />
          <span className="text-[8px] font-black uppercase tracking-widest">Add Pin</span>
        </button>
       )}
     </nav>


     {showLogin && (
       <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6">
         <div className="bg-[#1c1917] p-8 md:p-12 rounded-[2rem] border border-amber-500/10 shadow-3xl max-w-sm w-full text-center space-y-8">
           <div className="w-24 h-24 rounded-3xl bg-amber-500/5 border border-amber-500/10 flex items-center justify-center mx-auto shadow-inner">
             <Lock size={48} className="text-amber-500" />
           </div>
           <div>
             <h2 className="text-3xl font-black text-white uppercase tracking-[0.2em]">Admin Panel</h2>
           </div>
           <form onSubmit={handleLogin} className="space-y-6">
             <input
               type="password"
               value={authInput}
               onChange={e => setAuthInput(e.target.value)}
               placeholder="****"
               autoFocus
               className="w-full bg-black border-2 border-[#292524] rounded-2xl p-5 text-center tracking-[1.2em] text-amber-500 font-bold focus:border-amber-500 outline-none transition-all"
             />
             <div className="flex gap-3">
               <button type="button" onClick={() => setShowLogin(false)} className="flex-1 bg-[#292524] py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] text-[#78716c]">Abort</button>
               <button type="submit" className="flex-[2] bg-amber-500 text-black py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-transform">Authorize</button>
             </div>
           </form>
         </div>
       </div>
     )}


     <style dangerouslySetInnerHTML={{ __html: `
       .custom-scrollbar::-webkit-scrollbar { width: 4px; }
       .custom-scrollbar::-webkit-scrollbar-thumb { background: #292524; border-radius: 10px; }
       @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
     `}} />
   </div>
 );
}


const FancyMarker = ({ isSelected, onClick, type, symbol, color = '#f59e0b' }) => {
 const IconComponent = MARKER_TYPES[type]?.icon || Landmark;
 const pulseColorAlpha = color + '66';
  return (
   <div
     className="relative cursor-pointer pointer-events-auto group"
     onClick={(e) => { e.stopPropagation(); onClick(); }}
     style={{ '--marker-color': color, '--marker-color-alpha': pulseColorAlpha }}
   >
     <div className={`absolute -inset-10 pointer-events-none transition-opacity duration-700 ${isSelected ? 'opacity-100' : 'opacity-0'}`}>
       <div className="absolute inset-0 border-2 rounded-full animate-[ping_3s_linear_infinite]" style={{ borderColor: 'var(--marker-color-alpha)' }} />
       <div className="absolute inset-4 border rounded-full animate-[ping_2s_linear_infinite]" style={{ borderColor: 'var(--marker-color-alpha)' }} />
     </div>


     <div className={`relative flex items-center justify-center transition-all duration-300 ${isSelected ? 'scale-125 -translate-y-3' : 'hover:scale-110 active:scale-90'}`}>
      
       <div className={`w-14 h-14 absolute animate-[spin_12s_linear_infinite] transition-colors duration-500 ${isSelected ? 'opacity-100' : 'opacity-40'}`}>
         <svg viewBox="0 0 100 100" className="w-full h-full" style={{ color: isSelected ? color : '#44403c' }}>
           <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="12 6" />
           <circle cx="50" cy="5" r="4.5" fill="currentColor" />
           <circle cx="50" cy="95" r="4.5" fill="currentColor" />
           <circle cx="5" cy="50" r="4.5" fill="currentColor" />
           <circle cx="95" cy="50" r="4.5" fill="currentColor" />
         </svg>
       </div>


       <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 border-2
         ${isSelected
           ? 'bg-white text-black'
           : `bg-[#1c1917] text-white/40 group-hover:text-white`}
       `}
       style={{
         borderColor: isSelected ? color : '#44403c',
         boxShadow: isSelected ? `0 0 25px ${color}80` : 'none'
       }}
       >
         <span className="text-[12px] font-black">{symbol}</span>
       </div>
      
       <div className={`absolute -top-6 transition-all duration-500 ${isSelected ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
         <div className="p-1.5 rounded-lg text-black shadow-lg border border-white/20" style={{ backgroundColor: color }}>
           <IconComponent size={14} />
         </div>
       </div>


       <div className={`absolute top-full mt-[-1px] transition-all duration-500 ${isSelected ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-2 scale-50'}`}>
         <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[10px] shadow-xl" style={{ borderTopColor: color }} />
       </div>
     </div>
   </div>
 );
};


