import React, { useState, useEffect, useRef, FormEvent } from "react";
import { ActiveSlide } from "../types";
import { auth, db, handleFirestoreError, OperationType } from "../firebase";
import { collection, query, where, getDocs, setDoc, deleteDoc, doc } from "firebase/firestore";
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
  RotateCcw
} from "lucide-react";

interface SavedSermonNote {
  id: string;
  userId: string;
  title: string;
  content: string;
  createdAt: string;
  timestamp: string;
  rawDate: number;
}

interface SermonNotepadProps {
  sermonTopic: string;
  activeProjectedSlide: ActiveSlide;
  transcript: string;
}

export default function SermonNotepad({
  sermonTopic,
  activeProjectedSlide,
  transcript
}: SermonNotepadProps) {
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

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load saved notes once on load via Cloud Firestore
  useEffect(() => {
    const fetchSermonNotes = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const q = query(
          collection(db, "sermonNotes"),
          where("userId", "==", user.uid)
        );
        const snapshot = await getDocs(q);
        const notes: SavedSermonNote[] = [];
        snapshot.forEach((d) => {
          notes.push(d.data() as SavedSermonNote);
        });
        // Sort descending by rawDate
        notes.sort((a, b) => b.rawDate - a.rawDate);
        setSavedNotes(notes);
      } catch (e) {
        // Log/throw according to instruction error guidelines
        handleFirestoreError(e, OperationType.LIST, "sermonNotes");
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

  // Perform sermon note saving to Cloud Firestore
  const handleSaveNote = async (e: FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
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
      // Modify existing note inside Firestore
      const updatedNote: SavedSermonNote = {
        id: editingNoteId,
        userId: user.uid,
        title: titleVal,
        content: bodyVal,
        createdAt: formattedDate,
        timestamp: formattedTime,
        rawDate: now.getTime(),
      };

      try {
        await setDoc(doc(db, "sermonNotes", editingNoteId), updatedNote);
        const updated = savedNotes.map((note) =>
          note.id === editingNoteId ? updatedNote : note
        );
        setSavedNotes(updated);
        triggerSuccessFeedback("Note updated in cloud diary!");
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `sermonNotes/${editingNoteId}`);
      }
    } else {
      // Create fresh sermon note inside Firestore
      const noteId = `note-${now.getTime()}`;
      const newNote: SavedSermonNote = {
        id: noteId,
        userId: user.uid,
        title: titleVal,
        content: bodyVal,
        createdAt: formattedDate,
        timestamp: formattedTime,
        rawDate: now.getTime(),
      };

      try {
        await setDoc(doc(db, "sermonNotes", noteId), newNote);
        const updated = [newNote, ...savedNotes];
        setSavedNotes(updated);
        setEditingNoteId(newNote.id); // set as active editing session
        triggerSuccessFeedback("Saved note to secure cloud!");
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `sermonNotes/${noteId}`);
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

  // Initiate or complete removal of sermon note inside Firestore
  const handleDeleteNote = async (id: string, e: React.MouseEvent, confirmed = false) => {
    e.stopPropagation(); // preserve accordion toggle triggers
    if (!confirmed) {
      setPendingDeleteId(id);
      return;
    }
    
    try {
      await deleteDoc(doc(db, "sermonNotes", id));
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
      handleFirestoreError(err, OperationType.DELETE, `sermonNotes/${id}`);
    }
  };

  // Clear all notes inside Firestore
  const handleClearAllNotes = async (confirmed = false) => {
    if (!confirmed) {
      setShowPurgeConfirm(true);
      return;
    }

    try {
      // For each saved note, trigger the deleteDoc
      await Promise.all(savedNotes.map((note) => deleteDoc(doc(db, "sermonNotes", note.id))));
      setSavedNotes([]);
      handleResetEditor();
      setShowPurgeConfirm(false);
      triggerSuccessFeedback("Sanctuary cloud journal purged!");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, "sermonNotes");
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
      clipText = `\n\n[Scripture Context — ${activeProjectedSlide.title} (${activeProjectedSlide.translation || "NIV"})]\n"${activeProjectedSlide.body.trim()}"\n`;
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

  // Export note to filesystem as text/markdown document (.md)
  const handleDownloadNote = (note: SavedSermonNote, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const timestampHeader = `---
Sermon Title : ${note.title}
Date Taken   : ${note.createdAt} at ${note.timestamp}
System Source: Chaver AI Automatic Pulpit Monitor
---

`;
    const docText = timestampHeader + note.content;
    const blob = new Blob([docText], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    // Clean up filename
    const cleanFileName = note.title.toLowerCase().replace(/[^a-z0-8 ]/g, "").replace(/\s+/g, "_") || "sermon_notes";
    link.href = url;
    link.download = `${cleanFileName}_notes.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    triggerSuccessFeedback("Downloaded Markdown file!");
  };

  // Word & Character count info helper
  const getWordCount = () => {
    const trimmed = noteContent.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  };

  return (
    <div className="flex flex-col gap-3 font-sans w-full select-none text-[#E0E0E0] animate-fade-in">
      
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
                    📅 {note.createdAt} — {note.timestamp}
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
                        className="p-1 text-stone-400 hover:text-sky-400 hover:bg-stone-800 rounded transition"
                      >
                        <FileDown className="w-3 h-3" />
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

    </div>
  );
}
