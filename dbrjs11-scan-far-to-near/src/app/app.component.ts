import { Component, ElementRef, ViewChild } from '@angular/core';
import { BarcodeScanner, BarcodeScannerConfig, Point, CapturedResultReceiver, CameraEnhancer, IntermediateResultReceiver } from 'dynamsoft-barcode-reader-bundle';

interface LocalizedBarcode {
  location: {
    points: Point[];
  };
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})

export class AppComponent {
  title = 'angular';
  barcodeScanner: BarcodeScanner | null = null;
  isScannerLaunched: boolean = false;

  zoomBase = 1; // base zoom level is usually 1 or 100
  minZoom = 1;
  maxZoom = 1;

  frameSharpness: number = 0;
  poorFrameCount = 0;
  currentZoomStartTime = 0;

  @ViewChild('barcodeScannerViewRef') barcodeScannerViewRef!: ElementRef<HTMLDivElement>;
  @ViewChild('toastRef') toastRef!: ElementRef<HTMLDivElement>;

  async scannerLauncher (){
    if(this.isScannerLaunched){
      alert("The scanner is already launched.");
      return;
    }

    this.isScannerLaunched = true;
    
       const config: BarcodeScannerConfig = {
      license: "", // Replace with your Dynamsoft license key

      // Specify where to render the scanner UI
      // If container is not specified, the UI will take up the full screen
      container: this.barcodeScannerViewRef.nativeElement, 

      // Specify the path for the definition file "barcode-scanner.ui.xml" for the scanner view.
      uiPath: "https://cdn.jsdelivr.net/npm/dynamsoft-barcode-reader-bundle@11.2.4000/dist/ui/barcode-scanner.ui.xml",

      showUploadImageButton: false,
      // scannerViewConfig: {
      //   showFlashButton: true,
      //   cameraSwitchControl: "toggleFrontBack",
      // },
      templateFilePath: "modified-Templates.json",

      // Specify custom paths for the engine resources
      engineResourcePaths: {
        rootDirectory: "https://cdn.jsdelivr.net/npm/",
      },

      
      onInitReady: async(components) => {
        // Do something with the foundational components
        const { cameraEnhancer, cameraView, cvRouter } = components;

        await cameraEnhancer.setResolution({ width: 3840, height: 2160 });

        //// optional
        // // Set the scan laser to be visible in cameraView
        // cameraView.setScanLaserVisible(true);
        // // Set the scan region to a rectangle with percentage values by cameraEnhancer
        // let region = {
        //   "x": 0,
        //   "y": 30,
        //   "width": 100,
        //   "height": 40,
        //   "isMeasuredInPercentage": true
        // };
        // cameraEnhancer.setScanRegion(region);

        // onCapturedResultReceived
        const resultReceiver = new CapturedResultReceiver();
        resultReceiver.onCapturedResultReceived = async (result: any) => {
          if (!result.decodedBarcodesResult?.barcodeResultItems?.length) {
            this.frameHealthUpdater(cameraEnhancer);
          }
        };
        cvRouter.addResultReceiver(resultReceiver);

        // INTERMEDIATE RESULTS
        const intermediateReceiver = new IntermediateResultReceiver();

        intermediateReceiver.onLocalizedBarcodesReceived = async (
          intermediateResult: any,
          info: any
        ) => {
          if (!intermediateResult.localizedBarcodes.length) return;

          const originalImage = cvRouter.getIntermediateResultManager().getOriginalImage(); //not need param: intermediateResult.originalImageHashId

          const canvasImage = (originalImage as any).toCanvas();
          const localized = intermediateResult.localizedBarcodes as LocalizedBarcode[];

          let maxSharpness = 0;

          for (const barcode of localized) {
            const cropped = cropByFourPoints(
              canvasImage,
              barcode.location.points
            );

            const sharp = calculateLaplacianVariance(cropped);
            if (sharp > maxSharpness) maxSharpness = sharp;
          }

          this.frameSharpness = maxSharpness;
        };

        cvRouter
          .getIntermediateResultManager()
          .addResultReceiver(intermediateReceiver);

      },
      onCameraOpen: async(components)=>{
        const { cameraEnhancer, cameraView, cvRouter } = components;
        await this.detectZoomRange(cameraEnhancer);
        // Set the zoom factor to 10
        cameraEnhancer.setZoom({ factor: Math.min(10 * this.zoomBase, this.maxZoom) });
      },
    }

    // Create an instance of the BarcodeScanner with the provided configuration
    this.barcodeScanner = new BarcodeScanner(config);



  let result = await this.barcodeScanner.launch();
  
  if (result?.barcodeResults.length) {
    alert(result.barcodeResults[0].text);
    this.isScannerLaunched = false;
  }
  }


  async ngOnDestroy(): Promise<void> { 
    // Dispose of the barcode scanner when the component unmounts
    this.barcodeScanner?.dispose();
  }
  async detectZoomRange(cameraEnhancer: any): Promise<void> { 
    const capabilities = cameraEnhancer.getCapabilities();
    let maxZoom = capabilities?.zoom?.max;

    if (maxZoom) {
      const minZoom = capabilities.zoom.min;

      if(minZoom > 1.01){ // just want detect if > 1, 0.01 is just epsilon
        this.zoomBase = 100;
      }

      this.minZoom = minZoom;
      this.maxZoom = maxZoom;
    }
  }
  // ================== FRAME HEALTH ==================
  async frameHealthUpdater(cameraEnhancer: CameraEnhancer){

    let isNeedZoomSmaller = false;

    if (this.frameSharpness < 300) {
      this.poorFrameCount++;

      if (this.poorFrameCount >= 25) {
        isNeedZoomSmaller = true;
        this.poorFrameCount = 0;
      }
    }

    if (!this.currentZoomStartTime) {
      this.currentZoomStartTime = Date.now();
    } else if (Date.now() - this.currentZoomStartTime > 3000) {
      isNeedZoomSmaller = true;
      this.currentZoomStartTime = 0;
    }

    if (isNeedZoomSmaller) {
      let currentZoom = cameraEnhancer.getZoomSettings().factor;

      if (currentZoom > this.minZoom) {
        const newZoom = Math.max(this.minZoom, currentZoom - this.zoomBase);

        await cameraEnhancer.setZoom({ factor: newZoom });
        funcShowToast(
          "Frame quality is poor, reducing zoom by 1. Please move closer."
        );
      }
    }
  };
}

// ================== LAPLACIAN SHARPNESS ==============
const calculateLaplacianVariance = (canvas: HTMLCanvasElement): number => {
  const context: CanvasRenderingContext2D = canvas.getContext("2d")!;
  const imageData:ImageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const width:number = imageData.width;
  const height:number = imageData.height;

  // grayscale
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0; i < data.length; i += 4) {
    gray[i / 4] =
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  // Laplacian kernel
  const laplacian = new Float32Array(width * height);
  const kernel: number[] = [0, 1, 0, 1, -4, 1, 0, 1, 0];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const pixel = gray[(y + ky) * width + (x + kx)];
          const weight = kernel[(ky + 1) * 3 + (kx + 1)];
          sum += pixel * weight;
        }
      }
      laplacian[y * width + x] = sum;
    }
  }

  // mean
  let mean = 0;
  for (let i = 0; i < laplacian.length; i++) mean += laplacian[i];
  mean /= laplacian.length;

  // variance
  let variance = 0;
  for (let i = 0; i < laplacian.length; i++) {
    variance += Math.pow(laplacian[i] - mean, 2);
  }
  return variance / laplacian.length;
};

// ================== CROP BY POINTS ==================
const cropByFourPoints = (
  oriCanvas: HTMLCanvasElement,
  points: Point[]
): HTMLCanvasElement => {

  const tmpCanvas:HTMLCanvasElement = document.createElement("canvas");
  tmpCanvas.width = oriCanvas.width;
  tmpCanvas.height = oriCanvas.height;

  const tmpCtx:CanvasRenderingContext2D = tmpCanvas.getContext("2d")!;
  tmpCtx.beginPath();
  tmpCtx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i++) {
    tmpCtx.lineTo(points[i].x, points[i].y);
  }
  tmpCtx.closePath();
  tmpCtx.clip();

  tmpCtx.drawImage(oriCanvas, 0, 0);

  const minX:number = Math.min(...points.map((p) => p.x));
  const maxX:number = Math.max(...points.map((p) => p.x));
  const minY:number = Math.min(...points.map((p) => p.y));
  const maxY:number = Math.max(...points.map((p) => p.y));

  const outCanvas:HTMLCanvasElement = document.createElement("canvas");
  outCanvas.width = maxX - minX;
  outCanvas.height = maxY - minY;

  outCanvas
    .getContext("2d")!
    .drawImage(
      tmpCanvas,
      minX,
      minY,
      outCanvas.width,
      outCanvas.height,
      0,
      0,
      outCanvas.width,
      outCanvas.height
    );

  return outCanvas;
};

// ================== TOAST ==================
let taskShowToast: any = null;
const funcShowToast = (msg: string, duration = 3000) => {
  const elToast = document.querySelector(".dm-camera-mn-toast") as HTMLElement;
  if (!elToast) return;

  elToast.textContent = msg;
  elToast.style.display = "";

  if (taskShowToast) clearTimeout(taskShowToast);

  taskShowToast = setTimeout(() => {
    elToast.style.display = "none";
    taskShowToast = null;
  }, duration);
};

