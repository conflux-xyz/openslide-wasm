declare type OpenslideWasmAPI = any;
declare type OpenslidePtr = number;
declare class OpenslideImage {
    imgPtr: OpenslidePtr;
    wasmApi: OpenslideWasmAPI;
    filename: string;
    constructor(wasmApi: OpenslideWasmAPI, imgPtr: OpenslidePtr, filename: string);
    getPropertyNames(): string[];
    getPropertyValue(name: string): string | null;
    getLevelCount(): any;
    getLevelDimensions(level: number): number[];
    getLevelDownsample(level: number): any;
    readRegion(x: number, y: number, level: number, w: number, h: number, readRgba?: boolean): Uint8ClampedArray;
    drawToCanvas(canvas: HTMLCanvasElement, x: number, y: number, level: number, w: number, h: number): void;
    close(): void;
}
declare function cstring(wasmApi: OpenslideWasmAPI, str: string): any;
declare function fetchFileFromUrl(url: string): Promise<File>;
declare function loadFile(wasmApi: OpenslideWasmAPI, file: File): Promise<unknown>;
declare const Module: any;
declare class Openslide {
    private wasmApi;
    isReady: boolean;
    initialize(useWebworker?: boolean): Promise<unknown>;
    open(fileOrUrl: File | string): Promise<OpenslideImage>;
}
