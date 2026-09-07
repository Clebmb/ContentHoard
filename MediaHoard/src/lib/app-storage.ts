"use client";

type StorageResponse = {
    value: string | null;
};

const endpoint = "/api/app-storage";

const readLocal = (key: string) => {
    if (typeof window === "undefined") return null;
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
};

const writeLocal = (key: string, value: string) => {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(key, value);
    } catch {}
};

const removeLocal = (key: string) => {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.removeItem(key);
    } catch {}
};

export const getAppStorageItem = async (key: string) => {
    try {
        const response = await fetch(`${endpoint}?key=${encodeURIComponent(key)}`, {
            method: "GET",
            cache: "no-store",
        });
        if (response.ok) {
            const payload = await response.json() as StorageResponse;
            if (payload.value !== null) {
                writeLocal(key, payload.value);
                return payload.value;
            }
        }
    } catch {}

    const localValue = readLocal(key);
    if (localValue !== null) {
        void setAppStorageItem(key, localValue);
    }
    return localValue;
};

export const setAppStorageItem = async (key: string, value: string) => {
    writeLocal(key, value);

    await fetch(endpoint, {
        method: "POST",
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify({ key, value }),
    }).catch(() => undefined);
};

export const removeAppStorageItem = async (key: string) => {
    removeLocal(key);

    await fetch(`${endpoint}?key=${encodeURIComponent(key)}`, {
        method: "DELETE",
    }).catch(() => undefined);
};
