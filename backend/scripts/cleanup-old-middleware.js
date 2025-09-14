import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const middlewareDir = path.join(__dirname, '..', 'src', 'middleware');

// List of files to remove (relative to middlewareDir)
const filesToRemove = [
    'auth.js',
    'upload.js',
    'validateRequest.js',
    'errorHandler.js',
    'security.js',
    'logger.js',
    'asyncHandler.js'
];

// Remove each file
filesToRemove.forEach(file => {
    const filePath = path.join(middlewareDir, file);
    
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`✅ Removed: ${filePath}`);
        } else {
            console.log(`ℹ️  Not found (already removed?): ${filePath}`);
        }
    } catch (error) {
        console.error(`❌ Error removing ${filePath}:`, error.message);
    }
});

console.log('\n✅ Cleanup complete!');
