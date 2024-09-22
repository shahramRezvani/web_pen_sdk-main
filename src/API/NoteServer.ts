import JSZip from "jszip";
import * as NLog from "../Util/NLog";
import PUIController from "./PUIController";
import { PageInfo, PaperSize } from "../Util/type";


// Ncode Formula
const NCODE_SIZE_IN_INCH = (8 * 7) / 600;
const POINT_72DPI_SIZE_IN_INCH = 1 / 72;

const point72ToNcode = (p: number): number => {
  const ratio = NCODE_SIZE_IN_INCH / POINT_72DPI_SIZE_IN_INCH;
  return p / ratio;
};

/**
 * Set Note Page PUI in PUIController
 */
const setNprojInPuiController = async (url: string | null, pageInfo: PageInfo): Promise<void> => {
  let nprojUrl = `/assets/${pageInfo.section}_${pageInfo.owner}_${pageInfo.book}.zip`;

  NLog.log("[NoteServer] In the PUIController, set nproj at the following url => " + nprojUrl);

  try {
    const res = await fetch(nprojUrl);
    const zipBlob = await res.blob();
    const jszip = new JSZip();
    const zip = await jszip.loadAsync(zipBlob);


   // const zipFile = zip.file(`${pageInfo.section}_${pageInfo.owner}_${pageInfo.book}.nproj`);
    const zipFile = zip.file(`${pageInfo.section}_${pageInfo.owner}_${pageInfo.book}/${pageInfo.section}_${pageInfo.owner}_${pageInfo.book}.nproj`);


    if (zipFile) {
      const nprojData = await zipFile.async("text");
      PUIController.getInstance().fetchOnlyPageSymbols(nprojData, pageInfo);
    } else {
      throw new Error("Nproj file not found in the ZIP.");
    }
  } catch (err) {
    NLog.log(err);
    throw err;
  }
};

/**
 * Calculate page margin info
 * -> define X(min/max), Y(min,max)
 */
const extractMarginInfo = async (url: string | null, pageInfo: PageInfo): Promise<PaperSize | undefined> => {
  let nprojUrl = url || `/assets/${pageInfo.section}_${pageInfo.owner}_${pageInfo.book}.zip`;
  
  NLog.log("[NoteServer] Get the page margin from the following url => " + nprojUrl);

  try {
    const res = await fetch(nprojUrl);
    const zipBlob = await res.blob();
    const jszip = new JSZip();
    const zip = await jszip.loadAsync(zipBlob);
    console.log("@zip",zip)
 //   const nprojFile = zip.file(`${pageInfo.section}_${pageInfo.owner}_${pageInfo.book}.nproj`);
    const nprojFile = zip.file(`${pageInfo.section}_${pageInfo.owner}_${pageInfo.book}/${pageInfo.section}_${pageInfo.owner}_${pageInfo.book}.nproj`);

    console.log("@nprojFile",nprojFile)
    if (nprojFile) {
      const nprojXml = await nprojFile.async("text");
      const parser = new DOMParser();
      const doc = parser.parseFromString(nprojXml, "text/xml");

      const section = doc.children[0].getElementsByTagName("section")[0]?.innerHTML;
      const owner = doc.children[0].getElementsByTagName("owner")[0]?.innerHTML;
      const book = doc.children[0].getElementsByTagName("code")[0]?.innerHTML;

      let startPage = doc.children[0].getElementsByTagName("start_page")[0]?.innerHTML;
      const segment_info = doc.children[0].getElementsByTagName("segment_info");
      if (segment_info.length > 0) {
        const start_page_new = segment_info[0].getAttribute("ncode_start_page");
        startPage = start_page_new;
      }


      console.log("@doc",doc)
      console.log("@doc.children",doc.children)
      console.log("@doc.children[0]",doc.children[0])
      console.log("@[pageInfo.page - parseInt(startPage)]",[pageInfo.page - parseInt(startPage)])

      const page_item = doc.children[0].getElementsByTagName("page_item")[pageInfo.page - parseInt(startPage)];
      if (!page_item) throw new Error("Page item is undefined");

      let x1 = parseInt(page_item.getAttribute("x1") || "0");
      let x2 = parseInt(page_item.getAttribute("x2") || "0");
      let y1 = parseInt(page_item.getAttribute("y1") || "0");
      let y2 = parseInt(page_item.getAttribute("y2") || "0");

      const crop_margin = page_item.getAttribute("crop_margin") || "0,0,0,0";
      const margins = crop_margin.split(",");
      const l = parseFloat(margins[0]);
      const t = parseFloat(margins[1]);
      const r = parseFloat(margins[2]);
      const b = parseFloat(margins[3]);

      const Xmin = point72ToNcode(x1) + point72ToNcode(l);
      const Ymin = point72ToNcode(y1) + point72ToNcode(t);
      const Xmax = point72ToNcode(x2) - point72ToNcode(r);
      const Ymax = point72ToNcode(y2) - point72ToNcode(b);

      return { Xmin, Xmax, Ymin, Ymax };
    } else {
      throw new Error("Nproj file not found in the ZIP.");
    }
  } catch (err) {
    NLog.log(err);
    throw err;
  }
};

/**
 * GET note image function
 */
const getNoteImage = async (pageInfo: PageInfo, setImageBlobUrl: (url: string) => void): Promise<void> => {
  const zipUrl = `/assets/${pageInfo.section}_${pageInfo.owner}_${pageInfo.book}.zip`;
  const page = pageInfo.page;

  try {
    const jszip = new JSZip();
    const res = await fetch(zipUrl);
    const zipBlob = await res.blob();

    await jszip.loadAsync(zipBlob).then(async (zip) => {
      const zipValues: any = await Object.values(zip.files);
      const target = zipValues.filter((x: any) => {
        let found = x.name.match(/(\d+)_(\d+)_(\d+)_(\d+)\.jpg/);
        let pageNum = found ? parseInt(found[4], 10) : -1;
        return pageNum === page;
      });

      if (target.length > 0) {
        const imageBlob = await target[0].async("blob");
        const imageBlobUrl = URL.createObjectURL(imageBlob);
        setImageBlobUrl(imageBlobUrl);
      } else {
        throw new Error("Image file not found in the ZIP.");
      }
    });
  } catch (err) {
    NLog.log(err);
    throw err;
  }
};

const api = {
  extractMarginInfo,
  getNoteImage,
  setNprojInPuiController,
};

export default api;
