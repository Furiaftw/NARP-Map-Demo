import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
 X, Compass, Target, Info, ZoomIn,
 ZoomOut, Maximize, Plus, Trash2,
 Save, Landmark, Home, Star,
 Map as MapIcon, ChevronRight, Eye, Link as LinkIcon, User, Activity,
 Image, Settings, LogIn, LogOut, Shield, UserPlus, UserMinus
} from 'lucide-react';
import { oauthLogin, handleAuthCallback, getUser, logout as identityLogout } from '@netlify/identity';


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

const OWNER_EMAIL = 'grisales4000@gmail.com';

export default function App() {
 // Auth State
 const [user, setUser] = useState(null);
 const [authRole, setAuthRole] = useState(null); // 'owner' | 'staff' | null
 const [isWhitelisted, setIsWhitelisted] = useState(false);
 const [authLoading, setAuthLoading] = useState(true);
 const [showAdminPanel, setShowAdminPanel] = useState(false);
 const [whitelist, setWhitelist] = useState([]);
 const [newEmail, setNewEmail] = useState('');
 const [whitelistMessage, setWhitelistMessage] = useState('');

 // Marker Size
 const [markerSize, setMarkerSize] = useState(1);
 const [showSizeControl, setShowSizeControl] = useState(false);

 // Map Data
 const [mapUrl, setMapUrl] = useState('');
 const [mapLinkInput, setMapLinkInput] = useState('');
 const [mapLinkSaving, setMapLinkSaving] = useState(false);
 const [mapLinkMessage, setMapLinkMessage] = useState('');
 const [showMapLinkEditor, setShowMapLinkEditor] = useState(false);
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
   symbol: '\u706B',
   color: '#f59e0b',
   description: '',
   links: [{ text: '', url: '' }],
   status: '',
   leader: '',
 });


 const mapContainerRef = useRef(null);
 const imageWrapperRef = useRef(null);
 const [imageNaturalSize, setImageNaturalSize] = useState(null);
 const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

 const hasStaffAccess = isWhitelisted;
 const isOwner = authRole === 'owner';

 // --- Auth: handle OAuth callback on load, then check auth ---
 useEffect(() => {
   async function initAuth() {
     try {
       const result = await handleAuthCallback();
       if (result && result.type === 'oauth') {
         // OAuth login completed
       }
     } catch {}

     try {
       const currentUser = await getUser();
       if (currentUser) {
         setUser(currentUser);
         await checkAuth();
       }
     } catch {}
     setAuthLoading(false);
   }
   initAuth();
 }, []);

 const checkAuth = async () => {
   try {
     const res = await fetch('/api/check-auth');
     if (res.ok) {
       const data = await res.json();
       setAuthRole(data.role);
       setIsWhitelisted(data.whitelisted);
     } else {
       setAuthRole(null);
       setIsWhitelisted(false);
     }
   } catch {
     setAuthRole(null);
     setIsWhitelisted(false);
   }
 };

 const handleGoogleLogin = () => {
   oauthLogin('google');
 };

 const handleLogout = async () => {
   try {
     await identityLogout();
   } catch {}
   setUser(null);
   setAuthRole(null);
   setIsWhitelisted(false);
   setShowAdminPanel(false);
   setShowMapLinkEditor(false);
   setIsAdding(false);
 };

 // --- Whitelist Management (Owner only) ---
 const fetchWhitelist = async () => {
   try {
     const res = await fetch('/api/whitelist');
     if (res.ok) {
       const data = await res.json();
       setWhitelist(data.whitelist || []);
     }
   } catch {}
 };

 const addToWhitelist = async () => {
   if (!newEmail.trim()) return;
   setWhitelistMessage('');
   try {
     const res = await fetch('/api/whitelist', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ action: 'add', email: newEmail.trim() }),
     });
     if (res.ok) {
       const data = await res.json();
       setWhitelist(data.whitelist || []);
       setNewEmail('');
       setWhitelistMessage('User added!');
       setTimeout(() => setWhitelistMessage(''), 3000);
     } else {
       const data = await res.json().catch(() => ({}));
       setWhitelistMessage(data.error || 'Failed to add.');
     }
   } catch {
     setWhitelistMessage('Error adding user.');
   }
 };

 const removeFromWhitelist = async (email) => {
   try {
     const res = await fetch('/api/whitelist', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ action: 'remove', email }),
     });
     if (res.ok) {
       const data = await res.json();
       setWhitelist(data.whitelist || []);
     }
   } catch {}
 };

 useEffect(() => {
   if (isOwner && showAdminPanel) {
     fetchWhitelist();
   }
 }, [isOwner, showAdminPanel]);

 // --- Map Link (fetch on load, save via API) ---
 useEffect(() => {
   async function fetchMapLink() {
     try {
       const res = await fetch('/api/map-link');
       if (res.ok) {
         const data = await res.json();
         if (data.url) {
           setMapUrl(data.url);
           setMapLinkInput(data.url);
         }
       }
     } catch {}
   }
   fetchMapLink();
 }, []);

 const handleSaveMapLink = async () => {
   if (!mapLinkInput.trim()) return;
   setMapLinkSaving(true);
   setMapLinkMessage('');
   try {
     const res = await fetch('/api/map-link', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ url: mapLinkInput.trim() }),
     });
     if (res.ok) {
       setMapUrl(mapLinkInput.trim());
       setImageNaturalSize(null);
       setMapLinkMessage('Map link saved!');
       setTimeout(() => setMapLinkMessage(''), 3000);
     } else if (res.status === 401) {
       setMapLinkMessage('Not authorized.');
     } else {
       setMapLinkMessage('Failed to save. Try again.');
     }
   } catch {
     setMapLinkMessage('Error saving map link.');
   }
   setMapLinkSaving(false);
 };


 // --- Pin Persistence ---
 useEffect(() => {
   fetchPins();
 }, []);

 const fetchPins = async () => {
   try {
     const res = await fetch('/api/pins');
     if (res.ok) {
       const data = await res.json();
       setMarkers(data.pins || []);
     }
   } catch {}
 };

 const savePinToServer = async (action, pin = null, pinId = null) => {
   try {
     const res = await fetch('/api/pins', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ action, pin, pinId }),
     });
     if (res.status === 401) {
       return;
     }
     await fetchPins();
   } catch {}
 };


 // --- Image Aspect Ratio & Container Sizing ---
 useEffect(() => {
   const container = mapContainerRef.current;
   if (!container) return;
   const observer = new ResizeObserver(entries => {
     const { width, height } = entries[0].contentRect;
     setContainerSize({ width, height });
   });
   observer.observe(container);
   return () => observer.disconnect();
 }, [mapUrl]);

 const handleImageLoad = (e) => {
   setImageNaturalSize({ width: e.target.naturalWidth, height: e.target.naturalHeight });
 };

 const imageWrapperStyle = useMemo(() => {
   if (!imageNaturalSize || !containerSize.width || !containerSize.height) {
     return { width: '100%', height: '100%' };
   }
   const imageRatio = imageNaturalSize.width / imageNaturalSize.height;
   const containerRatio = containerSize.width / containerSize.height;
   if (imageRatio > containerRatio) {
     const w = containerSize.width;
     return { width: `${w}px`, height: `${w / imageRatio}px` };
   } else {
     const h = containerSize.height;
     return { width: `${h * imageRatio}px`, height: `${h}px` };
   }
 }, [imageNaturalSize, containerSize]);


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
     if (isAdding && hasStaffAccess && imageWrapperRef.current && (!e.touches || e.touches.length === 0)) {
       const rect = imageWrapperRef.current.getBoundingClientRect();
       const leftPercent = ((clientX - rect.left) / rect.width) * 100;
       const topPercent = ((clientY - rect.top) / rect.height) * 100;
       setShowEditor({ top: topPercent, left: leftPercent });
     } else {
       setSelectedId(null);
       setShowSidebar(false);
     }
   }
   setIsDragging(false);
   setInitialPinchDistance(null);
 };


 const saveMarker = async () => {
   if (!tempMarker.name) return;
   const newMarker = {
     ...tempMarker,
     id: Date.now(),
     top: `${showEditor.top}%`,
     left: `${showEditor.left}%`,
   };
   setMarkers(prev => [...prev, newMarker]);
   setShowEditor(null);
   setTempMarker({ name: '', type: 'VILLAGE', symbol: '\u706B', color: '#f59e0b', description: '', links: [{ text: '', url: '' }], status: '', leader: '' });
   await savePinToServer('create', newMarker);
 };


 const deleteMarker = async (id) => {
   setMarkers(prev => prev.filter(m => m.id !== id));
   if (selectedId === id) setSelectedId(null);
   await savePinToServer('delete', null, id);
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
         {/* Staff-only buttons */}
         {hasStaffAccess && (
           <>
             <button
               onClick={() => setShowMapLinkEditor(!showMapLinkEditor)}
               className={`p-2 md:px-4 md:py-2 rounded-lg border transition-all text-xs font-bold uppercase tracking-widest flex items-center gap-2
                 ${showMapLinkEditor ? 'bg-amber-500 text-black border-amber-400' : 'bg-[#1c1917] text-white border-[#292524]'}
               `}
             >
               <Image size={16}/>
               <span className="hidden sm:inline">Map Link</span>
             </button>
             <button
               onClick={() => setIsAdding(!isAdding)}
               className={`p-2 md:px-4 md:py-2 rounded-lg border transition-all text-xs font-bold uppercase tracking-widest flex items-center gap-2
                 ${isAdding ? 'bg-amber-500 text-black border-amber-400' : 'bg-[#1c1917] text-white border-[#292524]'}
               `}
             >
               {isAdding ? <Save size={16}/> : <Plus size={16}/>}
               <span className="hidden sm:inline">{isAdding ? 'Finalize' : 'Add Pin'}</span>
             </button>
           </>
         )}

         {/* Owner admin button */}
         {isOwner && (
           <button
             onClick={() => setShowAdminPanel(!showAdminPanel)}
             className={`p-2 md:px-4 md:py-2 rounded-lg border transition-all text-xs font-bold uppercase tracking-widest flex items-center gap-2
               ${showAdminPanel ? 'bg-purple-500 text-white border-purple-400' : 'bg-[#1c1917] text-white border-[#292524]'}
             `}
           >
             <Shield size={16}/>
             <span className="hidden sm:inline">Admin</span>
           </button>
         )}

         {/* Auth button */}
         {!authLoading && (
           user ? (
             <button
               onClick={handleLogout}
               className="p-2 md:px-4 md:py-2 rounded-lg border bg-[#1c1917] text-white border-[#292524] transition-all text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-red-900/30 hover:border-red-900/50"
             >
               <LogOut size={16}/>
               <span className="hidden sm:inline">Logout</span>
             </button>
           ) : (
             <button
               onClick={handleGoogleLogin}
               className="p-2 md:px-4 md:py-2 rounded-lg border bg-[#1c1917] text-white border-[#292524] transition-all text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-amber-500/10 hover:border-amber-500/30"
             >
               <LogIn size={16}/>
               <span className="hidden sm:inline">Staff Login</span>
             </button>
           )
         )}
       </div>
     </header>

     {/* Logged in but not whitelisted banner */}
     {user && !isWhitelisted && !authLoading && (
       <div className="z-[55] bg-yellow-900/20 border-b border-yellow-700/30 px-4 py-3 md:px-8 text-center">
         <p className="text-[10px] text-yellow-500 uppercase tracking-widest font-bold">
           Logged in as {user.email} — awaiting access approval from the owner
         </p>
       </div>
     )}

     {/* Admin Panel */}
     {isOwner && showAdminPanel && (
       <div className="z-[55] bg-[#1c1917] border-b border-purple-500/20 px-4 py-5 md:px-8">
         <div className="max-w-2xl mx-auto">
           <div className="flex items-center gap-2 mb-4">
             <Shield size={14} className="text-purple-500" />
             <h3 className="text-[10px] font-black text-purple-500 uppercase tracking-[0.3em]">Access Management</h3>
           </div>
           <p className="text-[10px] text-[#78716c] mb-4 uppercase tracking-widest">
             Add or remove email addresses to grant staff access. Staff can create markers and change the map image.
           </p>

           <div className="flex gap-3 mb-4">
             <input
               type="email"
               value={newEmail}
               onChange={e => setNewEmail(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && addToWhitelist()}
               placeholder="user@example.com"
               className="flex-grow bg-black border border-[#292524] rounded-xl p-3 text-sm focus:border-purple-500/50 outline-none font-mono"
             />
             <button
               onClick={addToWhitelist}
               disabled={!newEmail.trim()}
               className="px-6 py-3 bg-purple-500 hover:bg-purple-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest text-[10px] rounded-xl transition-all flex items-center gap-2"
             >
               <UserPlus size={14} />
               Grant
             </button>
           </div>

           {whitelistMessage && (
             <p className={`text-[10px] mb-3 font-bold uppercase tracking-widest ${whitelistMessage.includes('added') ? 'text-green-500' : 'text-red-500'}`}>
               {whitelistMessage}
             </p>
           )}

           {whitelist.length > 0 ? (
             <div className="space-y-2">
               <p className="text-[9px] text-[#57534e] uppercase tracking-widest font-bold mb-2">Whitelisted Users</p>
               {whitelist.map(email => (
                 <div key={email} className="flex items-center justify-between bg-black/40 rounded-xl px-4 py-3 border border-white/5">
                   <span className="text-xs font-mono text-[#d6d3d1]">{email}</span>
                   <button
                     onClick={() => removeFromWhitelist(email)}
                     className="p-2 text-red-500 hover:bg-red-500/20 rounded-lg transition-all flex items-center gap-1"
                   >
                     <UserMinus size={14} />
                     <span className="text-[9px] font-bold uppercase hidden sm:inline">Revoke</span>
                   </button>
                 </div>
               ))}
             </div>
           ) : (
             <p className="text-[10px] text-[#57534e] uppercase tracking-widest text-center py-4">No whitelisted users yet</p>
           )}
         </div>
       </div>
     )}


     {/* Map Link Editor */}
     {hasStaffAccess && showMapLinkEditor && (
       <div className="z-[55] bg-[#1c1917] border-b border-[#292524] px-4 py-4 md:px-8">
         <div className="max-w-2xl mx-auto">
           <div className="flex items-center gap-2 mb-3">
             <Image size={14} className="text-amber-500" />
             <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.3em]">Map Image Link</h3>
           </div>
           <p className="text-[10px] text-[#78716c] mb-3 uppercase tracking-widest">Paste an image URL (e.g. Imgur link) to display as the map. This will be saved for all visitors.</p>
           <div className="flex gap-3">
             <input
               type="url"
               value={mapLinkInput}
               onChange={e => setMapLinkInput(e.target.value)}
               placeholder="https://i.imgur.com/example.png"
               className="flex-grow bg-black border border-[#292524] rounded-xl p-3 text-sm focus:border-amber-500/50 outline-none font-mono"
             />
             <button
               onClick={handleSaveMapLink}
               disabled={mapLinkSaving || !mapLinkInput.trim()}
               className="px-6 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black uppercase tracking-widest text-[10px] rounded-xl transition-all flex items-center gap-2"
             >
               <Save size={14} />
               {mapLinkSaving ? 'Saving...' : 'Save'}
             </button>
           </div>
           {mapLinkMessage && (
             <p className={`text-[10px] mt-2 font-bold uppercase tracking-widest ${mapLinkMessage.includes('saved') ? 'text-green-500' : 'text-red-500'}`}>
               {mapLinkMessage}
             </p>
           )}
         </div>
       </div>
     )}


     <main className="flex-grow relative flex flex-col lg:flex-row h-[calc(100vh-68px)] overflow-hidden">
       <div className="flex-grow relative bg-[#0c0a09] h-full">
         {!mapUrl ? (
           <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center bg-[#0c0a09]">
             <div className="w-20 h-20 rounded-full bg-[#1c1917] flex items-center justify-center mb-6 shadow-2xl border border-[#292524]">
               <Compass size={40} className="text-[#292524] animate-pulse" />
             </div>
             <h2 className="text-lg font-bold text-white/40 uppercase tracking-widest mb-2">No Map Available</h2>
             <p className="text-[10px] text-[#57534e] uppercase tracking-widest max-w-xs">
               {hasStaffAccess
                 ? 'Use the "Map Link" button above to set a map image URL.'
                 : 'The map has not been configured yet.'}
             </p>
           </div>
         ) : (
           <div className="h-full w-full relative touch-none select-none">
             {/* Zoom & Size Controls */}
             <div className="absolute top-4 right-4 z-40 flex flex-col gap-2">
               <button onClick={() => handleZoom('in')} className="bg-black/70 hover:bg-amber-500 p-3 rounded-xl border border-white/10 text-white hover:text-black transition-all shadow-xl active:scale-90"><ZoomIn size={20}/></button>
               <button onClick={() => handleZoom('out')} className="bg-black/70 hover:bg-amber-500 p-3 rounded-xl border border-white/10 text-white hover:text-black transition-all shadow-xl active:scale-90"><ZoomOut size={20}/></button>
               <button onClick={resetZoom} className="bg-black/70 hover:bg-amber-500 p-3 rounded-xl border border-white/10 text-white hover:text-black transition-all shadow-xl active:scale-90"><Maximize size={20}/></button>
               <button onClick={() => setShowSizeControl(!showSizeControl)} className={`p-3 rounded-xl border transition-all shadow-xl active:scale-90 ${showSizeControl ? 'bg-amber-500 text-black border-amber-400' : 'bg-black/70 hover:bg-amber-500 border-white/10 text-white hover:text-black'}`}>
                 <Settings size={20}/>
               </button>
             </div>

             {/* Marker Size Slider */}
             {showSizeControl && (
               <div className="absolute top-4 left-4 z-40 bg-black/80 backdrop-blur-sm rounded-xl p-4 border border-white/10 shadow-xl">
                 <div className="flex items-center gap-3">
                   <span className="text-[9px] font-bold text-[#78716c] uppercase tracking-widest whitespace-nowrap">Pin Size</span>
                   <input
                     type="range"
                     min="0.3"
                     max="2"
                     step="0.1"
                     value={markerSize}
                     onChange={e => setMarkerSize(parseFloat(e.target.value))}
                     className="w-24 accent-amber-500"
                   />
                   <span className="text-[10px] text-amber-500 font-mono w-8">{markerSize.toFixed(1)}</span>
                 </div>
               </div>
             )}


             <div
               ref={mapContainerRef}
               className={`h-full w-full overflow-hidden transition-all duration-300 ${isAdding && hasStaffAccess ? 'ring-inset ring-4 ring-amber-500/10 cursor-crosshair' : ''}`}
               onMouseDown={startDrag}
               onMouseMove={onDrag}
               onMouseUp={endDrag}
               onTouchStart={startDrag}
               onTouchMove={onDrag}
               onTouchEnd={endDrag}
             >
               <div
                 className="relative origin-center transition-transform duration-200 ease-out flex items-center justify-center"
                 style={{ width: '100%', height: '100%', transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)` }}
               >
                 <div ref={imageWrapperRef} className="relative" style={imageWrapperStyle}>
                 <img src={mapUrl} alt="Map" draggable="false" className="w-full h-full block pointer-events-none brightness-[0.85] contrast-[1.1]" crossOrigin="anonymous" onLoad={handleImageLoad} />


                 {markers.map((m) => (
                   <div
                     key={m.id}
                     className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20"
                     style={{ top: m.top, left: m.left, transform: `translate(-50%, -50%) scale(${Math.max(0.4, 1.2 / Math.sqrt(scale)) * markerSize})` }}
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
                   {hasStaffAccess && (
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
                 <div className="flex items-center gap-2 mb-3 flex-wrap">
                   <span
                     className="inline-block text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest text-black"
                     style={{ backgroundColor: selectedLoc.color }}
                   >
                     {MARKER_TYPES[selectedLoc.type]?.label || 'Location'}
                   </span>
                 </div>
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
                  <p className="text-[10px] font-bold text-[#44403c] uppercase tracking-[0.4em]">NARP World</p>
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
       {hasStaffAccess && (
         <button onClick={() => setIsAdding(!isAdding)} className={`flex flex-col items-center gap-1.5 ${isAdding ? 'text-amber-500' : 'text-[#78716c]'}`}>
           <Plus size={22} />
           <span className="text-[8px] font-black uppercase tracking-widest">Add Pin</span>
         </button>
       )}
     </nav>


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
