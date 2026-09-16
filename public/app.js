const fileInput = document.getElementById('fileInput');
const dropzone = document.getElementById('dropzone');
const uploadBtn = document.getElementById('uploadBtn');
const uploadStatus = document.getElementById('uploadStatus');
const documentList = document.getElementById('documentList');
const askForm = document.getElementById('askForm');
const askBtn = document.getElementById('askBtn');
const questionInput = document.getElementById('questionInput');
const messages = document.getElementById('messages');
const tracePanel = document.getElementById('tracePanel');
const traceGrid = document.getElementById('traceGrid');
const sources = document.getElementById('sources');
const workspaceLabel = document.getElementById('workspaceLabel');

const workspaceKey = 'agentic-rag-workspace-id';
const docsKey = 'agentic-rag-documents';
const workspaceId = localStorage.getItem(workspaceKey) || crypto.randomUUID();
localStorage.setItem(workspaceKey, workspaceId);
workspaceLabel.textContent = `Workspace ${workspaceId.slice(0, 8)}`;

let selectedFile = null;
let uploadedDocs = JSON.parse(localStorage.getItem(docsKey) || '[]');

function renderDocs() {
  if (!uploadedDocs.length) {
    documentList.innerHTML = '<div class="empty">No documents uploaded yet.</div>';
    return;
  }

  documentList.innerHTML = uploadedDocs.map(doc => `
    <div class="doc">
      <strong title="${escapeHtml(doc.name)}">${escapeHtml(doc.name)}</strong>
      <small>${doc.chunks} chunks</small>
    </div>
  `).join('');
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setUploadStatus(message, isError = false) {
  uploadStatus.textContent = message;
  uploadStatus.classList.remove('hidden', 'error');
  if (isError) uploadStatus.classList.add('error');
}

function selectFile(file) {
  if (!file) return;
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    selectedFile = null;
    uploadBtn.disabled = true;
    return setUploadStatus('Please choose a PDF file.', true);
  }
  if (file.size > 20 * 1024 * 1024) {
    selectedFile = null;
    uploadBtn.disabled = true;
    return setUploadStatus('PDF is larger than 20 MB.', true);
  }

  selectedFile = file;
  uploadBtn.disabled = false;
  setUploadStatus(`${file.name} ready to upload.`);
}

fileInput.addEventListener('change', event => selectFile(event.target.files[0]));
['dragenter', 'dragover'].forEach(type => dropzone.addEventListener(type, event => {
  event.preventDefault();
  dropzone.classList.add('drag');
}));
['dragleave', 'drop'].forEach(type => dropzone.addEventListener(type, event => {
  event.preventDefault();
  dropzone.classList.remove('drag');
}));
dropzone.addEventListener('drop', event => selectFile(event.dataTransfer.files[0]));

uploadBtn.addEventListener('click', async () => {
  if (!selectedFile) return;
  uploadBtn.disabled = true;
  uploadBtn.textContent = 'Indexing…';
  setUploadStatus('Parsing, chunking, embedding and storing your PDF…');

  try {
    const response = await fetch('/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/pdf',
        'X-Workspace-Id': workspaceId,
        'X-File-Name': selectedFile.name
      },
      body: selectedFile
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Upload failed');

    uploadedDocs.push({ name: data.filename, chunks: data.chunks });
    localStorage.setItem(docsKey, JSON.stringify(uploadedDocs));
    renderDocs();
    setUploadStatus(`${data.filename} indexed: ${data.pointsStored} vectors stored.`);
    selectedFile = null;
    fileInput.value = '';
  } catch (error) {
    setUploadStatus(error.message, true);
  } finally {
    uploadBtn.textContent = 'Upload & index';
    uploadBtn.disabled = !selectedFile;
  }
});

function addMessage(role, text, loading = false) {
  const wrapper = document.createElement('div');
  wrapper.className = `message ${role}`;
  const content = role === 'assistant'
    ? `<div class="avatar">A</div><div class="bubble">${loading ? '<span class="loader"></span> Thinking through the graph…' : escapeHtml(text)}</div>`
    : `<div class="bubble">${escapeHtml(text)}</div>`;
  wrapper.innerHTML = content;
  messages.appendChild(wrapper);
  messages.scrollTop = messages.scrollHeight;
  return wrapper;
}

function renderTrace(route, sourceList = []) {
  tracePanel.classList.remove('hidden');
  const cells = [
    ['Query type', route.queryType || '—'],
    ['Retrieval', route.retrievalDecision || 'skipped'],
    ['Web search', route.webSearched ? 'used' : 'not used'],
    ['Generations', route.generations ?? '—'],
    ['Reflection', route.reflection || '—']
  ];

  traceGrid.innerHTML = cells.map(([label, value]) => `
    <div class="trace"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div>
  `).join('');

  sources.innerHTML = sourceList.length
    ? sourceList.map(source => `
      <article class="source">
        <b>${escapeHtml(source.type === 'web' ? (source.title || 'Web source') : (source.source || 'Document source'))}</b>
        ${source.url ? `<div><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener">Open source ↗</a></div>` : ''}
        <p>${escapeHtml(source.preview || source.parentText || source.childText || '')}</p>
      </article>
    `).join('')
    : '<div class="empty">No source cards returned for this query.</div>';
}

askForm.addEventListener('submit', async event => {
  event.preventDefault();
  const question = questionInput.value.trim();
  if (question.length < 3) return;

  addMessage('user', question);
  questionInput.value = '';
  askBtn.disabled = true;
  const pending = addMessage('assistant', '', true);

  try {
    const response = await fetch('/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, workspaceId })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Query failed');

    pending.remove();
    addMessage('assistant', data.answer || 'No answer returned.');
    renderTrace(data.route || {}, data.sources || []);
  } catch (error) {
    pending.remove();
    addMessage('assistant', `Request failed: ${error.message}`);
  } finally {
    askBtn.disabled = false;
    questionInput.focus();
  }
});

questionInput.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    askForm.requestSubmit();
  }
});

renderDocs();
