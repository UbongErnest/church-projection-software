import React, { useState, useEffect, useRef, FormEvent } from "react";
import { ActiveSlide } from "../types";
import { supabase, UserProfile, SavedSermonNote } from "../supabase";
import { 
   Notebook, 
   Save, 
   Trash2, 
   Download, 
   Edit, 
   Plus, 
   FileText, 
   Check, 
   Sparkles, 
   ClipboardPaste, 
   FileDown, 
   BookOpen, 
   FileUp, 
   ChevronDown, 
   ChevronUp, 
   RotateCcw,
   Crown,
   Lock,
   X
 } from "lucide-react";

interface SermonNotepadProps {
   sermonTopic: string;
   activeProjectedSlide: ActiveSlide;
   transcript: string;
   userProfile?: UserProfile | null;
 }

export default function SermonNotepad({
   sermonTopic,
   activeProjectedSlide,
   transcript,
   userProfile
 }: SermonNotepadProps) {
// User level plan state mapping
   const userPlan = userProfile?.subscriptionPlan || "free";
   const subscriptionStatus = userProfile?.subscriptionStatus;
   const isPremium = userPlan === "yearly";
   const hasExpired = subscriptionStatus === "expired" && userPlan !== "free";

   // Notepad form state
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  
  // Library of saved sermons in localStorage
  const [savedNotes, setSavedNotes] = useState<SavedSermonNote[]>([]);
  
  // Active editing session tracking (if loading an existing note)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [isSuccessAction, setIsSuccessAction] = useState("");

  // Deletion pending confirmations
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);

// AI Copilot state
   const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
   const [generatedOutline, setGeneratedOutline] = useState("");
   const [showOutlineModal, setShowOutlineModal] = useState(false);
   const [isRefiningNotes, setIsRefiningNotes] = useState(false);
   const [refinedNotes, setRefinedNotes] = useState("");
   const [showRefineModal, setShowRefineModal] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

// AI Outline generator handler
   const handleTriggerAiOutline = async () => {
     if (hasExpired || userPlan !== "yearly") {
       triggerSuccessFeedback(hasExpired ? "⚠️ Subscription Expired! Renew to use AI Copilot." : "⚠️ AI Copilot Outline requires Yearly Premium!");
       return;
     }
     if (!noteContent.trim()) {
       triggerSuccessFeedback("⚠️ Journal canvas empty! Add notes first.");
       return;
     }

     setIsGeneratingOutline(true);
     try {
       const res = await fetch("/api/ai/copilot", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
           notesContent: noteContent,
           topic: noteTitle || sermonTopic
         })
       });
       const data = await res.json();
       if (data && data.outline) {
         setGeneratedOutline(data.outline);
         setShowOutlineModal(true);
         triggerSuccessFeedback("AI outline generated!");
       } else {
         triggerSuccessFeedback("⚠️ Failed to generate sermon outline.");
       }
     } catch (err) {
       console.error("AI Copilot outline fetch error:", err);
       triggerSuccessFeedback("⚠️ Outline request failed.");
     } finally {
       setIsGeneratingOutline(false);
     }
   };

   // AI Notes Refinement handler
   const handleRefineNotes = async () => {
     if (hasExpired || userPlan !== "yearly") {
       triggerSuccessFeedback(hasExpired ? "⚠️ Subscription Expired! Renew to use AI Copilot." : "⚠️ AI Notes Refinement requires Yearly Premium!");
       return;
     }
     if (!noteContent.trim()) {
       triggerSuccessFeedback("⚠️ Journal canvas empty! Add notes first.");
       return;
     }

     setIsRefiningNotes(true);
     try {
       const res = await fetch("/api/ai/copilot?action=refine", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
           notesContent: noteContent,
           topic: noteTitle || sermonTopic,
           sermonContext: sermonTopic
         })
       });
       const data = await res.json();
       if (data && data.refined) {
         setRefinedNotes(data.refined);
         setShowRefineModal(true);
         triggerSuccessFeedback("Notes refined successfully!");
       } else {
         triggerSuccessFeedback("⚠️ Failed to refine notes.");
       }
     } catch (err) {
       console.error("AI Refine notes fetch error:", err);
       triggerSuccessFeedback("⚠️ Notes refinement request failed.");
     } finally {
       setIsRefiningNotes(false);
     }
   };

// Load saved notes once on load via Supabase
   useEffect(() => {
     const fetchSermonNotes = async () => {
       const { data: { user } } = await supabase.auth.getUser();
       if (!user) return;
       try {
         const { data: notes, error } = await supabase
           .from('sermon_notes')
           .select('*')
           .eq('user_id', user.id)
           .order('raw_date', { ascending: false });
         
         if (error) throw error;
         setSavedNotes(notes || []);
       } catch (e) {
         console.error("Supabase sermon notes fetch error:", e);
       }
     };

     fetchSermonNotes();
   }, []);

  // Sync title with sermonTopic if title is empty or hasn't been modified yet
  useEffect(() => {
    if (!editingNoteId && !noteTitle) {
      setNoteTitle(sermonTopic || "Sunday Message Note");
    }
  }, [sermonTopic, editingNoteId]);

  // Trigger feedback banner
  const triggerSuccessFeedback = (message: string) => {
    setIsSuccessAction(message);
    setTimeout(() => setIsSuccessAction(""), 2500);
  };

// Perform sermon note saving to Supabase
   const handleSaveNote = async (e: FormEvent) => {
     e.preventDefault();
     const { data: { user } } = await supabase.auth.getUser();
     if (!user) {
       triggerSuccessFeedback("⚠️ Authenticated session required!");
       return;
     }

     const titleVal = noteTitle.trim() || sermonTopic || "Untold Sunday Study";
     const bodyVal = noteContent.trim();

     if (!bodyVal) {
       triggerSuccessFeedback("⚠️ Canvas empty! Please write some notes before saving.");
       return;
     }

     const now = new Date();
     const formattedDate = now.toLocaleDateString("en-US", {
       year: "numeric",
       month: "short",
       day: "numeric",
     });
     const formattedTime = now.toLocaleTimeString([], {
       hour: "2-digit",
       minute: "2-digit",
     });

     if (editingNoteId) {
       // Modify existing note in Supabase
       const updatedNote = {
         id: editingNoteId,
         user_id: user.id,
         title: titleVal,
         content: bodyVal,
         created_at: formattedDate,
         timestamp: formattedTime,
         raw_date: now.getTime(),
       };

       try {
         const { error } = await supabase
           .from('sermon_notes')
           .upsert(updatedNote);
         
         if (error) throw error;
         const updated = savedNotes.map((note) =>
           note.id === editingNoteId ? updatedNote : note
         );
         setSavedNotes(updated);
         triggerSuccessFeedback("Note updated in cloud diary!");
       } catch (err) {
         console.error("Supabase note update error:", err);
       }
     } else {
       // Create fresh sermon note in Supabase
       const noteId = `note-${now.getTime()}`;
       const newNote = {
         id: noteId,
         user_id: user.id,
         title: titleVal,
         content: bodyVal,
         created_at: formattedDate,
         timestamp: formattedTime,
         raw_date: now.getTime(),
       };

       try {
         const { error } = await supabase
           .from('sermon_notes')
           .insert(newNote);
         
         if (error) throw error;
         const updated = [newNote, ...savedNotes];
         setSavedNotes(updated);
         setEditingNoteId(newNote.id); // set as active editing session
         triggerSuccessFeedback("Saved note to secure cloud!");
       } catch (err) {
         console.error("Supabase note insert error:", err);
       }
     }
   };

  // Create clean fresh slate
  const handleResetEditor = () => {
    setEditingNoteId(null);
    setNoteTitle(sermonTopic || "Sunday Message Note");
    setNoteContent("");
    triggerSuccessFeedback("Cleared notepad!");
  };

  // Load selected older note for dynamic revision/edit
  const handleLoadNote = (note: SavedSermonNote) => {
    setEditingNoteId(note.id);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    triggerSuccessFeedback("Loaded note to active session");
    
    // Focus textarea
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  };

// Initiate or complete removal of sermon note in Supabase
   const handleDeleteNote = async (id: string, e: React.MouseEvent, confirmed = false) => {
     e.stopPropagation(); // preserve accordion toggle triggers
     if (!confirmed) {
       setPendingDeleteId(id);
       return;
     }
     
     try {
       const { error } = await supabase
         .from('sermon_notes')
         .delete()
         .eq('id', id);
      
       if (error) throw error;
       const updated = savedNotes.filter((note) => note.id !== id);
       setSavedNotes(updated);
       
       if (editingNoteId === id) {
         setEditingNoteId(null);
         setNoteTitle(sermonTopic || "Sunday Message Note");
         setNoteContent("");
       }
       setPendingDeleteId(null);
       triggerSuccessFeedback("Note removed from cloud");
     } catch (err) {
       console.error("Supabase note delete error:", err);
     }
   };

   // Clear all notes in Supabase
   const handleClearAllNotes = async (confirmed = false) => {
     if (!confirmed) {
       setShowPurgeConfirm(true);
       return;
     }

     try {
       const { error } = await supabase
         .from('sermon_notes')
         .delete()
         .gte('raw_date', 0);
      
       if (error) throw error;
       setSavedNotes([]);
       handleResetEditor();
       setShowPurgeConfirm(false);
       triggerSuccessFeedback("Sanctuary cloud journal purged!");
     } catch (err) {
       console.error("Supabase clear all notes error:", err);
     }
   };

  // Dynamic attachment logic: Insert current scripture slide to the body
  const handleInsertActiveSlide = () => {
    if (!activeProjectedSlide || !activeProjectedSlide.body) {
      triggerSuccessFeedback("⚠️ No active slide to insert!");
      return;
    }

    let clipText = "";
    if (activeProjectedSlide.type === "verse") {
      clipText = `\n\n[Scripture Context — ${activeProjectedSlide.title} (${activeProjectedSlide.translation || "KJV"})]\n"${activeProjectedSlide.body.trim()}"\n`;
    } else if (activeProjectedSlide.type === "lyrics") {
      clipText = `\n\n[Worship Lyric — ${activeProjectedSlide.title}]\n"${activeProjectedSlide.body.trim()}"\n`;
    } else {
      clipText = `\n\n[Slide Focus — ${activeProjectedSlide.title}]\n"${activeProjectedSlide.body.trim()}"\n`;
    }

    setNoteContent((prev) => prev + clipText);
    triggerSuccessFeedback("Appended slide text!");
  };

  // Dynamic attachment logic: Insert live transcript sentence block
  const handleInsertLiveTranscript = () => {
    if (!transcript) {
      triggerSuccessFeedback("⚠️ Voice transcript empty! Speak first.");
      return;
    }

    const appendText = `\n\n[Preacher Quote]: "${transcript.trim()}"`;
    setNoteContent((prev) => prev + appendText);
    triggerSuccessFeedback("Appended voice transcript quote!");
  };

// Convert markdown bold (**text**) to HTML bold (<strong>text</strong>)
  const convertBoldToHtml = (text: string): string => {
    return text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  };

  // Export note to filesystem as text/markdown document (.md) or PDF
  const handleDownloadNote = (note: SavedSermonNote, e?: React.MouseEvent, asPdf = false) => {
    if (e) e.stopPropagation();

    if (userPlan === "free") {
      triggerSuccessFeedback("⚠️ Notes Export is locked for Free users!");
      return;
    }

    const docContent = note.content;
    const cleanFileName = note.title.toLowerCase().replace(/[^a-z0-8 ]/g, "").replace(/\s+/g, "_") || "sermon_notes";

    if (asPdf) {
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${note.title}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 40px; line-height: 1.6; color: #333; background: #fff; }
    .header { border-bottom: 2px solid #555; padding-bottom: 20px; margin-bottom: 30px; }
    .title { font-size: 28px; font-weight: bold; margin-bottom: 10px; text-transform: uppercase; color: #2c3e50; }
    .meta { font-size: 12px; color: #666; }
    .content { font-size: 14px; white-space: pre-wrap; }
    .section { margin-top: 25px; }
    .section-title { font-weight: bold; font-size: 16px; margin-bottom: 10px; color: #2c3e50; }
    strong { color: #1a5276; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">${note.title}</div>
    <div class="meta">📅 ${note.created_at} • ${note.timestamp} • Chaver AI Sanctuary Journal</div>
  </div>
  <div class="content">${convertBoldToHtml(docContent).replace(/\n/g, "<br>")}</div>
</body>
</html>`;

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.onload = () => {
          printWindow.print();
          setTimeout(() => printWindow.close(), 100);
        };
        triggerSuccessFeedback("Opening PDF print dialog...");
      }
    } else {
      const timestampHeader = `---
Sermon Title : ${note.title}
Date Taken   : ${note.created_at} at ${note.timestamp}
System Source: Chaver AI Automatic Pulpot Monitor
---

`;
      const docText = timestampHeader + docContent;
      const blob = new Blob([docText], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.download = `${cleanFileName}_notes.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      triggerSuccessFeedback("Downloaded Markdown file!");
    }
  };

  // Word & Character count info helper
  const getWordCount = () => {
    const trimmed = noteContent.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  };

return (
    <div className="flex flex-col gap-3 font-sans w-full select-none text-[#E0E0E0] animate-fade-in">
      {userPlan === "free" ? (
        <div className="flex flex-col items-center justify-center text-center p-6 bg-white/5 border border-white/10 rounded-2xl min-h-[380px] gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center animate-pulse">
            <Crown className="w-6 h-6 text-amber-400" />
          </div>
          <h3 className="font-sans font-black text-xs uppercase text-white tracking-wider">
            Upgrade Required
          </h3>
          <p className="text-white/50 text-[11px] leading-relaxed max-w-[240px]">
            Upgrade to the <span className="text-amber-400 font-bold">Monthly Plan</span> to unlock sermon journaling, cloud saves, and upgrade to Yearly for AI Copilot.
          </p>
          <div className="w-full text-center py-2 px-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 font-sans font-bold text-[10px] uppercase">
            🔒 PREMIUM EXCLUSIVE FEATURE
          </div>
<p className="text-white/30 text-[9px] leading-tight">
             Please switch to the 💳 PLANS & BILLING tab in the Control Panel to upgrade!
           </p>
          </div>
        ) : (
        <>
          {/* Tiny active notification channel */}
          {isSuccessAction && (
            <div className="bg-sky-500/10 border border-sky-400/30 text-sky-400 px-2 py-1 text-[9px] font-mono tracking-wider rounded-md text-center flex items-center justify-center gap-1.5 animate-pulse">
              <Sparkles className="w-3 h-3 text-sky-400" />
              <span>{isSuccessAction.toUpperCase()}</span>
            </div>
          )}

      {/* Editor Frame */}
      <form onSubmit={handleSaveNote} className="flex flex-col gap-2.5 bg-white/5 border border-white/8 rounded-xl p-3.5 relative shadow-xl">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-blue-400 uppercase tracking-widest font-bold flex items-center gap-1">
            <Notebook className="w-3 h-3 text-blue-400" /> 
            {editingNoteId ? "Editing Sermon Note" : "Live Sermon Note-Taker"}
          </span>
          <div className="flex items-center gap-1.5">
            {editingNoteId && (
              <button
                type="button"
                onClick={handleResetEditor}
                className="bg-stone-800 hover:bg-stone-700 hover:text-white px-2 py-1 rounded text-[9px] font-mono uppercase tracking-wider text-stone-300 transition-all flex items-center gap-1 cursor-pointer select-none"
                title="Create a new fresh sermon note"
              >
                <Plus className="w-2.5 h-2.5" /> New Slate
              </button>
            )}
          </div>
        </div>

        {/* Note Title Input */}
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">Sermon Subject / Topic</span>
          <input
            type="text"
            placeholder="e.g. Divine Grace in Hard Seasons"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            className="w-full bg-black/40 border border-white/10 hover:border-white/15 focus:border-blue-500 focus:outline-none px-2.5 py-1.5 rounded text-xs text-white"
          />
        </div>

        {/* Advanced quick-inject panel for premium usability */}
        <div className="flex flex-col gap-1 bg-black/30 p-2 rounded-lg border border-white/5">
          <span className="text-[8px] font-mono text-blue-400/80 uppercase tracking-wider block mb-1">
            ⚡ Quick Pulpit Injection Assets
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={handleInsertActiveSlide}
              disabled={!activeProjectedSlide || !activeProjectedSlide.body}
              title={activeProjectedSlide?.body ? "Insert active scripture or lyric slide text instantly" : "Project a slide first to enable quick-insert"}
              className="py-1 px-1.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 disabled:hover:bg-stone-900 border border-white/5 rounded text-[9.5px] font-sans text-stone-300 font-medium transition-colors cursor-pointer select-none flex items-center justify-center gap-1"
            >
              <BookOpen className="w-2.5 h-2.5 text-sky-400 shrink-0" />
              <span className="truncate">Insert Cast Slide</span>
            </button>
            <button
              type="button"
              onClick={handleInsertLiveTranscript}
              disabled={!transcript}
              title={transcript ? "Insert live speech text instantly at bottom" : "Speech transcript buffer empty"}
              className="py-1 px-1.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 disabled:hover:bg-stone-900 border border-white/5 rounded text-[9.5px] font-sans text-stone-300 font-medium transition-colors cursor-pointer select-none flex items-center justify-center gap-1"
            >
              <ClipboardPaste className="w-2.5 h-2.5 text-amber-500 shrink-0" />
              <span className="truncate">Insert Live Quote</span>
            </button>
          </div>
        </div>

        {/* Content Notepad Area */}
        <div className="flex flex-col gap-1 relative">
          <div className="flex justify-between items-center pr-1">
            <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">Preaching journal notes</span>
            <span className="text-[8px] font-mono text-stone-500 uppercase tracking-wider">
              {getWordCount()} words • {noteContent.length} chars
            </span>
          </div>
          <textarea
            ref={textareaRef}
            placeholder="As the Pastor preaches, type key sermon points, verses, thoughts, and revelations here..."
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            rows={6}
            className="w-full bg-black/50 border border-white/10 p-2.5 focus:border-blue-500 focus:outline-none rounded text-xs text-white placeholder-white/20 font-sans leading-relaxed resize-y scrollbar"
          />
        </div>

        {/* Save button and reset */}
        <div className="grid grid-cols-12 gap-2 mt-0.5">
          <button
            type="submit"
            className="col-span-8 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-sans font-bold text-xs py-2 rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-900/15"
          >
            <Save className="w-3.5 h-3.5 shrink-0" />
            <span>{editingNoteId ? "Update Sermon Note" : "Save Sermon Note"}</span>
          </button>
          <button
            type="button"
            onClick={handleResetEditor}
            disabled={!noteContent && !noteTitle}
            className="col-span-4 bg-stone-900 hover:bg-stone-850 disabled:opacity-40 select-none text-stone-300 font-sans font-medium text-xs py-2 rounded-lg cursor-pointer border border-white/5 transition-colors flex items-center justify-center gap-1"
          >
            <RotateCcw className="w-3 h-3 shrink-0" />
            <span>Reset</span>
          </button>
        </div>

{/* AI Copilot Outline builder (unlocked only for Yearly Premium) */}
         <div className="pt-1 text-left">
           <button
             type="button"
             onClick={handleTriggerAiOutline}
             disabled={isGeneratingOutline}
             className={`w-full font-sans font-bold text-xs py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-md ${
               userPlan === "yearly"
                 ? "bg-gradient-to-r from-amber-500/15 to-teal-500/15 hover:from-amber-500/25 hover:to-teal-500/25 border border-teal-500/35 text-teal-300 cursor-pointer"
                 : "bg-stone-900/60 border border-white/5 text-stone-500 cursor-pointer hover:border-amber-500/20"
             }`}
           >
             {isGeneratingOutline ? (
               <div className="w-3.5 h-3.5 border-2 border-teal-400/30 border-t-teal-400 rounded-full animate-spin" />
             ) : (
               <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
             )}
             <span>AI Sermon Copilot Outline</span>
             {userPlan !== "yearly" && <Lock className="w-2.5 h-2.5 text-amber-500 shrink-0" />}
           </button>
         </div>

         {/* AI Notes Refinement button (unlocked only for Yearly Premium) */}
         <div className="pt-1 text-left">
           <button
             type="button"
             onClick={handleRefineNotes}
             disabled={isRefiningNotes}
             className={`w-full font-sans font-bold text-xs py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-md ${
               userPlan === "yearly"
                 ? "bg-gradient-to-r from-emerald-500/15 to-cyan-500/15 hover:from-emerald-500/25 hover:to-cyan-500/25 border border-cyan-500/35 text-cyan-300 cursor-pointer"
                 : "bg-stone-900/60 border border-white/5 text-stone-500 cursor-pointer hover:border-amber-500/20"
             }`}
           >
             {isRefiningNotes ? (
               <div className="w-3.5 h-3.5 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
             ) : (
               <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
             )}
             <span>AI Structure & Refine Notes</span>
             {userPlan !== "yearly" && <Lock className="w-2.5 h-2.5 text-amber-500 shrink-0" />}
           </button>
         </div>
       </form>

      {/* Library of Preserved Sermon Notes */}
      <div className="mt-2.5">
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <span className="text-[9.5px] font-mono text-white/40 uppercase tracking-widest font-bold">
            📚 PRESERVED NOTES JOURNAL ({savedNotes.length})
          </span>
          {savedNotes.length > 0 && (
            showPurgeConfirm ? (
              <div className="flex items-center gap-1.5 text-[9px] font-mono animate-fade-in bg-red-950/30 border border-red-500/20 px-2 py-0.5 rounded-md">
                <span className="text-red-400 font-bold uppercase tracking-wider text-[8.5px]">Clear all notes?</span>
                <button
                  onClick={() => handleClearAllNotes(true)}
                  className="bg-red-600 px-1.5 py-0.2 rounded text-white font-extrabold hover:bg-red-500 transition cursor-pointer select-none"
                >
                  Yes
                </button>
                <button
                  onClick={() => setShowPurgeConfirm(false)}
                  className="bg-stone-850 px-1.5 py-0.2 rounded text-stone-300 hover:bg-stone-700 transition cursor-pointer select-none"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleClearAllNotes(false)}
                className="text-[9px] text-red-400 hover:text-red-300 hover:underline cursor-pointer select-none font-mono uppercase transition-colors"
              >
                Purge Journal
              </button>
            )
          )}
        </div>

        {savedNotes.length === 0 ? (
          <div className="bg-black/20 rounded-xl border border-white/5 p-4 text-center text-[10px] leading-relaxed font-mono text-white/30 italic">
            📖 Your Sanctuary journal is currently empty. Write your first sermon note above and click "Save" to build your private spiritual library.
          </div>
        ) : (
          <div className="space-y-2 max-h-[260px] overflow-y-auto scrollbar pr-1">
            {savedNotes.map((note) => (
              <div
                key={note.id}
                onClick={() => handleLoadNote(note)}
                className={`w-full text-left p-3 rounded-xl border transition-all duration-150 cursor-pointer select-none relative group ${
                  editingNoteId === note.id 
                    ? "bg-blue-600/10 border-blue-500/50 hover:bg-blue-600/12 shadow-sm shadow-blue-950/20" 
                    : "bg-[#181a1f] border-white/5 hover:border-white/12 hover:bg-[#1e2026]"
                }`}
              >
                {/* Header info */}
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-[8.5px] font-mono text-[#8b9bb4]">
                    📅 {note.created_at} — {note.timestamp}
                  </span>
                  
                  {pendingDeleteId === note.id ? (
                    <div className="flex items-center gap-1.5 bg-red-950/45 border border-red-500/30 px-1.5 py-0.5 rounded text-[8px] animate-pulse">
                      <span className="text-red-400 font-bold uppercase text-[7px] tracking-wider">Delete?</span>
                      <button
                        onClick={(e) => handleDeleteNote(note.id, e, true)}
                        className="bg-red-600 hover:bg-red-500 text-white font-extrabold px-1 py-0.2 rounded transition cursor-pointer"
                      >
                        Yes
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingDeleteId(null);
                        }}
                        className="bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold px-1 py-0.2 rounded transition cursor-pointer"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadNote(note);
                        }}
                        title="Export as Markdown text file"
                        className="p-1 rounded transition text-stone-400 hover:text-sky-400 hover:bg-stone-800"
                      >
                        <FileDown className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadNote(note, undefined, true);
                        }}
                        title="Export as PDF (opens print dialog)"
                        className="p-1 rounded transition text-stone-400 hover:text-emerald-400 hover:bg-stone-800"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteNote(note.id, e)}
                        title="Delete sermon note"
                        className="p-1 text-stone-400 hover:text-red-400 hover:bg-stone-800 rounded transition"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Sermon Note Content preview */}
                <h4 className="font-sans font-bold text-xs text-white uppercase tracking-wide truncate mb-1">
                  {note.title}
                </h4>
                <p className="text-white/50 text-[10.5px] leading-relaxed line-clamp-3 whitespace-pre-line">
                  {note.content}
                </p>

                {/* Indicator that it is currently loaded in active space */}
                {editingNoteId === note.id && (
                  <div className="absolute right-3.5 bottom-2.5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                    <span className="text-[8px] font-mono uppercase tracking-wider text-blue-400 font-bold">Loaded</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

{/* AI OUTLINE DISPLAY MODAL */}
       {showOutlineModal && (
         <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
           <div className="w-full max-w-2xl bg-[#111317] border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col max-h-[85vh] shadow-2xl relative text-left">
             <button
               onClick={() => setShowOutlineModal(false)}
               className="absolute top-5 right-5 p-1 rounded-lg text-stone-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
             >
               <X className="w-4 h-4" />
             </button>

             <div className="flex items-center gap-2 border-b border-white/5 pb-4 mb-4">
               <Crown className="w-5 h-5 text-amber-400" />
               <div>
                 <h3 className="font-sans font-black text-sm uppercase text-white tracking-tight">AI Copilot Sermon Outline</h3>
                 <span className="text-[9px] font-mono text-teal-400 uppercase tracking-widest font-bold">Generated based on rough journal notes</span>
               </div>
             </div>

             <div className="flex-1 overflow-y-auto text-xs text-stone-300 space-y-4 pr-1 leading-relaxed font-sans scrollbar-thin scrollbar-thumb-white/10 whitespace-pre-wrap select-text">
               {generatedOutline}
             </div>

             <div className="mt-6 pt-4 border-t border-white/5 flex justify-end gap-3">
               <button
                 type="button"
                 onClick={() => {
                   setNoteContent((prev) => prev + "\n\n---\n\n" + generatedOutline);
                   setShowOutlineModal(false);
                   triggerSuccessFeedback("Appended outline to note editor!");
                 }}
                 className="bg-teal-600 hover:bg-teal-500 text-white font-sans font-bold text-xs px-5 py-2.5 rounded-lg cursor-pointer transition"
               >
                 Append to Editor
               </button>
               <button
                 type="button"
                 onClick={() => setShowOutlineModal(false)}
                 className="bg-stone-850 hover:bg-stone-750 text-stone-300 font-sans font-bold text-xs px-5 py-2.5 rounded-lg cursor-pointer transition border border-white/5"
               >
                 Dismiss Outline
               </button>
             </div>
           </div>
         </div>
       )}

       {/* AI REFINED NOTES DISPLAY MODAL */}
       {showRefineModal && (
         <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
           <div className="w-full max-w-2xl bg-[#111317] border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col max-h-[85vh] shadow-2xl relative text-left">
             <button
               onClick={() => setShowRefineModal(false)}
               className="absolute top-5 right-5 p-1 rounded-lg text-stone-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
             >
               <X className="w-4 h-4" />
             </button>

             <div className="flex items-center gap-2 border-b border-white/5 pb-4 mb-4">
               <Sparkles className="w-5 h-5 text-cyan-400" />
               <div>
                 <h3 className="font-sans font-black text-sm uppercase text-white tracking-tight">AI Structured Notes</h3>
                 <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-widest font-bold">Enhanced for clarity and understanding</span>
               </div>
             </div>

             <div className="flex-1 overflow-y-auto text-xs text-stone-300 space-y-4 pr-1 leading-relaxed font-sans scrollbar-thin scrollbar-thumb-white/10 whitespace-pre-wrap select-text">
               {refinedNotes}
             </div>

<div className="mt-6 pt-4 border-t border-white/5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setNoteContent(refinedNotes);
                    setShowRefineModal(false);
                    triggerSuccessFeedback("Refined notes applied to editor!");
                  }}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white font-sans font-bold text-xs px-5 py-2.5 rounded-lg cursor-pointer transition"
                >
                  Use Refined Notes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${noteTitle || "Refined Notes"}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 40px; line-height: 1.6; color: #333; background: #fff; }
    .header { border-bottom: 2px solid #555; padding-bottom: 20px; margin-bottom: 30px; }
    .title { font-size: 28px; font-weight: bold; margin-bottom: 10px; text-transform: uppercase; color: #2c3e50; }
    .meta { font-size: 12px; color: #666; }
    .content { font-size: 14px; white-space: pre-wrap; }
    .section { margin-top: 25px; }
    .section-title { font-weight: bold; font-size: 16px; margin-bottom: 10px; color: #2c3e50; }
    strong { color: #1a5276; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">${noteTitle || "Refined Notes"}</div>
    <div class="meta">📅 ${new Date().toLocaleDateString()} • Chaver AI Sanctuary Journal</div>
  </div>
  <div class="content">${convertBoldToHtml(refinedNotes).replace(/\n/g, "<br>")}</div>
</body>
</html>`;
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                      printWindow.document.write(htmlContent);
                      printWindow.document.close();
                      printWindow.onload = () => {
                        printWindow.print();
                        setTimeout(() => printWindow.close(), 100);
                      };
                      triggerSuccessFeedback("Opening PDF print dialog...");
                    }
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-sans font-bold text-xs px-5 py-2.5 rounded-lg cursor-pointer transition flex items-center gap-1"
                >
                  <Download className="w-3 h-3" /> Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => setShowRefineModal(false)}
                  className="bg-stone-850 hover:bg-stone-750 text-stone-300 font-sans font-bold text-xs px-5 py-2.5 rounded-lg cursor-pointer transition border border-white/5"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}
         </>
        )}
     </div>
   );
 }
