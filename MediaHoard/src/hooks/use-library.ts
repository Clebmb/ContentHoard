"use client";

import { useState, useEffect, useCallback } from "react";
import { useProfiles } from "@/providers/ProfileProvider";
import { getAppStorageItem, setAppStorageItem } from "@/lib/app-storage";
import { isDesktopShell } from "@/lib/desktop-player";

export interface MetaItem {
    id: string;
    type: string;
    name: string;
    poster: string;
    description?: string;
    releaseInfo?: string;
    background?: string;
    parentId?: string;
    isFolder?: boolean;
    folderColor?: string;
    folderIcon?: string;
    iconColor?: string;
    localPath?: string;
    size?: number;
    localOnly?: boolean;
    order?: number;
    genres?: string[];
}

export interface TmdbSettings {
    apiKey: string;
    readToken?: string;
}

type DirectoryPickerHandle = FileSystemDirectoryHandle & {
    values: () => AsyncIterable<FileSystemHandle>;
};

type FilePickerWindow = Window & typeof globalThis & {
    showOpenFilePicker?: (options?: {
        multiple?: boolean;
        types?: Array<{
            description?: string;
            accept: Record<string, string[]>;
        }>;
    }) => Promise<FileSystemFileHandle[]>;
    showDirectoryPicker?: () => Promise<DirectoryPickerHandle>;
};

type DesktopPickedVideoFile = {
    path: string;
    name: string;
    size: number;
    relative_parent: string;
};

type DesktopPickedVideoDirectory = {
    root_name: string;
    files: DesktopPickedVideoFile[];
};

const DB_NAME_BASE = 'MediaHoardLibrary';
const STORE_NAME = 'library_items';
const HANDLES_STORE = 'file_handles';

const openDB = (profileId?: string): Promise<IDBDatabase> => {
    const dbName = profileId ? `${DB_NAME_BASE}_${profileId}` : DB_NAME_BASE;
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            if (!db.objectStoreNames.contains(HANDLES_STORE)) db.createObjectStore(HANDLES_STORE);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const saveHandleToDB = async (key: string, handle: FileSystemHandle, profileId?: string) => {
    try {
        const db = await openDB(profileId);
        const tx = db.transaction(HANDLES_STORE, 'readwrite');
        tx.objectStore(HANDLES_STORE).put(handle, key);
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) { console.error("DB Handle Save failed", e); }
};

const getHandleFromDB = async (key: string, profileId?: string) => {
    try {
        const db = await openDB(profileId);
        const tx = db.transaction(HANDLES_STORE, 'readonly');
        const request = tx.objectStore(HANDLES_STORE).get(key);

        return await new Promise<FileSystemHandle | null>((resolve, reject) => {
            request.onsuccess = () => resolve((request.result as FileSystemHandle | undefined) ?? null);
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error("DB Handle Load failed", e);
        return null;
    }
};

const parseLocalFileName = (fileName: string): { title: string; year: string | null } => {
    let clean = fileName.replace(/\.[^/.]+$/, "");
    const yearMatch = clean.match(/\b(19\d{2}|20\d{2})\b/);
    const year = yearMatch ? yearMatch[0] : null;

    if (year) {
        clean = clean.split(year)[0];
    }

    clean = clean
        .replace(/[\.\_\-]/g, ' ')
        .replace(/\b(1080p|720p|480p|2160p|4k|8k|uhd|hdtv|webrip|web|dl|bluray|brrip|bdrip|remux)\b/gi, '')
        .replace(/\b(x264|x265|hevc|h264|h265|aac|dts|dd5|ac3|truehd)\b/gi, '')
        .replace(/\b(yts|yify|rarbg|ettv|shaanig|psagame|gaz|fgt|avc|atmos)\b/gi, '')
        .replace(/\b(director'?s cut|extended|unrated|theatrical)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

    return { title: clean, year };
};

const extractVideoThumbnail = (file: File | Blob): Promise<string> => {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;

        const url = URL.createObjectURL(file);
        video.src = url;

        const cleanup = () => {
            URL.revokeObjectURL(url);
            video.remove();
        };

        video.onloadeddata = () => {
            video.currentTime = Math.min(2, video.duration / 4);
        };

        video.onseeked = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                    cleanup();
                    resolve(dataUrl);
                } else {
                    cleanup();
                    resolve('');
                }
            } catch {
                cleanup();
                resolve('');
            }
        };

        video.onerror = () => {
            cleanup();
            resolve('');
        };

        setTimeout(() => {
            cleanup();
            resolve('');
        }, 4000);
    });
};

const extractVideoThumbnailFromUrl = (src: string): Promise<string> => {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        video.src = src;

        const cleanup = () => {
            video.remove();
        };

        video.onloadeddata = () => {
            video.currentTime = Math.min(2, video.duration / 4);
        };

        video.onseeked = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                    cleanup();
                    resolve(dataUrl);
                } else {
                    cleanup();
                    resolve('');
                }
            } catch {
                cleanup();
                resolve('');
            }
        };

        video.onerror = () => {
            cleanup();
            resolve('');
        };

        setTimeout(() => {
            cleanup();
            resolve('');
        }, 4000);
    });
};

const loadDesktopImportApi = async () => {
    const { getElectronApi, convertLocalFileToUrl } = await import("@/lib/electron-desktop");
    const api = getElectronApi();
    if (!api) {
        throw new Error("Desktop import requires the Electron shell.");
    }

    return {
        pickFiles: () => api.pickVideoFiles() as Promise<DesktopPickedVideoFile[]>,
        pickDirectory: () => api.pickVideoDirectory() as Promise<DesktopPickedVideoDirectory | null>,
        convertFileSrc: convertLocalFileToUrl,
    };
};

export function useLibrary() {
    const [library, setLibrary] = useState<MetaItem[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [tmdbSettings, setTmdbSettings] = useState<TmdbSettings | null>(null);
    const { getStorageKey, activeProfile, isLoaded: profilesLoaded } = useProfiles();
    const profileId = activeProfile?.id;

    // Load from DB
    useEffect(() => {
        if (!profilesLoaded) return;

        const load = async () => {
            try {
                const db = await openDB(profileId);
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const request = store.getAll();
                
                request.onsuccess = () => {
                    const res = request.result || [];
                    setLibrary(res.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
                    setIsLoaded(true);
                };
            } catch (e) {
                console.error("Failed to load library", e);
                setIsLoaded(true);
            }

            const storedTmdb = await getAppStorageItem(getStorageKey("mediahoard_tmdb_settings"));
            if (storedTmdb) {
                setTmdbSettings(JSON.parse(storedTmdb));
            }
        };
        load();
    }, [profilesLoaded, profileId, getStorageKey]);

    const updateLibrary = async (newLib: MetaItem[]) => {
        setLibrary(newLib);
        
        // Sync to DB
        try {
            const db = await openDB(profileId);
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            
            // Clear existing and rewrite (simple sync for now)
            await new Promise((resolve) => {
                const clearReq = store.clear();
                clearReq.onsuccess = () => resolve(true);
            });

            newLib.forEach(item => {
                store.put(item);
            });
        } catch (e) {
            console.error("Failed to save library to DB", e);
        }
    };

    const saveTmdbSettings = (settings: TmdbSettings) => {
        setTmdbSettings(settings);
        void setAppStorageItem(getStorageKey("mediahoard_tmdb_settings"), JSON.stringify(settings));
    };

    const getNextOrder = (parentId?: string, items: MetaItem[] = library) => {
        const siblingOrders = items
            .filter(item => item.parentId === parentId)
            .map(item => item.order ?? 0);

        return siblingOrders.length ? Math.max(...siblingOrders) + 1 : 0;
    };

    const isDescendantFolder = (folderId: string, possibleAncestorId: string) => {
        let curr: string | undefined = folderId;
        while (curr) {
            if (curr === possibleAncestorId) return true;
            curr = library.find(item => item.id === curr)?.parentId;
        }
        return false;
    };

    const addFiles = async (currentFolderId?: string) => {
        if (isDesktopShell()) {
            try {
                const desktopApi = await loadDesktopImportApi();
                const selectedFiles = await desktopApi.pickFiles();
                if (!selectedFiles.length) return;

                const nextLibrary = [...library];

                for (const file of selectedFiles) {
                    const posterUrl = await desktopApi.convertFileSrc(file.path);
                    const poster = await extractVideoThumbnailFromUrl(posterUrl);
                    nextLibrary.push({
                        id: crypto.randomUUID(),
                        type: 'movie',
                        name: file.name.replace(/\.[^/.]+$/, ""),
                        poster,
                        parentId: currentFolderId,
                        order: getNextOrder(currentFolderId, nextLibrary),
                        localPath: file.path,
                        size: file.size,
                        localOnly: true
                    });
                }

                await updateLibrary(nextLibrary);
            } catch (error) {
                console.error("Desktop file import failed", error);
            }
            return;
        }

        const pickerWindow = window as FilePickerWindow;
        if (typeof pickerWindow.showOpenFilePicker !== 'function') {
            alert("File System Access API not supported in this browser.");
            return;
        }

        try {
            const handles = await pickerWindow.showOpenFilePicker({
                multiple: true,
                types: [{ description: 'Video Files', accept: { 'video/*': ['.mp4', '.mkv', '.webm', '.avi', '.mov'] } }]
            });

            const newItems: MetaItem[] = [];
            for (const handle of handles) {
                const file = await handle.getFile();
                const id = crypto.randomUUID();

                await saveHandleToDB(id, handle, profileId);

                const thumb = await extractVideoThumbnail(file);
                const item: MetaItem = {
                    id,
                    type: 'movie',
                    name: file.name.replace(/\.[^/.]+$/, ""),
                    poster: thumb,
                    parentId: currentFolderId,
                    order: getNextOrder(currentFolderId, [...library, ...newItems]),
                    localPath: file.name,
                    size: file.size,
                    localOnly: true
                };

                newItems.push(item);
            }
            updateLibrary([...library, ...newItems]);
        } catch (err: unknown) {
            if (!(err instanceof DOMException && err.name === 'AbortError')) console.error("File pick failed", err);
        }
    };

    const addDirectory = async (currentFolderId?: string) => {
        if (isDesktopShell()) {
            try {
                const desktopApi = await loadDesktopImportApi();
                const selectedDirectory = await desktopApi.pickDirectory();
                if (!selectedDirectory) return;

                const nextLibrary = [...library];
                const rootId = crypto.randomUUID();
                const folderIds = new Map<string, string>([["", rootId]]);

                nextLibrary.push({
                    id: rootId,
                    type: 'folder',
                    name: selectedDirectory.root_name,
                    poster: '',
                    isFolder: true,
                    folderColor: '#39E079',
                    parentId: currentFolderId,
                    order: getNextOrder(currentFolderId, nextLibrary),
                    localOnly: true
                });

                for (const file of selectedDirectory.files) {
                    const segments = file.relative_parent ? file.relative_parent.split("/").filter(Boolean) : [];
                    let currentRelative = "";
                    let parentId = rootId;

                    for (const segment of segments) {
                        currentRelative = currentRelative ? `${currentRelative}/${segment}` : segment;
                        let folderId = folderIds.get(currentRelative);

                        if (!folderId) {
                            folderId = crypto.randomUUID();
                            nextLibrary.push({
                                id: folderId,
                                type: 'folder',
                                name: segment,
                                poster: '',
                                isFolder: true,
                                folderColor: '#397EE0',
                                parentId,
                                order: getNextOrder(parentId, nextLibrary),
                                localOnly: true
                            });
                            folderIds.set(currentRelative, folderId);
                        }

                        parentId = folderId;
                    }

                    const posterUrl = await desktopApi.convertFileSrc(file.path);
                    const poster = await extractVideoThumbnailFromUrl(posterUrl);
                    nextLibrary.push({
                        id: crypto.randomUUID(),
                        type: 'movie',
                        name: file.name.replace(/\.[^/.]+$/, ""),
                        poster,
                        parentId,
                        order: getNextOrder(parentId, nextLibrary),
                        localPath: file.path,
                        size: file.size,
                        localOnly: true
                    });
                }

                await updateLibrary(nextLibrary);
            } catch (error) {
                console.error("Desktop directory import failed", error);
            }
            return;
        }

        const pickerWindow = window as FilePickerWindow;
        if (typeof pickerWindow.showDirectoryPicker !== 'function') {
            alert("File System Access API not supported in this browser.");
            return;
        }

        try {
            const dirHandle = await pickerWindow.showDirectoryPicker();
            const rootId = crypto.randomUUID();
            const newItems: MetaItem[] = [];

            newItems.push({
                id: rootId,
                type: 'folder',
                name: dirHandle.name,
                poster: '',
                isFolder: true,
                folderColor: '#39E079',
                parentId: currentFolderId,
                order: getNextOrder(currentFolderId),
                localOnly: true
            });

            const scan = async (handle: DirectoryPickerHandle, parentId: string) => {
                for await (const entry of handle.values()) {
                    if (entry.kind === 'file' && entry.name.match(/\.(mp4|mkv|webm|avi|mov)$/i)) {
                        const fileId = crypto.randomUUID();
                        const fileHandle = entry as FileSystemFileHandle;
                        await saveHandleToDB(fileId, fileHandle);
                        const file = await fileHandle.getFile();
                        
                        const thumb = await extractVideoThumbnail(file);
                        const item: MetaItem = {
                            id: fileId,
                            type: 'movie',
                            name: entry.name.replace(/\.[^/.]+$/, ""),
                            poster: thumb,
                            parentId: parentId,
                            order: getNextOrder(parentId, [...library, ...newItems]),
                            localPath: entry.name,
                            size: file.size,
                            localOnly: true
                        };

                        newItems.push(item);
                    } else if (entry.kind === 'directory') {
                        const directoryHandle = entry as DirectoryPickerHandle;
                        const dirId = crypto.randomUUID();
                        newItems.push({
                            id: dirId,
                            type: 'folder',
                            name: entry.name,
                            poster: '',
                            isFolder: true,
                            folderColor: '#397EE0',
                            parentId: parentId,
                            order: getNextOrder(parentId, [...library, ...newItems]),
                            localOnly: true
                        });
                        await scan(directoryHandle, dirId);
                    }
                }
            };

            await scan(dirHandle, rootId);
            updateLibrary([...library, ...newItems]);
        } catch (err: unknown) {
            if (!(err instanceof DOMException && err.name === 'AbortError')) console.error("Dir pick failed", err);
        }
    };

    const createFolder = async (name: string, parentId?: string, color?: string, icon?: string, iconColor?: string) => {
        const id = crypto.randomUUID();
        const newFolder: MetaItem = {
            id,
            type: 'folder',
            name: name || "New Folder",
            poster: '',
            isFolder: true,
            folderColor: color || '#397EE0',
            folderIcon: icon || '',
            iconColor: iconColor || '#FFFFFF',
            parentId: parentId,
            order: getNextOrder(parentId),
            localOnly: true
        };
        await updateLibrary([...library, newFolder]);
        return newFolder;
    };

    const editItem = async (id: string, updates: Partial<MetaItem>) => {
        const newLib = library.map(item => item.id === id ? { ...item, ...updates } : item);
        await updateLibrary(newLib);
    };

    const getLocalFile = useCallback(async (id: string) => {
        const handle = await getHandleFromDB(id, profileId);
        if (!handle || handle.kind !== 'file') return null;

        try {
            const fileHandle = handle as FileSystemFileHandle;
            return await fileHandle.getFile();
        } catch (e) {
            console.error("Failed to read local file", e);
            return null;
        }
    }, [profileId]);

    const moveItem = async (id: string, newParentId?: string) => {
        if (id === newParentId) return;
        const itemToMove = library.find(item => item.id === id);
        if (!itemToMove) return;
        if (itemToMove.isFolder && newParentId && isDescendantFolder(newParentId, id)) return;

        const nextOrder = getNextOrder(newParentId, library.filter(item => item.id !== id));
        const newLib = library.map(item => item.id === id ? { ...item, parentId: newParentId, order: nextOrder } : item);
        await updateLibrary(newLib);
    };

    const reorderItems = async (items: MetaItem[]) => {
        const updatedLibrary = [...library];
        items.forEach((item, index) => {
            const idx = updatedLibrary.findIndex(i => i.id === item.id);
            if (idx !== -1) {
                updatedLibrary[idx] = { ...updatedLibrary[idx], order: index };
            }
        });
        await updateLibrary(updatedLibrary.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    };

    return {
        library,
        isLoaded,
        updateLibrary,
        reorderItems,
        tmdbSettings,
        saveTmdbSettings,
        addFiles,
        addDirectory,
        createFolder,
        editItem,
        moveItem,
        parseLocalFileName,
        getLocalFile
    };
}
