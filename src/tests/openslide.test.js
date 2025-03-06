import puppeteer from "puppeteer";
import { spawn } from "child_process";

let browser;
let page;
let server;
global.page = page;



beforeAll(async () => {
  server = spawn("python", ["tests/server.py"]);
  await new Promise((resolve) => setTimeout(resolve, 3000));
  browser = await puppeteer.launch({ headless: false });
  page = await browser.newPage();
  page.goto("http://localhost:8080/test.html");
  await new Promise((resolve) => setTimeout(resolve, 3000));
}, 10000);

afterAll(async () => {
  await browser.close();
  server.kill();
});

describe("Test OpenSlide (WASM file system)", () => {
  it("should import openslide class", async () => {
    const result = await page.evaluate(() => {
      return window.OpenSlide !== null;
    });
    expect(result).toBe(true);
  });

  it("should instantiate openslide class", async () => {
    const result = await page.evaluate(async () => {
      // set a global context (we can only have one OpenSlide runtime instance per window)
      window.openSlide = new window.OpenSlide();
      await window.openSlide.initialize();
      return true;
    });
    expect(result).toBe(true);
  });

  it("should load a file via fetch + File Object", async () => {
    const result = await page.evaluate(async () => {
      window.slide_local_fs = await window.openSlide.open(
        "JP2K-33003-1.svs",
        true
      );
      return true;
    });
    expect(result).toBe(true);
  });

  it("should load the property names and values", async () => {
    const [names, value, levelCount] = await page.evaluate(async () => {
      const names = window.slide_local_fs.getPropertyNames();
      const value = window.slide_local_fs.getPropertyValue(names[0]);
      const levelCount = window.slide_local_fs.getLevelCount();
      return [names, value, levelCount];
    });
    expect(names[0]).toBe("aperio.AppMag");
    expect(levelCount).toBe(3);
    expect(names.length).toBe(53);
    expect(value).toBe("40");
  });

  it("should have the right dimensions", async () => {
    const [level0] = await page.evaluate(async () => {
      const level0 = slide_local_fs.getLevelDimensions(0);
      return [level0];
    });
    expect(level0[0]).toBe(15374);
    expect(level0[1]).toBe(17497);
  });

  it("should have the right dimensions", async () => {
    const byteLength = await page.evaluate(async () => {
      const regionData = await slide_local_fs.readRegion(0, 0, 0, 512, 512);
      return regionData.byteLength;
    });
    expect(byteLength).toBe(512*512*4);
  });
});


describe("Test OpenSlide (HTTP file system)", () => {
  it("should load a file via fetch", async () => {
    const result = await page.evaluate(async () => {
      window.slide_remote_fs = await window.openSlide.open(
        "https://conflux-public-access-testing.s3.us-west-2.amazonaws.com/slides/TCGA-LL-A7SZ-01Z-00-DX1.4DAF6421-6A1D-41C8-BFD6-859FE10CB8CC.svs",
        false
      );
      return true;
    });
    expect(result).toBe(true);
  }, 30000);

  it("should load the property names and values", async () => {
    const [names, value, levelCount] = await page.evaluate(async () => {
      const names = window.slide_remote_fs.getPropertyNames();
      const value = window.slide_remote_fs.getPropertyValue(names[0]);
      const levelCount = window.slide_remote_fs.getLevelCount();
      return [names, value, levelCount];
    });
    expect(names[0]).toBe("aperio.AppMag");
    expect(levelCount).toBe(4);
    expect(names.length).toBe(57);
    expect(value).toBe("40");
  });

  it("should have the right dimensions", async () => {
    const [level0] = await page.evaluate(async () => {
      const level0 = slide_remote_fs.getLevelDimensions(0);
      return [level0];
    });
    expect(level0[0]).toBe(97608);
    expect(level0[1]).toBe(69881);
  });

  it("should have the right dimensions", async () => {
    const byteLength = await page.evaluate(async () => {
      const regionData = await slide_remote_fs.readRegion(0, 0, 0, 512, 512);
      return regionData.byteLength;
    });
    expect(byteLength).toBe(512*512*4);
  });
});

