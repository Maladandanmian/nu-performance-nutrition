/**
 * Test script for DEXA image extraction
 */

import { extractDexaImages } from './dexaImageExtraction';

async function testImageExtraction() {
  const pdfPath = '/home/ubuntu/upload/Benskin,D(May2024).pdf';
  
  console.log('Testing image extraction from:', pdfPath);
  console.log('---');
  
  try {
    const images = await extractDexaImages(pdfPath);
    
    console.log(`✅ Successfully extracted ${images.length} images`);
    console.log('');
    
    images.forEach((img, idx) => {
      console.log(`Image ${idx + 1}:`);
      console.log(`  Type: ${img.type}`);
      console.log(`  Page: ${img.pageNumber}`);
      console.log(`  URL: ${img.imageUrl}`);
      console.log(`  Key: ${img.imageKey}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Image extraction failed:', error);
    throw error;
  }
}

testImageExtraction();
