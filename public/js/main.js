// Constants
const ALLOWED_FILE_TYPES = ['.pdf', '.jpg', '.jpeg', '.png', '.txt'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// DOM Elements
const loadingScreen = document.getElementById('loading-screen');
const uploadForm = document.getElementById('upload-form');
const fileInput = document.getElementById('file-input');
const fileInfo = document.getElementById('file-info');
const progressBar = document.getElementById('progress-bar');
const progressPercent = document.getElementById('progress-percent');
const uploadProgressContainer = document.querySelector('.upload-progress-container');
const message = document.getElementById('message');
const fileList = document.getElementById('file-list');
const refreshBtn = document.getElementById('refresh-btn');
const downloadLink = document.getElementById('download-link');

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Show loading screen for a few seconds before fading out
    setTimeout(() => {
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            loadingScreen.style.visibility = 'hidden';
        }, 500);
    }, 3000);
    
    loadFiles();
    
    fileInput.addEventListener('change', handleFileSelect);
    uploadForm.addEventListener('submit', handleFormSubmit);
    refreshBtn.addEventListener('click', loadFiles);
});

// Functions
function handleFileSelect(event) {
    const file = event.target.files[0];
    
    if (!file) {
        fileInfo.innerHTML = '<p>No file selected</p>';
        return;
    }
    
    // Validate file type
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    const isValidType = ALLOWED_FILE_TYPES.includes(fileExtension);
    
    // Validate file size
    const isValidSize = file.size <= MAX_FILE_SIZE;
    
    let statusHTML = `
        <p><strong>Name:</strong> ${file.name}</p>
        <p><strong>Size:</strong> ${formatFileSize(file.size)}</p>
        <p><strong>Type:</strong> ${file.type || 'Unknown'}</p>
    `;
    
    if (!isValidType) {
        statusHTML += `<p class="error">Error: File type not supported</p>`;
    }
    
    if (!isValidSize) {
        statusHTML += `<p class="error">Error: File exceeds maximum size of ${formatFileSize(MAX_FILE_SIZE)}</p>`;
    }
    
    fileInfo.innerHTML = statusHTML;
    
    return isValidType && isValidSize;
}

function handleFormSubmit(event) {
    event.preventDefault();
    
    const file = fileInput.files[0];
    if (!file) {
        showMessage('Please select a file first', 'error');
        return;
    }
    
    // Validate again
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    const isValidType = ALLOWED_FILE_TYPES.includes(fileExtension);
    const isValidSize = file.size <= MAX_FILE_SIZE;
    
    if (!isValidType) {
        showMessage(`File type not supported. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}`, 'error');
        return;
    }
    
    if (!isValidSize) {
        showMessage(`File is too large. Maximum size: ${formatFileSize(MAX_FILE_SIZE)}`, 'error');
        return;
    }
    
    uploadFile(file);
}

function uploadFile(file) {
    // Create FormData instance
    const formData = new FormData();
    formData.append('file', file);
    
    // Disable form during upload
    setFormState(false);
    uploadProgressContainer.style.display = 'block';
    
    // Create and configure XHR
    const xhr = new XMLHttpRequest();
    
    // Setup progress tracking
    xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            progressBar.style.width = percentComplete + '%';
            progressPercent.textContent = percentComplete + '%';
        }
    });
    
    // Handle completion
    xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
            const response = JSON.parse(xhr.responseText);
            showMessage('File uploaded successfully!', 'success');
            createDownloadLink(response);
            loadFiles(); // Refresh file list
        } else {
            let errorMessage = 'Upload failed';
            try {
                const response = JSON.parse(xhr.responseText);
                errorMessage = response.message || response.error || 'Upload failed';
            } catch (e) {
                console.error('Could not parse error response:', e);
            }
            showMessage(errorMessage, 'error');
        }
        resetUploadForm();
    });
    
    // Handle errors
    xhr.addEventListener('error', () => {
        showMessage('Network error occurred', 'error');
        resetUploadForm();
    });
    
    // Handle abort
    xhr.addEventListener('abort', () => {
        showMessage('Upload aborted', 'error');
        resetUploadForm();
    });
    
    // Send the request
    xhr.open('POST', '/upload', true);
    xhr.send(formData);
}

function resetUploadForm() {
    progressBar.style.width = '0%';
    progressPercent.textContent = '0%';
    uploadProgressContainer.style.display = 'none';
    setFormState(true);
}

function loadFiles() {
    // Show loading spinner
    fileList.innerHTML = '<div class="loader"></div>';
    
    fetch('/files')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch files');
            }
            return response.json();
        })
        .then(data => {
            displayFiles(data.files);
        })
        .catch(error => {
            fileList.innerHTML = `
                <div class="no-files">
                    <p>Error loading files: ${error.message}</p>
                </div>
            `;
        });
}

function displayFiles(files) {
    if (!files || files.length === 0) {
        fileList.innerHTML = `
            <div class="no-files">
                <p>No files uploaded yet</p>
            </div>
        `;
        return;
    }
    
    // Clear previous content
    fileList.innerHTML = '';
    
    // Add each file to the list
    files.forEach(file => {
        const fileName = file.key.split('/').pop();
        const fileExtension = '.' + fileName.split('.').pop().toLowerCase();
        
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        
        // Determine icon based on file type
        let iconClass = 'fa-file';
        if (fileExtension === '.pdf') iconClass = 'fa-file-pdf';
        else if (['.jpg', '.jpeg', '.png'].includes(fileExtension)) iconClass = 'fa-file-image';
        else if (fileExtension === '.txt') iconClass = 'fa-file-alt';
        
        fileItem.innerHTML = `
            <div class="file-info-container">
                <div class="file-icon">
                    <i class="fas ${iconClass}"></i>
                </div>
                <div class="file-details">
                    <h4>${fileName}</h4>
                    <p>${formatFileSize(file.size)} • ${formatDate(file.lastModified)}</p>
                </div>
            </div>
            <div class="file-actions">
                <button type="button" class="select-btn" data-key="${file.key}" 
                    title="Select File">
                    <i class="fas fa-check-circle"></i>
                </button>
                <button type="button" class="download-btn" data-key="${file.key}" 
                    title="Download File">
                    <i class="fas fa-download"></i>
                </button>
                <button type="button" class="copy-link-btn" data-key="${file.key}" 
                    title="Copy Link">
                    <i class="fas fa-link"></i>
                </button>
            </div>
        `;
        
        // Add event listeners for actions
        const selectBtn = fileItem.querySelector('.select-btn');
        selectBtn.addEventListener('click', () => {
            // Select file and show in Last Upload section
            const filename = file.key.split('/').pop();
            const fileUrl = `${window.location.origin}/uploads/${filename}`;
            createDownloadLinkFromUrl(fileUrl, filename);
            showMessage('File selected!', 'success');
        });

        // Add copy link button event listener
        const copyBtn = fileItem.querySelector('.copy-link-btn');
        copyBtn.addEventListener('click', () => {
            generateShareLink(file.key);
        });

        // Add download button event listener
        const downloadBtn = fileItem.querySelector('.download-btn');
        downloadBtn.addEventListener('click', () => {
            downloadFile(file.key);
        });

        fileList.appendChild(fileItem);
    });
}

function generateShareLink(fileKey) {
    // Get the file name from the key
    const filename = fileKey.split('/').pop();
    
    // Create a direct link to the file
    const fileUrl = `${window.location.origin}/uploads/${filename}`;
    
    // Show the link in the download section
    createDownloadLinkFromUrl(fileUrl, filename);
    
    // Copy the link to clipboard
    copyToClipboard(fileUrl);
    showMessage('Link copied to clipboard!', 'success');
}

function createDownloadLink(uploadResult) {
    // Create a URL to the uploaded file
    const fileUrl = `${window.location.origin}/uploads/${uploadResult.fileName}`;
    createDownloadLinkFromUrl(fileUrl, uploadResult.fileName);
}

function createDownloadLinkFromUrl(url, fileName) {
    downloadLink.innerHTML = `
        <p>Your file is ready to share:</p>
        <div class="download-url-container">
            <div class="download-url" title="${url}">${url}</div>
            <button type="button" class="copy-btn" title="Copy to clipboard">
                <i class="fas fa-copy"></i>
            </button>
        </div>
        <div class="download-actions" style="margin-top:1rem;">
            <a href="${url}" download="${fileName}" class="modern-button" target="_blank">
                <i class="fas fa-download"></i> Download File
            </a>
            <button type="button" class="modern-button" onclick="window.open('${url}', '_blank')">
                <i class="fas fa-eye"></i> View File
            </button>
            <button type="button" class="modern-button delete-btn" data-filename="${fileName}">
                <i class="fas fa-trash"></i> Delete File
            </button>
        </div>
    `;
    
    // Add copy to clipboard functionality
    const copyBtn = downloadLink.querySelector('.copy-btn');
    copyBtn.addEventListener('click', () => {
        copyToClipboard(url);
        showMessage('Link copied to clipboard!', 'success');
    });
    
    // Add delete functionality
    const deleteBtn = downloadLink.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', () => {
        deleteFile(fileName);
    });
}

function downloadFile(fileKey) {
    const filename = fileKey.split('/').pop();
    const fileUrl = `${window.location.origin}/uploads/${filename}`;
    
    // Create a temporary link element and trigger download
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = fileUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    showMessage('Downloading file!', 'success');
}

function deleteFile(fileName) {
    // Make DELETE request to server
    fetch(`/delete/${fileName}`, {
        method: 'DELETE'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to delete file');
        }
        return response.json();
    })
    .then(data => {
        showMessage('File deleted successfully!', 'success');
        downloadLink.innerHTML = '';
        loadFiles(); // Refresh file list
    })
    .catch(error => {
        showMessage(`Error deleting file: ${error.message}`, 'error');
    });
}

function copyToClipboard(text) {
    // Create a temporary input element
    const input = document.createElement('input');
    input.style.position = 'fixed';
    input.style.opacity = 0;
    input.value = text;
    document.body.appendChild(input);
    
    // Select and copy
    input.select();
    input.setSelectionRange(0, 99999);
    document.execCommand('copy');
    
    // Clean up
    document.body.removeChild(input);
}

function showProgress(show) {
    const progressContainer = document.querySelector('.progress-container');
    if (show) {
        progressContainer.style.display = 'block';
    } else {
        progressContainer.style.display = 'none';
    }
}

function setFormState(enabled) {
    const submitBtn = uploadForm.querySelector('button[type="submit"]');
    fileInput.disabled = !enabled;
    submitBtn.disabled = !enabled;
    
    if (!enabled) {
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
    } else {
        submitBtn.innerText = 'Upload';
    }
}

function showMessage(text, type) {
    message.innerText = text;
    message.className = `message ${type}`;
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        message.className = 'message';
    }, 5000);
}

// Utility Functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}