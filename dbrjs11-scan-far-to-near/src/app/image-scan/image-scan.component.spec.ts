import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImageScanComponent } from './image-scan.component';

describe('ImageScanComponent', () => {
  let component: ImageScanComponent;
  let fixture: ComponentFixture<ImageScanComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImageScanComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImageScanComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
