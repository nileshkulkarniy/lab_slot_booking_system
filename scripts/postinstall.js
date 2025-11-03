#!/usr/bin/env node

const { execSync } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

console.log('Running postinstall script...');
console.log(`Platform: ${os.platform()}, Architecture: ${os.arch()}`);

// Check if we're deploying to a cloud platform that requires bcrypt rebuild
const isCloudPlatform = process.env.RENDER || 
                       process.env.HEROKU || 
                       process.env.VERCEL ||
                       process.env.NODE_ENV === 'production';

if (isCloudPlatform) {
  console.log('Detected cloud deployment environment. Handling bcrypt installation...');
  
  try {
    // Check if node-pre-gyp exists and fix permissions if needed
    const nodePreGypPath = path.join('node_modules', '.bin', 'node-pre-gyp');
    if (fs.existsSync(nodePreGypPath)) {
      console.log('Found node-pre-gyp, fixing permissions...');
      try {
        execSync('chmod +x ' + nodePreGypPath, { stdio: 'inherit' });
        console.log('Fixed node-pre-gyp permissions successfully.');
      } catch (permissionError) {
        console.log('Could not fix node-pre-gyp permissions, continuing...');
      }
    } else {
      console.log('node-pre-gyp not found, will attempt fresh install');
    }
    
    // Clean install approach for cloud environments
    console.log('Removing existing bcrypt module...');
    try {
      execSync('npm remove bcrypt', { stdio: 'inherit' });
    } catch (removeError) {
      console.log('Bcrypt not present or could not be removed, continuing...');
    }
    
    // Install bcrypt with unsafe-perm to bypass permission issues
    console.log('Installing bcrypt with unsafe-perm...');
    execSync('npm install bcrypt --unsafe-perm', { stdio: 'inherit' });
    console.log('Bcrypt installed successfully with unsafe-perm.');
    
  } catch (error) {
    console.error('Failed to handle bcrypt installation:', error.message);
    
    // Final fallback - try using yarn if available
    try {
      console.log('Attempting installation with yarn...');
      execSync('yarn add bcrypt', { stdio: 'inherit' });
      console.log('Bcrypt installed successfully with yarn.');
    } catch (yarnError) {
      console.error('Failed to install bcrypt with yarn:', yarnError.message);
      console.log('WARNING: bcrypt installation failed. Application may not work correctly.');
      process.exit(0); // Don't fail the build for this
    }
  }
} else {
  console.log('Local development environment detected. Skipping bcrypt rebuild.');
  console.log('If you encounter bcrypt errors, run: npm rebuild bcrypt --update-binary');
}