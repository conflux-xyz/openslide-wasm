declare type OpenSlideWasmAPI = any;
declare type OpenSlidePtr = number;
export declare class OpenSlideImage {
    imgPtr: OpenSlidePtr;
    wasmApi: OpenSlideWasmAPI;
    constructor(wasmApi: OpenSlideWasmAPI, imgPtr: OpenSlidePtr);
    getPropertyNames(): string[];
    getPropertyValue(name: string): string | null;
    getLevelCount(): any;
    getLevelDimensions(level: number): number[];
    getLevelDownsample(level: number): any;
    readRegion(x: number, y: number, level: number, w: number, h: number, readRgba?: boolean): Promise<Uint8ClampedArray>;
    drawToCanvas(canvas: HTMLCanvasElement, x: number, y: number, level: number, w: number, h: number): Promise<void>;
    close(): void;
}
export default class OpenSlide {
    private wasmApi;
    initialize(): Promise<unknown>;
    open(fileOrUrl: File | string, downloadToLocal?: boolean): Promise<OpenSlideImage>;
}
export {};
