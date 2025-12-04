const API_BASE = 'https://se2-backend-api-project.onrender.com/api';

// Elements
const bookForm = document.getElementById('book-form');
const booksList = document.getElementById('books-list');
const resetBookBtn = document.getElementById('reset-book');
const modal = document.getElementById('modal');
const closeModalBtn = document.getElementById('close-modal');
const editBookForm = document.getElementById('edit-book-form');
let currentEditingId = null; // added

// Helper: escape HTML to avoid XSS when inserting into innerHTML
function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function getErrorMessage(status, text) {
  switch (status) {
    case 400: return `Bad request: ${text || 'Invalid data'}`;
    case 404: return 'Book not found';
    case 409: return `Conflict: ${text || 'Book already exists'}`;
    case 422: return `Invalid data: ${text || 'Check your inputs'}`;
    case 500: return `Server error: ${text || 'Please try again later'}`;
    default: return `Error ${status}: ${text || 'Unknown error'}`;
  }
}

async function fetchBooks() {
  if (!booksList) return;
  booksList.innerHTML = 'Loading...';
  try {
    const res = await fetch(`${API_BASE}/books`);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(getErrorMessage(res.status, text));
    }
    const data = await res.json();
    renderBooks(data);
  } catch (err) {
    booksList.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
    console.error('fetchBooks error:', err);
  }
}

function renderBooks(items) {
  if (!booksList) return;
  if (!items || items.length === 0) {
    booksList.innerHTML = '<div>No books found.</div>';
    return;
  }

  let html = '<table class="table"><thead><tr><th>ISBN</th><th>Title</th><th>Author</th><th>Copies</th><th>Actions</th></tr></thead><tbody>';
  items.forEach(b => {
    // ensure we use the MongoDB document _id for actions
    const id = b._id || b.id || '';
    html += `<tr>
      <td>${escapeHtml(b.isbn)}</td>
      <td>${escapeHtml(b.title)}</td>
      <td>${escapeHtml(b.author)}</td>
      <td>${escapeHtml(String(b.copies))}</td>
      <td>
        <button data-action="edit" data-id="${id}">Edit</button>
        <button data-action="delete" data-id="${id}">Delete</button>
      </td>
    </tr>`;
  });
  html += '</tbody></table>';
  booksList.innerHTML = html;

  // attach listeners
  booksList.querySelectorAll('button[data-action="edit"]').forEach(btn => btn.addEventListener('click', onEditClick));
  booksList.querySelectorAll('button[data-action="delete"]').forEach(btn => btn.addEventListener('click', onDeleteClick));
}

// Add book
if (bookForm) {
  bookForm.addEventListener('submit', async e => {
    e.preventDefault();

    const isbnRaw = document.getElementById('isbn').value.trim();
    if (!/^\d{13}$/.test(isbnRaw)) {
      return alert('ISBN must be exactly 13 numeric digits.');
    }
    const isbn = isbnRaw;

    const title = document.getElementById('title').value.trim();
    const author = document.getElementById('author').value.trim();
    const copiesVal = document.getElementById('copies').value;
    const copies = copiesVal === '' ? null : Number(copiesVal);

    if (copies === null || Number.isNaN(copies) || copies < 1) {
      return alert('Copies must be a number and at least 1.');
    }

    if (!isbn || !title || !author) {
      return alert('Please fill all fields correctly.');
    }

    try {
      const submitBtn = bookForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      const res = await fetch(`${API_BASE}/books`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isbn, title, author, copies })
      });

      const text = await res.text().catch(() => '');
      if (!res.ok) {
        throw new Error(getErrorMessage(res.status, text));
      }

      bookForm.reset();
      await fetchBooks();
      alert('Book added successfully!');
    } catch (err) {
      alert(err.message || 'Error adding book');
      console.error('Add book error:', err);
    } finally {
      const submitBtn = bookForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

// Reset button
if (resetBookBtn) {
  resetBookBtn.addEventListener('click', () => {
    if (bookForm) bookForm.reset();
  });
}

// Delete handler
async function onDeleteClick(e) {
  const id = e.currentTarget.dataset.id;
  if (!id) return;
  if (!confirm('Delete this book?')) return;
  try {
    const btn = e.currentTarget;
    btn.disabled = true;

    const res = await fetch(`${API_BASE}/books/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      throw new Error(getErrorMessage(res.status, text));
    }

    await fetchBooks();
  } catch (err) {
    alert(err.message || 'Error deleting book');
    console.error('Delete book error:', err);
  }
}

// Edit/Open modal
async function onEditClick(e) {
  const id = e.currentTarget.dataset.id;
  if (!id) return;
  try {
    const res = await fetch(`${API_BASE}/books/${id}`);
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      throw new Error(getErrorMessage(res.status, text));
    }

    const book = await JSON.parse(text);
    document.getElementById('edit-isbn').value = book.isbn || '';
    document.getElementById('edit-title').value = book.title || '';
    document.getElementById('edit-author').value = book.author || '';
    document.getElementById('edit-copies').value = book.copies || 0;
    currentEditingId = id;
    modal.classList.remove('hidden');
  } catch (err) {
    alert(err.message || 'Failed to fetch book');
    console.error('Edit book error:', err);
  }
}

// Close modal
if (closeModalBtn) {
  closeModalBtn.addEventListener('click', () => {
    if (modal) modal.classList.add('hidden');
  });
  // also close on outside click
  if (modal) {
    modal.addEventListener('click', (ev) => {
      if (ev.target === modal) modal.classList.add('hidden');
    });
  }
}

// Submit edit
if (editBookForm) {
  editBookForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (!currentEditingId) return alert('No book selected.');

    const editedCopies = Number(document.getElementById('edit-copies').value);
    if (Number.isNaN(editedCopies) || editedCopies < 1) {
      return alert('Copies must be a number and at least 1.');
    }

    const payload = {
      isbn: document.getElementById('edit-isbn').value.trim(),
      title: document.getElementById('edit-title').value.trim(),
      author: document.getElementById('edit-author').value.trim(),
      copies: editedCopies
    };

    try {
      const submitBtn = editBookForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      const res = await fetch(`${API_BASE}/books/${currentEditingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const text = await res.text().catch(() => '');
      if (!res.ok) {
        throw new Error(getErrorMessage(res.status, text));
      }

      modal.classList.add('hidden');
      currentEditingId = null;
      await fetchBooks();
      alert('Book updated successfully!');
    } catch (err) {
      alert(err.message || 'Failed to update book');
      console.error('Edit book error:', err);
    } finally {
      const submitBtn = editBookForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

// Initialize
fetchBooks();
