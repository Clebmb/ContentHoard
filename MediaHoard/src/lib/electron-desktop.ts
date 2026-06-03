"use client";

export const getElectronApi = () => {
    if (typeof window === "undefined") {
        return null;
    }

    return window.mediahoardElectron || null;
};

export const isElectronDesktop = () => Boolean(getElectronApi());

export const convertLocalFileToUrl = async (filePath: string) => {
    const api = getElectronApi();
    if (api) {
        return api.fileUrl(filePath);
    }

    return `file://${filePath}`;
};
