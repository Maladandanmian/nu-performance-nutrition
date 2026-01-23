import { describe, it, expect } from 'vitest';
import { extractDexaImages } from './dexaImageExtraction';

describe('DEXA Image Extraction', () => {
  it('should extract images from a DEXA PDF', async () => {
    const pdfPath = '/home/ubuntu/upload/Benskin,D(May2024).pdf';
    
    const images = await extractDexaImages(pdfPath);
    
    // Should extract multiple images
    expect(images.length).toBeGreaterThan(0);
    
    // Each image should have required fields
    images.forEach((img) => {
      expect(img.type).toBeDefined();
      expect(img.imageUrl).toBeDefined();
      expect(img.imageKey).toBeDefined();
      expect(img.pageNumber).toBeGreaterThan(0);
      
      // Type should be one of the expected values
      expect(['body_scan_color', 'body_scan_gray', 'fracture_risk_chart', 'body_fat_chart']).toContain(img.type);
      
      // URL should be a valid S3 URL
      expect(img.imageUrl).toMatch(/^https:\/\//);
      
      // Key should be in the dexa-images folder
      expect(img.imageKey).toMatch(/^dexa-images\//);
    });
  }, 120000); // 2 minute timeout for PDF processing + AI analysis

  it('should identify different image types correctly', async () => {
    const pdfPath = '/home/ubuntu/upload/Benskin,D(May2024).pdf';
    
    const images = await extractDexaImages(pdfPath);
    
    // Should have at least one of each major type
    const types = images.map(img => img.type);
    
    // Check that we extracted body scan images
    const hasBodyScan = types.some(t => t === 'body_scan_color' || t === 'body_scan_gray');
    expect(hasBodyScan).toBe(true);
    
    // Check that we extracted at least one chart
    const hasChart = types.some(t => t === 'fracture_risk_chart' || t === 'body_fat_chart');
    expect(hasChart).toBe(true);
  }, 120000);

  it('should assign correct page numbers to extracted images', async () => {
    const pdfPath = '/home/ubuntu/upload/Benskin,D(May2024).pdf';
    
    const images = await extractDexaImages(pdfPath);
    
    // Page numbers should be sequential and start from 1
    const pageNumbers = images.map(img => img.pageNumber);
    expect(Math.min(...pageNumbers)).toBe(1);
    
    // All page numbers should be positive integers
    pageNumbers.forEach(pageNum => {
      expect(pageNum).toBeGreaterThan(0);
      expect(Number.isInteger(pageNum)).toBe(true);
    });
  }, 120000);

  it('should generate unique S3 keys for each image', async () => {
    const pdfPath = '/home/ubuntu/upload/Benskin,D(May2024).pdf';
    
    const images = await extractDexaImages(pdfPath);
    
    // All image keys should be unique
    const keys = images.map(img => img.imageKey);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
    
    // All URLs should be unique
    const urls = images.map(img => img.imageUrl);
    const uniqueUrls = new Set(urls);
    expect(uniqueUrls.size).toBe(urls.length);
  }, 120000);
});
