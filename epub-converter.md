---
layout: page
title: EPUB to TXT Converter
permalink: /epub-converter/
---

# EPUB to TXT Converter

Convert your EPUB files to plain text format easily. Just drop your EPUB files below or click to select them.

<div class="container">
    <div id="dropZone">
        <p>Drop your EPUB files here or click to select files</p>
        <input type="file" id="fileInput" accept=".epub" multiple style="display: none"/>
    </div>
    <div id="fileList"></div>
    <div class="progress-container">
        <progress value="0" max="100"></progress>
        <div id="progressText">0%</div>
    </div>
    <button id="convertBtn" disabled>Convert Selected Files to TXT</button>
    <div id="output"></div>
    <div class="debug-controls">
        <label>
            <input type="checkbox" id="debugMode"> Enable Debug Mode
        </label>
    </div>
    <div id="debugLog" style="display: none;"></div>
</div>

<style>
    .container {
        text-align: center;
        max-width: 800px;
        margin: 20px auto;
        padding: 20px;
    }
    #dropZone {
        border: 2px dashed #ccc;
        padding: 20px;
        margin: 20px 0;
        border-radius: 5px;
        cursor: pointer;
        background-color: #f8f9fa;
    }
    #dropZone.dragover {
        background-color: #e1e1e1;
        border-color: #999;
    }
    #output {
        margin-top: 20px;
        white-space: pre-wrap;
    }
    #fileList {
        margin: 15px 0;
        text-align: left;
        max-height: 200px;
        overflow-y: auto;
        padding: 10px;
        border: 1px solid #eee;
        border-radius: 5px;
        background-color: #fff;
    }
    .file-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px;
        border-bottom: 1px solid #eee;
        background-color: #f8f9fa;
        margin-bottom: 4px;
        border-radius: 4px;
    }
    .file-item:last-child {
        border-bottom: none;
    }
    .remove-file {
        background-color: #ff4444;
        color: white;
        border: none;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        line-height: 24px;
        text-align: center;
        cursor: pointer;
        padding: 0;
        font-size: 16px;
    }
    .remove-file:hover {
        background-color: #cc0000;
    }
    .progress-container {
        margin-top: 10px;
        display: none;
    }
    progress {
        width: 100%;
        height: 20px;
    }
    .no-files {
        color: #666;
        font-style: italic;
        padding: 10px;
        text-align: center;
    }
    #convertBtn {
        background-color: #4CAF50;
        color: white;
        padding: 12px 24px;
        border: none;
        border-radius: 25px;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        margin: 20px 0;
    }
    #convertBtn:hover:not(:disabled) {
        background-color: #45a049;
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    }
    #convertBtn:active:not(:disabled) {
        transform: translateY(0);
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    #convertBtn:disabled {
        background-color: #cccccc;
        cursor: not-allowed;
        box-shadow: none;
        opacity: 0.7;
    }
    .debug-controls {
        margin: 10px 0;
        padding: 10px;
        background: #f8f9fa;
        border-radius: 5px;
        text-align: left;
    }
    .debug-controls label {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        color: #666;
    }
    .debug-controls input[type="checkbox"] {
        width: 16px;
        height: 16px;
    }
    #debugLog {
        margin-top: 20px;
        text-align: left;
        background: #f8f9fa;
        padding: 10px;
        border-radius: 5px;
        max-height: 300px;
        overflow-y: auto;
        font-family: monospace;
        font-size: 12px;
        white-space: pre-wrap;
        word-wrap: break-word;
        border: 1px solid #eee;
    }
</style>

<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
<script>
document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const convertBtn = document.getElementById('convertBtn');
    const output = document.getElementById('output');
    const fileList = document.getElementById('fileList');
    const debugMode = document.getElementById('debugMode');
    const debugLog = document.getElementById('debugLog');
    let selectedFiles = [];

    fileInput.setAttribute('multiple', 'true');

    // Add click handler to open file selection dialog
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

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
        const files = Array.from(e.dataTransfer.files).filter(file => 
            file.type === 'application/epub+zip'
        );
        if (files.length > 0) {
            handleFiles(files);
        } else {
            output.textContent = 'Please drop EPUB files.';
        }
    });

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
        convertBtn.disabled = selectedFiles.length === 0;
        updateFileList();
    }

    function updateFileList() {
        fileList.innerHTML = '';
        Array.from(selectedFiles).forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <span>${file.name}</span>
                <button class="remove-file" data-index="${index}">&times;</button>
            `;
            fileList.appendChild(fileItem);
        });

        const removeButtons = fileList.getElementsByClassName('remove-file');
        Array.from(removeButtons).forEach(button => {
            button.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                selectedFiles = Array.from(selectedFiles).filter((_, i) => i !== index);
                updateFileList();
                convertBtn.disabled = selectedFiles.length === 0;
                if (selectedFiles.length === 0) {
                    output.textContent = 'No files selected';
                } else {
                    output.textContent = `Selected ${selectedFiles.length} file(s)`;
                }
            });
        });

        if (selectedFiles.length === 0) {
            fileList.innerHTML = '<div class="no-files">No files selected</div>';
        }
    }

    convertBtn.addEventListener('click', async () => {
        if (selectedFiles.length === 0) return;

        output.textContent = 'Converting files...';
        let successCount = 0;
        let failCount = 0;

        try {
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

    // Debug mode toggle handler
    debugMode.addEventListener('change', (e) => {
        debugLog.style.display = e.target.checked ? 'block' : 'none';
    });

    function log(message, isError = false) {
        if (!debugMode.checked) return;
        
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;
        
        if (isError) {
            console.error(logMessage);
        } else {
            console.log(logMessage);
        }
        
        debugLog.innerHTML += logMessage + '\n';
        debugLog.scrollTop = debugLog.scrollHeight;
    }

    function detectAndRemoveWatermark(text) {
        // Split text into lines
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        
        if (lines.length < 2) return text;
        
        // Find the most common prefix in the first few lines
        const firstLines = lines.slice(0, 5); // Look at first 5 lines
        const prefixes = new Map();
        
        // Try different prefix lengths (from 5 to 50 characters)
        for (let length = 5; length <= 50; length++) {
            firstLines.forEach(line => {
                if (line.length >= length) {
                    const prefix = line.substring(0, length);
                    prefixes.set(prefix, (prefixes.get(prefix) || 0) + 1);
                }
            });
        }
        
        // Find the most common prefix that appears at least twice
        let bestPrefix = '';
        let maxCount = 0;
        
        prefixes.forEach((count, prefix) => {
            if (count > maxCount && count >= 2) {
                maxCount = count;
                bestPrefix = prefix;
            }
        });
        
        if (bestPrefix) {
            log(`Detected watermark prefix: "${bestPrefix}" (appears ${maxCount} times)`);
            // Remove the prefix from all lines
            return lines.map(line => line.startsWith(bestPrefix) ? line.substring(bestPrefix.length).trim() : line)
                       .join('\n');
        }
        
        return text;
    }

    async function convertEpub(file) {
        log(`Starting conversion of file: ${file.name}`);
        const zipData = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(zipData);
        let textContent = '';

        const files = Object.keys(zip.files);
        log(`Total files in EPUB: ${files.length}`);
        if (debugMode.checked) {
            log(`Files found: ${files.join(', ')}`);
        }

        const containerPath = files.find(path => path.toLowerCase() === 'meta-inf/container.xml');
        const containerFile = zip.file(containerPath);
        if (!containerFile) {
            throw new Error('Invalid EPUB: Missing container.xml');
        }
        const containerXml = await containerFile.async('text');
        if (debugMode.checked) {
            log('Container XML content:');
            log(containerXml.substring(0, 200) + '...');
        }
        
        const rootFileMatch = containerXml.match(/full-path=["']([^"']*?)["']/);
        if (!rootFileMatch) {
            throw new Error('Cannot find content.opf path');
        }
        const rootFilePath = rootFileMatch[1];
        log(`Root file path: ${rootFilePath}`);
        
        const normalizedRootPath = rootFilePath.replace(/\\/g, '/');
        const contentOpfFile = zip.file(normalizedRootPath);
        if (!contentOpfFile) {
            throw new Error(`Cannot find content.opf file at path: ${normalizedRootPath}`);
        }
        const contentOpf = await contentOpfFile.async('text');
        if (debugMode.checked) {
            log('Content OPF content:');
            log(contentOpf.substring(0, 200) + '...');
        }

        const spineMatch = contentOpf.match(/<spine[^>]*>([\s\S]*?)<\/spine>/);
        if (!spineMatch) {
            throw new Error('Cannot find spine in content.opf');
        }

        const spineItems = [...spineMatch[1].matchAll(/idref=["']([^"']+)["']/g)]
            .map(match => match[1]);
        log(`Spine items found: ${spineItems.join(', ')}`);

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
        if (debugMode.checked) {
            log('Manifest items:');
            log(JSON.stringify(manifestItems, null, 2));
        }

        const baseDir = rootFilePath.includes('/') 
            ? rootFilePath.substring(0, rootFilePath.lastIndexOf('/') + 1) 
            : '';
        log(`Base directory: ${baseDir}`);

        for (const itemId of spineItems) {
            const relativePath = manifestItems[itemId];
            if (relativePath) {
                const fullPath = (baseDir + relativePath).replace(/\\/g, '/');
                log(`Processing file: ${fullPath}`);
                let file = zip.file(fullPath);
                
                if (!file) {
                    const oebpsPath = 'OEBPS/' + fullPath;
                    log(`Trying alternate path: ${oebpsPath}`);
                    file = zip.file(oebpsPath);
                }

                if (!file) {
                    const decodedPath = decodeURIComponent(fullPath);
                    log(`Trying decoded path: ${decodedPath}`);
                    file = zip.file(decodedPath);
                    
                    if (!file) {
                        const oebpsDecodedPath = 'OEBPS/' + decodedPath;
                        log(`Trying decoded path with OEBPS: ${oebpsDecodedPath}`);
                        file = zip.file(oebpsDecodedPath);
                    }
                }

                if (!file) {
                    log(`Warning: File not found: ${fullPath}`);
                    continue;
                }

                const content = await file.async('text');
                if (debugMode.checked) {
                    log(`Raw content from ${fullPath}:`);
                    log(content.substring(0, 200) + '...');
                }
    
                if (content) {
                    const textOnly = content
                        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                        .replace(/<[^>]+>/g, '')
                        .replace(/&nbsp;/g, ' ')
                        .replace(/&#160;/g, ' ')
                        .replace(/&\w+;/g, ' ')
                        .replace(/&#\d+;/g, ' ')
                        .replace(/Section\d+\.html/gi, '')
                        .replace(/Chapter\s*\d+/gi, '')
                        .replace(/Section\s*\d+/gi, '')
                        .replace(/Booktopia\s+Epub\s*/gi, '')
                        .replace(/\s+/g, ' ')
                        .trim();
                    
                    const cleanedText = detectAndRemoveWatermark(textOnly);
                    
                    if (debugMode.checked) {
                        log(`Processed content from ${fullPath}:`);
                        log(cleanedText.substring(0, 200) + '...');
                    }
                    
                    if (cleanedText) {
                        textContent += cleanedText + '\n\n';
                    }
                }
            }
        }

        if (!textContent) {
            throw new Error('No text content found in EPUB');
        }

        if (debugMode.checked) {
            log('Final text content:');
            log(textContent.substring(0, 500) + '...');
        }

        const blob = new Blob([textContent], { type: 'text/plain' });
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.download = file.name.replace('.epub', '.txt');
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    }
});
</script> 