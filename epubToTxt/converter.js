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

            // Get container.xml content
            const containerFile = zip.file('META-INF/container.xml');
            if (!containerFile) {
                throw new Error('Invalid EPUB: Missing container.xml');
            }
            const containerXml = await containerFile.async('text');
            
            // Extract root file path more safely
            const rootFileMatch = containerXml.match(/full-path=["']([^"']*?)["']/);
            if (!rootFileMatch) {
                throw new Error('Cannot find content.opf path');
            }
            const rootFilePath = rootFileMatch[1];
            
            // Get content.opf
            const contentOpfFile = zip.file(rootFilePath);
            if (!contentOpfFile) {
                throw new Error('Cannot find content.opf file');
            }
            const contentOpf = await contentOpfFile.async('text');

            // Extract spine items more safely
            const spineMatch = contentOpf.match(/<spine[^>]*>([\s\S]*?)<\/spine>/);
            if (!spineMatch) {
                throw new Error('Cannot find spine in content.opf');
            }

            const spineItems = [...spineMatch[1].matchAll(/idref=["']([^"']+)["']/g)]
                .map(match => match[1]);

            // Map manifest items more safely
            const manifestItems = {};
            const manifestMatches = [...contentOpf.matchAll(/<item[^>]*?id=["']([^"']+)["'][^>]*?href=["']([^"']+)["'][^>]*?>/g)];
            
            for (const match of manifestMatches) {
                manifestItems[match[1]] = match[2];
            }

            // Get base directory
            const baseDir = rootFilePath.includes('/') 
                ? rootFilePath.substring(0, rootFilePath.lastIndexOf('/') + 1) 
                : '';

            // Process files
            for (const itemId of spineItems) {
                const relativePath = manifestItems[itemId];
                if (relativePath) {
                    const fullPath = baseDir + relativePath;
                    const content = await zip.file(fullPath)?.async('text');
                    if (content) {
                        // Convert HTML to plain text
                        const textOnly = content
                            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                            .replace(/<[^>]+>/g, '')
                            .replace(/&nbsp;/g, ' ')
                            .replace(/\s+/g, ' ')
                            .trim();
                        textContent += textOnly + '\n\n';
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
            console.error('Detailed error:', error);
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