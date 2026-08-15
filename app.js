// Điền URL Web App của Apps Script sau khi deploy (xem README.md).
const API_URL = 'https://script.google.com/macros/s/AKfycbxL5ht1alt37qFa1o8umThE2FFsqdA2h5Uns-DjsWa7FzNIK5Luszj-V1QjwnTe1cU3/exec';

const DAY_LABELS = { Mon: 'Thứ 2', Tue: 'Thứ 3', Wed: 'Thứ 4', Thu: 'Thứ 5', Fri: 'Thứ 6' };
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const statusEl = document.getElementById('status');
const currentEl = document.getElementById('week-current');
const nextEl = document.getElementById('week-next');
const todayHeroEl = document.getElementById('today-hero');
const modalOverlay = document.getElementById('modal-overlay');
const modalContent = document.getElementById('modal-content');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const themeToggle = document.getElementById('theme-toggle');
const themeToggleIcon = document.getElementById('theme-toggle-icon');
const themeToggleLabel = document.getElementById('theme-toggle-label');

function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'light' || saved === 'dark') {
    document.documentElement.setAttribute('data-theme', saved);
  }
  updateThemeIcon();
}
function updateThemeIcon() {
  const current = document.documentElement.getAttribute('data-theme');
  const isDark = current === 'dark' || (!current && window.matchMedia('(prefers-color-scheme: dark)').matches);
  themeToggleIcon.textContent = isDark ? '☀️' : '🌙';
  themeToggleLabel.textContent = isDark ? 'Chế độ sáng' : 'Chế độ tối';
}
themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const isDark = current === 'dark' || (!current && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const next = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeIcon();
});

function showStatus(msg, type) {
  statusEl.hidden = false;
  statusEl.textContent = msg;
  statusEl.className = 'status-msg ' + (type || '');
}
function hideStatus() {
  statusEl.hidden = true;
}

function closeModal() {
  modalOverlay.hidden = true;
  modalContent.innerHTML = '';
}
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});
lightbox.addEventListener('click', () => { lightbox.hidden = true; lightboxImg.src = ''; });

function openLightbox(url) {
  lightboxImg.src = url;
  lightbox.hidden = false;
}

function mondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}
function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function fmtRange(weekStr) {
  const monday = new Date(weekStr + 'T00:00:00');
  const friday = new Date(monday);
  friday.setDate(friday.getDate() + 4);
  const opts = { day: '2-digit', month: '2-digit' };
  return `${monday.toLocaleDateString('vi-VN', opts)} – ${friday.toLocaleDateString('vi-VN', opts)}`;
}

async function apiGet(weeks) {
  const url = weeks ? `${API_URL}?weeks=${weeks.join(',')}` : API_URL;
  const res = await fetch(url);
  return res.json();
}
async function apiPost(payload) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

function toBadge(to) {
  const span = document.createElement('span');
  span.className = `to-badge to-${to}`;
  span.textContent = `Tổ ${to}`;
  return span;
}

function renderWeekBlock(container, week, opts) {
  container.innerHTML = '';
  container.className = `week-block ${week.status}`;

  const head = document.createElement('div');
  head.className = 'week-head';
  const h2 = document.createElement('h2');
  h2.textContent = opts.title;
  const tag = document.createElement('span');
  tag.className = 'week-tag';
  tag.textContent = week.status === 'open' ? 'Đang mở đăng ký' : 'Đã chốt';
  head.appendChild(h2);
  head.appendChild(tag);

  const range = document.createElement('p');
  range.className = 'week-range';
  range.textContent = fmtRange(week.weekStart);

  container.appendChild(head);
  container.appendChild(range);

  const grid = document.createElement('div');
  grid.className = 'day-grid';

  const registeredTo = new Set(
    DAYS.map((d) => week.days[d].to).filter(Boolean).map(Number)
  );

  DAYS.forEach((d) => {
    const info = week.days[d];
    const card = document.createElement('div');
    card.className = 'day-card' + (info.to ? ' filled' : ' empty');
    if (info.to) card.style.setProperty('--to-color', `var(--to-${info.to})`);

    const label = document.createElement('div');
    label.className = 'day-label';
    label.textContent = DAY_LABELS[d];
    card.appendChild(label);

    if (info.to) {
      card.appendChild(toBadge(info.to));
    } else {
      const muted = document.createElement('div');
      muted.className = 'empty-note';
      muted.textContent = 'Chưa có tổ trực';
      card.appendChild(muted);
    }

    if (info.photoUrl) {
      const img = document.createElement('img');
      img.className = 'thumb';
      img.src = info.photoUrl;
      img.alt = `Ảnh trực ${DAY_LABELS[d]}`;
      img.addEventListener('click', () => openLightbox(info.photoUrl));
      card.appendChild(img);
    }

    const actions = document.createElement('div');
    actions.className = 'actions';

    if (week.status === 'open') {
      if (info.to) {
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-danger';
        cancelBtn.textContent = 'Hủy đăng ký';
        cancelBtn.addEventListener('click', () => handleUnregister(week, d));
        actions.appendChild(cancelBtn);
      } else {
        const regBtn = document.createElement('button');
        regBtn.className = 'btn btn-primary';
        regBtn.textContent = 'Đăng ký';
        regBtn.addEventListener('click', () => openRegisterModal(week, d, registeredTo));
        actions.appendChild(regBtn);
      }
    } else if (info.to && !info.photoUrl) {
      const uploadBtn = document.createElement('button');
      uploadBtn.className = 'btn btn-secondary';
      uploadBtn.textContent = 'Up ảnh vệ sinh';
      uploadBtn.addEventListener('click', () => openUploadModal(week, d, info.to));
      actions.appendChild(uploadBtn);
    } else if (info.to && info.photoUrl) {
      const reuploadBtn = document.createElement('button');
      reuploadBtn.className = 'btn btn-secondary';
      reuploadBtn.textContent = 'Up ảnh khác';
      reuploadBtn.addEventListener('click', () => openUploadModal(week, d, info.to));
      actions.appendChild(reuploadBtn);
    }

    card.appendChild(actions);
    grid.appendChild(card);
  });

  container.appendChild(grid);
}

function renderTodayHero(weekCurrent) {
  todayHeroEl.innerHTML = '';
  const jsDay = new Date().getDay(); // 0 = CN, 1 = T2, ... 6 = T7
  const dayKey = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri' }[jsDay];

  const eyebrow = document.createElement('span');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = 'Hôm nay · ' + new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' });

  const headline = document.createElement('div');
  headline.className = 'headline';

  const textWrap = document.createElement('div');
  textWrap.appendChild(eyebrow);
  textWrap.appendChild(headline);
  todayHeroEl.appendChild(textWrap);

  if (!dayKey) {
    todayHeroEl.classList.add('is-empty');
    headline.textContent = 'Cuối tuần — không có lịch trực';
    return;
  }

  const info = weekCurrent.days[dayKey];
  if (!info.to) {
    todayHeroEl.classList.add('is-empty');
    headline.textContent = 'Hôm nay chưa có tổ trực';
    return;
  }

  todayHeroEl.classList.remove('is-empty');
  todayHeroEl.style.setProperty('--to-current', `var(--to-${info.to})`);
  headline.innerHTML = `Tổ <span class="to-name">${info.to}</span> trực vệ sinh hôm nay`;

  if (info.photoUrl) {
    const img = document.createElement('img');
    img.className = 'today-thumb';
    img.src = info.photoUrl;
    img.alt = 'Ảnh trực vệ sinh hôm nay';
    img.addEventListener('click', () => openLightbox(info.photoUrl));
    todayHeroEl.appendChild(img);
  }
}

function openRegisterModal(week, day, registeredTo) {
  modalContent.innerHTML = '';
  const h3 = document.createElement('h3');
  h3.textContent = `Đăng ký trực ${DAY_LABELS[day]}`;
  modalContent.appendChild(h3);

  const p = document.createElement('p');
  p.className = 'hint';
  p.textContent = 'Chọn tổ của bạn:';
  modalContent.appendChild(p);

  const picker = document.createElement('div');
  picker.className = 'to-picker';
  let selected = null;
  for (let t = 1; t <= 5; t++) {
    const btn = document.createElement('button');
    btn.textContent = `Tổ ${t}`;
    if (registeredTo.has(t)) {
      btn.disabled = true;
      btn.title = 'Tổ này đã đăng ký ngày khác trong tuần';
    }
    btn.addEventListener('click', () => {
      selected = t;
      [...picker.children].forEach((c) => c.classList.remove('selected'));
      btn.classList.add('selected');
    });
    picker.appendChild(btn);
  }
  modalContent.appendChild(picker);

  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-secondary';
  cancelBtn.textContent = 'Đóng';
  cancelBtn.addEventListener('click', closeModal);
  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'btn btn-primary';
  confirmBtn.textContent = 'Xác nhận';
  confirmBtn.addEventListener('click', async () => {
    if (!selected) { showStatus('Vui lòng chọn tổ', 'error'); return; }
    closeModal();
    showStatus('Đang đăng ký...', 'loading');
    const res = await apiPost({ action: 'register', week: week.weekStart, day, to: selected });
    if (res.ok) { hideStatus(); load(); } else { showStatus(res.error || 'Có lỗi xảy ra', 'error'); }
  });
  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);
  modalContent.appendChild(actions);

  modalOverlay.hidden = false;
}

async function handleUnregister(week, day) {
  if (!confirm(`Hủy đăng ký ${DAY_LABELS[day]}?`)) return;
  showStatus('Đang hủy...', 'loading');
  const res = await apiPost({ action: 'unregister', week: week.weekStart, day });
  if (res.ok) { hideStatus(); load(); } else { showStatus(res.error || 'Có lỗi xảy ra', 'error'); }
}

function resizeImageToBase64(file, maxSize, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => { img.src = reader.result; };
    reader.onerror = reject;
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxSize) {
        height = Math.round((height * maxSize) / width);
        width = maxSize;
      } else if (height > maxSize) {
        width = Math.round((width * maxSize) / height);
        height = maxSize;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function openUploadModal(week, day, to) {
  modalContent.innerHTML = '';
  const h3 = document.createElement('h3');
  h3.textContent = `Up ảnh trực ${DAY_LABELS[day]} — Tổ ${to}`;
  modalContent.appendChild(h3);

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.className = 'file-input';
  modalContent.appendChild(input);

  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-secondary';
  cancelBtn.textContent = 'Đóng';
  cancelBtn.addEventListener('click', closeModal);
  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'btn btn-primary';
  confirmBtn.textContent = 'Tải lên';
  confirmBtn.addEventListener('click', async () => {
    if (!input.files[0]) { showStatus('Vui lòng chọn ảnh', 'error'); return; }
    closeModal();
    showStatus('Đang tải ảnh lên...', 'loading');
    try {
      const base64 = await resizeImageToBase64(input.files[0], 1200, 0.7);
      const res = await apiPost({ action: 'uploadPhoto', week: week.weekStart, day, to, imageBase64: base64 });
      if (res.ok) { hideStatus(); load(); } else { showStatus(res.error || 'Có lỗi xảy ra', 'error'); }
    } catch (err) {
      showStatus('Không thể xử lý ảnh: ' + err, 'error');
    }
  });
  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);
  modalContent.appendChild(actions);

  modalOverlay.hidden = false;
}

function updateCountdown() {
  const el = document.getElementById('countdown');
  const now = new Date();
  const thisMonday = mondayOf(now);
  let deadline = new Date(thisMonday);
  deadline.setDate(deadline.getDate() + 7); // 0h Thứ 2 tuần sau
  if (now >= deadline) {
    deadline.setDate(deadline.getDate() + 7);
  }
  const diffMs = deadline - now;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((diffMs / (1000 * 60)) % 60);
  el.textContent = `⏳ Còn ${days} ngày ${hours} giờ ${mins} phút để đăng ký trực tuần sau`;
}

async function load() {
  showStatus('Đang tải lịch trực...', 'loading');
  try {
    const data = await apiGet();
    if (!data.ok) throw new Error(data.error || 'Lỗi không xác định');
    hideStatus();
    const [weekCurrent, weekNext] = data.weeks;
    renderTodayHero(weekCurrent);
    renderWeekBlock(currentEl, weekCurrent, { title: 'Tuần này' });
    renderWeekBlock(nextEl, weekNext, { title: 'Tuần sau' });
  } catch (err) {
    showStatus('Không tải được dữ liệu: ' + err.message, 'error');
  }
}

initTheme();
updateCountdown();
setInterval(updateCountdown, 60 * 1000);
load();
