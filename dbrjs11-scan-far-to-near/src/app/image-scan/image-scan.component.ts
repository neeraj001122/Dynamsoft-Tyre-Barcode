import { Component, ElementRef, ViewChild } from '@angular/core';
import { BarcodeScanner } from 'dynamsoft-barcode-reader-bundle';

@Component({
  selector: 'app-image-scan',
  imports: [],
  templateUrl: './image-scan.component.html',
  styleUrl: './image-scan.component.css'
})
export class ImageScanComponent {

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('imagePreview') imagePreview!: ElementRef<HTMLImageElement>;

  barcodeScanner: BarcodeScanner | null = null;

  async ngOnInit() {
    // Initialize BarcodeScanner for image decoding
    this.barcodeScanner = new BarcodeScanner({
      license: "", // Replace with your Dynamsoft license key
      templateFilePath: "modified-Templates.json",
      engineResourcePaths: {
        rootDirectory: "https://cdn.jsdelivr.net/npm/",
      },
    });
  }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.imagePreview.nativeElement.src = e.target?.result as string;
        this.scanImage(file);
      };
      reader.readAsDataURL(file);
    }
  }

  async scanImage(file: File) {
    if (this.barcodeScanner) {
      try {
        const result = await this.barcodeScanner.decode(file);
        const barcodeItems = result.items.filter(item => item.type === 2); // CRIT_BARCODE
        if (barcodeItems.length > 0) {
          const barcodeItem = barcodeItems[0] as any; // BarcodeResultItem
          alert(`Barcode found: ${barcodeItem.text}`);
        } else {
          alert('No barcode found in the image.');
        }
      } catch (error) {
        console.error('Error scanning image:', error);
        alert('Error scanning image.');
      }
    }
  }

  ngOnDestroy() {
    this.barcodeScanner?.dispose();
  }

}
