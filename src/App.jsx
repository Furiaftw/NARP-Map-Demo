import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
 X, Scroll, Shield, Compass, Target, Info, ZoomIn,
 ZoomOut, Maximize, MousePointer2, Plus, Trash2,
 Upload, Save, Lock, Unlock, Landmark, Home, Star,
 Map as MapIcon, ChevronRight, Eye, Link as LinkIcon, User, Activity,
 LogOut, Image, Users, EyeOff, Settings, UserCheck, UserX, Crown
} from 'lucide-react';
import {
  getUser,
  logout as identityLogout,
  oauthLogin,
  handleAuthCallback,
  onAuthChange,
  AUTH_EVENTS,
} from '@netlify/identity';


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
 // Auth (Netlify Identity)
 const [currentUser, setCurrentUser] = useState(null);
 const [authLoading, setAuthLoading] = useState(true);
 const [showLogin, setShowLogin] = useState(false);

 // Role & Access
 const [userRole, setUserRole] = useState(null);
 const [userApproved, setUserApproved] = useState(false);
 const [pendingApproval, setPendingApproval] = useState(false);
 const [userEmail, setUserEmail] = useState('');

 // Admin Panel
 const [showAdminPanel, setShowAdminPanel] = useState(false);
 const [whitelist, setWhitelist] = useState({});
 const [newUserEmail, setNewUserEmail] = useState('');
 const [newUserRole, setNewUserRole] = useState('user');

 // Secret Access
 const [secretAccess, setSecretAccess] = useState({});
 const [grantEmail, setGrantEmail] = useState('');

 // Marker Size
 const [markerSize, setMarkerSize] = useState(1);
 const [showSizeControl, setShowSizeControl] = useState(false);

 const isOwner = userRole === 'owner';
 const isStaff = userRole === 'staff';
 const isAdmin = userApproved && (isOwner || isStaff);

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
   isSecret: false,
 });


 const mapContainerRef = useRef(null);


 // --- Auth Helpers ---
 const getToken = useCallback(() => {
   if (!currentUser) return null;
   return currentUser?.token?.access_token || null;
 }, [currentUser]);

 const getAuthHeaders = useCallback(() => {
   const token = getToken();
   if (!token) return {};
   return { 'Authorization': `Bearer ${token}` };
 }, [getToken]);


 // --- Auth (Netlify Identity with Google OAuth) ---
 useEffect(() => {
   async function init() {
     try {
       const result = await handleAuthCallback();
       if (result && (result.type === 'oauth' || result.type === 'confirmation')) {
         setCurrentUser(result.user);
       }
     } catch {
       // callback not present or failed
     }

     const user = await getUser();
     setCurrentUser(user);
     setAuthLoading(false);
   }
   init();

   const unsubscribe = onAuthChange((event, user) => {
     if (event === AUTH_EVENTS.LOGIN) setCurrentUser(user);
     if (event === AUTH_EVENTS.LOGOUT) {
       setCurrentUser(null);
       setUserRole(null);
       setUserApproved(false);
       setPendingApproval(false);
       setUserEmail('');
     }
   });

   return () => unsubscribe();
 }, []);


 // --- Check Access on Login ---
 useEffect(() => {
   if (currentUser && !authLoading) {
     checkAccess();
   }
 }, [currentUser, authLoading]);

 const checkAccess = async () => {
   try {
     const token = currentUser?.token?.access_token;
     if (!token) return;
     const res = await fetch('/api/check-access', {
       method: 'POST',
       headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
     });
     if (res.ok) {
       const data = await res.json();
       setUserEmail(data.email || '');
       if (data.approved) {
         setUserRole(data.role);
         setUserApproved(true);
         setPendingApproval(false);
       } else {
         setPendingApproval(true);
         setUserApproved(false);
         setUserRole(null);
       }
     }
   } catch {
     // API not available
   }
 };


 const handleGoogleLogin = () => {
   oauthLogin('google');
 };

 const handleLogout = async () => {
   try {
     await identityLogout();
   } catch {
     // ignore
   }
   setCurrentUser(null);
   setUserRole(null);
   setUserApproved(false);
   setPendingApproval(false);
   setUserEmail('');
   setShowLogin(false);
 };


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
     } catch {
       // API not available (local dev without netlify dev)
     }
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
       headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
       body: JSON.stringify({ url: mapLinkInput.trim() }),
     });
     if (res.ok) {
       setMapUrl(mapLinkInput.trim());
       setMapLinkMessage('Map link saved!');
       setTimeout(() => setMapLinkMessage(''), 3000);
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
 }, [userApproved, currentUser]);

 const fetchPins = async () => {
   try {
     const token = currentUser?.token?.access_token;
     const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
     const res = await fetch('/api/pins', { headers });
     if (res.ok) {
       const data = await res.json();
       setMarkers(data.pins || []);
     }
   } catch {
     // API not available
   }
 };

 const savePinToServer = async (action, pin = null, pinId = null) => {
   try {
     await fetch('/api/pins', {
       method: 'POST',
       headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
       body: JSON.stringify({ action, pin, pinId }),
     });
     await fetchPins();
   } catch {}
 };


 // --- Whitelist Management (Owner) ---
 const fetchWhitelist = async () => {
   try {
     const res = await fetch('/api/whitelist', { headers: getAuthHeaders() });
     if (res.ok) {
       const data = await res.json();
       setWhitelist(data.whitelist || {});
     }
   } catch {}
 };

 const manageWhitelist = async (action, targetEmail, role = null) => {
   try {
     const res = await fetch('/api/whitelist', {
       method: 'POST',
       headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
       body: JSON.stringify({ action, targetEmail, role }),
     });
     if (res.ok) {
       const data = await res.json();
       setWhitelist(data.whitelist || {});
     }
   } catch {}
 };

 const openAdminPanel = () => {
   setShowAdminPanel(true);
   fetchWhitelist();
   fetchSecretAccess();
 };


 // --- Secret Access Management ---
 useEffect(() => {
   if (isAdmin) {
     fetchSecretAccess();
   }
 }, [isAdmin]);

 const fetchSecretAccess = async () => {
   try {
     const res = await fetch('/api/secret-access', { headers: getAuthHeaders() });
     if (res.ok) {
       const data = await res.json();
       setSecretAccess(data.secretAccess || {});
     }
   } catch {}
 };

 const manageSecretAccess = async (action, pinId, targetEmail) => {
   try {
     const res = await fetch('/api/secret-access', {
       method: 'POST',
       headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
       body: JSON.stringify({ action, pinId, targetEmail }),
     });
     if (res.ok) {
       const data = await res.json();
       setSecretAccess(data.secretAccess || {});
     }
   } catch {}
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
   setTempMarker({ name: '', type: 'VILLAGE', symbol: '\u706B', color: '#f59e0b', description: '', links: [{ text: '', url: '' }], status: '', leader: '', isSecret: false });
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
         {isAdmin ? (
           <div className="flex items-center gap-2">
             {/* Role Badge */}
             <span className={`hidden md:flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border ${
               isOwner ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' : 'bg-blue-500/10 text-blue-500 border-blue-500/30'
             }`}>
               {isOwner ? <Crown size={10} /> : <Shield size={10} />}
               {userRole}
             </span>

             {/* Admin Panel (Owner Only) */}
             {isOwner && (
               <button
                 onClick={openAdminPanel}
                 className="p-2 md:px-4 md:py-2 rounded-lg border transition-all text-xs font-bold uppercase tracking-widest flex items-center gap-2 bg-[#1c1917] text-white border-[#292524] hover:border-amber-500/50"
               >
                 <Users size={16}/>
                 <span className="hidden sm:inline">Admin</span>
               </button>
             )}

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
             <button onClick={handleLogout} className="p-2 md:px-4 md:py-2 bg-red-900/10 text-red-500 rounded-lg border border-red-900/40 text-xs font-bold uppercase flex items-center gap-2">
               <LogOut size={16} />
               <span className="hidden sm:inline">Logout</span>
             </button>
           </div>
         ) : currentUser && pendingApproval ? (
           <div className="flex items-center gap-2">
             <span className="text-[9px] font-bold text-yellow-500 uppercase tracking-widest hidden md:block">Pending Approval</span>
             <button onClick={handleLogout} className="p-2 md:px-4 md:py-2 bg-red-900/10 text-red-500 rounded-lg border border-red-900/40 text-xs font-bold uppercase flex items-center gap-2">
               <LogOut size={16} />
               <span className="hidden sm:inline">Logout</span>
             </button>
           </div>
         ) : currentUser && userApproved && userRole === 'user' ? (
           <div className="flex items-center gap-2">
             <span className="hidden md:flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border bg-[#292524] text-[#78716c] border-[#292524]">
               <User size={10} /> User
             </span>
             <button onClick={handleLogout} className="p-2 md:px-4 md:py-2 bg-red-900/10 text-red-500 rounded-lg border border-red-900/40 text-xs font-bold uppercase flex items-center gap-2">
               <LogOut size={16} />
               <span className="hidden sm:inline">Logout</span>
             </button>
           </div>
         ) : (
           <button onClick={() => setShowLogin(true)} className="flex items-center gap-2 px-4 py-2 bg-[#1c1917] hover:bg-amber-500 hover:text-black rounded-lg border border-[#292524] transition-all text-[10px] md:text-xs font-bold uppercase tracking-widest">
             <Unlock size={14} /> <span className="hidden sm:inline">Staff Login</span>
           </button>
         )}
       </div>
     </header>


     {/* Map Link Editor (Staff Only) */}
     {isAdmin && showMapLinkEditor && (
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


     {/* Pending Approval Banner */}
     {currentUser && pendingApproval && (
       <div className="z-[55] bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-4 md:px-8">
         <div className="max-w-2xl mx-auto flex items-center gap-3">
           <Shield size={16} className="text-yellow-500 flex-shrink-0" />
           <div>
             <p className="text-xs font-bold text-yellow-500 uppercase tracking-widest">Access Pending</p>
             <p className="text-[10px] text-[#78716c] mt-1">Your account is awaiting approval from the Owner. You can view the map but cannot interact with it yet.</p>
           </div>
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
               {isAdmin ? 'Use the "Map Link" button above to set a map image URL.' : 'A staff member needs to set a map image link.'}
             </p>
           </div>
         ) : (
           <div className="h-full w-full relative touch-none select-none">
             {/* Zoom & Size Controls */}
             <div className="absolute top-4 right-4 z-40 flex flex-col gap-2">
               <button onClick={() => handleZoom('in')} className="bg-black/70 hover:bg-amber-500 p-3 rounded-xl border border-white/10 text-white hover:text-black transition-all shadow-xl active:scale-90"><ZoomIn size={20}/></button>
               <button onClick={() => handleZoom('out')} className="bg-black/70 hover:bg-amber-500 p-3 rounded-xl border border-white/10 text-white hover:text-black transition-all shadow-xl active:scale-90"><ZoomOut size={20}/></button>
               <button onClick={resetZoom} className="bg-black/70 hover:bg-amber-500 p-3 rounded-xl border border-white/10 text-white hover:text-black transition-all shadow-xl active:scale-90"><Maximize size={20}/></button>
               {userApproved && (
                 <button onClick={() => setShowSizeControl(!showSizeControl)} className={`p-3 rounded-xl border transition-all shadow-xl active:scale-90 ${showSizeControl ? 'bg-amber-500 text-black border-amber-400' : 'bg-black/70 hover:bg-amber-500 border-white/10 text-white hover:text-black'}`}>
                   <Settings size={20}/>
                 </button>
               )}
             </div>

             {/* Marker Size Slider */}
             {userApproved && showSizeControl && (
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
                 <img src={mapUrl} alt="Map" draggable="false" className="w-full h-full object-contain pointer-events-none brightness-[0.85] contrast-[1.1]" crossOrigin="anonymous" />


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
                       isSecret={m.isSecret}
                       isAdmin={isAdmin}
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


                   {/* Secret Pin Toggle (Staff/Owner Only) */}
                   {isAdmin && (
                     <div className="flex items-center justify-between p-3 bg-purple-900/10 rounded-xl border border-purple-500/20">
                       <div className="flex items-center gap-2">
                         <EyeOff size={14} className="text-purple-400" />
                         <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest">Secret Pin</span>
                       </div>
                       <button
                         type="button"
                         onClick={() => setTempMarker({...tempMarker, isSecret: !tempMarker.isSecret})}
                         className={`w-10 h-5 rounded-full transition-colors flex items-center ${tempMarker.isSecret ? 'bg-purple-500' : 'bg-[#292524]'}`}
                       >
                         <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${tempMarker.isSecret ? 'translate-x-5' : 'translate-x-0.5'}`} />
                       </button>
                     </div>
                   )}


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
                 <div className="flex items-center gap-2 mb-3 flex-wrap">
                   <span
                     className="inline-block text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest text-black"
                     style={{ backgroundColor: selectedLoc.color }}
                   >
                     {MARKER_TYPES[selectedLoc.type]?.label || 'Location'}
                   </span>
                   {selectedLoc.isSecret && (
                     <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest bg-purple-500/20 text-purple-400 border border-purple-500/30">
                       <EyeOff size={10} /> Secret
                     </span>
                   )}
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


                 {/* Secret Pin Access Management */}
                 {selectedLoc.isSecret && isAdmin && (
                   <div className="bg-purple-900/10 rounded-2xl p-5 border border-purple-500/20 space-y-4">
                     <div className="flex items-center gap-2">
                       <EyeOff size={14} className="text-purple-400" />
                       <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Secret Pin Access</span>
                     </div>

                     <div className="space-y-2">
                       <p className="text-[9px] font-bold text-[#78716c] uppercase tracking-widest">Users with access:</p>
                       {(secretAccess[String(selectedLoc.id)] || []).length === 0 ? (
                         <p className="text-[10px] text-[#57534e] italic">No additional access granted</p>
                       ) : (
                         (secretAccess[String(selectedLoc.id)] || []).map(email => (
                           <div key={email} className="flex items-center justify-between bg-black/30 rounded-lg px-3 py-2">
                             <span className="text-[10px] text-[#a8a29e] truncate">{email}</span>
                             {isOwner && (
                               <button
                                 onClick={() => manageSecretAccess('revoke', selectedLoc.id, email)}
                                 className="text-[9px] text-red-500 hover:text-red-400 font-bold uppercase ml-2 flex-shrink-0"
                               >
                                 Revoke
                               </button>
                             )}
                           </div>
                         ))
                       )}
                     </div>

                     <div className="flex gap-2">
                       <input
                         value={grantEmail}
                         onChange={e => setGrantEmail(e.target.value)}
                         placeholder="user@email.com"
                         className="flex-grow bg-black border border-[#292524] rounded-lg p-2.5 text-[10px] focus:border-purple-500/50 outline-none"
                       />
                       <button
                         onClick={() => { if (grantEmail.trim()) { manageSecretAccess('grant', selectedLoc.id, grantEmail.trim()); setGrantEmail(''); } }}
                         disabled={!grantEmail.trim()}
                         className="px-4 py-2 bg-purple-500 hover:bg-purple-400 text-white rounded-lg text-[9px] font-bold uppercase tracking-widest disabled:opacity-50 transition-all flex-shrink-0"
                       >
                         Grant
                       </button>
                     </div>
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
                           {m.isSecret && isAdmin && <EyeOff size={10} className="text-purple-400" />}
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


     {/* Login Modal */}
     {showLogin && (
       <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6">
         <div className="bg-[#1c1917] p-8 md:p-12 rounded-[2rem] border border-amber-500/10 shadow-3xl max-w-sm w-full text-center space-y-8">
           <div className="w-24 h-24 rounded-3xl bg-amber-500/5 border border-amber-500/10 flex items-center justify-center mx-auto shadow-inner">
             <Shield size={48} className="text-amber-500" />
           </div>
           <div>
             <h2 className="text-3xl font-black text-white uppercase tracking-[0.2em]">Staff Login</h2>
             <p className="text-[10px] text-[#78716c] uppercase tracking-widest mt-3">Sign in with your Google account</p>
           </div>
           <div className="space-y-4">
             <button
               onClick={handleGoogleLogin}
               className="w-full bg-white hover:bg-gray-100 text-black py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3"
             >
               <svg className="w-5 h-5" viewBox="0 0 24 24">
                 <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                 <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                 <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                 <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
               </svg>
               Sign in with Google
             </button>
             <button
               type="button"
               onClick={() => setShowLogin(false)}
               className="w-full bg-[#292524] py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] text-[#78716c] hover:text-white transition-all"
             >
               Cancel
             </button>
           </div>
         </div>
       </div>
     )}


     {/* Admin Panel (Owner Only) */}
     {showAdminPanel && isOwner && (
       <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4" onClick={() => setShowAdminPanel(false)}>
         <div className="bg-[#1c1917] rounded-2xl border border-amber-500/20 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
           {/* Admin Header */}
           <div className="flex justify-between items-center p-6 border-b border-[#292524] flex-shrink-0">
             <div className="flex items-center gap-3">
               <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                 <Crown size={18} className="text-amber-500" />
               </div>
               <div>
                 <h2 className="font-black text-white uppercase tracking-[0.2em] text-sm">Admin Panel</h2>
                 <p className="text-[9px] text-[#78716c] uppercase tracking-widest mt-0.5">Owner Access Control</p>
               </div>
             </div>
             <button onClick={() => setShowAdminPanel(false)} className="p-2 text-[#78716c] hover:text-white rounded-lg hover:bg-white/5">
               <X size={20} />
             </button>
           </div>

           {/* Admin Content */}
           <div className="overflow-y-auto p-6 space-y-6 custom-scrollbar flex-grow">

             {/* Add User */}
             <div className="bg-black/30 rounded-xl p-5 border border-white/5">
               <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.3em] mb-4">Add User to Whitelist</h3>
               <div className="flex gap-2">
                 <input
                   value={newUserEmail}
                   onChange={e => setNewUserEmail(e.target.value)}
                   placeholder="user@gmail.com"
                   className="flex-grow bg-black border border-[#292524] rounded-lg p-3 text-sm focus:border-amber-500/50 outline-none"
                 />
                 <select
                   value={newUserRole}
                   onChange={e => setNewUserRole(e.target.value)}
                   className="bg-black border border-[#292524] rounded-lg px-3 text-sm outline-none text-white"
                 >
                   <option value="user">User</option>
                   <option value="staff">Staff</option>
                 </select>
                 <button
                   onClick={() => { if (newUserEmail.trim()) { manageWhitelist('add', newUserEmail.trim(), newUserRole); setNewUserEmail(''); } }}
                   disabled={!newUserEmail.trim()}
                   className="px-5 py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-lg font-black text-[10px] uppercase tracking-widest disabled:opacity-50 transition-all"
                 >
                   Add
                 </button>
               </div>
             </div>

             {/* User List */}
             <div className="bg-black/30 rounded-xl p-5 border border-white/5">
               <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.3em] mb-4">Whitelisted Users</h3>
               <div className="space-y-2">
                 {Object.keys(whitelist).length === 0 ? (
                   <p className="text-[10px] text-[#57534e] italic">No users yet. Add one above.</p>
                 ) : (
                   Object.entries(whitelist).map(([email, data]) => (
                     <div key={email} className="flex items-center justify-between p-3.5 bg-[#0c0a09] rounded-xl border border-white/5 gap-3">
                       <div className="flex-grow min-w-0">
                         <div className="flex items-center gap-2">
                           <span className="text-xs font-bold text-white truncate">{data.name || email}</span>
                           {email === OWNER_EMAIL && <Crown size={12} className="text-amber-500 flex-shrink-0" />}
                         </div>
                         <div className="flex items-center gap-3 mt-1">
                           <span className="text-[9px] text-[#57534e] truncate">{email}</span>
                           {data.lastLogin && (
                             <span className="text-[8px] text-[#44403c]">
                               Last: {new Date(data.lastLogin).toLocaleDateString()}
                             </span>
                           )}
                         </div>
                       </div>
                       <div className="flex items-center gap-2 flex-shrink-0">
                         <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full tracking-wider ${
                           data.role === 'owner' ? 'bg-amber-500/20 text-amber-500' :
                           data.role === 'staff' ? 'bg-blue-500/20 text-blue-500' :
                           'bg-[#292524] text-[#78716c]'
                         }`}>
                           {data.role}
                         </span>
                         {email !== OWNER_EMAIL && (
                           <>
                             <select
                               value={data.role}
                               onChange={e => manageWhitelist('set-role', email, e.target.value)}
                               className="bg-black border border-[#292524] rounded-lg px-2 py-1.5 text-[10px] outline-none text-white"
                             >
                               <option value="user">User</option>
                               <option value="staff">Staff</option>
                             </select>
                             {data.approved ? (
                               <button
                                 onClick={() => manageWhitelist('revoke', email)}
                                 className="p-2 bg-red-900/20 text-red-500 rounded-lg hover:bg-red-900/40 transition-colors"
                                 title="Revoke access"
                               >
                                 <UserX size={14} />
                               </button>
                             ) : (
                               <button
                                 onClick={() => manageWhitelist('approve', email, data.role)}
                                 className="p-2 bg-green-900/20 text-green-500 rounded-lg hover:bg-green-900/40 transition-colors"
                                 title="Approve access"
                               >
                                 <UserCheck size={14} />
                               </button>
                             )}
                           </>
                         )}
                       </div>
                     </div>
                   ))
                 )}
               </div>
             </div>

             {/* Secret Pin Access Overview */}
             <div className="bg-black/30 rounded-xl p-5 border border-white/5">
               <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.3em] mb-4">Secret Pin Access Overview</h3>
               {markers.filter(m => m.isSecret).length === 0 ? (
                 <p className="text-[10px] text-[#57534e] italic">No secret pins created yet.</p>
               ) : (
                 <div className="space-y-3">
                   {markers.filter(m => m.isSecret).map(pin => (
                     <div key={pin.id} className="bg-[#0c0a09] rounded-xl p-4 border border-purple-500/10">
                       <div className="flex items-center gap-2 mb-3">
                         <EyeOff size={12} className="text-purple-400" />
                         <span className="text-xs font-bold text-white uppercase tracking-widest">{pin.name}</span>
                       </div>
                       <div className="space-y-1.5">
                         {(secretAccess[String(pin.id)] || []).length === 0 ? (
                           <p className="text-[9px] text-[#57534e] italic">No one has access</p>
                         ) : (
                           (secretAccess[String(pin.id)] || []).map(email => (
                             <div key={email} className="flex items-center justify-between bg-black/50 rounded-lg px-3 py-2">
                               <span className="text-[10px] text-[#a8a29e]">{email}</span>
                               <button
                                 onClick={() => manageSecretAccess('revoke', pin.id, email)}
                                 className="text-[9px] text-red-500 hover:text-red-400 font-bold uppercase"
                               >
                                 Revoke
                               </button>
                             </div>
                           ))
                         )}
                       </div>
                       <div className="flex gap-2 mt-3">
                         <input
                           placeholder="Grant access to email..."
                           className="flex-grow bg-black border border-[#292524] rounded-lg p-2.5 text-[10px] focus:border-purple-500/50 outline-none"
                           onKeyDown={e => {
                             if (e.key === 'Enter' && e.target.value.trim()) {
                               manageSecretAccess('grant', pin.id, e.target.value.trim());
                               e.target.value = '';
                             }
                           }}
                         />
                       </div>
                     </div>
                   ))}
                 </div>
               )}
             </div>
           </div>
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


const FancyMarker = ({ isSelected, onClick, type, symbol, color = '#f59e0b', isSecret = false, isAdmin = false }) => {
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

       {/* Secret indicator for admins */}
       {isSecret && isAdmin && (
         <div className="absolute -bottom-5 left-1/2 -translate-x-1/2">
           <div className="p-0.5 rounded bg-purple-500/80">
             <EyeOff size={8} className="text-white" />
           </div>
         </div>
       )}

       <div className={`absolute top-full mt-[-1px] transition-all duration-500 ${isSelected ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-2 scale-50'}`}>
         <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[10px] shadow-xl" style={{ borderTopColor: color }} />
       </div>
     </div>
   </div>
 );
};
