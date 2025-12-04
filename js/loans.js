const API_BASE = 'https://se2-backend-api-project.onrender.com/api';

const loanForm = document.getElementById("loan-form");
const loansList = document.getElementById("loans-list");
const resetLoanBtn = document.getElementById("reset-loan");

const memberSelect = document.getElementById("memberId");
const bookSelect = document.getElementById("bookId");

function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function getErrorMessage(status, text) {
  switch (status) {
    case 400: return `Bad request: ${text || 'Invalid data'}`;
    case 404: return 'Loan or resource not found';
    case 409: return `Conflict: ${text || 'Cannot create loan'}`;
    case 422: return `Invalid data: ${text || 'Check your inputs'}`;
    case 500: return `Server error: ${text || 'Please try again later'}`;
    default: return `Error ${status}: ${text || 'Unknown error'}`;
  }
}

async function loadDropdowns() {
  if (!memberSelect || !bookSelect) return;
  memberSelect.innerHTML = `<option value="">Select member</option>`;
  bookSelect.innerHTML = `<option value="">Select book</option>`;

  try {
    const [membersRes, booksRes] = await Promise.all([
      fetch(`${API_BASE}/members`),
      fetch(`${API_BASE}/books`)
    ]);

    if (!membersRes.ok) {
      const text = await membersRes.text().catch(() => '');
      throw new Error(getErrorMessage(membersRes.status, text));
    }
    if (!booksRes.ok) {
      const text = await booksRes.text().catch(() => '');
      throw new Error(getErrorMessage(booksRes.status, text));
    }

    const members = await membersRes.json();
    const books = await booksRes.json();

    if (Array.isArray(members) && members.length) {
      memberSelect.innerHTML += members.map(m =>
        `<option value="${m._id}">${escapeHtml(m.name)}</option>`
      ).join('');
    }

    if (Array.isArray(books) && books.length) {
      bookSelect.innerHTML += books.map(b =>
        `<option value="${b._id}">${escapeHtml(b.title)}</option>`
      ).join('');
    }
  } catch (err) {
    console.error('loadDropdowns error:', err);
    alert('Failed to load members or books: ' + err.message);
  }
}

async function fetchLoans() {
  if (!loansList) return;
  loansList.innerHTML = "Loading...";

  try {
    const res = await fetch(`${API_BASE}/loans`);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(getErrorMessage(res.status, text));
    }

    const loans = await res.json();

    if (!Array.isArray(loans) || loans.length === 0) {
      loansList.innerHTML = "<p>No loans yet.</p>";
      return;
    }

    let html = `<table class="table">
    <thead><tr>
      <th>Member</th><th>Book</th><th>Loaned At</th><th>Due At</th><th>Returned At</th><th>Actions</th>
    </tr></thead><tbody>`;

    loans.forEach(l => {
      html += `<tr>
        <td>${escapeHtml(l.memberId?.name || '?')}</td>
        <td>${escapeHtml(l.bookId?.title || '?')}</td>
        <td>${escapeHtml(l.loanedAt?.slice(0,10) || '')}</td>
        <td>${escapeHtml(l.dueAt?.slice(0,10) || '')}</td>
        <td>${l.returnedAt ? escapeHtml(l.returnedAt.slice(0,10)) : 'Not returned'}</td>
        <td>
          <button data-id="${l._id}" data-action="return">Mark Returned</button>
          <button data-id="${l._id}" data-action="delete">Delete</button>
        </td>
      </tr>`;
    });

    html += "</tbody></table>";
    loansList.innerHTML = html;

    loansList.querySelectorAll("[data-action='delete']")
      .forEach(btn => btn.addEventListener("click", onDeleteLoan));
    loansList.querySelectorAll("[data-action='return']")
      .forEach(btn => btn.addEventListener("click", onReturnLoan));
  } catch (err) {
    loansList.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
    console.error('fetchLoans error:', err);
  }
}

if (loanForm) {
  loanForm.addEventListener("submit", async e => {
    e.preventDefault();

    const memberId = memberSelect?.value;
    const bookId = bookSelect?.value;
    const loanedAt = document.getElementById('loanedAt')?.value;
    const dueAt = document.getElementById('dueAt')?.value;

    if (!memberId || !bookId || !loanedAt || !dueAt) {
      return alert('Please complete all loan fields.');
    }

    try {
      const submitBtn = loanForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      const res = await fetch(`${API_BASE}/loans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, bookId, loanedAt, dueAt })
      });

      const text = await res.text().catch(() => '');
      if (!res.ok) {
        throw new Error(getErrorMessage(res.status, text));
      }

      loanForm.reset();
      await loadDropdowns();
      await fetchLoans();
      alert('Loan created successfully!');
    } catch (err) {
      alert(err.message || 'Error creating loan');
      console.error('Create loan error:', err);
    } finally {
      const submitBtn = loanForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

if (resetLoanBtn) {
  resetLoanBtn.addEventListener("click", () => loanForm.reset());
}

async function onDeleteLoan(e) {
  const id = e.target.dataset.id;
  if (!id) return;
  if (!confirm("Delete this loan?")) return;

  try {
    const btn = e.target;
    btn.disabled = true;

    const res = await fetch(`${API_BASE}/loans/${id}`, { method: "DELETE" });
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      throw new Error(getErrorMessage(res.status, text));
    }

    await fetchLoans();
    await loadDropdowns();
  } catch (err) {
    alert(err.message || "Delete failed");
    console.error('onDeleteLoan error:', err);
  }
}

async function onReturnLoan(e) {
  const id = e.target.dataset.id;
  if (!id) return;

  try {
    const btn = e.target;
    btn.disabled = true;

    const res = await fetch(`${API_BASE}/loans/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnedAt: new Date().toISOString() })
    });

    const text = await res.text().catch(() => '');
    if (!res.ok) {
      throw new Error(getErrorMessage(res.status, text));
    }

    await fetchLoans();
    await loadDropdowns();
    alert('Loan marked as returned!');
  } catch (err) {
    alert(err.message || "Mark returned failed");
    console.error('onReturnLoan error:', err);
  }
}

loadDropdowns();
fetchLoans();
