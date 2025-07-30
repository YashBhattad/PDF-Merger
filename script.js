let pdfFiles = [];
let mergedPdfBlob = null;

// File input handler
document.getElementById('pdfFiles').addEventListener('change', function(e) {
    addFiles(Array.from(e.target.files));
});

function addFiles(files) {
    const validFiles = files.filter(file => {
        if (file.type === 'application/pdf') {
            return true;
        } else {
            showStatus(`"${file.name}" is not a valid PDF file and was skipped.`, 'error');
            return false;
        }
    });

    pdfFiles.push(...validFiles);
    updateFileDisplay();
    updateMergeButton();
}

function updateFileDisplay() {
    const fileLabel = document.getElementById('fileLabel');
    const fileCount = document.getElementById('fileCount');
    const pdfList = document.getElementById('pdfList');

    if (pdfFiles.length === 0) {
        fileLabel.classList.remove('has-files');
        fileLabel.querySelector('.file-icon').textContent = '📚';
        fileLabel.querySelector('.file-text').textContent = 'Choose PDF Files';
        fileLabel.querySelector('.file-subtext').textContent = 'Click to select multiple PDF files or drag & drop them here';
        fileCount.style.display = 'none';
        pdfList.style.display = 'none';
    } else {
        fileLabel.classList.add('has-files');
        fileLabel.querySelector('.file-icon').textContent = '✅';
        fileLabel.querySelector('.file-text').textContent = `${pdfFiles.length} PDF${pdfFiles.length > 1 ? 's' : ''} Selected`;
        fileLabel.querySelector('.file-subtext').textContent = 'Click to add more files or drag & drop additional PDFs';
        fileCount.textContent = `Total size: ${getTotalSize()}`;
        fileCount.style.display = 'block';
        
        pdfList.style.display = 'block';
        pdfList.innerHTML = pdfFiles.map((file, index) => `
            <div class="pdf-item" data-index="${index}">
                <div class="pdf-info">
                    <span>📄</span>
                    <span class="pdf-name">${file.name}</span>
                    <span class="pdf-size">(${(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
                <div class="pdf-actions">
                    <button class="move-btn" onclick="moveFile(${index}, -1)" ${index === 0 ? 'disabled' : ''} title="Move up">⬆️</button>
                    <button class="move-btn" onclick="moveFile(${index}, 1)" ${index === pdfFiles.length - 1 ? 'disabled' : ''} title="Move down">⬇️</button>
                    <button class="remove-btn" onclick="removeFile(${index})" title="Remove">❌</button>
                </div>
            </div>
        `).join('');
    }
}

function getTotalSize() {
    const totalBytes = pdfFiles.reduce((sum, file) => sum + file.size, 0);
    return (totalBytes / 1024 / 1024).toFixed(2) + ' MB';
}

function moveFile(index, direction) {
    if (direction === -1 && index > 0) {
        [pdfFiles[index], pdfFiles[index - 1]] = [pdfFiles[index - 1], pdfFiles[index]];
    } else if (direction === 1 && index < pdfFiles.length - 1) {
        [pdfFiles[index], pdfFiles[index + 1]] = [pdfFiles[index + 1], pdfFiles[index]];
    }
    updateFileDisplay();
}

function removeFile(index) {
    pdfFiles.splice(index, 1);
    updateFileDisplay();
    updateMergeButton();
}

function clearAllFiles() {
    pdfFiles = [];
    mergedPdfBlob = null;
    document.getElementById('pdfFiles').value = '';
    document.getElementById('status').style.display = 'none';
    updateFileDisplay();
    updateMergeButton();
}

function updateMergeButton() {
    const mergeBtn = document.getElementById('mergeBtn');
    mergeBtn.disabled = pdfFiles.length < 2;
}

async function mergePDFs() {
    if (pdfFiles.length < 2) {
        showStatus('Please select at least 2 PDF files to merge.', 'error');
        return;
    }

    const mergeBtn = document.getElementById('mergeBtn');
    const btnText = document.getElementById('btnText');
    
    try {
        // Show loading state
        mergeBtn.disabled = true;
        btnText.innerHTML = '<span class="loading-spinner"></span>Merging PDFs...';
        showStatus(`Processing ${pdfFiles.length} PDF files...`, 'processing');

        // Create new PDF document
        const mergedPdf = await PDFLib.PDFDocument.create();
        let totalPages = 0;

        // Process each PDF file in order
        for (let i = 0; i < pdfFiles.length; i++) {
            const file = pdfFiles[i];
            btnText.innerHTML = `<span class="loading-spinner"></span>Processing ${file.name} (${i + 1}/${pdfFiles.length})...`;
            
            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
                const pageIndices = pdf.getPageIndices();
                const pages = await mergedPdf.copyPages(pdf, pageIndices);
                
                pages.forEach((page) => mergedPdf.addPage(page));
                totalPages += pageIndices.length;
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
                showStatus(`Error processing "${file.name}". This file may be corrupted or password-protected.`, 'error');
                return;
            }
        }

        btnText.innerHTML = '<span class="loading-spinner"></span>Finalizing merged PDF...';

        // Save the merged PDF
        const pdfBytes = await mergedPdf.save();

        // Create blob and store it globally
        mergedPdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
        
        // Generate filename
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = `merged-pdf-${timestamp}.pdf`;

        // Show success message with download button
        const statusDiv = document.getElementById('status');
        statusDiv.className = 'status success';
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = `
            <div>✅ Successfully merged ${pdfFiles.length} PDFs into one document!</div>
            <div style="color: #666; font-size: 0.9em; margin: 5px 0;">Total pages: ${totalPages} | Size: ${(mergedPdfBlob.size / 1024 / 1024).toFixed(2)} MB</div>
            <div style="margin-top: 15px;">
                <button class="download-btn" onclick="downloadMergedPDF('${filename}')">
                    📥 Download Merged PDF
                </button>
                <button class="download-btn" onclick="previewPDF()" style="background: linear-gradient(45deg, #6f42c1, #563d7c);">
                    👁️ Preview PDF
                </button>
            </div>
        `;

    } catch (error) {
        console.error('Error merging PDFs:', error);
        showStatus('Error merging PDFs. Please check that all files are valid PDF documents and try again.', 'error');
    } finally {
        // Reset button state
        mergeBtn.disabled = false;
        btnText.textContent = '📎 Merge PDFs';
        updateMergeButton();
    }
}

function downloadMergedPDF(filename) {
    if (!mergedPdfBlob) {
        showStatus('No merged PDF available. Please merge PDFs first.', 'error');
        return;
    }

    try {
        const downloadUrl = URL.createObjectURL(mergedPdfBlob);
        const downloadLink = document.createElement('a');
        downloadLink.href = downloadUrl;
        downloadLink.download = filename;
        downloadLink.style.display = 'none';
        
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        setTimeout(() => {
            URL.revokeObjectURL(downloadUrl);
        }, 1000);

        showStatus('Download started! Check your downloads folder.', 'success');
        
    } catch (error) {
        console.error('Download error:', error);
        showStatus('Download failed. Please try again.', 'error');
    }
}

function previewPDF() {
    if (!mergedPdfBlob) {
        showStatus('No merged PDF available. Please merge PDFs first.', 'error');
        return;
    }

    try {
        const previewUrl = URL.createObjectURL(mergedPdfBlob);
        const previewWindow = window.open(previewUrl, '_blank');
        
        if (!previewWindow) {
            showStatus('Please allow popups to preview the PDF.', 'error');
        } else {
            setTimeout(() => {
                URL.revokeObjectURL(previewUrl);
            }, 5000);
        }
    } catch (error) {
        console.error('Preview error:', error);
        showStatus('Preview failed. Please try downloading instead.', 'error');
    }
}

function showStatus(message, type) {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';

    if (type === 'error') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 7000);
    }
}

// Enhanced drag and drop functionality
const fileLabel = document.getElementById('fileLabel');

fileLabel.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileLabel.style.borderColor = '#764ba2';
    fileLabel.style.backgroundColor = 'rgba(118, 75, 162, 0.2)';
    fileLabel.style.transform = 'scale(1.02)';
});

fileLabel.addEventListener('dragleave', (e) => {
    e.preventDefault();
    fileLabel.style.borderColor = '#667eea';
    fileLabel.style.backgroundColor = 'rgba(102, 126, 234, 0.1)';
    fileLabel.style.transform = 'scale(1)';
});

fileLabel.addEventListener('drop', (e) => {
    e.preventDefault();
    fileLabel.style.borderColor = '#667eea';
    fileLabel.style.backgroundColor = 'rgba(102, 126, 234, 0.1)';
    fileLabel.style.transform = 'scale(1)';
    
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
});

// Prevent default drag behaviors on document
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());

// Initialize
updateFileDisplay();
updateMergeButton();