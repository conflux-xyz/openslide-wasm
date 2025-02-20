declare type OpenslideWasmAPI = any;
declare type OpenslidePtr = number;
export declare class OpenSlideImage {
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
export declare class OpenSlide {
    private wasmApi;
    isReady: boolean;
    initialize(useWebworker?: boolean): Promise<unknown>;
    open(fileOrUrl: File | string): Promise<OpenSlideImage>;
}
export {};
