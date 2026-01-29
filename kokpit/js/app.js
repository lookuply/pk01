/**
 * Main application
 */

const app = {
    mainContent: null,
    currentRoute: null,

    async init() {
        this.mainContent = document.getElementById('mainContent');

        // Initialize theme
        this.initTheme();

        // Initialize auth
        const loggedIn = await auth.init();

        if (loggedIn) {
            this.showLoggedInUI();
            this.loadNotifications();
        }

        // Setup router
        window.addEventListener('hashchange', () => this.handleRoute());
        this.handleRoute();

        // Setup event listeners
        this.setupEventListeners();
    },

    initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
    },

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    },

    setupEventListeners() {
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', async (e) => {
            e.preventDefault();
            await auth.logout();
            this.showLoggedOutUI();
            window.location.hash = '#/login';
        });
    },

    showLoggedInUI() {
        document.getElementById('navRight').style.display = 'flex';
        document.getElementById('userName').textContent = auth.user.full_name;
    },

    showLoggedOutUI() {
        document.getElementById('navRight').style.display = 'none';
    },

    async loadNotifications() {
        try {
            const data = await api.getNotifications({ unread_only: true, limit: 10 });
            const badge = document.getElementById('notificationBadge');
            if (data.unread_count > 0) {
                badge.textContent = data.unread_count > 99 ? '99+' : data.unread_count;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        } catch (error) {
            console.error('Failed to load notifications:', error);
        }
    },

    handleRoute() {
        const hash = window.location.hash || '#/';
        const [path, params] = hash.slice(1).split('?');
        const segments = path.split('/').filter(Boolean);

        // Protected routes
        if (!auth.isLoggedIn() && path !== '/login') {
            window.location.hash = '#/login';
            return;
        }

        // Route matching
        if (path === '/login') {
            this.renderLogin();
        } else if (path === '/' || path === '/dashboard') {
            this.renderDashboard();
        } else if (path === '/projects') {
            this.renderProjects();
        } else if (path === '/users' && auth.isAdmin()) {
            this.renderUsers();
        } else if (segments[0] === 'projects' && segments[1]) {
            const projectId = parseInt(segments[1]);
            if (segments[2] === 'stories' && segments[3]) {
                this.renderStoryDetail(projectId, parseInt(segments[3]));
            } else if (segments[2] === 'stories') {
                this.renderStories(projectId);
            } else if (segments[2] === 'issues' && segments[3]) {
                this.renderIssueDetail(projectId, parseInt(segments[3]));
            } else if (segments[2] === 'issues') {
                this.renderIssues(projectId);
            } else {
                this.renderProjectDetail(projectId);
            }
        } else {
            this.render404();
        }
    },

    renderLogin() {
        this.mainContent.innerHTML = `
            <div class="login-page">
                <div class="card login-card">
                    <h2 class="card-title">Prihlásenie</h2>
                    <form id="loginForm">
                        <div class="form-group">
                            <label class="form-label" for="email">Email</label>
                            <input type="email" id="email" name="email" class="form-input" required autofocus>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="password">Heslo</label>
                            <input type="password" id="password" name="password" class="form-input" required>
                        </div>
                        <button type="submit" class="btn btn-primary" style="width: 100%;">Prihlásiť sa</button>
                    </form>
                </div>
            </div>
        `;

        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = form.getData(e.target);

            try {
                await auth.login(data.email, data.password);
                this.showLoggedInUI();
                this.loadNotifications();
                window.location.hash = '#/dashboard';
                toast.success('Úspešne prihlásený');
            } catch (error) {
                toast.error(error.message);
            }
        });
    },

    async renderDashboard() {
        this.mainContent.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        try {
            const [projectsData, notificationsData] = await Promise.all([
                api.getProjects({ limit: 5 }),
                api.getNotifications({ limit: 5 }),
            ]);

            this.mainContent.innerHTML = `
                <div class="container">
                    <div class="dashboard">
                        <div class="dashboard-header">
                            <h1>Dashboard</h1>
                            <a href="#/projects" class="btn btn-primary">Nový projekt</a>
                        </div>

                        <div class="stats-grid">
                            <div class="card stat-card">
                                <div class="stat-value">${projectsData.total}</div>
                                <div class="stat-label">Aktívne projekty</div>
                            </div>
                            <div class="card stat-card">
                                <div class="stat-value">${notificationsData.unread_count}</div>
                                <div class="stat-label">Neprečítané notifikácie</div>
                            </div>
                            ${auth.isAdmin() ? `
                                <a href="#/users" class="card stat-card" style="text-decoration: none; color: inherit;">
                                    <div class="stat-label">Správa používateľov</div>
                                    <div style="margin-top: var(--spacing-xs);">Spravovať →</div>
                                </a>
                            ` : ''}
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">Posledné projekty</h3>
                                <a href="#/projects" class="btn btn-secondary btn-sm">Všetky projekty</a>
                            </div>
                            ${projectsData.items.length > 0 ? `
                                <div class="project-grid">
                                    ${projectsData.items.map(project => `
                                        <div class="card project-card" onclick="window.location.hash='#/projects/${project.id}'">
                                            <h3>${this.escapeHtml(project.name)}</h3>
                                            <p>${this.escapeHtml(project.description || 'Bez popisu')}</p>
                                            <div class="project-meta">
                                                <span class="badge badge-${project.status}">${this.formatStatus(project.status)}</span>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : `
                                <div class="empty-state">
                                    <p>Zatiaľ nemáte žiadne projekty.</p>
                                    <button class="btn btn-primary" onclick="app.showNewProjectModal()">Vytvoriť projekt</button>
                                </div>
                            `}
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            toast.error('Nepodarilo sa načítať dashboard');
            console.error(error);
        }
    },

    async renderProjects() {
        this.mainContent.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        try {
            const data = await api.getProjects();

            this.mainContent.innerHTML = `
                <div class="container">
                    <div class="dashboard">
                        <div class="dashboard-header">
                            <h1>Projekty</h1>
                            <button class="btn btn-primary" onclick="app.showNewProjectModal()">Nový projekt</button>
                        </div>

                        <div class="filters">
                            <button class="filter-btn active" data-status="">Všetky</button>
                            <button class="filter-btn" data-status="active">Aktívne</button>
                            <button class="filter-btn" data-status="on_hold">Pozastavené</button>
                            <button class="filter-btn" data-status="completed">Dokončené</button>
                        </div>

                        ${data.items.length > 0 ? `
                            <div class="project-grid" id="projectGrid">
                                ${data.items.map(project => this.renderProjectCard(project)).join('')}
                            </div>
                        ` : `
                            <div class="empty-state">
                                <p>Zatiaľ nemáte žiadne projekty.</p>
                                <button class="btn btn-primary" onclick="app.showNewProjectModal()">Vytvoriť projekt</button>
                            </div>
                        `}
                    </div>
                </div>
            `;

            // Filter buttons
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const status = btn.dataset.status;
                    const filtered = await api.getProjects(status ? { status } : {});
                    document.getElementById('projectGrid').innerHTML = filtered.items.map(p => this.renderProjectCard(p)).join('');
                });
            });
        } catch (error) {
            toast.error('Nepodarilo sa načítať projekty');
            console.error(error);
        }
    },

    renderProjectCard(project) {
        return `
            <div class="card project-card" onclick="window.location.hash='#/projects/${project.id}'">
                <h3>${this.escapeHtml(project.name)}</h3>
                <p>${this.escapeHtml(project.description || 'Bez popisu')}</p>
                <div class="project-meta">
                    <span class="badge badge-${project.status}">${this.formatStatus(project.status)}</span>
                    <span>${this.formatDate(project.updated_at)}</span>
                </div>
            </div>
        `;
    },

    async renderProjectDetail(projectId) {
        this.mainContent.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        try {
            const project = await api.getProject(projectId);

            this.mainContent.innerHTML = `
                <div class="container">
                    <div class="dashboard">
                        <div class="dashboard-header">
                            <div>
                                <a href="#/projects" style="color: var(--color-text-muted); font-size: 13px;">← Späť na projekty</a>
                                <h1>${this.escapeHtml(project.name)}</h1>
                                <p style="color: var(--color-text-muted);">${this.escapeHtml(project.description || '')}</p>
                            </div>
                            <div style="display: flex; gap: var(--spacing-sm);">
                                <button class="btn btn-secondary" onclick="app.showEditProjectModal(${projectId})">Upraviť</button>
                            </div>
                        </div>

                        <div class="stats-grid">
                            <a href="#/projects/${projectId}/stories" class="card stat-card" style="text-decoration: none; color: inherit;">
                                <div class="stat-label">User Stories</div>
                                <div style="margin-top: var(--spacing-xs);">Zobraziť všetky →</div>
                            </a>
                            <a href="#/projects/${projectId}/issues" class="card stat-card" style="text-decoration: none; color: inherit;">
                                <div class="stat-label">Issues</div>
                                <div style="margin-top: var(--spacing-xs);">Zobraziť všetky →</div>
                            </a>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">Členovia projektu</h3>
                                ${auth.isEmployee() ? `<button class="btn btn-secondary btn-sm" onclick="app.showAddMemberModal(${projectId})">Pridať člena</button>` : ''}
                            </div>
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>Meno</th>
                                        <th>Email</th>
                                        <th>Rola</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>${this.escapeHtml(project.owner.full_name)}</td>
                                        <td>${this.escapeHtml(project.owner.email)}</td>
                                        <td><span class="badge">Vlastník</span></td>
                                        <td></td>
                                    </tr>
                                    ${project.members.map(member => `
                                        <tr>
                                            <td>${this.escapeHtml(member.user.full_name)}</td>
                                            <td>${this.escapeHtml(member.user.email)}</td>
                                            <td><span class="badge">${this.formatMemberRole(member.role)}</span></td>
                                            <td>
                                                ${auth.isEmployee() ? `
                                                    <button class="btn btn-sm btn-secondary" onclick="app.removeMember(${projectId}, ${member.user_id})">Odstrániť</button>
                                                ` : ''}
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            toast.error('Nepodarilo sa načítať projekt');
            console.error(error);
        }
    },

    async renderStories(projectId) {
        this.mainContent.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        try {
            const [project, storiesData] = await Promise.all([
                api.getProject(projectId),
                api.getStories(projectId),
            ]);

            this.mainContent.innerHTML = `
                <div class="container">
                    <div class="dashboard">
                        <div class="dashboard-header">
                            <div>
                                <a href="#/projects/${projectId}" style="color: var(--color-text-muted); font-size: 13px;">← ${this.escapeHtml(project.name)}</a>
                                <h1>User Stories</h1>
                            </div>
                            <button class="btn btn-primary" onclick="app.showNewStoryModal(${projectId})">Nová story</button>
                        </div>

                        <div class="filters">
                            <button class="filter-btn active" data-status="">Všetky</button>
                            <button class="filter-btn" data-status="draft">Draft</button>
                            <button class="filter-btn" data-status="pending_review">Na schválenie</button>
                            <button class="filter-btn" data-status="approved">Schválené</button>
                            <button class="filter-btn" data-status="in_progress">V práci</button>
                            <button class="filter-btn" data-status="done">Hotové</button>
                        </div>

                        ${storiesData.items.length > 0 ? `
                            <div class="card">
                                <div class="story-list" id="storyList">
                                    ${storiesData.items.map(story => this.renderStoryItem(story, projectId)).join('')}
                                </div>
                            </div>
                        ` : `
                            <div class="empty-state">
                                <p>Zatiaľ nemáte žiadne user stories.</p>
                                <button class="btn btn-primary" onclick="app.showNewStoryModal(${projectId})">Vytvoriť story</button>
                            </div>
                        `}
                    </div>
                </div>
            `;

            // Filter buttons
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const status = btn.dataset.status;
                    const filtered = await api.getStories(projectId, status ? { status } : {});
                    document.getElementById('storyList').innerHTML = filtered.items.map(s => this.renderStoryItem(s, projectId)).join('');
                });
            });
        } catch (error) {
            toast.error('Nepodarilo sa načítať stories');
            console.error(error);
        }
    },

    renderStoryItem(story, projectId) {
        return `
            <div class="story-item card" onclick="window.location.hash='#/projects/${projectId}/stories/${story.id}'">
                <div class="story-header">
                    <span class="story-id">#${story.id}</span>
                    <span class="badge badge-${story.status}">${this.formatStatus(story.status)}</span>
                    <span class="badge badge-${story.priority}">${this.formatPriority(story.priority)}</span>
                </div>
                <div class="story-template">
                    <strong>Ako</strong> ${this.escapeHtml(story.as_a)}, <strong>chcem</strong> ${this.escapeHtml(story.i_want_to)}, <strong>aby som</strong> ${this.escapeHtml(story.so_that)}
                </div>
                <div class="story-footer">
                    <span>Vytvoril: ${this.escapeHtml(story.created_by.full_name)}</span>
                    <span>${this.formatDate(story.created_at)}</span>
                </div>
            </div>
        `;
    },

    async renderStoryDetail(projectId, storyId) {
        this.mainContent.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        try {
            const [project, story, versions] = await Promise.all([
                api.getProject(projectId),
                api.getStory(storyId),
                api.getStoryVersions(storyId),
            ]);

            this.mainContent.innerHTML = `
                <div class="container">
                    <div class="dashboard">
                        <div class="dashboard-header">
                            <div>
                                <a href="#/projects/${projectId}/stories" style="color: var(--color-text-muted); font-size: 13px;">← User Stories</a>
                                <h1>Story #${story.id}</h1>
                            </div>
                            <div style="display: flex; gap: var(--spacing-sm);">
                                <button class="btn btn-secondary" onclick="app.showEditStoryModal(${projectId}, ${storyId})">Upraviť</button>
                                <select class="form-select" style="width: auto;" onchange="app.changeStoryStatus(${storyId}, this.value)">
                                    <option value="draft" ${story.status === 'draft' ? 'selected' : ''}>Draft</option>
                                    <option value="pending_review" ${story.status === 'pending_review' ? 'selected' : ''}>Na schválenie</option>
                                    <option value="approved" ${story.status === 'approved' ? 'selected' : ''}>Schválené</option>
                                    <option value="in_progress" ${story.status === 'in_progress' ? 'selected' : ''}>V práci</option>
                                    <option value="testing" ${story.status === 'testing' ? 'selected' : ''}>Testovanie</option>
                                    <option value="done" ${story.status === 'done' ? 'selected' : ''}>Hotové</option>
                                    <option value="rejected" ${story.status === 'rejected' ? 'selected' : ''}>Zamietnuté</option>
                                </select>
                            </div>
                        </div>

                        <div class="card">
                            <div class="story-template-form">
                                <div class="form-group">
                                    <span class="template-prefix">Ako</span>
                                    <div style="flex: 1;">${this.escapeHtml(story.as_a)}</div>
                                </div>
                                <div class="form-group">
                                    <span class="template-prefix">chcem</span>
                                    <div style="flex: 1;">${this.escapeHtml(story.i_want_to)}</div>
                                </div>
                                <div class="form-group">
                                    <span class="template-prefix">aby som</span>
                                    <div style="flex: 1;">${this.escapeHtml(story.so_that)}</div>
                                </div>
                            </div>

                            ${story.acceptance_criteria ? `
                                <h4 style="margin-top: var(--spacing-md);">Akceptačné kritériá</h4>
                                <p style="white-space: pre-wrap;">${this.escapeHtml(story.acceptance_criteria)}</p>
                            ` : ''}

                            ${story.notes ? `
                                <h4 style="margin-top: var(--spacing-md);">Poznámky</h4>
                                <p style="white-space: pre-wrap;">${this.escapeHtml(story.notes)}</p>
                            ` : ''}

                            <div style="margin-top: var(--spacing-md); display: flex; gap: var(--spacing-md); flex-wrap: wrap;">
                                <div><strong>Priorita:</strong> <span class="badge badge-${story.priority}">${this.formatPriority(story.priority)}</span></div>
                                <div><strong>Story points:</strong> ${story.story_points || '-'}</div>
                                <div><strong>Priradené:</strong> ${story.assigned_to ? this.escapeHtml(story.assigned_to.full_name) : '-'}</div>
                                <div><strong>Verzia:</strong> ${story.version}</div>
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">Komentáre</h3>
                            </div>
                            <div id="comments">
                                ${story.comments.length > 0 ? story.comments.map(comment => `
                                    <div style="padding: var(--spacing-sm) 0; border-bottom: 1px solid var(--color-border);">
                                        <div style="display: flex; justify-content: space-between; margin-bottom: var(--spacing-xs);">
                                            <strong>${this.escapeHtml(comment.user.full_name)}</strong>
                                            <span style="color: var(--color-text-muted); font-size: 12px;">${this.formatDate(comment.created_at)}</span>
                                        </div>
                                        <p style="white-space: pre-wrap;">${this.escapeHtml(comment.content)}</p>
                                    </div>
                                `).join('') : '<p style="color: var(--color-text-muted);">Zatiaľ žiadne komentáre.</p>'}
                            </div>
                            <form id="commentForm" style="margin-top: var(--spacing-md);">
                                <div class="form-group">
                                    <textarea name="content" class="form-textarea" placeholder="Napíšte komentár..." rows="3"></textarea>
                                </div>
                                <button type="submit" class="btn btn-primary">Pridať komentár</button>
                            </form>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">Prílohy</h3>
                            </div>
                            <div id="attachmentsContainer">
                                <div class="attachments-grid" id="attachmentsGrid"></div>
                                <div class="file-upload-zone" id="uploadZone" onclick="document.getElementById('fileInput').click()">
                                    <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                                        <path d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16"/>
                                    </svg>
                                    <p>Kliknite alebo potiahnite súbory sem</p>
                                    <span class="hint">Obrázky, PDF, dokumenty (max 10MB)</span>
                                    <input type="file" id="fileInput" class="file-upload-input" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt">
                                </div>
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">História verzií</h3>
                            </div>
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>Verzia</th>
                                        <th>Zmena</th>
                                        <th>Autor</th>
                                        <th>Dátum</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${versions.map(v => `
                                        <tr>
                                            <td>v${v.version}</td>
                                            <td>${this.escapeHtml(v.change_summary || '-')}</td>
                                            <td>${this.escapeHtml(v.created_by.full_name)}</td>
                                            <td>${this.formatDate(v.created_at)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            // Load attachments
            this.loadAttachments(storyId);

            // File upload handlers
            const uploadZone = document.getElementById('uploadZone');
            const fileInput = document.getElementById('fileInput');

            uploadZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadZone.classList.add('dragover');
            });

            uploadZone.addEventListener('dragleave', () => {
                uploadZone.classList.remove('dragover');
            });

            uploadZone.addEventListener('drop', async (e) => {
                e.preventDefault();
                uploadZone.classList.remove('dragover');
                const files = e.dataTransfer.files;
                await this.uploadFiles(storyId, files);
            });

            fileInput.addEventListener('change', async (e) => {
                await this.uploadFiles(storyId, e.target.files);
                fileInput.value = '';
            });

            // Comment form
            document.getElementById('commentForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const content = e.target.querySelector('[name="content"]').value;
                if (!content.trim()) return;

                try {
                    await api.addStoryComment(storyId, content);
                    toast.success('Komentár pridaný');
                    this.renderStoryDetail(projectId, storyId);
                } catch (error) {
                    toast.error('Nepodarilo sa pridať komentár');
                }
            });
        } catch (error) {
            toast.error('Nepodarilo sa načítať story');
            console.error(error);
        }
    },

    async renderIssues(projectId) {
        this.mainContent.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        try {
            const [project, issuesData] = await Promise.all([
                api.getProject(projectId),
                api.getIssues(projectId),
            ]);

            this.mainContent.innerHTML = `
                <div class="container">
                    <div class="dashboard">
                        <div class="dashboard-header">
                            <div>
                                <a href="#/projects/${projectId}" style="color: var(--color-text-muted); font-size: 13px;">← ${this.escapeHtml(project.name)}</a>
                                <h1>Issues</h1>
                            </div>
                            <button class="btn btn-primary" onclick="app.showNewIssueModal(${projectId})">Nový issue</button>
                        </div>

                        <div class="filters">
                            <button class="filter-btn active" data-status="">Všetky</button>
                            <button class="filter-btn" data-status="open">Otvorené</button>
                            <button class="filter-btn" data-status="in_progress">V práci</button>
                            <button class="filter-btn" data-status="resolved">Vyriešené</button>
                            <button class="filter-btn" data-status="closed">Zatvorené</button>
                        </div>

                        ${issuesData.items.length > 0 ? `
                            <div class="card">
                                <table class="table" id="issueTable">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Názov</th>
                                            <th>Typ</th>
                                            <th>Stav</th>
                                            <th>Priorita</th>
                                            <th>Priradené</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${issuesData.items.map(issue => this.renderIssueRow(issue, projectId)).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : `
                            <div class="empty-state">
                                <p>Zatiaľ nemáte žiadne issues.</p>
                                <button class="btn btn-primary" onclick="app.showNewIssueModal(${projectId})">Vytvoriť issue</button>
                            </div>
                        `}
                    </div>
                </div>
            `;

            // Filter buttons
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const status = btn.dataset.status;
                    const filtered = await api.getIssues(projectId, status ? { status } : {});
                    document.getElementById('issueTable').querySelector('tbody').innerHTML =
                        filtered.items.map(i => this.renderIssueRow(i, projectId)).join('');
                });
            });
        } catch (error) {
            toast.error('Nepodarilo sa načítať issues');
            console.error(error);
        }
    },

    renderIssueRow(issue, projectId) {
        return `
            <tr onclick="window.location.hash='#/projects/${projectId}/issues/${issue.id}'" style="cursor: pointer;">
                <td>#${issue.id}</td>
                <td>${this.escapeHtml(issue.title)}</td>
                <td><span class="badge">${this.formatIssueType(issue.type)}</span></td>
                <td><span class="badge badge-${issue.status}">${this.formatStatus(issue.status)}</span></td>
                <td><span class="badge badge-${issue.priority}">${this.formatPriority(issue.priority)}</span></td>
                <td>${issue.assigned_to ? this.escapeHtml(issue.assigned_to.full_name) : '-'}</td>
            </tr>
        `;
    },

    async renderIssueDetail(projectId, issueId) {
        this.mainContent.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        try {
            const [project, issue, versions] = await Promise.all([
                api.getProject(projectId),
                api.getIssue(issueId),
                api.get(`/issues/${issueId}/versions`),
            ]);

            this.mainContent.innerHTML = `
                <div class="container">
                    <div class="dashboard">
                        <div class="dashboard-header">
                            <div>
                                <a href="#/projects/${projectId}/issues" style="color: var(--color-text-muted); font-size: 13px;">← Issues</a>
                                <h1>${this.escapeHtml(issue.title)}</h1>
                            </div>
                            <div style="display: flex; gap: var(--spacing-sm);">
                                <button class="btn btn-secondary" onclick="app.showEditIssueModal(${projectId}, ${issueId})">Upraviť</button>
                                <select class="form-select" style="width: auto;" onchange="app.changeIssueStatus(${issueId}, this.value)">
                                    <option value="open" ${issue.status === 'open' ? 'selected' : ''}>Otvorený</option>
                                    <option value="in_progress" ${issue.status === 'in_progress' ? 'selected' : ''}>V práci</option>
                                    <option value="resolved" ${issue.status === 'resolved' ? 'selected' : ''}>Vyriešený</option>
                                    <option value="closed" ${issue.status === 'closed' ? 'selected' : ''}>Zatvorený</option>
                                    <option value="wont_fix" ${issue.status === 'wont_fix' ? 'selected' : ''}>Neopravíme</option>
                                </select>
                            </div>
                        </div>

                        <div class="card">
                            <p style="white-space: pre-wrap;">${this.escapeHtml(issue.description || 'Bez popisu')}</p>

                            <div style="margin-top: var(--spacing-md); display: flex; gap: var(--spacing-md); flex-wrap: wrap;">
                                <div><strong>Typ:</strong> <span class="badge">${this.formatIssueType(issue.type)}</span></div>
                                <div><strong>Priorita:</strong> <span class="badge badge-${issue.priority}">${this.formatPriority(issue.priority)}</span></div>
                                <div><strong>Priradené:</strong> ${issue.assigned_to ? this.escapeHtml(issue.assigned_to.full_name) : '-'}</div>
                                ${issue.related_story_id ? `<div><strong>Súvisiaca story:</strong> <a href="#/projects/${projectId}/stories/${issue.related_story_id}">#${issue.related_story_id}</a></div>` : ''}
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">Komentáre</h3>
                            </div>
                            <div id="comments">
                                ${issue.comments.length > 0 ? issue.comments.map(comment => `
                                    <div style="padding: var(--spacing-sm) 0; border-bottom: 1px solid var(--color-border);">
                                        <div style="display: flex; justify-content: space-between; margin-bottom: var(--spacing-xs);">
                                            <strong>${this.escapeHtml(comment.user.full_name)}</strong>
                                            <span style="color: var(--color-text-muted); font-size: 12px;">${this.formatDate(comment.created_at)}</span>
                                        </div>
                                        <p style="white-space: pre-wrap;">${this.escapeHtml(comment.content)}</p>
                                    </div>
                                `).join('') : '<p style="color: var(--color-text-muted);">Zatiaľ žiadne komentáre.</p>'}
                            </div>
                            <form id="commentForm" style="margin-top: var(--spacing-md);">
                                <div class="form-group">
                                    <textarea name="content" class="form-textarea" placeholder="Napíšte komentár..." rows="3"></textarea>
                                </div>
                                <button type="submit" class="btn btn-primary">Pridať komentár</button>
                            </form>
                        </div>
                    </div>
                </div>
            `;

            // Comment form
            document.getElementById('commentForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const content = e.target.querySelector('[name="content"]').value;
                if (!content.trim()) return;

                try {
                    await api.addIssueComment(issueId, content);
                    toast.success('Komentár pridaný');
                    this.renderIssueDetail(projectId, issueId);
                } catch (error) {
                    toast.error('Nepodarilo sa pridať komentár');
                }
            });
        } catch (error) {
            toast.error('Nepodarilo sa načítať issue');
            console.error(error);
        }
    },

    render404() {
        this.mainContent.innerHTML = `
            <div class="container">
                <div class="empty-state" style="padding-top: var(--spacing-xl);">
                    <h1>404</h1>
                    <p>Stránka nenájdená</p>
                    <a href="#/dashboard" class="btn btn-primary">Späť na dashboard</a>
                </div>
            </div>
        `;
    },

    // User Management (Admin only)
    async renderUsers() {
        if (!auth.isAdmin()) {
            window.location.hash = '#/dashboard';
            return;
        }

        this.mainContent.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        try {
            const usersData = await api.getUsers();

            this.mainContent.innerHTML = `
                <div class="container users-page">
                    <div class="dashboard">
                        <div class="dashboard-header">
                            <h1>Správa používateľov</h1>
                            <button class="btn btn-primary" onclick="app.showNewUserModal()">Nový používateľ</button>
                        </div>

                        <div class="card">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>Používateľ</th>
                                        <th>Email</th>
                                        <th>Rola</th>
                                        <th>Stav</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${usersData.items.map(user => `
                                        <tr>
                                            <td>
                                                <div class="user-row">
                                                    <div class="user-avatar">${this.getInitials(user.full_name)}</div>
                                                    <div class="user-info">
                                                        <div class="user-name">${this.escapeHtml(user.full_name)}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>${this.escapeHtml(user.email)}</td>
                                            <td><span class="badge">${this.formatUserRole(user.role)}</span></td>
                                            <td><span class="badge badge-${user.is_active ? 'done' : 'draft'}">${user.is_active ? 'Aktívny' : 'Neaktívny'}</span></td>
                                            <td>
                                                <button class="btn btn-sm btn-secondary" onclick="app.showEditUserModal(${user.id})">Upraviť</button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            toast.error('Nepodarilo sa načítať používateľov');
            console.error(error);
        }
    },

    showNewUserModal() {
        modal.show({
            title: 'Nový používateľ',
            content: `
                <form id="newUserForm">
                    <div class="user-form-grid">
                        <div class="form-group">
                            <label class="form-label">Meno</label>
                            <input type="text" name="full_name" class="form-input" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Email</label>
                            <input type="email" name="email" class="form-input" required>
                        </div>
                    </div>
                    <div class="user-form-grid">
                        <div class="form-group">
                            <label class="form-label">Heslo</label>
                            <input type="password" name="password" class="form-input" required minlength="6">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Rola</label>
                            <select name="role" class="form-select">
                                <option value="customer">Zákazník</option>
                                <option value="employee">Zamestnanec</option>
                                <option value="admin">Administrátor</option>
                            </select>
                        </div>
                    </div>
                </form>
            `,
            footer: `
                <button class="btn btn-secondary" onclick="modal.hide()">Zrušiť</button>
                <button class="btn btn-primary" onclick="app.createUser()">Vytvoriť</button>
            `,
        });
    },

    async createUser() {
        const formEl = document.getElementById('newUserForm');
        const data = form.getData(formEl);

        try {
            await api.createUser(data);
            modal.hide();
            toast.success('Používateľ vytvorený');
            this.renderUsers();
        } catch (error) {
            toast.error(error.message);
        }
    },

    async showEditUserModal(userId) {
        try {
            const user = await api.getUser(userId);
            modal.show({
                title: 'Upraviť používateľa',
                content: `
                    <form id="editUserForm">
                        <div class="user-form-grid">
                            <div class="form-group">
                                <label class="form-label">Meno</label>
                                <input type="text" name="full_name" class="form-input" value="${this.escapeHtml(user.full_name)}" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Email</label>
                                <input type="email" name="email" class="form-input" value="${this.escapeHtml(user.email)}" required>
                            </div>
                        </div>
                        <div class="user-form-grid">
                            <div class="form-group">
                                <label class="form-label">Rola</label>
                                <select name="role" class="form-select">
                                    <option value="customer" ${user.role === 'customer' ? 'selected' : ''}>Zákazník</option>
                                    <option value="employee" ${user.role === 'employee' ? 'selected' : ''}>Zamestnanec</option>
                                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrátor</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Stav</label>
                                <select name="is_active" class="form-select">
                                    <option value="true" ${user.is_active ? 'selected' : ''}>Aktívny</option>
                                    <option value="false" ${!user.is_active ? 'selected' : ''}>Neaktívny</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Nové heslo (voliteľné)</label>
                            <input type="password" name="password" class="form-input" minlength="6" placeholder="Ponechajte prázdne ak nechcete zmeniť">
                        </div>
                    </form>
                `,
                footer: `
                    <button class="btn btn-secondary" onclick="modal.hide()">Zrušiť</button>
                    <button class="btn btn-primary" onclick="app.updateUser(${userId})">Uložiť</button>
                `,
            });
        } catch (error) {
            toast.error('Nepodarilo sa načítať používateľa');
        }
    },

    async updateUser(userId) {
        const formEl = document.getElementById('editUserForm');
        const data = form.getData(formEl);

        // Convert is_active to boolean
        data.is_active = data.is_active === 'true';

        // Remove empty password
        if (!data.password) {
            delete data.password;
        }

        try {
            await api.updateUser(userId, data);
            modal.hide();
            toast.success('Používateľ aktualizovaný');
            this.renderUsers();
        } catch (error) {
            toast.error(error.message);
        }
    },

    getInitials(name) {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    },

    formatUserRole(role) {
        const map = {
            admin: 'Administrátor',
            employee: 'Zamestnanec',
            customer: 'Zákazník',
        };
        return map[role] || role;
    },

    // Modals
    showNewProjectModal() {
        modal.show({
            title: 'Nový projekt',
            content: `
                <form id="newProjectForm">
                    <div class="form-group">
                        <label class="form-label">Názov projektu</label>
                        <input type="text" name="name" class="form-input" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Popis</label>
                        <textarea name="description" class="form-textarea"></textarea>
                    </div>
                </form>
            `,
            footer: `
                <button class="btn btn-secondary" onclick="modal.hide()">Zrušiť</button>
                <button class="btn btn-primary" onclick="app.createProject()">Vytvoriť</button>
            `,
        });
    },

    async createProject() {
        const formEl = document.getElementById('newProjectForm');
        const data = form.getData(formEl);

        try {
            const project = await api.createProject(data);
            modal.hide();
            toast.success('Projekt vytvorený');
            window.location.hash = `#/projects/${project.id}`;
        } catch (error) {
            toast.error(error.message);
        }
    },

    async showEditProjectModal(projectId) {
        try {
            const project = await api.getProject(projectId);
            modal.show({
                title: 'Upraviť projekt',
                content: `
                    <form id="editProjectForm">
                        <div class="form-group">
                            <label class="form-label">Názov projektu</label>
                            <input type="text" name="name" class="form-input" value="${this.escapeHtml(project.name)}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Popis</label>
                            <textarea name="description" class="form-textarea">${this.escapeHtml(project.description || '')}</textarea>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Stav</label>
                            <select name="status" class="form-select">
                                <option value="active" ${project.status === 'active' ? 'selected' : ''}>Aktívny</option>
                                <option value="on_hold" ${project.status === 'on_hold' ? 'selected' : ''}>Pozastavený</option>
                                <option value="completed" ${project.status === 'completed' ? 'selected' : ''}>Dokončený</option>
                                <option value="archived" ${project.status === 'archived' ? 'selected' : ''}>Archivovaný</option>
                            </select>
                        </div>
                    </form>
                `,
                footer: `
                    <button class="btn btn-secondary" onclick="modal.hide()">Zrušiť</button>
                    <button class="btn btn-primary" onclick="app.updateProject(${projectId})">Uložiť</button>
                `,
            });
        } catch (error) {
            toast.error('Nepodarilo sa načítať projekt');
        }
    },

    async updateProject(projectId) {
        const formEl = document.getElementById('editProjectForm');
        const data = form.getData(formEl);

        try {
            await api.updateProject(projectId, data);
            modal.hide();
            toast.success('Projekt aktualizovaný');
            this.renderProjectDetail(projectId);
        } catch (error) {
            toast.error(error.message);
        }
    },

    async showAddMemberModal(projectId) {
        try {
            const users = await api.getUsers();
            const project = await api.getProject(projectId);

            // Filter out users who are already members or owner
            const existingMemberIds = [project.owner.id, ...project.members.map(m => m.user_id)];
            const availableUsers = users.items.filter(u => !existingMemberIds.includes(u.id));

            if (availableUsers.length === 0) {
                toast.info('Všetci používatelia sú už členmi projektu');
                return;
            }

            modal.show({
                title: 'Pridať člena',
                content: `
                    <form id="addMemberForm">
                        <div class="form-group">
                            <label class="form-label">Používateľ</label>
                            <select name="user_id" class="form-select" required>
                                ${availableUsers.map(u => `<option value="${u.id}">${this.escapeHtml(u.full_name)} (${this.escapeHtml(u.email)})</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Rola</label>
                            <select name="role" class="form-select">
                                <option value="member">Člen</option>
                                <option value="viewer">Sledovateľ</option>
                            </select>
                        </div>
                    </form>
                `,
                footer: `
                    <button class="btn btn-secondary" onclick="modal.hide()">Zrušiť</button>
                    <button class="btn btn-primary" onclick="app.addMember(${projectId})">Pridať</button>
                `,
            });
        } catch (error) {
            toast.error('Nepodarilo sa načítať používateľov');
        }
    },

    async addMember(projectId) {
        const formEl = document.getElementById('addMemberForm');
        const data = form.getData(formEl);

        try {
            await api.addProjectMember(projectId, parseInt(data.user_id), data.role);
            modal.hide();
            toast.success('Člen pridaný');
            this.renderProjectDetail(projectId);
        } catch (error) {
            toast.error(error.message);
        }
    },

    async removeMember(projectId, userId) {
        if (!confirm('Naozaj chcete odstrániť tohto člena z projektu?')) return;

        try {
            await api.removeProjectMember(projectId, userId);
            toast.success('Člen odstránený');
            this.renderProjectDetail(projectId);
        } catch (error) {
            toast.error(error.message);
        }
    },

    // Story Editor State
    storyEditorState: {
        projectId: null,
        storyId: null,
        currentStep: 1,
        data: {
            as_a: '',
            i_want_to: '',
            so_that: '',
            acceptance_criteria: [],
            priority: 'medium',
            story_points: null,
            notes: ''
        },
        pendingFiles: []
    },

    showNewStoryModal(projectId) {
        this.storyEditorState = {
            projectId,
            storyId: null,
            currentStep: 1,
            data: {
                as_a: '',
                i_want_to: '',
                so_that: '',
                acceptance_criteria: [],
                priority: 'medium',
                story_points: null,
                notes: ''
            },
            pendingFiles: []
        };
        this.openStoryEditor('Nová User Story');
    },

    async showEditStoryModal(projectId, storyId) {
        try {
            const story = await api.getStory(storyId);
            const criteria = story.acceptance_criteria
                ? story.acceptance_criteria.split('\n').filter(c => c.trim())
                : [];

            this.storyEditorState = {
                projectId,
                storyId,
                currentStep: 1,
                data: {
                    as_a: story.as_a || '',
                    i_want_to: story.i_want_to || '',
                    so_that: story.so_that || '',
                    acceptance_criteria: criteria,
                    priority: story.priority || 'medium',
                    story_points: story.story_points || null,
                    notes: story.notes || ''
                },
                pendingFiles: []
            };
            this.openStoryEditor('Upraviť Story #' + storyId);
        } catch (error) {
            toast.error('Nepodarilo sa načítať story');
        }
    },

    openStoryEditor(title) {
        // Remove existing overlay
        const existing = document.querySelector('.story-editor-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'story-editor-overlay';
        overlay.innerHTML = `
            <div class="story-editor-panel">
                <div class="story-editor-header">
                    <h2>
                        ${title}
                        <span class="badge badge-draft">Draft</span>
                    </h2>
                    <button class="story-editor-close" onclick="app.closeStoryEditor()">
                        <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>

                <div class="story-editor-steps">
                    <div class="story-step active" data-step="1" onclick="app.goToStep(1)">
                        <span class="story-step-number">1</span>
                        <span class="story-step-label">Príbeh</span>
                    </div>
                    <div class="story-step" data-step="2" onclick="app.goToStep(2)">
                        <span class="story-step-number">2</span>
                        <span class="story-step-label">Kritériá</span>
                    </div>
                    <div class="story-step" data-step="3" onclick="app.goToStep(3)">
                        <span class="story-step-number">3</span>
                        <span class="story-step-label">Detaily</span>
                    </div>
                </div>

                <div class="story-editor-content">
                    <div class="story-editor-form">
                        <!-- Step 1: Story Template -->
                        <div class="story-step-panel active" data-panel="1">
                            <div class="story-input-group">
                                <div class="story-input-label">
                                    <span class="story-input-prefix">Ako</span>
                                    <span class="story-input-hint">Kto je používateľ?</span>
                                </div>
                                <textarea
                                    class="story-input-field"
                                    id="storyAsA"
                                    placeholder="zákazník / admin / registrovaný používateľ..."
                                    oninput="app.updateStoryPreview()"
                                >${this.escapeHtml(this.storyEditorState.data.as_a)}</textarea>
                            </div>

                            <div class="story-input-group">
                                <div class="story-input-label">
                                    <span class="story-input-prefix">Chcem</span>
                                    <span class="story-input-hint">Čo chce používateľ urobiť?</span>
                                </div>
                                <textarea
                                    class="story-input-field"
                                    id="storyIWantTo"
                                    placeholder="vidieť prehľad mojich objednávok..."
                                    oninput="app.updateStoryPreview()"
                                >${this.escapeHtml(this.storyEditorState.data.i_want_to)}</textarea>
                            </div>

                            <div class="story-input-group">
                                <div class="story-input-label">
                                    <span class="story-input-prefix">Aby som</span>
                                    <span class="story-input-hint">Aký je prínos/hodnota?</span>
                                </div>
                                <textarea
                                    class="story-input-field"
                                    id="storySoThat"
                                    placeholder="mohol sledovať stav dodania..."
                                    oninput="app.updateStoryPreview()"
                                >${this.escapeHtml(this.storyEditorState.data.so_that)}</textarea>
                            </div>
                        </div>

                        <!-- Step 2: Acceptance Criteria -->
                        <div class="story-step-panel" data-panel="2">
                            <h3 style="margin-bottom: var(--spacing-md);">Akceptačné kritériá</h3>
                            <p style="color: var(--color-text-muted); margin-bottom: var(--spacing-md); font-size: 13px;">
                                Definujte podmienky, ktoré musia byť splnené, aby bola story považovaná za hotovú.
                            </p>

                            <div class="criteria-list" id="criteriaList">
                                ${this.renderCriteriaItems()}
                            </div>

                            <button type="button" class="add-criteria-btn" onclick="app.addCriterion()">
                                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M8 4v8M4 8h8"/>
                                </svg>
                                Pridať kritérium
                            </button>
                        </div>

                        <!-- Step 3: Details -->
                        <div class="story-step-panel" data-panel="3">
                            <h3 style="margin-bottom: var(--spacing-md);">Detaily</h3>

                            <div class="details-grid">
                                <div class="form-group">
                                    <label class="form-label">Priorita</label>
                                    <select id="storyPriority" class="form-select" onchange="app.updateStoryPreview()">
                                        <option value="low" ${this.storyEditorState.data.priority === 'low' ? 'selected' : ''}>Nízka</option>
                                        <option value="medium" ${this.storyEditorState.data.priority === 'medium' ? 'selected' : ''}>Stredná</option>
                                        <option value="high" ${this.storyEditorState.data.priority === 'high' ? 'selected' : ''}>Vysoká</option>
                                        <option value="critical" ${this.storyEditorState.data.priority === 'critical' ? 'selected' : ''}>Kritická</option>
                                    </select>
                                </div>

                                <div class="form-group">
                                    <label class="form-label">Story Points</label>
                                    <input
                                        type="number"
                                        id="storyPoints"
                                        class="form-input"
                                        min="1"
                                        max="100"
                                        value="${this.storyEditorState.data.story_points || ''}"
                                        placeholder="1, 2, 3, 5, 8, 13..."
                                        onchange="app.updateStoryPreview()"
                                    >
                                </div>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Poznámky</label>
                                <textarea
                                    id="storyNotes"
                                    class="form-textarea"
                                    rows="3"
                                    placeholder="Dodatočné informácie, technické poznámky..."
                                    oninput="app.updateStoryPreview()"
                                >${this.escapeHtml(this.storyEditorState.data.notes)}</textarea>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Prílohy</label>
                                <div class="pending-files-list" id="pendingFilesList"></div>
                                <div class="file-upload-zone file-upload-zone-sm" id="storyEditorUploadZone">
                                    <svg width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                                        <path d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16"/>
                                    </svg>
                                    <p>Kliknite alebo potiahnite súbory</p>
                                    <span class="hint">Obrázky, PDF, dokumenty (max 10MB)</span>
                                    <input type="file" id="storyEditorFileInput" class="file-upload-input" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt">
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="story-editor-preview">
                        <h4>Náhľad story</h4>
                        <div class="story-preview-card" id="storyPreviewCard">
                            ${this.renderStoryPreview()}
                        </div>
                    </div>
                </div>

                <div class="story-editor-footer">
                    <div class="story-editor-footer-left">
                        <button class="btn btn-secondary" id="prevStepBtn" onclick="app.prevStep()" style="display: none;">
                            ← Späť
                        </button>
                    </div>
                    <div class="story-editor-footer-right">
                        <button class="btn btn-secondary" onclick="app.closeStoryEditor()">Zrušiť</button>
                        <button class="btn btn-primary" id="nextStepBtn" onclick="app.nextStep()">
                            Pokračovať →
                        </button>
                        <button class="btn btn-primary" id="saveStoryBtn" onclick="app.saveStory()" style="display: none;">
                            ${this.storyEditorState.storyId ? 'Uložiť zmeny' : 'Vytvoriť story'}
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Animate in
        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });

        // Focus first input
        setTimeout(() => {
            document.getElementById('storyAsA')?.focus();
        }, 300);

        // Keyboard shortcuts
        overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeStoryEditor();
            }
            if (e.key === 'Enter' && e.ctrlKey) {
                this.saveStory();
            }
        });

        // File upload handlers for story editor
        this.setupStoryEditorFileUpload();
    },

    setupStoryEditorFileUpload() {
        const uploadZone = document.getElementById('storyEditorUploadZone');
        const fileInput = document.getElementById('storyEditorFileInput');

        if (!uploadZone || !fileInput) return;

        uploadZone.addEventListener('click', (e) => {
            if (e.target !== fileInput) {
                fileInput.click();
            }
        });

        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });

        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('dragover');
        });

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            this.addPendingFiles(e.dataTransfer.files);
        });

        fileInput.addEventListener('change', (e) => {
            this.addPendingFiles(e.target.files);
            fileInput.value = '';
        });

        // Render existing pending files
        this.renderPendingFiles();
    },

    addPendingFiles(files) {
        for (const file of files) {
            if (file.size > 10 * 1024 * 1024) {
                toast.error(`Súbor ${file.name} je príliš veľký (max 10MB)`);
                continue;
            }
            // Check for duplicates
            if (!this.storyEditorState.pendingFiles.some(f => f.name === file.name && f.size === file.size)) {
                this.storyEditorState.pendingFiles.push(file);
            }
        }
        this.renderPendingFiles();
    },

    removePendingFile(index) {
        this.storyEditorState.pendingFiles.splice(index, 1);
        this.renderPendingFiles();
    },

    renderPendingFiles() {
        const list = document.getElementById('pendingFilesList');
        if (!list) return;

        const files = this.storyEditorState.pendingFiles;
        if (files.length === 0) {
            list.innerHTML = '';
            return;
        }

        list.innerHTML = files.map((file, i) => `
            <div class="pending-file-item">
                <div class="pending-file-icon">
                    ${this.isImageFile(file.name) ? `
                        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21,15 16,10 5,21"/>
                        </svg>
                    ` : `
                        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                            <polyline points="14,2 14,8 20,8"/>
                        </svg>
                    `}
                </div>
                <div class="pending-file-info">
                    <span class="pending-file-name">${this.escapeHtml(file.name)}</span>
                    <span class="pending-file-size">${this.formatFileSize(file.size)}</span>
                </div>
                <button type="button" class="pending-file-remove" onclick="app.removePendingFile(${i})">
                    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        `).join('');
    },

    renderCriteriaItems() {
        const criteria = this.storyEditorState.data.acceptance_criteria;
        if (criteria.length === 0) {
            return `
                <div class="criteria-item">
                    <input type="checkbox" class="criteria-checkbox">
                    <input type="text" class="criteria-input" placeholder="Keď..., tak..." oninput="app.updateCriterion(0, this.value)">
                    <button type="button" class="criteria-remove" onclick="app.removeCriterion(0)">
                        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 4l8 8M12 4l-8 8"/>
                        </svg>
                    </button>
                </div>
            `;
        }
        return criteria.map((c, i) => `
            <div class="criteria-item">
                <input type="checkbox" class="criteria-checkbox">
                <input type="text" class="criteria-input" value="${this.escapeHtml(c)}" placeholder="Keď..., tak..." oninput="app.updateCriterion(${i}, this.value)">
                <button type="button" class="criteria-remove" onclick="app.removeCriterion(${i})">
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M4 4l8 8M12 4l-8 8"/>
                    </svg>
                </button>
            </div>
        `).join('');
    },

    renderStoryPreview() {
        const d = this.storyEditorState.data;
        return `
            <div class="story-line">
                <strong>Ako</strong> ${d.as_a || '<span class="placeholder">typ používateľa</span>'}
            </div>
            <div class="story-line">
                <strong>chcem</strong> ${d.i_want_to || '<span class="placeholder">akcia/funkcionalita</span>'}
            </div>
            <div class="story-line">
                <strong>aby som</strong> ${d.so_that || '<span class="placeholder">prínos/hodnota</span>'}
            </div>
            ${d.acceptance_criteria.filter(c => c).length > 0 ? `
                <div style="margin-top: var(--spacing-md); padding-top: var(--spacing-md); border-top: 1px solid var(--color-border);">
                    <strong style="font-size: 11px; text-transform: uppercase; color: var(--color-text-muted);">Kritériá</strong>
                    <ul style="margin-top: var(--spacing-xs); padding-left: var(--spacing-md); font-size: 12px; color: var(--color-text-light);">
                        ${d.acceptance_criteria.filter(c => c).map(c => `<li>${this.escapeHtml(c)}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            <div class="story-preview-meta">
                <span class="badge badge-${d.priority}">${this.formatPriority(d.priority)}</span>
                ${d.story_points ? `<span class="badge">${d.story_points} SP</span>` : ''}
            </div>
        `;
    },

    updateStoryPreview() {
        const asA = document.getElementById('storyAsA')?.value || '';
        const iWantTo = document.getElementById('storyIWantTo')?.value || '';
        const soThat = document.getElementById('storySoThat')?.value || '';
        const priority = document.getElementById('storyPriority')?.value || 'medium';
        const storyPoints = document.getElementById('storyPoints')?.value || null;
        const notes = document.getElementById('storyNotes')?.value || '';

        this.storyEditorState.data = {
            ...this.storyEditorState.data,
            as_a: asA,
            i_want_to: iWantTo,
            so_that: soThat,
            priority,
            story_points: storyPoints ? parseInt(storyPoints) : null,
            notes
        };

        const preview = document.getElementById('storyPreviewCard');
        if (preview) {
            preview.innerHTML = this.renderStoryPreview();
        }
    },

    updateCriterion(index, value) {
        if (!this.storyEditorState.data.acceptance_criteria[index] && value) {
            this.storyEditorState.data.acceptance_criteria[index] = value;
        } else {
            this.storyEditorState.data.acceptance_criteria[index] = value;
        }
        this.updateStoryPreview();
    },

    addCriterion() {
        this.storyEditorState.data.acceptance_criteria.push('');
        const list = document.getElementById('criteriaList');
        if (list) {
            list.innerHTML = this.renderCriteriaItems();
            // Focus last input
            const inputs = list.querySelectorAll('.criteria-input');
            inputs[inputs.length - 1]?.focus();
        }
    },

    removeCriterion(index) {
        this.storyEditorState.data.acceptance_criteria.splice(index, 1);
        const list = document.getElementById('criteriaList');
        if (list) {
            list.innerHTML = this.renderCriteriaItems();
        }
        this.updateStoryPreview();
    },

    goToStep(step) {
        this.storyEditorState.currentStep = step;
        this.updateStepUI();
    },

    nextStep() {
        if (this.storyEditorState.currentStep < 3) {
            this.updateStoryPreview();
            this.storyEditorState.currentStep++;
            this.updateStepUI();
        }
    },

    prevStep() {
        if (this.storyEditorState.currentStep > 1) {
            this.updateStoryPreview();
            this.storyEditorState.currentStep--;
            this.updateStepUI();
        }
    },

    updateStepUI() {
        const step = this.storyEditorState.currentStep;

        // Update step indicators
        document.querySelectorAll('.story-step').forEach((el, i) => {
            el.classList.remove('active', 'completed');
            if (i + 1 === step) {
                el.classList.add('active');
            } else if (i + 1 < step) {
                el.classList.add('completed');
            }
        });

        // Update panels
        document.querySelectorAll('.story-step-panel').forEach((el) => {
            el.classList.remove('active');
            if (parseInt(el.dataset.panel) === step) {
                el.classList.add('active');
            }
        });

        // Update buttons
        const prevBtn = document.getElementById('prevStepBtn');
        const nextBtn = document.getElementById('nextStepBtn');
        const saveBtn = document.getElementById('saveStoryBtn');

        if (prevBtn) prevBtn.style.display = step > 1 ? 'inline-flex' : 'none';
        if (nextBtn) nextBtn.style.display = step < 3 ? 'inline-flex' : 'none';
        if (saveBtn) saveBtn.style.display = step === 3 ? 'inline-flex' : 'none';
    },

    closeStoryEditor() {
        const overlay = document.querySelector('.story-editor-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 300);
        }
    },

    async saveStory() {
        this.updateStoryPreview();

        const data = {
            as_a: this.storyEditorState.data.as_a,
            i_want_to: this.storyEditorState.data.i_want_to,
            so_that: this.storyEditorState.data.so_that,
            acceptance_criteria: this.storyEditorState.data.acceptance_criteria.filter(c => c).join('\n'),
            priority: this.storyEditorState.data.priority,
            notes: this.storyEditorState.data.notes
        };

        if (this.storyEditorState.data.story_points) {
            data.story_points = parseInt(this.storyEditorState.data.story_points);
        }

        try {
            let storyId = this.storyEditorState.storyId;

            if (storyId) {
                await api.updateStory(storyId, data);
                toast.success('Story aktualizovaná');
            } else {
                const newStory = await api.createStory(this.storyEditorState.projectId, data);
                storyId = newStory.id;
                toast.success('Story vytvorená');
            }

            // Upload pending files
            if (this.storyEditorState.pendingFiles.length > 0) {
                for (const file of this.storyEditorState.pendingFiles) {
                    try {
                        await api.uploadStoryAttachment(storyId, file);
                    } catch (error) {
                        toast.error(`Nepodarilo sa nahrať ${file.name}`);
                    }
                }
                if (this.storyEditorState.pendingFiles.length > 0) {
                    toast.success(`${this.storyEditorState.pendingFiles.length} príloha(y) nahraná(é)`);
                }
            }

            this.closeStoryEditor();

            if (this.storyEditorState.storyId) {
                this.renderStoryDetail(this.storyEditorState.projectId, storyId);
            } else {
                this.renderStories(this.storyEditorState.projectId);
            }
        } catch (error) {
            toast.error(error.message);
        }
    },

    showNewIssueModal(projectId) {
        modal.show({
            title: 'Nový Issue',
            content: `
                <form id="newIssueForm">
                    <div class="form-group">
                        <label class="form-label">Názov</label>
                        <input type="text" name="title" class="form-input" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Popis</label>
                        <textarea name="description" class="form-textarea"></textarea>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md);">
                        <div class="form-group">
                            <label class="form-label">Typ</label>
                            <select name="type" class="form-select">
                                <option value="bug">Bug</option>
                                <option value="task" selected>Úloha</option>
                                <option value="improvement">Vylepšenie</option>
                                <option value="question">Otázka</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Priorita</label>
                            <select name="priority" class="form-select">
                                <option value="low">Nízka</option>
                                <option value="medium" selected>Stredná</option>
                                <option value="high">Vysoká</option>
                                <option value="critical">Kritická</option>
                            </select>
                        </div>
                    </div>
                </form>
            `,
            footer: `
                <button class="btn btn-secondary" onclick="modal.hide()">Zrušiť</button>
                <button class="btn btn-primary" onclick="app.createIssue(${projectId})">Vytvoriť</button>
            `,
        });
    },

    async createIssue(projectId) {
        const formEl = document.getElementById('newIssueForm');
        const data = form.getData(formEl);

        try {
            await api.createIssue(projectId, data);
            modal.hide();
            toast.success('Issue vytvorený');
            this.renderIssues(projectId);
        } catch (error) {
            toast.error(error.message);
        }
    },

    async changeStoryStatus(storyId, status) {
        try {
            await api.updateStoryStatus(storyId, status);
            toast.success('Stav zmenený');
        } catch (error) {
            toast.error(error.message);
        }
    },

    async changeIssueStatus(issueId, status) {
        try {
            await api.updateIssueStatus(issueId, status);
            toast.success('Stav zmenený');
        } catch (error) {
            toast.error(error.message);
        }
    },

    // Utility functions
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('sk-SK', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    },

    formatStatus(status) {
        const map = {
            draft: 'Draft',
            pending_review: 'Na schválenie',
            approved: 'Schválené',
            in_progress: 'V práci',
            testing: 'Testovanie',
            done: 'Hotové',
            rejected: 'Zamietnuté',
            active: 'Aktívny',
            on_hold: 'Pozastavený',
            completed: 'Dokončený',
            archived: 'Archivovaný',
            open: 'Otvorený',
            resolved: 'Vyriešený',
            closed: 'Zatvorený',
            wont_fix: 'Neopravíme',
        };
        return map[status] || status;
    },

    formatPriority(priority) {
        const map = {
            low: 'Nízka',
            medium: 'Stredná',
            high: 'Vysoká',
            critical: 'Kritická',
        };
        return map[priority] || priority;
    },

    formatIssueType(type) {
        const map = {
            bug: 'Bug',
            task: 'Úloha',
            improvement: 'Vylepšenie',
            question: 'Otázka',
        };
        return map[type] || type;
    },

    formatMemberRole(role) {
        const map = {
            owner: 'Vlastník',
            member: 'Člen',
            viewer: 'Sledovateľ',
        };
        return map[role] || role;
    },

    // Attachments
    async loadAttachments(storyId) {
        try {
            const attachments = await api.getStoryAttachments(storyId);
            this.renderAttachments(storyId, attachments);
        } catch (error) {
            console.log('No attachments or error:', error);
            this.renderAttachments(storyId, []);
        }
    },

    renderAttachments(storyId, attachments) {
        const grid = document.getElementById('attachmentsGrid');
        if (!grid) return;

        if (attachments.length === 0) {
            grid.innerHTML = '<p style="color: var(--color-text-muted); text-align: center; padding: var(--spacing-md);">Zatiaľ žiadne prílohy</p>';
            return;
        }

        grid.innerHTML = attachments.map(att => `
            <div class="attachment-card">
                <div class="attachment-preview">
                    ${this.isImageFile(att.filename)
                        ? `<img src="/api/stories/${storyId}/attachments/${att.id}/download" alt="${this.escapeHtml(att.filename)}">`
                        : `<svg class="file-icon" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>`
                    }
                </div>
                <div class="attachment-info">
                    <div class="attachment-name" title="${this.escapeHtml(att.filename)}">${this.escapeHtml(att.filename)}</div>
                    <div class="attachment-meta">${this.formatFileSize(att.size)}</div>
                    <div class="attachment-actions">
                        <a href="/api/stories/${storyId}/attachments/${att.id}/download" class="btn btn-sm btn-secondary" download>Stiahnuť</a>
                        <button class="btn btn-sm btn-secondary" onclick="app.deleteAttachment(${storyId}, ${att.id})">Zmazať</button>
                    </div>
                </div>
            </div>
        `).join('');
    },

    async uploadFiles(storyId, files) {
        for (const file of files) {
            if (file.size > 10 * 1024 * 1024) {
                toast.error(`Súbor ${file.name} je príliš veľký (max 10MB)`);
                continue;
            }

            try {
                toast.info(`Nahrávam ${file.name}...`);
                await api.uploadStoryAttachment(storyId, file);
                toast.success(`${file.name} nahraný`);
            } catch (error) {
                toast.error(`Nepodarilo sa nahrať ${file.name}`);
            }
        }
        this.loadAttachments(storyId);
    },

    async deleteAttachment(storyId, attachmentId) {
        if (!confirm('Naozaj chcete zmazať túto prílohu?')) return;

        try {
            await api.deleteStoryAttachment(storyId, attachmentId);
            toast.success('Príloha zmazaná');
            this.loadAttachments(storyId);
        } catch (error) {
            toast.error('Nepodarilo sa zmazať prílohu');
        }
    },

    isImageFile(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
    },

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    },
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
