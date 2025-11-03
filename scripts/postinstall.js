#!/usr/bin/env node

const { execSync } = require('child_process');
const os = require('os');

console.log('Running postinstall script...');
console.log(`Platform: ${os.platform()}, Architecture: ${os.arch()}`);

// Check if we're deploying to a cloud platform that requires bcrypt rebuild
const isCloudPlatform = process.env.RENDER || 
                       process.env.HEROKU || 
                       process.env.VERCEL ||
                       process.env.NODE_ENV === 'production';

if (isCloudPlatform) {
  console.log('Detected cloud deployment environment. Rebuilding bcrypt...');
  
  try {
    // Rebuild bcrypt for the current platform
    execSync('npm rebuild bcrypt --update-binary', { stdio: 'inherit' });
    console.log('Bcrypt rebuilt successfully for cloud deployment.');
  } catch (error) {
    console.error('Failed to rebuild bcrypt:', error.message);
    
    // Try alternative approach - reinstall bcrypt completely
    try {
      console.log('Attempting complete reinstall of bcrypt...');
      execSync('npm uninstall bcrypt && npm install bcrypt', { stdio: 'inherit' });
      console.log('Bcrypt reinstalled successfully.');
    } catch (reinstallError) {
      console.error('Failed to reinstall bcrypt:', reinstallError.message);
      process.exit(1);
    }
  }
} else {
  console.log('Local development environment detected. Skipping bcrypt rebuild.');
  console.log('If you encounter bcrypt errors, run: npm rebuild bcrypt --update-binary');
}