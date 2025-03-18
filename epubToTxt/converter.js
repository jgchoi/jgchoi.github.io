document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const convertBtn = document.getElementById('convertBtn');
    const output = document.getElementById('output');
    let selectedFile = null;

    // Drag and drop handlers
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file.type === 'application/epub+zip') {
            handleFile(file);
        } else {
            output.textContent = 'Please drop an EPUB file.';
        }
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleFile(file);
        }
    });

    function handleFile(file) {
        selectedFile = file;
        convertBtn.disabled = false;
        output.textContent = `Selected file: ${file.name}`;
    }

    convertBtn.addEventListener('click', async () => {
        if (!selectedFile) return;

        try {
            const zipData = await selectedFile.arrayBuffer();
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
            downloadLink.download = selectedFile.name.replace('.epub', '.txt');
            downloadLink.click();
            URL.revokeObjectURL(downloadLink.href);

            output.textContent = 'Conversion completed! File downloaded.';
        } catch (error) {
            console.error('Conversion error:', error);
            output.textContent = 'Error converting file: ' + error.message;
        }
    });

    function processText(text) {
        // Remove "Cover" from the beginning
        text = text.replace(/^Cover\n+/, '');
        
        // Split into sentences while preserving original line breaks
        // This regex looks for sentence endings (.!?) followed by a space or newline
        const sentences = text.split(/([.!?])\s+/);
        
        // Rejoin sentences with double newlines
        let processedText = '';
        for (let i = 0; i < sentences.length - 1; i += 2) {
            if (i + 1 < sentences.length) {
                processedText += sentences[i] + sentences[i + 1] + '\n\n';
            }
        }
        
        return processedText.trim();
    }
});