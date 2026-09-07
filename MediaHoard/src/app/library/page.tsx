"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useLibrary, MetaItem } from "@/hooks/use-library";
import { motion, AnimatePresence } from "framer-motion";
import { IconPickerDialog } from "@/components/ui/icon-picker-dialog";
import { isDesktopShell } from "@/lib/desktop-player";

type DropTarget = {
  type: "folder" | "breadcrumb";
  id?: string;
};

type PendingDrag = {
  item: MetaItem;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

type DragOverlay = {
  item: MetaItem;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

export default function LibraryPage() {
  const { library, isLoaded, updateLibrary, addFiles, addDirectory, createFolder, editItem, reorderItems, moveItem } = useLibrary();
  const desktopShell = isDesktopShell();
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragPreviewItems, setDragPreviewItems] = useState<MetaItem[] | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [dragOverlay, setDragOverlay] = useState<DragOverlay | null>(null);
  const pendingDragRef = useRef<PendingDrag | null>(null);
  const dragPreviewItemsRef = useRef<MetaItem[] | null>(null);
  const dropTargetRef = useRef<DropTarget | null>(null);
  const dragMovedRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const [editingItem, setEditingItem] = useState<MetaItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [editIconColor, setEditIconColor] = useState("#FFFFFF");
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);

  const currentItems = useMemo(() => {
    const orderByParent = library
      .filter(i => {
        if (currentFolderId) return i.parentId === currentFolderId;
        return !i.parentId;
      })
      .map((item, index) => ({ item, index }))
      .sort((a, b) => (a.item.order ?? a.index) - (b.item.order ?? b.index))
      .map(({ item }) => item);

    let items = orderByParent;

    if (searchQuery) {
      items = items.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    return items;
  }, [library, currentFolderId, searchQuery]);

  const visibleItems = dragPreviewItems ?? currentItems;

  const setPreviewItems = (items: MetaItem[] | null) => {
    dragPreviewItemsRef.current = items;
    setDragPreviewItems(items);
  };

  const setActiveDropTarget = (target: DropTarget | null) => {
    dropTargetRef.current = target;
    setDropTarget(target);
  };

  const breadcrumbs = useMemo(() => {
    const crumbs = [];
    let curr = currentFolderId;
    while (curr) {
      const folder = library.find(i => i.id === curr);
      if (folder) {
        crumbs.unshift(folder);
        curr = folder.parentId;
      } else {
        break;
      }
    }
    return crumbs;
  }, [library, currentFolderId]);

  const handleDelete = (id: string) => {
    const idsToDelete = new Set<string>();
    
    const findDescendants = (parentId: string) => {
      idsToDelete.add(parentId);
      library.forEach(item => {
        if (item.parentId === parentId) {
          if (item.isFolder) {
            findDescendants(item.id);
          } else {
            idsToDelete.add(item.id);
          }
        }
      });
    };
    
    findDescendants(id);
    updateLibrary(library.filter(i => !idsToDelete.has(i.id)));
  };

  const handleEdit = (item: MetaItem) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditColor(item.folderColor || "#397EE0");
    setEditIcon(item.folderIcon || "");
    setEditIconColor(item.iconColor || "#FFFFFF");
    setIsEditModalOpen(true);
  };

  const saveEdit = async () => {
    if (!editingItem) return;
    
    if (editingItem.id === 'new') {
        await createFolder(editName, editingItem.parentId, editColor, editIcon, editIconColor);
    } else {
        await editItem(editingItem.id, {
          name: editName,
          folderColor: editingItem.isFolder ? editColor : undefined,
          folderIcon: editingItem.isFolder ? editIcon : undefined,
          iconColor: editingItem.isFolder ? editIconColor : undefined
        });
    }
    setIsEditModalOpen(false);
    setEditingItem(null);
  };


  const isDescendantFolder = (folderId: string, possibleAncestorId: string) => {
    let curr: string | undefined = folderId;
    while (curr) {
      if (curr === possibleAncestorId) return true;
      curr = library.find(i => i.id === curr)?.parentId;
    }
    return false;
  };

  const getFolderDropTarget = (target: Element, x: number, y: number, item: MetaItem): DropTarget | null => {
    const folderTarget = target.closest<HTMLElement>("[data-folder-id]");
    if (!folderTarget) return null;

    const folderId = folderTarget.getAttribute("data-folder-id");
    if (!folderId || folderId === item.id) return null;
    if (item.isFolder && isDescendantFolder(folderId, item.id)) return null;

    const rect = folderTarget.getBoundingClientRect();
    const isCenterDrop =
      x > rect.left + rect.width * 0.12 &&
      x < rect.right - rect.width * 0.12 &&
      y > rect.top &&
      y < rect.bottom;

    return isCenterDrop ? { type: "folder", id: folderId } : null;
  };

  const getBreadcrumbDropTarget = (target: Element, item: MetaItem): DropTarget | null => {
    const breadcrumbTarget = target.closest<HTMLElement>("[data-breadcrumb-id]");
    if (!breadcrumbTarget) return null;

    const breadcrumbId = breadcrumbTarget.getAttribute("data-breadcrumb-id");
    const id = breadcrumbId === "root" ? undefined : breadcrumbId || undefined;
    if (id === item.id || (id && item.isFolder && isDescendantFolder(id, item.id))) return null;

    return { type: "breadcrumb", id };
  };

  const resetDragState = () => {
    setPreviewItems(null);
    setActiveDropTarget(null);
    setDragOverlay(null);
    pendingDragRef.current = null;
    setIsDragging(false);
    setTimeout(() => setDraggedItemId(null), 80);
  };

  const getDraggedCardVisual = () => {
    if (dropTarget?.type === "breadcrumb") return { scale: 0.45, opacity: 0.7, rotate: 0 };
    if (dropTarget?.type === "folder") return { scale: 0.85, opacity: 0.8, rotate: 0 };
    return { scale: 1.05, opacity: 0.9, rotate: 2 };
  };

  const updatePreviewOrder = (item: MetaItem, x: number, y: number) => {
    if (searchQuery) return;

    const currentPreview = dragPreviewItemsRef.current ?? currentItems;
    const withoutDragged = currentPreview.filter(i => i.id !== item.id);
    
    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-item-id]"))
      .filter(el => el.dataset.itemId !== item.id && !el.dataset.dragOverlay);
      
    if (elements.length === 0) return;

    const itemsWithRects = elements.map(el => ({
      id: el.dataset.itemId!,
      rect: el.getBoundingClientRect()
    }));

    const rows: { top: number; items: typeof itemsWithRects }[] = [];
    itemsWithRects.forEach(item => {
      let row = rows.find(r => Math.abs(r.top - item.rect.top) < 25);
      if (!row) {
        row = { top: item.rect.top, items: [] };
        rows.push(row);
      }
      row.items.push(item);
    });

    rows.sort((a, b) => a.top - b.top);
    rows.forEach(r => r.items.sort((a, b) => a.rect.left - b.rect.left));

    let targetIndex = withoutDragged.length;
    let found = false;

    for (let rIndex = 0; rIndex < rows.length; rIndex++) {
      const row = rows[rIndex];
      const rowBottom = Math.max(...row.items.map(i => i.rect.bottom));
      
      if (y < rowBottom + 15) {
        for (let iIndex = 0; iIndex < row.items.length; iIndex++) {
          const { id, rect } = row.items[iIndex];
          if (x < rect.left + rect.width / 2) {
            const itemIndex = withoutDragged.findIndex(i => i.id === id);
            if (itemIndex !== -1) targetIndex = itemIndex;
            found = true;
            break;
          }
        }
        if (!found) {
          const lastItemInRow = row.items[row.items.length - 1];
          const itemIndex = withoutDragged.findIndex(i => i.id === lastItemInRow.id);
          if (itemIndex !== -1) targetIndex = itemIndex + 1;
          found = true;
        }
        break;
      }
    }

    const nextItems = [...withoutDragged];
    nextItems.splice(targetIndex, 0, item);

    const currentIds = currentPreview.map(i => i.id).join("|");
    const nextIds = nextItems.map(i => i.id).join("|");
    if (currentIds !== nextIds) setPreviewItems(nextItems);
  };

  const beginDrag = (pending: PendingDrag, x: number, y: number) => {
    dragMovedRef.current = true;
    setDraggedItemId(pending.item.id);
    setIsDragging(true);
    setPreviewItems(currentItems);
    setDragOverlay({
      item: pending.item,
      x: x - pending.offsetX,
      y: y - pending.offsetY,
      offsetX: pending.offsetX,
      offsetY: pending.offsetY,
      width: pending.width,
      height: pending.height
    });
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>, item: MetaItem) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button")) return;

    const rect = event.currentTarget.getBoundingClientRect();
    dragMovedRef.current = false;
    pendingDragRef.current = {
      item,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height
    };
  };

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const pending = pendingDragRef.current;
      if (!pending) return;

      const movedEnough = Math.hypot(event.clientX - pending.startX, event.clientY - pending.startY) > 5;
      if (!dragOverlay && !movedEnough) return;
      if (!dragOverlay) beginDrag(pending, event.clientX, event.clientY);

      const activeOverlay = dragOverlay ?? {
        item: pending.item,
        offsetX: pending.offsetX,
        offsetY: pending.offsetY,
        width: pending.width,
        height: pending.height
      };

      setDragOverlay({
        item: pending.item,
        x: event.clientX - activeOverlay.offsetX,
        y: event.clientY - activeOverlay.offsetY,
        offsetX: activeOverlay.offsetX,
        offsetY: activeOverlay.offsetY,
        width: activeOverlay.width,
        height: activeOverlay.height
      });

      const target = document.elementFromPoint(event.clientX, event.clientY);
      if (!target) return;

      const nextDropTarget = getBreadcrumbDropTarget(target, pending.item) ?? getFolderDropTarget(target, event.clientX, event.clientY, pending.item);
      setActiveDropTarget(nextDropTarget);

      if (!nextDropTarget) updatePreviewOrder(pending.item, event.clientX, event.clientY);
    };

    const handlePointerUp = () => {
      const pending = pendingDragRef.current;
      if (!pending) return;

      const finalDropTarget = dropTargetRef.current;
      const finalPreviewItems = dragPreviewItemsRef.current;
      const didDrag = dragMovedRef.current;
      resetDragState();

      if (!didDrag) return;
      if (finalDropTarget) {
        moveItem(pending.item.id, finalDropTarget.id);
        return;
      }

      if (finalPreviewItems && !searchQuery) reorderItems(finalPreviewItems);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [beginDrag, currentItems, dragOverlay, getBreadcrumbDropTarget, getFolderDropTarget, moveItem, reorderItems, resetDragState, searchQuery, updatePreviewOrder]);

  const getMediaCard = (item: MetaItem, index: number) => (
    <motion.div
      key={item.id}
      layout
      onPointerDown={(e) => handlePointerDown(e, item)}
      whileHover={item.isFolder && !draggedItemId ? { scale: 0.97 } : {}}
      animate={dropTarget?.type === "folder" && dropTarget.id === item.id ? { scale: 1.05 } : { scale: 1 }}
      transition={{ type: "spring" as const, stiffness: 500, damping: 40, mass: 0.7 }}
      className={`group relative flex flex-col gap-2 cursor-grab active:cursor-grabbing w-full transition-opacity duration-200 select-none ${
        dropTarget?.type === "folder" && dropTarget.id === item.id ? "opacity-80" : ""
      } ${
        isDragging ? "" : "animate-in fade-in zoom-in-95 duration-500 fill-mode-both"
      } ${draggedItemId === item.id ? "z-10" : "z-0"}`}
      style={{ position: "relative", animationDelay: isDragging ? "0ms" : `${Math.min(index * 30, 500)}ms` }}
      data-item-id={item.id}
      data-folder-id={item.isFolder ? item.id : undefined}
      onClick={() => {
        if (draggedItemId) return;
        if (item.isFolder) {
          setCurrentFolderId(item.id);
        }
      }}
    >
      {draggedItemId === item.id && (
        <div className="absolute inset-0 rounded-xl border-2 border-dashed border-white/20 bg-white/5 animate-pulse flex items-center justify-center">
            <div className="w-1/2 h-1/2 rounded-full bg-white/5 blur-2xl" />
        </div>
      )}

      <div className={`aspect-[2/3] w-full rounded-xl overflow-hidden bg-surface-container-low border border-white/10 relative shadow-[0_0_30px_rgba(255,255,255,0.2)] group-hover:shadow-[0_0_60px_rgba(255,255,255,0.6),0_0_100px_rgba(255,255,255,0.25)] transition-all duration-300 ${
        draggedItemId === item.id ? "opacity-0" : ""
      } ${
        item.isFolder ? "group-hover:scale-[0.98]" : "group-hover:-translate-y-2"
      } ${
        dropTarget?.type === "folder" && dropTarget.id === item.id ? "ring-2 ring-white/80 ring-offset-2 ring-offset-background shadow-[0_0_40px_rgba(255,255,255,0.4)]" : ""
      }`}>
        {item.isFolder ? (
          <div
            className="w-full h-full flex flex-col items-center justify-center p-4 transition-all duration-500 relative"
            style={{ backgroundColor: item.folderColor ? item.folderColor : 'rgba(255,255,255,0.05)' }}
          >
            {item.folderIcon ? (
              item.folderIcon.includes('://') || item.folderIcon.startsWith('data:') ? (
                <img src={item.folderIcon} alt="" className="w-24 h-24 object-contain drop-shadow-xl z-10" />
              ) : (
                <span className="material-symbols-outlined text-[64px] z-10" style={{ color: item.iconColor || 'white' }}>{item.folderIcon}</span>
              )
            ) : (
              <span className="material-symbols-outlined text-[64px] mb-2 relative z-10" style={{ color: item.iconColor || 'rgba(255,255,255,0.5)' }}>folder</span>
            )}
            {/* Subtle gloss on folder */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
          </div>
        ) : item.poster ? (
          <>
            <img
              src={item.poster}
              alt={item.name}
              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
              <button className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center mx-auto mb-4 shadow-lg scale-0 group-hover:scale-100 transition-transform duration-300 delay-100">
                <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
              </button>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-white/5 text-white/20">
            <span className="material-symbols-outlined text-[48px]">movie</span>
          </div>
        )}
        
        <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(item);
            }}
            className="w-8 h-8 rounded-full bg-black/50 hover:bg-white hover:text-black text-white flex items-center justify-center transition-all shadow-lg"
            title="Edit"
          >
            <span className="material-symbols-outlined text-[16px]">edit</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(item.id);
            }}
            className="w-8 h-8 rounded-full bg-black/50 hover:bg-error text-white flex items-center justify-center transition-all shadow-lg"
            title="Delete"
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
      </div>
      <div className={`px-1 overflow-hidden transition-opacity ${draggedItemId === item.id ? "opacity-0" : ""}`}>
        <h3 className="truncate text-sm md:text-base font-bold text-white group-hover:text-white transition-all">
          {item.name}
        </h3>
        <div className="flex items-center justify-between text-xs text-white/50 mt-1">
          <span className="capitalize">{item.type}</span>
          {item.localOnly && <span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-white/70 font-bold uppercase tracking-wider">Local</span>}
        </div>
      </div>
    </motion.div>
  );

  return (
    <main className="flex-1 flex flex-col relative w-full min-h-screen pt-32 pb-32 md:pb-16 px-6">
      <div className="max-w-[1440px] mx-auto w-full flex-1 flex flex-col md:flex-row gap-8 animate-in fade-in duration-200">
        
        {/* Left Sidebar */}
        <aside className="w-full md:w-64 shrink-0 flex flex-col gap-6">
          <div className="sticky top-32">
            <h2 className="text-headline-md text-white mb-4 px-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[24px]">video_library</span>
              Library
            </h2>
            
            <div className="mt-6 px-3 flex flex-col gap-3">
              <button 
                onClick={() => {
                    setEditingItem({
                      id: 'new',
                      name: '',
                      type: 'folder',
                      poster: '',
                      isFolder: true,
                      parentId: currentFolderId
                    });
                    setEditName("");
                    setEditColor("#397EE0");
                    setEditIcon("");
                    setEditIconColor("#FFFFFF");
                    setIsEditModalOpen(true);
                }}
                className="w-full bg-white text-black hover:bg-white/90 px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg hover:scale-105 active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px]">create_new_folder</span>
                Create Folder
              </button>

              <button 
                onClick={() => addDirectory(currentFolderId)}
                className="w-full bg-surface-container-high hover:bg-surface-bright text-white px-4 py-3 rounded-xl text-sm font-semibold transition-all border border-white/5 flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
              >
                <span className="material-symbols-outlined text-[18px]">folder_open</span>
                Add Folder
              </button>
              
              <button 
                onClick={() => addFiles(currentFolderId)}
                className="w-full bg-surface-container-high hover:bg-surface-bright text-white px-4 py-3 rounded-xl text-sm font-semibold transition-all border border-white/5 flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
              >
                <span className="material-symbols-outlined text-[18px]">note_add</span>
                Add Files
              </button>
            </div>

            <div className="mt-8 px-3">
              <p className="text-[10px] text-white/40 leading-relaxed italic">
                {desktopShell
                  ? "Desktop imports use native file and folder pickers so local media stays available across app restarts."
                  : "Local files are processed directly in your browser. Video thumbnails are generated automatically."}
              </p>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <section className="flex-1 flex flex-col gap-6">
          
          {/* Top Bar (Breadcrumbs & Search) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container/30 border border-white/5 p-3 rounded-2xl backdrop-blur-md">
            
            <div className="flex items-center flex-wrap gap-1 px-2 text-sm font-medium text-white/70">
              <motion.button
                onClick={() => setCurrentFolderId(undefined)}
                whileHover={{ scale: 0.9, opacity: 0.75 }}
                data-breadcrumb-id="root"
                className={`transition-all duration-300 px-2 py-1 rounded-md border-2 border-transparent hover:border-white/20 active:scale-75 ${
                  !currentFolderId ? "bg-white/10 text-white" : ""
                } ${
                  dropTarget?.type === "breadcrumb" && !dropTarget.id ? "bg-white/20 text-white ring-1 ring-white/50" : ""
                }`}
              >
                Root
              </motion.button>
              {breadcrumbs.map((crumb, idx) => (
                <div key={crumb.id} className="flex items-center gap-1" data-breadcrumb-id={crumb.id}>
                  <span className="material-symbols-outlined text-[16px] opacity-50">chevron_right</span>
                  <motion.button
                    onClick={() => setCurrentFolderId(crumb.id)}
                    whileHover={{ scale: 0.9, opacity: 0.75 }}
                    data-breadcrumb-id={crumb.id}
                    className={`transition-all duration-300 px-2 py-1 rounded-md max-w-[120px] truncate border-2 border-transparent hover:border-white/20 active:scale-75 ${
                      idx === breadcrumbs.length - 1 ? "bg-white/10 text-white" : ""
                    } ${
                      dropTarget?.type === "breadcrumb" && dropTarget.id === crumb.id ? "bg-white/40 text-white ring-2 ring-white/80 ring-offset-2 ring-offset-background shadow-[0_0_20px_rgba(255,255,255,0.3)]" : ""
                    }`}
                  >
                    {crumb.name}
                  </motion.button>
                </div>
              ))}
            </div>

            <div className="relative w-full sm:w-64 shrink-0">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-[18px]">search</span>
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search folder..." 
                className="w-full bg-black/20 border border-white/10 text-white placeholder:text-white/40 px-10 py-2 rounded-xl focus:outline-none focus:border-white/30 focus:bg-black/40 text-sm transition-all"
              />
            </div>
          </div>

          {/* Grid */}
          {!isLoaded ? (
             <div className="flex-1 flex items-center justify-center">
               <span className="material-symbols-outlined text-4xl text-white/20 animate-spin">refresh</span>
             </div>
          ) : currentItems.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-y-16 gap-x-6 py-10 -my-10 overflow-visible">
              {visibleItems.map((item, index) => getMediaCard(item, index))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 border border-dashed border-white/10 rounded-3xl bg-surface-container-lowest/30">
              <span className="material-symbols-outlined text-6xl text-white/10 mb-4">
                {searchQuery ? 'search_off' : currentFolderId ? 'folder_open' : 'video_library'}
              </span>
              <h3 className="text-headline-md text-white/80 mb-2">
                {searchQuery ? 'No results found' : currentFolderId ? 'This folder is empty' : 'Your library is empty'}
              </h3>
              <p className="text-body-md text-white/40 max-w-sm">
                {searchQuery 
                  ? 'Try adjusting your search terms.' 
                  : 'Use the buttons on the left to add local video files or directories to your MediaHoard library.'}
              </p>
            </div>
          )}
        </section>

      </div>

      {dragOverlay && (
        <motion.div
          data-drag-overlay="true"
          className="fixed pointer-events-none flex flex-col gap-2 cursor-grabbing"
          style={{
            left: dragOverlay.x,
            top: dragOverlay.y,
            width: dragOverlay.width,
            height: dragOverlay.height,
            zIndex: 99999
          }}
          animate={getDraggedCardVisual()}
          transition={{ type: "spring" as const, stiffness: 500, damping: 42, mass: 0.7 }}
        >
          <div className={`aspect-[2/3] w-full rounded-xl overflow-hidden bg-surface-container-low border border-white/10 relative shadow-[0_30px_80px_rgba(0,0,0,0.65),0_0_60px_rgba(255,255,255,0.45)] ${
            dropTarget?.type === "folder" ? "ring-2 ring-white/80 ring-offset-2 ring-offset-background" : ""
          }`}>
            {dragOverlay.item.isFolder ? (
              <div
                className="w-full h-full flex flex-col items-center justify-center p-4 relative"
                style={{ backgroundColor: dragOverlay.item.folderColor ? dragOverlay.item.folderColor : 'rgba(255,255,255,0.05)' }}
              >
                {dragOverlay.item.folderIcon ? (
                  dragOverlay.item.folderIcon.includes('://') || dragOverlay.item.folderIcon.startsWith('data:') ? (
                    <img src={dragOverlay.item.folderIcon} alt="" className="w-24 h-24 object-contain drop-shadow-xl z-10" />
                  ) : (
                    <span className="material-symbols-outlined text-[64px] z-10" style={{ color: dragOverlay.item.iconColor || 'white' }}>{dragOverlay.item.folderIcon}</span>
                  )
                ) : (
                  <span className="material-symbols-outlined text-[64px] mb-2 relative z-10" style={{ color: dragOverlay.item.iconColor || 'rgba(255,255,255,0.5)' }}>folder</span>
                )}
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
              </div>
            ) : dragOverlay.item.poster ? (
              <img
                src={dragOverlay.item.poster}
                alt={dragOverlay.item.name}
                className="w-full h-full object-cover opacity-100"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-white/5 text-white/20">
                <span className="material-symbols-outlined text-[48px]">movie</span>
              </div>
            )}
          </div>
          <div className="px-1 overflow-hidden">
            <h3 className="truncate text-sm md:text-base font-bold text-white">
              {dragOverlay.item.name}
            </h3>
            <div className="flex items-center justify-between text-xs text-white/50 mt-1">
              <span className="capitalize">{dragOverlay.item.type}</span>
              {dragOverlay.item.localOnly && <span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-white/70 font-bold uppercase tracking-wider">Local</span>}
            </div>
          </div>
        </motion.div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-surface-container-high w-full max-w-md rounded-3xl border border-white/10 p-8 shadow-2xl animate-in zoom-in-95 duration-300">
            <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined">{editingItem?.id === 'new' ? 'create_new_folder' : 'edit'}</span>
              {editingItem?.id === 'new' ? 'Create Folder' : `Edit ${editingItem?.isFolder ? 'Folder' : 'Media'}`}
            </h2>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-white/40 ml-1">Name</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 transition-all"
                />
              </div>

              {editingItem?.isFolder && (
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-white/40 ml-1">Appearance</label>
                  <div className="flex items-start gap-5">
                    {/* Icon Preview & Picker Trigger */}
                      <div 
                        className="w-20 h-20 rounded-2xl border-2 border-white/10 flex items-center justify-center overflow-hidden bg-white/5 relative group shrink-0 shadow-2xl"
                        style={{ backgroundColor: editColor }}
                      >
                        {editIcon ? (
                          editIcon.includes('://') || editIcon.startsWith('data:') ? (
                            <img src={editIcon} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="material-symbols-outlined text-[32px]" style={{ color: editIconColor }}>{editIcon}</span>
                          )
                        ) : (
                          <span className="material-symbols-outlined text-[32px]" style={{ color: editIconColor }}>folder</span>
                        )}
                      <button 
                        onClick={() => setIsIconPickerOpen(true)}
                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer border-none outline-none"
                      >
                        <span className="material-symbols-outlined text-white text-2xl">photo_camera</span>
                      </button>
                    </div>

                    {/* Color Presets & Custom Picker */}
                    <div className="flex-1 space-y-4">
                      <div className="space-y-3">
                        <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">Background Color</p>
                        <div className="flex flex-wrap gap-2.5">
                          {['#39E079', '#E03939', '#397EE0', '#E0A339', '#9C39E0', '#39E0DC', '#FFFFFF'].map(c => (
                            <button 
                              key={c} 
                              onClick={() => setEditColor(c)} 
                              className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${editColor === c ? 'border-white scale-110 ring-2 ring-white/20' : 'border-transparent opacity-60 hover:opacity-100'}`} 
                              style={{ backgroundColor: c }} 
                            />
                          ))}
                          <div className="relative">
                            <button 
                              onClick={() => document.getElementById('folder-color-input')?.click()}
                              className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all border border-white/10"
                              title="Custom Color"
                            >
                              <span className="material-symbols-outlined text-[16px] text-white">colorize</span>
                            </button>
                            <input 
                              id="folder-color-input"
                              type="color" 
                              value={editColor}
                              onChange={(e) => setEditColor(e.target.value)}
                              className="absolute inset-0 opacity-0 w-0 h-0 pointer-events-none"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3 mt-4">
                        <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">Icon Color</p>
                        <div className="flex flex-wrap gap-2.5">
                          {['#FFFFFF', '#000000', '#39E079', '#E03939', '#397EE0', '#E0A339', '#9C39E0'].map(c => (
                            <button 
                              key={c} 
                              onClick={() => setEditIconColor(c)} 
                              className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${editIconColor === c ? 'border-white scale-110 ring-2 ring-white/20' : 'border-transparent opacity-60 hover:opacity-100'}`} 
                              style={{ backgroundColor: c }} 
                            />
                          ))}
                          <div className="relative">
                            <button 
                              onClick={() => document.getElementById('icon-color-input')?.click()}
                              className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all border border-white/10"
                              title="Custom Icon Color"
                            >
                              <span className="material-symbols-outlined text-[16px] text-white">colorize</span>
                            </button>
                            <input 
                              id="icon-color-input"
                              type="color" 
                              value={editIconColor}
                              onChange={(e) => setEditIconColor(e.target.value)}
                              className="absolute inset-0 opacity-0 w-0 h-0 pointer-events-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-10">
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-2xl transition-all border border-white/5"
              >
                Cancel
              </button>
              <button 
                onClick={saveEdit}
                className="flex-1 bg-white text-black hover:bg-white/90 font-black py-3 rounded-2xl transition-all shadow-xl active:scale-95"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Icon Picker Dialog */}
      <IconPickerDialog 
        isOpen={isIconPickerOpen}
        onClose={() => setIsIconPickerOpen(false)}
        onSelectUpload={(url) => setEditIcon(url)}
        onSelectUrl={(url) => setEditIcon(url)}
        onSelectPreset={(name) => setEditIcon(name)}
        onSelectDefault={() => setEditIcon("")}
        hasExistingIcon={!!editIcon}
        title="Folder Icon"
        initialUrl={editIcon && (editIcon.includes('://') || editIcon.startsWith('data:')) ? editIcon : ""}
        presets={['movie', 'tv', 'theaters', 'videocam', 'subscriptions', 'playlist_play', 'library_music', 'album', 'camera_roll', 'auto_stories', 'menu_book', 'collections', 'photo_library', 'folder_zip', 'local_movies']}
      />
    </main>
  );
}
