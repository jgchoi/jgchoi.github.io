document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const convertBtn = document.getElementById('convertBtn');
    const output = document.getElementById('output');
    let selectedFiles = []; // Changed from selectedFile to selectedFiles array

    // Update file input to accept multiple files
    fileInput.setAttribute('multiple', 'true');

    // Drag and drop handlers
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    // Update drop handler
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files).filter(file => 
            file.type === 'application/epub+zip'
        );
        if (files.length > 0) {
            handleFiles(files);
        } else {
            output.textContent = 'Please drop EPUB files.';
        }
    });

    // Update file input handler
    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files).filter(file => 
            file.type === 'application/epub+zip'
        );
        if (files.length > 0) {
            handleFiles(files);
        }
    });

    function handleFiles(files) {
        selectedFiles = files;
        convertBtn.disabled = false;
        output.textContent = `Selected ${files.length} file(s): ${files.map(f => f.name).join(', ')}`;
    }

    // Update convert button handler
    convertBtn.addEventListener('click', async () => {
        if (selectedFiles.length === 0) return;

        output.textContent = 'Converting files...';
        let successCount = 0;
        let failCount = 0;

        try {
            // Process all files concurrently
            await Promise.all(selectedFiles.map(async file => {
                try {
                    await convertEpub(file);
                    successCount++;
                } catch (error) {
                    console.error(`Error converting ${file.name}:`, error);
                    failCount++;
                }
            }));

            output.textContent = `Conversion completed! Successfully converted: ${successCount}, Failed: ${failCount}`;
        } catch (error) {
            console.error('Conversion error:', error);
            output.textContent = 'Error during conversion: ' + error.message;
        }
    });

    // Separate conversion logic into its own function
    async function convertEpub(file) {
        const zipData = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(zipData);
        let textContent = '';

        // Debug - List all files in the EPUB
        const files = Object.keys(zip.files);
        console.log('All files in EPUB:', files);

        // Get container.xml content - use case-insensitive path
        const containerPath = files.find(path => path.toLowerCase() === 'meta-inf/container.xml');
        const containerFile = zip.file(containerPath);
        if (!containerFile) {
            throw new Error('Invalid EPUB: Missing container.xml');
        }
        const containerXml = await containerFile.async('text');
        console.log('Container XML:', containerXml);
        
        // Extract root file path more safely
        const rootFileMatch = containerXml.match(/full-path=["']([^"']*?)["']/);
        if (!rootFileMatch) {
            throw new Error('Cannot find content.opf path');
        }
        const rootFilePath = rootFileMatch[1];
        console.log('Root file path:', rootFilePath);
        
        // Get content.opf - normalize path separators
        const normalizedRootPath = rootFilePath.replace(/\\/g, '/');
        const contentOpfFile = zip.file(normalizedRootPath);
        if (!contentOpfFile) {
            throw new Error(`Cannot find content.opf file at path: ${normalizedRootPath}`);
        }
        const contentOpf = await contentOpfFile.async('text');
        console.log('Content OPF:', contentOpf);

        // Extract spine items more safely
        const spineMatch = contentOpf.match(/<spine[^>]*>([\s\S]*?)<\/spine>/);
        if (!spineMatch) {
            throw new Error('Cannot find spine in content.opf');
        }

        const spineItems = [...spineMatch[1].matchAll(/idref=["']([^"']+)["']/g)]
            .map(match => match[1]);
        console.log('Spine items:', spineItems);

        // Map manifest items more safely
        const manifestItems = {};
        const manifestMatches = contentOpf.match(/<item[^>]*?>/g) || [];
        manifestMatches.forEach(item => {
            const idMatch = item.match(/id=["']([^"']+)["']/);
            const hrefMatch = item.match(/href=["']([^"']+)["']/);
            if (idMatch && hrefMatch) {
                const id = idMatch[1];
                const href = hrefMatch[1];
                manifestItems[id] = href;
            }
        });
        console.log('Manifest items:', manifestItems);

        // Get base directory
        const baseDir = rootFilePath.includes('/') 
            ? rootFilePath.substring(0, rootFilePath.lastIndexOf('/') + 1) 
            : '';

        // When processing files, normalize all paths
        for (const itemId of spineItems) {
            const relativePath = manifestItems[itemId];
            // additional debug info
            console.log('Processing spine item:', itemId, 'with path:', relativePath);
            if (relativePath) {
                // Normalize the path joining
                const fullPath = (baseDir + relativePath).replace(/\\/g, '/');
                console.log('Attempting to process:', fullPath);
                
                // Try both the direct path and with OEBPS prefix
                let file = zip.file(fullPath);
                if (!file) {
                    // Try with OEBPS prefix if not found
                    const oebpsPath = 'OEBPS/' + fullPath;
                    file = zip.file(oebpsPath);
                    console.log('Trying alternate path:', oebpsPath);
                }

                if (!file) {
                    console.warn('File not found:', fullPath);
                    continue;
                }

                const content = await file.async('text');
                if (content) {
                    console.log('Content found for:', fullPath);
                    const textOnly = content
                        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                        .replace(/<[^>]+>/g, '')
                        .replace(/&nbsp;/g, ' ')
                        .replace(/Section\d+\.html/gi, '') // Remove section file names
                        .replace(/Chapter\s*\d+/gi, '')    // Remove chapter headers
                        .replace(/Section\s*\d+/gi, '')    // Remove section headers
                        .replace(/\s+/g, ' ')
                        .trim();
                    
                    if (textOnly) {
                        textContent += textOnly + '\n\n';
                    }
                }
            }
        }

        if (!textContent) {
            throw new Error('No text content found in EPUB');
        }

        // Process text content
        textContent = processText(textContent);

        // Create and download text file
        const blob = new Blob([textContent], { type: 'text/plain' });
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.download = file.name.replace('.epub', '.txt');
        downloadLink.click();
        URL.revokeObjectURL(downloadLink.href);
    }

    // Keep the existing processText function
    function processText(text) {
        // Remove "Cover" and section headers from the beginning
        text = text
            .replace(/^Cover\n+/, '')
            .replace(/^Section\d+\.html\s*/gm, '')
            .replace(/^Chapter\s*\d+\s*/gm, '')
            .replace(/^Section\s*\d+\s*/gm, '');
        
        // Split into sentences and add line breaks
        const sentences = text
            .split(/([.!?])\s+/)
            .filter(Boolean); // Remove empty strings
        
        // Rejoin sentences with double newlines
        let processedText = '';
        for (let i = 0; i < sentences.length - 1; i += 2) {
            const sentence = sentences[i];
            const punctuation = sentences[i + 1] || '';
            processedText += sentence + punctuation + '\n\n';
        }
        
        // Final cleanup
        return processedText
            .replace(/^\s+/gm, '')        // Remove leading whitespace from each line
            .replace(/\n{3,}/g, '\n\n')   // Replace multiple newlines with double newlines
            .replace(/([.!?])\n/g, '$1\n\n') // Ensure double newline after each sentence
            .trim();
    }

    // Add click handler for drop zone
    dropZone.addEventListener('click', () => {
        fileInput.click(); // Trigger file input when drop zone is clicked
    });

    // Prevent click propagation on file input to avoid double triggers
    fileInput.addEventListener('click', (e) => {
        e.stopPropagation();
    });
});