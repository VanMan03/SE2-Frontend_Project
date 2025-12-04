const API_BASE = 'https://se2-backend-api-project.onrender.com/api';

// Elements
const memberForm = document.getElementById('member-form');
const membersList = document.getElementById('members-list');
const resetMemberBtn = document.getElementById('reset-member');
const modal = document.getElementById('modal');
const closeModalBtn = document.getElementById('close-modal');
const editMemberForm = document.getElementById('edit-member-form');

// explicit inputs
const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const joinedAtInput = document.getElementById('joinedAt');

let currentEditingId = null;

function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  }[c]));
}

function getErrorMessage(status, text) {
  switch (status) {
    case 400: return `Bad request: ${text || 'Invalid data'}`;
    case 404: return 'Member not found';
    case 409: return `Conflict: ${text || 'Member already exists'}`;
    case 422: return `Invalid data: ${text || 'Check your inputs'}`;
    case 500: return `Server error: ${text || 'Please try again later'}`;
    default: return `Error ${status}: ${text || 'Unknown error'}`;
  }
}

async function fetchMembers() {
  if (!membersList) return;
  membersList.innerHTML = "Loading...";
  try {
    const res = await fetch(`${API_BASE}/members`);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(getErrorMessage(res.status, text));
    }
    const data = await res.json();
    renderMembers(data);
  } catch (err) {
    membersList.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
    console.error('fetchMembers error:', err);
  }
}

function renderMembers(items) {
  if (!items || items.length === 0) {
    membersList.innerHTML = "<p>No members yet.</p>";
    return;
  }

  let html = `<table class="table">
  <thead>
    <tr><th>Name</th><th>Email</th><th>Joined</th><th>Actions</th></tr>
  </thead><tbody>`;

  items.forEach(m => {
    const id = m._id;
    html += `
      <tr>
        <td>${escapeHtml(m.name)}</td>
        <td>${escapeHtml(m.email)}</td>
        <td>${escapeHtml(m.joinedAt?.slice(0,10) || '')}</td>
        <td>
          <button data-action="edit" data-id="${id}">Edit</button>
          <button data-action="delete" data-id="${id}">Delete</button>
        </td>
      </tr>`;
  });

  html += "</tbody></table>";
  membersList.innerHTML = html;

  membersList.querySelectorAll("[data-action='edit']")
    .forEach(btn => btn.addEventListener("click", onEdit));
  membersList.querySelectorAll("[data-action='delete']")
    .forEach(btn => btn.addEventListener("click", onDelete));
}

if (memberForm) {
  memberForm.addEventListener("submit", async e => {
    e.preventDefault();

    const newMember = {
      name: nameInput?.value.trim(),
      email: emailInput?.value.trim(),
      joinedAt: joinedAtInput?.value
    };

    if (!newMember.name || !newMember.email || !newMember.joinedAt)
      return alert("Complete all fields.");

    try {
      const submitBtn = memberForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      const res = await fetch(`${API_BASE}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMember)
      });

      const text = await res.text().catch(() => '');
      if (!res.ok) {
        throw new Error(getErrorMessage(res.status, text));
      }

      memberForm.reset();
      await fetchMembers();
      alert('Member added successfully!');
    } catch (err) {
      alert(err.message || "Error adding member");
      console.error('Add member error:', err);
    } finally {
      const submitBtn = memberForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

if (resetMemberBtn) {
  resetMemberBtn.addEventListener("click", () => memberForm.reset());
}

async function onDelete(e) {
  const id = e.target.dataset.id;
  if (!id) return;
  if (!confirm("Delete this member?")) return;

  try {
    const btn = e.target;
    btn.disabled = true;

    const res = await fetch(`${API_BASE}/members/${id}`, { method: "DELETE" });
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      throw new Error(getErrorMessage(res.status, text));
    }

    await fetchMembers();
  } catch (err) {
    alert(err.message || "Delete failed");
    console.error('Delete member error:', err);
  }
}

async function onEdit(e) {
  const id = e.target.dataset.id;
  if (!id) return;
  currentEditingId = id;

  try {
    const res = await fetch(`${API_BASE}/members/${id}`);
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      throw new Error(getErrorMessage(res.status, text));
    }

    const data = await JSON.parse(text);

    document.getElementById("edit-name").value = data.name || '';
    document.getElementById("edit-email").value = data.email || '';
    document.getElementById("edit-joinedAt").value = data.joinedAt?.slice(0,10) || '';

    modal.classList.remove("hidden");
  } catch (err) {
    alert(err.message || "Failed to fetch member");
    console.error('Edit fetch error:', err);
  }
}

if (closeModalBtn) {
  closeModalBtn.addEventListener("click", () => {
    modal.classList.add("hidden");
  });
}

if (editMemberForm) {
  editMemberForm.addEventListener("submit", async e => {
    e.preventDefault();
    if (!currentEditingId) return alert('No member selected.');

    const updated = {
      name: document.getElementById('edit-name').value.trim(),
      email: document.getElementById('edit-email').value.trim(),
      joinedAt: document.getElementById('edit-joinedAt').value
    };

    try {
      const submitBtn = editMemberForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      const res = await fetch(`${API_BASE}/members/${currentEditingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated)
      });

      const text = await res.text().catch(() => '');
      if (!res.ok) {
        throw new Error(getErrorMessage(res.status, text));
      }

      modal.classList.add("hidden");
      await fetchMembers();
      alert('Member updated successfully!');
    } catch (err) {
      alert(err.message || "Update failed");
      console.error('Update member error:', err);
    } finally {
      const submitBtn = editMemberForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

fetchMembers();
